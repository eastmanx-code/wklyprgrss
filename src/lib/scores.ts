import "server-only";

import { latestByItem, statusFor } from "./status";
import { db } from "./supabase";
import type { Submission, WeekStatus } from "./types";
import { deadlineFor, isDeadlinePassed, weekEnding } from "./week";

/**
 * One venue's week, flattened for a warehouse.
 *
 * Every figure here is computed by the same helpers the screens use — the
 * board and the export cannot be allowed to disagree about a score, because
 * the moment they do, the argument stops being about the walk and starts
 * being about which number is real.
 *
 * Venue codes are this app's own, verbatim. Mapping them onto the warehouse
 * registry belongs in the staging layer, the way every other source's venue
 * key is mapped — this one has BABY where the registry has BBGR.
 */
export type VenueWeekRow = {
  /** Monday. How this app keys a week. */
  week_start: string;
  /** Sunday. How the warehouse keys a week — join on this. */
  week_ending: string;
  venue_code: string;
  /** Tasks on the board now. Historical weeks are scored against the current
      board, which is the only definition the schema supports. */
  items_on_board: number;
  /** Tasks with a photo and comment filed that week. The pass/fail gate. */
  filed_count: number;
  /** Signed off by the admin. The score. */
  approved_count: number;
  sent_back_count: number;
  awaiting_review_count: number;
  /** Filed, but the leader said it needs another cycle. */
  rolling_count: number;
  status: WeekStatus;
  /** Whether the week has been closed out for this venue. */
  graded: boolean;
  graded_by: string | null;
  graded_at: string | null;
  first_filed_at: string | null;
  last_filed_at: string | null;
  deadline_at: string;
  deadline_passed: boolean;
};

type Row = { id: string; venue_id: string; active: boolean };

/**
 * Every venue's numbers for each of the given weeks.
 *
 * One pass over the data rather than a query per venue per week: a twelve-week
 * pull is twelve rows times twenty-one venues, and that is three queries, not
 * two hundred and fifty.
 */
export async function venueWeekRows(
  weekStarts: string[],
  now: Date = new Date(),
): Promise<VenueWeekRow[]> {
  if (weekStarts.length === 0) return [];

  const { data: venueData, error: venueError } = await db()
    .from("venues")
    .select("id, code")
    .eq("active", true)
    .order("code");
  if (venueError) throw new Error(venueError.message);
  const venues = (venueData ?? []) as { id: string; code: string }[];

  const { data: itemData, error: itemError } = await db()
    .from("items")
    .select("id, venue_id, active");
  if (itemError) throw new Error(itemError.message);
  const items = (itemData ?? []) as Row[];

  const venueOfItem = new Map(items.map((item) => [item.id, item.venue_id]));
  const onBoard = new Map<string, number>();
  for (const item of items) {
    if (!item.active) continue;
    onBoard.set(item.venue_id, (onBoard.get(item.venue_id) ?? 0) + 1);
  }

  const earliest = [...weekStarts].sort()[0];
  const { data: subData, error: subError } = await db()
    .from("submissions")
    .select("id, item_id, week_start, created_at, review, progress")
    .is("cleared_at", null)
    .gte("week_start", earliest)
    .in("week_start", weekStarts);
  if (subError) throw new Error(subError.message);
  const submissions = (subData ?? []) as Submission[];

  const { data: gradeData, error: gradeError } = await db()
    .from("graded_weeks")
    .select("venue_id, week_start, graded_by, graded_at")
    .in("week_start", weekStarts);
  if (gradeError) throw new Error(gradeError.message);
  const grades = new Map(
    ((gradeData ?? []) as {
      venue_id: string;
      week_start: string;
      graded_by: string;
      graded_at: string;
    }[]).map((g) => [`${g.venue_id}|${g.week_start}`, g]),
  );

  const rows: VenueWeekRow[] = [];
  for (const weekStart of weekStarts) {
    const ofWeek = submissions.filter((s) => s.week_start === weekStart);
    const passed = isDeadlinePassed(weekStart, now);

    for (const venue of venues) {
      const mine = ofWeek.filter(
        (s) => venueOfItem.get(s.item_id) === venue.id,
      );
      // Newest entry per task decides its state, exactly as the board does —
      // a task filed twice in a week is one task, in whatever state it
      // finished in.
      const latest = [...latestByItem(mine).values()];
      const filed = latest.length;
      const activeCount = onBoard.get(venue.id) ?? 0;
      const times = mine.map((s) => s.created_at).sort();
      const grade = grades.get(`${venue.id}|${weekStart}`);

      rows.push({
        week_start: weekStart,
        week_ending: weekEnding(weekStart),
        venue_code: venue.code,
        items_on_board: activeCount,
        filed_count: filed,
        approved_count: latest.filter((s) => s.review === "approved").length,
        sent_back_count: latest.filter((s) => s.review === "sent_back").length,
        awaiting_review_count: latest.filter((s) => s.review === "pending")
          .length,
        rolling_count: latest.filter((s) => s.progress === "another_cycle")
          .length,
        status: statusFor(filed, activeCount, weekStart, now),
        graded: Boolean(grade),
        graded_by: grade?.graded_by ?? null,
        graded_at: grade?.graded_at ?? null,
        first_filed_at: times[0] ?? null,
        last_filed_at: times[times.length - 1] ?? null,
        deadline_at: deadlineFor(weekStart).toISOString(),
        deadline_passed: passed,
      });
    }
  }

  return rows;
}
