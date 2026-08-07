import "server-only";

import { db, selectAll } from "./supabase";
import type {
  Item,
  Submission,
  Venue,
  VenueSummary,
  VenueWeekSummary,
  WeekStatus,
} from "./types";
import {
  currentWeekStart,
  isDeadlinePassed,
  mostRecentCompletedWeek,
  shiftWeeks,
  weeksBetween,
} from "./week";

/**
 * How far back a fail streak may reach. Also bounds the dashboard query.
 */
/** How many weeks the trend line shows. Must not exceed the query window. */
const HISTORY_WEEKS = 8;

/**
 * The first week the board was in use. Weeks before it were not missed — the
 * app did not exist — so a streak can never reach past this.
 */
const PROGRAM_START_WEEK = process.env.PROGRAM_START_WEEK ?? "2026-08-03";

const STREAK_LOOKBACK_WEEKS = 26;

/**
 * What every venue owes each week. Company completion is measured against this
 * rather than against however many items happen to be configured — a venue with
 * only 3 items set up still owes 10, and that gap should be visible, not
 * silently divided away.
 */
/** Eight approved is a win. Below that but above zero is partial. */
export const WIN_THRESHOLD = 8;

export const WEEKLY_ITEM_TARGET = 10;

/**
 * Venue list without PINs — safe for the dropdown, the board and the dashboard.
 *
 * Stood-down venues are left out. The test venue is a real row so development
 * runs the same code paths production does, which also put it in the login
 * dropdown in front of every leader in the company.
 */
export async function getVenues(): Promise<VenueSummary[]> {
  const { data, error } = await db()
    .from("venues")
    .select("id, code, name")
    .eq("active", true)
    .order("code");
  if (error) throw new Error(error.message);
  return (data ?? []) as VenueSummary[];
}

/**
 * Includes the PIN. Only the login check and the admin venue screen call this.
 */
export async function getVenue(venueId: string): Promise<Venue | null> {
  const { data, error } = await db()
    .from("venues")
    .select("id, code, name, pin")
    .eq("id", venueId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Venue) ?? null;
}

export async function getItems(
  venueId: string,
  { includeInactive = false } = {},
): Promise<Item[]> {
  let query = db()
    .from("items")
    .select("id, venue_id, title, position, active")
    .eq("venue_id", venueId);
  if (!includeInactive) query = query.eq("active", true);

  const { data, error } = await query.order("position").order("title");
  if (error) throw new Error(error.message);
  return (data ?? []) as Item[];
}

export async function getSubmissionsForItems(
  itemIds: string[],
  weekStart?: string,
): Promise<Submission[]> {
  if (itemIds.length === 0) return [];
  return selectAll<Submission>((from, to) => {
    let query = db()
      .from("submissions")
      .select(
        "id, item_id, week_start, photo_url, before_photo_url, photo_purged_at, comment, author, assisted_by, review, reviewed_at, progress, created_at",
      )
      .in("item_id", itemIds);
    if (weekStart) query = query.eq("week_start", weekStart);
    return query
      .order("created_at", { ascending: false })
      .range(from, to) as unknown as PromiseLike<{
      data: Submission[] | null;
      error: { message: string } | null;
    }>;
  });
}

/**
 * A submission counts towards the week unless it has been sent back. Photo and
 * comment are both NOT NULL at the DB level, so a surviving row is sufficient
 * evidence that both were given.
 */
export function countsAsDone(submission: {
  review: Submission["review"];
}): boolean {
  // A submission exists, so the information was submitted. Sent back and
  // "one more cycle" are judgements about the work, made after it was filed —
  // the only failure is a blank.
  void submission;
  return true;
}

/** Item ids that are genuinely done, ignoring anything sent back. */
export function doneItemIdsFrom(submissions: Submission[]): Set<string> {
  return new Set(submissions.filter(countsAsDone).map((s) => s.item_id));
}

/**
 * A venue passes by getting a fresh photo and comment on all ten items — not
 * on however many happen to be configured. A venue with one item set up and
 * one photo in is not "all clear"; it owes nine more, and an incomplete list
 * is itself a failure to set the week up.
 */
export function statusFor(
  doneCount: number,
  activeCount: number,
  weekStart: string,
  now: Date,
): WeekStatus {
  if (doneCount >= WEEKLY_ITEM_TARGET) return "PASS";
  // Nothing to walk means nothing to miss.
  if (activeCount === 0) return "SETUP";
  return isDeadlinePassed(weekStart, now) ? "FAIL" : "PENDING";
}

/** Latest submission per item, newest first. */
export function latestByItem(
  submissions: Submission[],
): Map<string, Submission> {
  const latest = new Map<string, Submission>();
  for (const s of submissions) {
    const existing = latest.get(s.item_id);
    if (!existing || s.created_at > existing.created_at)
      latest.set(s.item_id, s);
  }
  return latest;
}

export type LeaderBoard = {
  weekStart: string;
  items: Item[];
  doneItemIds: Set<string>;
  /** Items the admin sent back — the leader has to redo these. */
  sentBackItemIds: Set<string>;
  /** Items the leader flagged as needing another cycle. */
  rollingItemIds: Set<string>;
  latest: Map<string, Submission>;
  /**
   * Weeks since this item last had a photo. 0 means one landed this week.
   * A card that says "Jul 14 · 19d" makes you do the arithmetic; this is the
   * number the arithmetic was for.
   */
  staleWeeks: Map<string, number>;
  /**
   * Consecutive weeks ending with this one where the item was filed as
   * needing another cycle. An item rolling for six weeks and one rolling
   * since yesterday read identically otherwise, and only one of them is a
   * problem.
   */
  rollingWeeks: Map<string, number>;
  status: WeekStatus;
};

export async function getLeaderBoard(
  venueId: string,
  now: Date = new Date(),
): Promise<LeaderBoard> {
  const weekStart = currentWeekStart(now);
  const items = await getItems(venueId);
  const itemIds = items.map((i) => i.id);

  // Latest photo per card comes from all history; DONE comes from this week.
  const [allSubmissions, thisWeek] = await Promise.all([
    getSubmissionsForItems(itemIds),
    getSubmissionsForItems(itemIds, weekStart),
  ]);

  const doneItemIds = doneItemIdsFrom(thisWeek);

  // Sent back only matters when nothing newer has replaced it.
  const sentBackItemIds = new Set(
    [...latestByItem(thisWeek).values()]
      .filter((s) => s.review === "sent_back")
      .map((s) => s.item_id),
  );

  const rollingItemIds = new Set(
    [...latestByItem(thisWeek).values()]
      .filter((s) => s.review !== "sent_back" && s.progress === "another_cycle")
      .map((s) => s.item_id),
  );

  const latest = latestByItem(allSubmissions);

  const staleWeeks = new Map<string, number>();
  for (const [itemId, submission] of latest) {
    staleWeeks.set(itemId, weeksBetween(submission.week_start, weekStart));
  }

  // The newest submission of each week, per item — then walk back from this
  // week while every one of them says another cycle.
  const newestPerWeek = new Map<string, Map<string, Submission>>();
  for (const submission of allSubmissions) {
    const weeks = newestPerWeek.get(submission.item_id) ?? new Map();
    const held = weeks.get(submission.week_start);
    if (!held || submission.created_at > held.created_at) {
      weeks.set(submission.week_start, submission);
    }
    newestPerWeek.set(submission.item_id, weeks);
  }

  const rollingWeeks = new Map<string, number>();
  for (const [itemId, weeks] of newestPerWeek) {
    let run = 0;
    let cursor = weekStart;
    for (;;) {
      const submission = weeks.get(cursor);
      if (
        !submission ||
        submission.review === "sent_back" ||
        submission.progress !== "another_cycle"
      ) {
        break;
      }
      run += 1;
      cursor = shiftWeeks(cursor, -1);
    }
    if (run > 0) rollingWeeks.set(itemId, run);
  }

  return {
    weekStart,
    items,
    doneItemIds,
    sentBackItemIds,
    rollingItemIds,
    latest,
    staleWeeks,
    rollingWeeks,
    status: statusFor(doneItemIds.size, items.length, weekStart, now),
  };
}

export type Dashboard = {
  weekStart: string;
  rows: VenueWeekSummary[];
  /** Total items done across every venue this week. */
  itemsDone: number;
  /** venues × WEEKLY_ITEM_TARGET — the real weekly obligation. */
  itemsTarget: number;
  /** Venues that don't have the full 10 items configured yet. */
  venuesUnderConfigured: string[];
  /** Who reached ten this week, earliest first. */
  finishes: { code: string; at: string }[];
  /** Company completion for each of the last few weeks, oldest first. */
  history: { weekStart: string; percent: number }[];
};

/**
 * One pass over every venue: this week's completion plus the fail streak.
 *
 * Streaks count back from the most recent week whose deadline has passed, and
 * stop at the venue's first-ever submission — weeks before a venue started
 * using the app are "no data", not failures. Historical weeks are scored
 * against the venue's *current* active items, which is the only definition the
 * schema supports.
 */
export async function getDashboard(now: Date = new Date()): Promise<Dashboard> {
  const weekStart = currentWeekStart(now);
  const completedWeek = mostRecentCompletedWeek(now);
  const earliestWeek = shiftWeeks(completedWeek, -(STREAK_LOOKBACK_WEEKS - 1));

  const venues = await getVenues();

  // Every item, not just the active ones. A retired item's photos still
  // happened: filtering here dropped their submissions from the loop below, so
  // retiring last week's list rewrote last week as incomplete. Venues that
  // choose fresh items each week would lose their record every time they
  // swapped.
  const allItems = await selectAll<Item>(
    (from, to) =>
      db()
        .from("items")
        .select("id, venue_id, title, position, active")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{
        data: Item[] | null;
        error: { message: string } | null;
      }>,
  );

  const itemToVenue = new Map(allItems.map((i) => [i.id, i.venue_id]));

  /**
   * Two different questions, two different item sets — conflating them put a
   * filled bar next to "not set up" on any venue whose only items were
   * retired.
   *
   * This week asks "how much of what you have now is done", so it counts
   * active items alone. Past weeks ask "did you complete that week", and the
   * config back then is unrecorded, so those count every item — the photos
   * genuinely happened.
   */
  const activeItemIds = new Set(
    allItems.filter((i) => i.active).map((i) => i.id),
  );

  // Active-only, because this answers "is this venue set up right now".
  const activeCountByVenue = new Map<string, number>();
  for (const item of allItems.filter((i) => i.active)) {
    activeCountByVenue.set(
      item.venue_id,
      (activeCountByVenue.get(item.venue_id) ?? 0) + 1,
    );
  }

  // Sent-back submissions are filtered in SQL so they never count anywhere.
  const submissions = await selectAll<
    Pick<Submission, "item_id" | "week_start" | "created_at" | "review">
  >(
    (from, to) =>
      db()
        .from("submissions")
        .select("item_id, week_start, created_at, review")
        .gte("week_start", earliestWeek)
        .order("week_start")
        .range(from, to) as unknown as PromiseLike<{
        data:
          | Pick<
              Submission,
              "item_id" | "week_start" | "created_at" | "review"
            >[]
          | null;
        error: { message: string } | null;
      }>,
  );

  // venueId -> weekStart -> set of done item ids
  const doneByVenueWeek = new Map<string, Map<string, Set<string>>>();
  const firstWeekByVenue = new Map<string, string>();
  // venueId -> every submission this week, to be walked in time order below
  const thisWeekByVenue = new Map<string, { item: string; at: string }[]>();

  // itemId -> newest submission this week, for scoring approvals.
  const newestThisWeek = new Map<string, (typeof submissions)[number]>();
  for (const s of submissions) {
    if (s.week_start !== weekStart) continue;
    const held = newestThisWeek.get(s.item_id);
    if (!held || s.created_at > held.created_at)
      newestThisWeek.set(s.item_id, s);
  }

  for (const s of submissions) {
    const venueId = itemToVenue.get(s.item_id);
    if (!venueId) continue; // submission against a deactivated item
    let weeks = doneByVenueWeek.get(venueId);
    if (!weeks) {
      weeks = new Map();
      doneByVenueWeek.set(venueId, weeks);
    }
    let set = weeks.get(s.week_start);
    if (!set) {
      set = new Set();
      weeks.set(s.week_start, set);
    }
    set.add(s.item_id);

    if (s.week_start === weekStart) {
      const forVenue = thisWeekByVenue.get(venueId) ?? [];
      forVenue.push({ item: s.item_id, at: s.created_at });
      thisWeekByVenue.set(venueId, forVenue);
    }

    const first = firstWeekByVenue.get(venueId);
    if (!first || s.week_start < first)
      firstWeekByVenue.set(venueId, s.week_start);
  }

  /**
   * When each venue reached the target this week — the moment its tenth
   * distinct item got a photo.
   *
   * Sorted by time here rather than relying on the query order, which is by
   * week: the tenth row processed is not the tenth row submitted.
   */
  const finishedAtByVenue = new Map<string, string>();
  for (const [venueId, entries] of thisWeekByVenue) {
    entries.sort((a, b) => a.at.localeCompare(b.at));
    const seen = new Set<string>();
    for (const entry of entries) {
      if (!activeItemIds.has(entry.item)) continue;
      seen.add(entry.item);
      if (seen.size === WEEKLY_ITEM_TARGET) {
        finishedAtByVenue.set(venueId, entry.at);
        break;
      }
    }
  }

  const rows: VenueWeekSummary[] = venues.map((venue) => {
    const activeCount = activeCountByVenue.get(venue.id) ?? 0;
    const weeks = doneByVenueWeek.get(venue.id);
    const doneThisWeek = weeks?.get(weekStart);
    const doneCount = doneThisWeek
      ? [...doneThisWeek].filter((id) => activeItemIds.has(id)).length
      : 0;

    let failStreak = 0;
    const firstWeek = firstWeekByVenue.get(venue.id);
    if (firstWeek && activeCount > 0) {
      let week = completedWeek;
      for (let i = 0; i < STREAK_LOOKBACK_WEEKS; i += 1) {
        if (week < firstWeek || week < PROGRAM_START_WEEK) break;
        const done = weeks?.get(week)?.size ?? 0;
        if (statusFor(done, activeCount, week, now) !== "FAIL") break;
        failStreak += 1;
        week = shiftWeeks(week, -1);
      }
    }

    // The score: what you signed off, not what was handed in.
    const approvedCount = doneThisWeek
      ? [...doneThisWeek].filter(
          (id) =>
            activeItemIds.has(id) &&
            newestThisWeek.get(id)?.review === "approved",
        ).length
      : 0;

    return {
      venue,
      doneCount,
      approvedCount,
      activeCount,
      status: statusFor(doneCount, activeCount, weekStart, now),
      failStreak,
    };
  });

  // Worst first, then the ones needing setup, then everything on track.
  const statusRank: Record<WeekStatus, number> = {
    FAIL: 0,
    SETUP: 1,
    PENDING: 2,
    PASS: 3,
  };
  rows.sort((a, b) => {
    if (statusRank[a.status] !== statusRank[b.status]) {
      return statusRank[a.status] - statusRank[b.status];
    }
    const ratioA = a.activeCount ? a.doneCount / a.activeCount : 0;
    const ratioB = b.activeCount ? b.doneCount / b.activeCount : 0;
    if (ratioA !== ratioB) return ratioA - ratioB;
    if (a.failStreak !== b.failStreak) return b.failStreak - a.failStreak;
    return a.venue.code.localeCompare(b.venue.code);
  });

  return {
    weekStart,
    rows,
    itemsDone: rows.reduce((sum, row) => sum + row.doneCount, 0),
    itemsTarget: rows.length * WEEKLY_ITEM_TARGET,
    history: Array.from({ length: HISTORY_WEEKS }, (_, i) => {
      const week = shiftWeeks(weekStart, -(HISTORY_WEEKS - 1 - i));
      const target = venues.length * WEEKLY_ITEM_TARGET;
      // The current week reuses the rows the ring, buckets and list are all
      // built from, so the chart's last point cannot drift from the headline.
      const done =
        week === weekStart
          ? rows.reduce((sum, row) => sum + row.doneCount, 0)
          : [...doneByVenueWeek.values()].reduce(
              (sum, weeks) => sum + (weeks.get(week)?.size ?? 0),
              0,
            );
      return {
        weekStart: week,
        percent: target ? Math.round((done / target) * 100) : 0,
      };
    }),
    finishes: rows
      .map((row) => ({
        code: row.venue.code,
        at: finishedAtByVenue.get(row.venue.id),
      }))
      .filter((f): f is { code: string; at: string } => Boolean(f.at))
      .sort((a, b) => a.at.localeCompare(b.at)),
    venuesUnderConfigured: rows
      .filter((row) => row.activeCount < WEEKLY_ITEM_TARGET)
      .map((row) => row.venue.code),
  };
}

/**
 * How many entries this venue has filed that nobody has approved yet.
 *
 * Only used to decide whether to offer a leader the way to clear them, and to
 * say how many rather than making them guess.
 */
export async function countUnapproved(venueId: string): Promise<number> {
  const { data: items } = await db()
    .from("items")
    .select("id")
    .eq("venue_id", venueId);
  const itemIds = ((items ?? []) as { id: string }[]).map((row) => row.id);
  if (itemIds.length === 0) return 0;

  const { count } = await db()
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .in("item_id", itemIds)
    .neq("review", "approved");
  return count ?? 0;
}
