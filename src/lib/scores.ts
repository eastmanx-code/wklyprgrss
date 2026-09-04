import "server-only";

import {
  WEEKLY_ITEM_TARGET,
  houseScored,
  latestByItem,
  statusFor,
} from "./status";
import { db, selectAll } from "./supabase";
import { HOUSES } from "./types";
import type { House, Submission, WeekStatus } from "./types";
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
  /**
   * Which half of the building. FOH is the dining room, HOH the kitchen, and
   * they are graded by different people against separate lists of ten — so the
   * grain of this table is one row per venue per house per week, and summing
   * the two would report an average that hides whichever half is worse.
   */
  house: House;
  /** Whether this house's numbers count yet, or were a practice walk. */
  scored: boolean;
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

type Row = { id: string; venue_id: string; active: boolean; house: House };

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
    .select("id, code, houses")
    .eq("active", true)
    .order("code");
  if (venueError) throw new Error(venueError.message);
  const venues = (venueData ?? []) as {
    id: string;
    code: string;
    houses: House[];
  }[];

  /**
   * Paged, because there are more than a thousand of them.
   *
   * PostgREST caps an unpaged select at a thousand rows and says nothing about
   * it. The item table crossed that line and a hundred and ten items fell off
   * the end — and every submission belonging to one of them had no venue to be
   * counted against, so it was counted nowhere. Three venues that filed and
   * signed off a full ten reported zero to the warehouse.
   */
  const items = await selectAll<Row>((from, to) =>
    db().from("items").select("id, venue_id, active, house").range(from, to),
  );

  // Keyed by venue *and* house everywhere below, so there is no path through
  // this function where a kitchen photograph lands in a dining-room total.
  const keyOf = (venueId: string, house: House) => `${venueId}|${house}`;
  const keyOfItem = new Map(
    items.map((item) => [item.id, keyOf(item.venue_id, item.house)]),
  );
  const onBoard = new Map<string, number>();
  for (const item of items) {
    if (!item.active) continue;
    const key = keyOf(item.venue_id, item.house);
    onBoard.set(key, (onBoard.get(key) ?? 0) + 1);
  }

  const earliest = [...weekStarts].sort()[0];
  // Same cap, and a twelve week pull clears it on its own.
  const submissions = await selectAll<Submission>(
    (from, to) =>
      db()
        .from("submissions")
        .select("id, item_id, week_start, created_at, review, progress")
        .is("cleared_at", null)
        .gte("week_start", earliest)
        .in("week_start", weekStarts)
        .range(from, to) as unknown as PromiseLike<{
        data: Submission[] | null;
        error: { message: string } | null;
      }>,
  );

  const gradeData = await selectAll<{
    venue_id: string;
    week_start: string;
    house: House;
    graded_by: string;
    graded_at: string;
  }>((from, to) =>
    db()
      .from("graded_weeks")
      .select("venue_id, week_start, house, graded_by, graded_at")
      .in("week_start", weekStarts)
      .range(from, to),
  );
  const grades = new Map(
    (
      gradeData as {
        venue_id: string;
        week_start: string;
        house: House;
        graded_by: string;
        graded_at: string;
      }[]
    ).map((g) => [`${g.venue_id}|${g.house}|${g.week_start}`, g]),
  );

  const rows: VenueWeekRow[] = [];
  for (const weekStart of weekStarts) {
    const ofWeek = submissions.filter((s) => s.week_start === weekStart);
    const passed = isDeadlinePassed(weekStart, now);

    for (const venue of venues) {
      // A venue only appears for the houses it actually runs, so a bar is one
      // row a week and a restaurant is two. A row for a kitchen that does not
      // exist would read in the warehouse as a kitchen nobody walked.
      for (const house of HOUSES.filter((h) => venue.houses.includes(h))) {
        const key = keyOf(venue.id, house);
        const mine = ofWeek.filter((s) => keyOfItem.get(s.item_id) === key);
        // Newest entry per task decides its state, exactly as the board does —
        // a task filed twice in a week is one task, in whatever state it
        // finished in.
        const latest = [...latestByItem(mine).values()];
        const filed = latest.length;
        const built = onBoard.get(key) ?? 0;
        // A house with no board is measured against the target, exactly as the
        // dashboard measures it. Reported as 0 of 0 it is arithmetically
        // complete, and the export would have called the worst case in the
        // programme a finished week while the board called it a fail.
        const activeCount = built === 0 ? WEEKLY_ITEM_TARGET : built;
        const times = mine.map((s) => s.created_at).sort();
        const grade = grades.get(`${venue.id}|${house}|${weekStart}`);

        rows.push({
          week_start: weekStart,
          week_ending: weekEnding(weekStart),
          venue_code: venue.code,
          house,
          scored: houseScored(house, weekStart),
          items_on_board: activeCount,
          filed_count: filed,
          approved_count: latest.filter((s) => s.review === "approved").length,
          sent_back_count: latest.filter((s) => s.review === "sent_back")
            .length,
          awaiting_review_count: latest.filter((s) => s.review === "pending")
            .length,
          rolling_count: latest.filter((s) => s.progress === "another_cycle")
            .length,
          status: statusFor(filed, built, weekStart, now),
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
  /** Which half of the building. Same grain rule as the weekly table. */
  house: House;
  scored: boolean;
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
    .select("id, code, houses")
    .eq("active", true)
    .order("code");
  if (venueError) throw new Error(venueError.message);
  const venues = (venueData ?? []) as {
    id: string;
    code: string;
    houses: House[];
  }[];

  const items = await selectAll<Row>((from, to) =>
    db().from("items").select("id, venue_id, active, house").range(from, to),
  );
  const keyOf = (venueId: string, house: House) => `${venueId}|${house}`;
  const keyOfItem = new Map(
    items.map((i) => [i.id, keyOf(i.venue_id, i.house)]),
  );
  const onBoard = new Map<string, number>();
  for (const item of items) {
    if (!item.active) continue;
    const key = keyOf(item.venue_id, item.house);
    onBoard.set(key, (onBoard.get(key) ?? 0) + 1);
  }

  const submissions = await selectAll<Submission>(
    (from, to) =>
      db()
        .from("submissions")
        .select("item_id, week_start, created_at, reviewed_at, review")
        .is("cleared_at", null)
        .in("week_start", weekStarts)
        .range(from, to) as unknown as PromiseLike<{
        data: Submission[] | null;
        error: { message: string } | null;
      }>,
  );

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
      // Same rule as the weekly grain.
      for (const house of HOUSES.filter((h) => venue.houses.includes(h))) {
        const key = keyOf(venue.id, house);
        const mine = ofWeek.filter((s) => keyOfItem.get(s.item_id) === key);
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
            house,
            scored: houseScored(house, weekStart),
            items_on_board: onBoard.get(key) || WEEKLY_ITEM_TARGET,
            entries_filed: filedToday.length,
            items_covered_to_date: covered.size,
            entries_approved: judgedToday.filter((s) => s.review === "approved")
              .length,
            entries_sent_back: judgedToday.filter(
              (s) => s.review === "sent_back",
            ).length,
            is_deadline_day: date === deadlineDay,
          });
        }
      }
    }
  }

  return rows;
}
