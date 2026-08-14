import "server-only";

import { latestByItem, statusFor } from "./status";
import { db } from "./supabase";
import type { Submission, WeekStatus } from "./types";
import {
  dayInTz,
  daysOfWeek,
  deadlineFor,
  isDeadlinePassed,
  todayInTz,
  weekEnding,
} from "./week";

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

/**
 * One venue's day.
 *
 * Derived from the timestamps already on every entry, so it is exact and it
 * works backwards over all of history — no snapshotting, nothing to start
 * collecting, nothing lost if a load is missed. A daily series assembled by
 * saving the weekly numbers once a day could only ever begin today, and would
 * be wiped by the idempotent upsert the weekly grain is designed for.
 */
export type VenueDayRow = {
  /** Calendar day, in the venues' own timezone. */
  date: string;
  day_of_week: string;
  week_start: string;
  week_ending: string;
  venue_code: string;
  items_on_board: number;
  /** Entries filed that day. Raw activity, so a re-file counts again. */
  entries_filed: number;
  /** Tasks with at least one entry this week, as at the end of that day. The
      progress curve toward the board. */
  items_covered_to_date: number;
  /** Verdicts given that day — which is the admin's work, not the venue's. */
  entries_approved: number;
  entries_sent_back: number;
  is_deadline_day: boolean;
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export async function venueDayRows(
  weekStarts: string[],
  now: Date = new Date(),
): Promise<VenueDayRow[]> {
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
  const venueOfItem = new Map(items.map((i) => [i.id, i.venue_id]));
  const onBoard = new Map<string, number>();
  for (const item of items) {
    if (!item.active) continue;
    onBoard.set(item.venue_id, (onBoard.get(item.venue_id) ?? 0) + 1);
  }

  const { data: subData, error: subError } = await db()
    .from("submissions")
    .select("item_id, week_start, created_at, reviewed_at, review")
    .is("cleared_at", null)
    .in("week_start", weekStarts);
  if (subError) throw new Error(subError.message);
  const submissions = (subData ?? []) as Submission[];

  const today = todayInTz(now);
  const rows: VenueDayRow[] = [];

  for (const weekStart of weekStarts) {
    const ofWeek = submissions.filter((s) => s.week_start === weekStart);
    const deadlineDay = dayInTz(deadlineFor(weekStart).toISOString());
    // A week in progress has no rows for days that have not happened. Zeroes
    // for a Saturday that is still two days away read as a venue that failed
    // on Saturday.
    const days = daysOfWeek(weekStart).filter((d) => d <= today);

    for (const venue of venues) {
      const mine = ofWeek.filter((s) => venueOfItem.get(s.item_id) === venue.id);
      const covered = new Set<string>();

      for (const date of days) {
        const filedToday = mine.filter((s) => dayInTz(s.created_at) === date);
        for (const s of filedToday) covered.add(s.item_id);

        const judgedToday = mine.filter(
          (s) => s.reviewed_at && dayInTz(s.reviewed_at) === date,
        );

        rows.push({
          date,
          day_of_week: DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()],
          week_start: weekStart,
          week_ending: weekEnding(weekStart),
          venue_code: venue.code,
          items_on_board: onBoard.get(venue.id) ?? 0,
          entries_filed: filedToday.length,
          items_covered_to_date: covered.size,
          entries_approved: judgedToday.filter((s) => s.review === "approved")
            .length,
          entries_sent_back: judgedToday.filter((s) => s.review === "sent_back")
            .length,
          is_deadline_day: date === deadlineDay,
        });
      }
    }
  }

  return rows;
}
