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
} from "./week";

/**
 * How far back a fail streak may reach. Also bounds the dashboard query.
 */
const STREAK_LOOKBACK_WEEKS = 26;

/**
 * What every venue owes each week. Company completion is measured against this
 * rather than against however many items happen to be configured — a venue with
 * only 3 items set up still owes 10, and that gap should be visible, not
 * silently divided away.
 */
export const WEEKLY_ITEM_TARGET = 10;

/** Venue list without PINs — safe for the dropdown, the board and the dashboard. */
export async function getVenues(): Promise<VenueSummary[]> {
  const { data, error } = await db()
    .from("venues")
    .select("id, code, name")
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

  const { data, error } = await query
    .order("position")
    .order("title");
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
  return submission.review !== "sent_back";
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
  _activeCount: number,
  weekStart: string,
  now: Date,
): WeekStatus {
  if (doneCount >= WEEKLY_ITEM_TARGET) return "PASS";
  return isDeadlinePassed(weekStart, now) ? "FAIL" : "PENDING";
}

/** Latest submission per item, newest first. */
export function latestByItem(
  submissions: Submission[],
): Map<string, Submission> {
  const latest = new Map<string, Submission>();
  for (const s of submissions) {
    const existing = latest.get(s.item_id);
    if (!existing || s.created_at > existing.created_at) latest.set(s.item_id, s);
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

  return {
    weekStart,
    items,
    doneItemIds,
    sentBackItemIds,
    rollingItemIds,
    latest: latestByItem(allSubmissions),
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

  const activeItems = await selectAll<Item>((from, to) =>
    db()
      .from("items")
      .select("id, venue_id, title, position, active")
      .eq("active", true)
      .order("id")
      .range(from, to) as unknown as PromiseLike<{
      data: Item[] | null;
      error: { message: string } | null;
    }>,
  );

  const itemToVenue = new Map(activeItems.map((i) => [i.id, i.venue_id]));
  const activeCountByVenue = new Map<string, number>();
  for (const item of activeItems) {
    activeCountByVenue.set(
      item.venue_id,
      (activeCountByVenue.get(item.venue_id) ?? 0) + 1,
    );
  }

  // Sent-back submissions are filtered in SQL so they never count anywhere.
  const submissions = await selectAll<Pick<Submission, "item_id" | "week_start">>(
    (from, to) =>
      db()
        .from("submissions")
        .select("item_id, week_start")
        .gte("week_start", earliestWeek)
        .neq("review", "sent_back")
        .order("week_start")
        .range(from, to) as unknown as PromiseLike<{
        data: Pick<Submission, "item_id" | "week_start">[] | null;
        error: { message: string } | null;
      }>,
  );

  // venueId -> weekStart -> set of done item ids
  const doneByVenueWeek = new Map<string, Map<string, Set<string>>>();
  const firstWeekByVenue = new Map<string, string>();

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

    const first = firstWeekByVenue.get(venueId);
    if (!first || s.week_start < first) firstWeekByVenue.set(venueId, s.week_start);
  }

  const rows: VenueWeekSummary[] = venues.map((venue) => {
    const activeCount = activeCountByVenue.get(venue.id) ?? 0;
    const weeks = doneByVenueWeek.get(venue.id);
    const doneCount = weeks?.get(weekStart)?.size ?? 0;

    let failStreak = 0;
    const firstWeek = firstWeekByVenue.get(venue.id);
    if (firstWeek && activeCount > 0) {
      let week = completedWeek;
      for (let i = 0; i < STREAK_LOOKBACK_WEEKS; i += 1) {
        if (week < firstWeek) break;
        const done = weeks?.get(week)?.size ?? 0;
        if (statusFor(done, activeCount, week, now) !== "FAIL") break;
        failStreak += 1;
        week = shiftWeeks(week, -1);
      }
    }

    return {
      venue,
      doneCount,
      activeCount,
      status: statusFor(doneCount, activeCount, weekStart, now),
      failStreak,
    };
  });

  const statusRank: Record<WeekStatus, number> = { FAIL: 0, PENDING: 1, PASS: 2 };
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
    venuesUnderConfigured: rows
      .filter((row) => row.activeCount < WEEKLY_ITEM_TARGET)
      .map((row) => row.venue.code),
  };
}
