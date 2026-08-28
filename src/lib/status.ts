import "server-only";

import { db, selectAll } from "./supabase";
import type {
  House,
  HouseWeek,
  Item,
  Submission,
  Venue,
  VenueSummary,
  VenueWeekSummary,
  WeekStatus,
} from "./types";
import { HOUSES } from "./types";
import {
  currentWeekStart,
  filingWeekStart,
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

/**
 * The first week the kitchen board counts.
 *
 * A venue writes its own ten, the same way it always has for the dining room,
 * so the board arrives empty and there is a week of naming and walking before
 * anything is scored. Nobody should be marked down for the week they were
 * still deciding what their ten are.
 *
 * The date matters for more than fairness. Past weeks are scored against the
 * board as it stands today, so a kitchen that counted from the moment its
 * first item was named would have written a fresh 0/10 into every week of
 * history at once.
 */
const HOH_START_WEEK = process.env.HOH_START_WEEK ?? "2026-08-24";

/** The week a house starts counting. Before it, it is on the board and mute. */
export function houseStartWeek(house: House): string {
  return house === "HOH" ? HOH_START_WEEK : PROGRAM_START_WEEK;
}

/** Whether a house's numbers count in the given week. */
export function houseScored(house: House, weekStart: string): boolean {
  return weekStart >= houseStartWeek(house);
}

/**
 * The houses whose numbers count company-wide in a given week, in board order.
 *
 * This is the calendar question only. What a particular venue is scored on is
 * this intersected with the houses it actually runs — see housesFor.
 */
export function scoredHouses(weekStart: string): House[] {
  return HOUSES.filter((house) => houseScored(house, weekStart));
}

/**
 * The houses a venue is scored on this week: the ones it runs, that count yet.
 *
 * Every total, target, grade gate and drawn row goes through here. Four venues
 * are bars with no kitchen, and measuring them against a house they do not
 * have would fail them every week for a room that does not exist.
 */
export function housesFor(
  venue: { houses: House[] },
  weekStart: string,
): House[] {
  return HOUSES.filter(
    (house) => venue.houses.includes(house) && houseScored(house, weekStart),
  );
}

const STREAK_LOOKBACK_WEEKS = 26;

/**
 * What every venue owes each week. Company completion is measured against this
 * rather than against however many items happen to be configured — a venue with
 * only 3 items set up still owes 10, and that gap should be visible, not
 * silently divided away.
 */
/**
 * Eight in ten signed off is a win, held as a ratio so it means the same on a
 * board of five as on a board of ten.
 */
export const WIN_RATIO = 0.8;

export function isWin(approvedCount: number, activeCount: number): boolean {
  return activeCount > 0 && approvedCount / activeCount >= WIN_RATIO;
}

/**
 * A venue wins the week by winning every house that counts.
 *
 * Not by the two averaged. Eight of twenty signed off is a fail at any split,
 * but ten and six averages to eighty per cent and would have been reported as
 * a win — with the six being the kitchen, which is the half that matters most
 * and the half nobody would have been told about.
 */
export function venueIsWin(row: VenueWeekSummary): boolean {
  return (
    row.scored.length > 0 &&
    row.scored.every((house) => isWin(house.approvedCount, house.activeCount))
  );
}

/** What a venue got signed off this week, across the houses that count. */
export function venueApproved(row: VenueWeekSummary): number {
  return row.scored.reduce((sum, house) => sum + house.approvedCount, 0);
}

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
    .select("id, code, name, houses")
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
    .select("id, code, name, pin, houses")
    .eq("id", venueId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Venue) ?? null;
}

/** Every column of an item, in one place — four call sites read them. */
export const ITEM_COLUMNS = "id, venue_id, title, position, active, house";

export async function getItems(
  venueId: string,
  {
    includeInactive = false,
    house,
  }: { includeInactive?: boolean; house?: House } = {},
): Promise<Item[]> {
  let query = db().from("items").select(ITEM_COLUMNS).eq("venue_id", venueId);
  if (!includeInactive) query = query.eq("active", true);
  // Positions run 1..n within a house, so ordering across both interleaves
  // them. Callers that want one house ask for one house; callers that want
  // everything get FOH's ten then the kitchen's ten, which is board order.
  if (house) query = query.eq("house", house);

  const { data, error } = await query
    .order("house")
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
        "id, item_id, week_start, photo_url, before_photo_url, photo_purged_at, comment, author, assisted_by, review, reviewed_at, review_note, progress, created_at",
      )
      .in("item_id", itemIds)
      .is("cleared_at", null);
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
  // A board that was never built is a nought, not an exemption. This used to
  // read "nothing to walk means nothing to miss", which excused the one
  // failure the programme cannot afford to excuse: building the ten is the
  // first part of the job, and a venue three weeks in with no list has not
  // been overlooked, it has not started. A venue that genuinely is not in the
  // programme yet is marked inactive, which is the lever that exists for it.
  if (activeCount === 0) {
    return isDeadlinePassed(weekStart, now) ? "FAIL" : "PENDING";
  }
  // The bar is ten, not whatever the board is currently holding. It was the
  // board for a while, on the reasoning that a venue running a rolling list of
  // live problems would fail for retiring them; but that let a venue with one
  // task left pass the week on one photograph, which is not the programme.
  if (doneCount >= activeCount) return "PASS";
  return isDeadlinePassed(weekStart, now) ? "FAIL" : "PENDING";
}

/**
 * The worse of several houses' verdicts — a venue is only as clean as its
 * dirtiest half. FAIL beats PENDING beats PASS.
 */
export function worstStatus(statuses: WeekStatus[]): WeekStatus {
  if (statuses.includes("FAIL")) return "FAIL";
  if (statuses.includes("PENDING")) return "PENDING";
  return statuses.length > 0 ? "PASS" : "PENDING";
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

/** One house's half of a venue's board. */
export type HouseBoard = {
  house: House;
  items: Item[];
  doneItemIds: Set<string>;
  /** Items the admin sent back — the leader has to redo these. */
  sentBackItemIds: Set<string>;
  approvedItemIds: Set<string>;
  rollingItemIds: Set<string>;
  status: WeekStatus;
  /** False while this house is still walking its list for practice. */
  scored: boolean;
};

/**
 * A venue's week, house by house.
 *
 * There is deliberately no venue-wide done count or status on here. Summing
 * the houses would measure a spotless dining room against a filthy walk-in and
 * report the average, which is the one thing splitting the board exists to
 * prevent — and while the kitchen is still practising, a venue-wide figure
 * would be counting a house that does not count yet.
 */
export type LeaderBoard = {
  weekStart: string;
  /** Both houses in board order — front of house first, kitchen under it. */
  houses: HouseBoard[];
  /* The maps below are keyed by item id, so one copy serves both houses. */
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
};

export async function getLeaderBoard(
  venueId: string,
  /** The halves this venue runs. A bar gets one section, not two empty ones. */
  venueHouses: House[] = HOUSES,
  now: Date = new Date(),
): Promise<LeaderBoard> {
  /**
   * The week this board is working on, which is not always the calendar week.
   *
   * Once the deadline has passed the week a leader is filing into is the next
   * one, so their own board has to move with it — otherwise they file on a
   * Friday, watch the count stay at nought, and reasonably conclude it did not
   * save. The admin review screen and the company dashboard deliberately stay
   * on the calendar week: grading happens after the deadline and has to keep
   * looking at the week it is judging.
   */
  const weekStart = filingWeekStart(now);
  const items = await getItems(venueId);
  const itemIds = items.map((i) => i.id);

  // Latest photo per card comes from all history; DONE comes from this week.
  const [allSubmissions, thisWeek] = await Promise.all([
    getSubmissionsForItems(itemIds),
    getSubmissionsForItems(itemIds, weekStart),
  ]);

  const doneItemIds = doneItemIdsFrom(thisWeek);

  const latest = latestByItem(allSubmissions);

  /**
   * Sent back is a state of the item, not of the week it was filed in.
   *
   * This read the current week only, so every Redo flag in the company
   * vanished at midnight on Monday: twenty-four items were sent back on a
   * Friday, and by the following week the leaders who had to redo them saw an
   * ordinary empty tile with nothing to say the work had been rejected.
   *
   * Measured against the newest submission instead, whichever week that is.
   * An admin asking for something again does not stop applying because the
   * calendar turned, and it clears the moment anything newer is filed.
   */
  const sentBackItemIds = new Set(
    [...latest.values()]
      .filter((s) => s.review === "sent_back")
      .map((s) => s.item_id),
  );

  /**
   * Finished, and waiting to be cleared off.
   *
   * Measured across weeks for the same reason sent-back is: a task approved on
   * Friday read "To do" again on Monday and asked for another photograph of a
   * job that was signed off. Every task here is a different job somewhere else
   * in the building, so re-shooting a finished one is pure waste.
   */
  const approvedItemIds = new Set(
    [...latest.values()]
      .filter((s) => s.review === "approved")
      .map((s) => s.item_id),
  );

  // Rolling stays inside the week: "one more cycle" is a note about this
  // week's pass, and a fresh photo is owed either way. The streak across weeks
  // is carried by rollingWeeks below.
  const rollingItemIds = new Set(
    [...latestByItem(thisWeek).values()]
      .filter((s) => s.review !== "sent_back" && s.progress === "another_cycle")
      .map((s) => s.item_id),
  );

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

  /**
   * The same four questions, asked of each house on its own.
   *
   * Split at the end rather than fetched twice: every set above is keyed by
   * item id and every item belongs to exactly one house, so the split is a
   * filter, and the two houses cannot disagree about a task they can both see.
   */
  const houses: HouseBoard[] = HOUSES.filter((house) =>
    venueHouses.includes(house),
  ).map((house) => {
    const mine = items.filter((item) => item.house === house);
    const ids = new Set(mine.map((item) => item.id));
    const only = (set: Set<string>) =>
      new Set([...set].filter((id) => ids.has(id)));
    const done = only(doneItemIds);
    return {
      house,
      items: mine,
      doneItemIds: done,
      sentBackItemIds: only(sentBackItemIds),
      approvedItemIds: only(approvedItemIds),
      rollingItemIds: only(rollingItemIds),
      // Ten, not mine.length. A leader whose board is down to one task is
      // not one photograph away from a passed week.
      status: statusFor(done.size, WEEKLY_ITEM_TARGET, weekStart, now),
      scored: houseScored(house, weekStart),
    };
  });

  return { weekStart, houses, latest, staleWeeks, rollingWeeks };
}

export type Dashboard = {
  weekStart: string;
  rows: VenueWeekSummary[];
  /**
   * The week's totals, one set per house, never one set for both.
   *
   * A single ring covering both halves is the averaging the split exists to
   * prevent: with front of house at 95% and the kitchen at 24%, one figure
   * reads 65%, which describes neither and hides the half that needs the
   * attention. There is deliberately no combined itemsDone on here.
   */
  byHouse: HouseTotals[];
  /** Venues with a house that doesn't have its full 10 items configured. */
  venuesUnderConfigured: string[];
};

/** One house's company-wide week, and how it has run over the last few. */
export type HouseTotals = {
  house: House;
  /** Items filed across every venue that runs this house. */
  itemsDone: number;
  /**
   * Items signed off across every venue that runs this house.
   *
   * Filing and passing are different facts and the dashboard only ever showed
   * the first. A week where everything was filed and half of it was sent back
   * read as a 95% week.
   */
  itemsApproved: number;
  /** Ten per venue that runs it — the real weekly obligation. */
  itemsTarget: number;
  percent: number;
  /**
   * Each of the last few weeks, oldest first: what was handed in and what was
   * signed off.
   *
   * Both, because they are different facts and only the first was ever
   * plotted. Filing climbed every week while the share that passed did not,
   * and a chart of filing alone drew that as a straight improvement. The gap
   * between the two lines is the week's send-backs.
   */
  history: {
    weekStart: string;
    percent: number;
    approvedPercent: number;
  }[];
  /** False while the house is still being walked for practice. */
  scored: boolean;
  /**
   * How the venues split on this house alone.
   *
   * A venue can win its dining room and miss its kitchen in the same week.
   * Counted once for the venue, that week reads as a single verdict and the
   * half that missed disappears into it.
   */
  wins: number;
  partial: number;
  missed: number;
  /** Who finished this house first and who finished last, earliest first. */
  finishes: { code: string; at: string }[];
  /**
   * Venues whose board for this house is actually built out to the ten.
   *
   * The gate before any of the rest of it. A house sitting at 24% because
   * eleven of its sixteen venues have not written a list yet is a different
   * problem from one at 24% because the walks are not happening, and the
   * completion figure alone cannot tell them apart.
   */
  boardsBuilt: number;
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
        .select(ITEM_COLUMNS)
        .order("id")
        .range(from, to) as unknown as PromiseLike<{
        data: Item[] | null;
        error: { message: string } | null;
      }>,
  );

  /**
   * Everything below is counted per venue *and per house*, never per venue.
   *
   * One key, used everywhere, so there is no path through this function where
   * a kitchen photograph can be added to a dining-room total. The moment the
   * two share a denominator, a venue can cover a failing house with a passing
   * one — which is the whole reason the board was split.
   */
  const keyOf = (venueId: string, house: House) => `${venueId}|${house}`;

  const venueOfItem = new Map(allItems.map((i) => [i.id, i.venue_id]));
  const houseOfItem = new Map(allItems.map((i) => [i.id, i.house]));
  const keyOfItem = (itemId: string): string | null => {
    const venueId = venueOfItem.get(itemId);
    const house = houseOfItem.get(itemId);
    return venueId && house ? keyOf(venueId, house) : null;
  };

  // Active-only, because this answers "is this house set up right now".
  const activeCountByKey = new Map<string, number>();
  for (const item of allItems.filter((i) => i.active)) {
    const key = keyOf(item.venue_id, item.house);
    activeCountByKey.set(key, (activeCountByKey.get(key) ?? 0) + 1);
  }

  // Sent-back submissions are filtered in SQL so they never count anywhere.
  const submissions = await selectAll<
    Pick<Submission, "item_id" | "week_start" | "created_at" | "review">
  >(
    (from, to) =>
      db()
        .from("submissions")
        .select("item_id, week_start, created_at, review")
        .is("cleared_at", null)
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

  // venue|house -> weekStart -> set of done item ids
  const doneByKeyWeek = new Map<string, Map<string, Set<string>>>();
  const firstWeekByKey = new Map<string, string>();
  // venueId -> every submission this week, to be walked in time order below
  const thisWeekByVenue = new Map<string, { item: string; at: string }[]>();

  /**
   * item|week -> the newest submission for that item in that week.
   *
   * Approvals are scored off the newest filing, because a task sent back and
   * redone in the same week is approved on the redo, not on the version that
   * was rejected. Kept for every week rather than only this one, so the chart
   * can plot what was signed off as well as what was handed in.
   */
  const newestByItemWeek = new Map<string, (typeof submissions)[number]>();
  for (const s of submissions) {
    const key = `${s.item_id}|${s.week_start}`;
    const held = newestByItemWeek.get(key);
    if (!held || s.created_at > held.created_at) newestByItemWeek.set(key, s);
  }

  for (const s of submissions) {
    const key = keyOfItem(s.item_id);
    if (!key) continue; // submission against a deleted item
    let weeks = doneByKeyWeek.get(key);
    if (!weeks) {
      weeks = new Map();
      doneByKeyWeek.set(key, weeks);
    }
    let set = weeks.get(s.week_start);
    if (!set) {
      set = new Set();
      weeks.set(s.week_start, set);
    }
    set.add(s.item_id);

    if (s.week_start === weekStart) {
      const venueId = venueOfItem.get(s.item_id)!;
      const forVenue = thisWeekByVenue.get(venueId) ?? [];
      forVenue.push({ item: s.item_id, at: s.created_at });
      thisWeekByVenue.set(venueId, forVenue);
    }

    const first = firstWeekByKey.get(key);
    if (!first || s.week_start < first) firstWeekByKey.set(key, s.week_start);
  }

  /**
   * When each venue finished each house this week — the moment that house's
   * tenth task got a photograph.
   *
   * Per house, not per venue. A single finishing time for the pair is the
   * later of the two, so a dining room done Monday and a kitchen done Thursday
   * both read as Thursday, and the half that was quick disappears into the
   * half that was not. A venue with no kitchen is simply never keyed for one.
   *
   * Sorted by time here rather than relying on the query order, which is by
   * week: the tenth row processed is not the tenth row submitted.
   */
  const byId = new Map(venues.map((venue) => [venue.id, venue]));
  /** venue|house -> the moment that house's tenth task got a photograph. */
  const finishedAt = new Map<string, string>();
  for (const [venueId, entries] of thisWeekByVenue) {
    const venue = byId.get(venueId);
    if (!venue) continue;
    entries.sort((a, b) => a.at.localeCompare(b.at));
    for (const house of HOUSES.filter((h) => venue.houses.includes(h))) {
      const seen = new Set<string>();
      for (const entry of entries) {
        if (houseOfItem.get(entry.item) !== house) continue;
        seen.add(entry.item);
        if (seen.size === WEEKLY_ITEM_TARGET) {
          finishedAt.set(keyOf(venueId, house), entry.at);
          break;
        }
      }
    }
  }

  const rows: VenueWeekSummary[] = venues.map((venue) => {
    // Only the halves this venue runs. A bar is never drawn, counted or
    // graded on a kitchen it does not have.
    const houses = HOUSES.filter((house) => venue.houses.includes(house)).map(
      (house): HouseWeek => {
        const key = keyOf(venue.id, house);
        const weeks = doneByKeyWeek.get(key);
        const doneThisWeek = weeks?.get(weekStart);
        /**
         * What was filed this week, whether or not the task is still on the
         * board.
         *
         * This filtered by active, so retiring a finished task took its
         * photograph out of the score with it and a graded 10/10 fell to 9/10
         * the moment a venue tidied up. Leaders were told to freeze their boards
         * until Monday because of it. The work happened; a board edit afterwards
         * is not a confession that it did not.
         */
        const doneCount = doneThisWeek ? doneThisWeek.size : 0;
        /**
         * Ten. Always ten, whatever the board happens to hold.
         *
         * This used to be the venue's own board size, so a venue that reset
         * and never rebuilt was scored against what was left: one task on the
         * board meant one task passed the week, and a board of eight read
         * "8/8" and drew as complete. Four venues were sitting on that this
         * week, one of them being told it was finished.
         *
         * The deal is ten updates a week. A short board is a venue that has
         * not finished setting up, which is a shortfall to show rather than a
         * denominator to shrink — the same reasoning that already refuses to
         * let an empty board score nought out of nought.
         */
        const activeCount = WEEKLY_ITEM_TARGET;

        let failStreak = 0;
        const firstWeek = firstWeekByKey.get(key);
        if (firstWeek) {
          let week = completedWeek;
          for (let i = 0; i < STREAK_LOOKBACK_WEEKS; i += 1) {
            // A house cannot have missed a week it was not being scored in.
            if (week < firstWeek || week < houseStartWeek(house)) break;
            const done = weeks?.get(week)?.size ?? 0;
            if (statusFor(done, activeCount, week, now) !== "FAIL") break;
            failStreak += 1;
            week = shiftWeeks(week, -1);
          }
        }

        // The score: what you signed off, not what was handed in. Same rule as
        // doneCount — an approval survives the task being cleared off the board.
        const approvedCount = doneThisWeek
          ? [...doneThisWeek].filter(
              (id) =>
                newestByItemWeek.get(`${id}|${weekStart}`)?.review ===
                "approved",
            ).length
          : 0;

        return {
          house,
          doneCount,
          approvedCount,
          activeCount,
          status: statusFor(doneCount, activeCount, weekStart, now),
          failStreak,
          scored: houseScored(house, weekStart),
        };
      },
    );

    const [foh, hoh] = houses;
    const scored = houses.filter((h) => h.scored);

    return {
      venue,
      foh,
      hoh,
      houses,
      scored,
      // One house failing fails the venue. Averaging them would let a spotless
      // dining room carry a kitchen that missed the week entirely.
      status: worstStatus(scored.map((h) => h.status)),
      failStreak: Math.max(0, ...scored.map((h) => h.failStreak)),
    };
  });

  // Worst first, then everything still open, then everything on track.
  const statusRank: Record<WeekStatus, number> = {
    FAIL: 0,
    PENDING: 1,
    PASS: 2,
  };
  const ratioOf = (row: VenueWeekSummary) => {
    const done = row.scored.reduce((sum, h) => sum + h.doneCount, 0);
    const owed = row.scored.reduce((sum, h) => sum + h.activeCount, 0);
    return owed ? done / owed : 0;
  };
  rows.sort((a, b) => {
    if (statusRank[a.status] !== statusRank[b.status]) {
      return statusRank[a.status] - statusRank[b.status];
    }
    const ratioA = ratioOf(a);
    const ratioB = ratioOf(b);
    if (ratioA !== ratioB) return ratioA - ratioB;
    if (a.failStreak !== b.failStreak) return b.failStreak - a.failStreak;
    return a.venue.code.localeCompare(b.venue.code);
  });

  /**
   * The same totals, worked out once per house and never added together.
   *
   * How many venues owe a house changes the denominator: sixteen run a kitchen
   * and twenty-one run a dining room, so the kitchen's hundred per cent is a
   * hundred and sixty items, not two hundred and ten.
   */
  const byHouse: HouseTotals[] = HOUSES.map((house) => {
    const owed = venues.filter((venue) => venue.houses.includes(house));
    const target = owed.length * WEEKLY_ITEM_TARGET;
    const done = rows.reduce(
      (sum, row) =>
        sum + (row.houses.find((h) => h.house === house)?.doneCount ?? 0),
      0,
    );
    const approved = rows.reduce(
      (sum, row) =>
        sum + (row.houses.find((h) => h.house === house)?.approvedCount ?? 0),
      0,
    );
    /**
     * The split on this house alone.
     *
     * Read once per venue, a week where the dining room passed and the kitchen
     * missed collapses to a single verdict and the miss vanishes into it.
     */
    const mine = rows
      .map((row) => row.houses.find((h) => h.house === house))
      .filter((h): h is HouseWeek => Boolean(h));

    return {
      house,
      itemsDone: done,
      itemsApproved: approved,
      itemsTarget: target,
      percent: target ? Math.round((done / target) * 100) : 0,
      scored: houseScored(house, weekStart),
      // Off the raw item count, not the week's activeCount: that one is
      // coerced to the target when a house has no board at all, so counting it
      // reported every empty board as a built one.
      boardsBuilt: owed.filter(
        (venue) =>
          (activeCountByKey.get(keyOf(venue.id, house)) ?? 0) >=
          WEEKLY_ITEM_TARGET,
      ).length,
      wins: mine.filter((h) => isWin(h.approvedCount, h.activeCount)).length,
      missed: mine.filter((h) => h.approvedCount === 0).length,
      partial: mine.filter(
        (h) => h.approvedCount > 0 && !isWin(h.approvedCount, h.activeCount),
      ).length,
      finishes: owed
        .map((venue) => ({
          code: venue.code,
          at: finishedAt.get(keyOf(venue.id, house)),
        }))
        .filter((f): f is { code: string; at: string } => Boolean(f.at))
        .sort((a, b) => a.at.localeCompare(b.at)),
      history: Array.from({ length: HISTORY_WEEKS }, (_, i) => {
        const week = shiftWeeks(weekStart, -(HISTORY_WEEKS - 1 - i));
        const weekTarget = owed.length * WEEKLY_ITEM_TARGET;
        // The current week reuses the same rows the ring and the list are
        // built from, so the chart's last point cannot drift from the
        // headline.
        let filed = 0;
        let signedOff = 0;
        if (week === weekStart) {
          filed = done;
          signedOff = approved;
        } else {
          for (const [key, weeks] of doneByKeyWeek) {
            if (!key.endsWith(`|${house}`)) continue;
            const ids = weeks.get(week);
            if (!ids) continue;
            filed += ids.size;
            for (const id of ids) {
              if (newestByItemWeek.get(`${id}|${week}`)?.review === "approved")
                signedOff += 1;
            }
          }
        }
        return {
          weekStart: week,
          percent: weekTarget ? Math.round((filed / weekTarget) * 100) : 0,
          approvedPercent: weekTarget
            ? Math.round((signedOff / weekTarget) * 100)
            : 0,
        };
      }),
    };
  });

  return {
    weekStart,
    rows,
    byHouse,
    // A house short of its ten is a house that cannot pass the week, whichever
    // house it is. Listed once per venue however many houses are short.
    venuesUnderConfigured: rows
      .filter((row) =>
        row.scored.some(
          (h) =>
            (activeCountByKey.get(keyOf(row.venue.id, h.house)) ?? 0) <
            WEEKLY_ITEM_TARGET,
        ),
      )
      .map((row) => row.venue.code),
  };
}

/**
 * How many entries this venue has filed that nobody has judged yet.
 *
 * Pending only. Approved work is the record of a signed-off week and a
 * rejection is the instruction to redo the job — neither is a leader's to
 * clear away.
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
    .is("cleared_at", null)
    .eq("review", "pending");
  return count ?? 0;
}

/**
 * The grade on a venue's most recently finished week, if there is one.
 *
 * Reset Board waits on this. A venue clearing its board before the week has
 * been judged is exactly what leaders were told would not happen.
 */
export async function gradeFor(
  venueId: string,
  weekStart: string,
  house: House,
): Promise<{ gradedAt: string; gradedBy: string } | null> {
  const { data } = await db()
    .from("graded_weeks")
    .select("graded_at, graded_by")
    .eq("venue_id", venueId)
    .eq("week_start", weekStart)
    .eq("house", house)
    .maybeSingle();
  const row = data as { graded_at: string; graded_by: string } | null;
  return row ? { gradedAt: row.graded_at, gradedBy: row.graded_by } : null;
}

/**
 * Every house's grade for a venue's week, keyed by house.
 *
 * Two people grade and each signs their own, so "has this week been closed
 * out" is two questions. Read as one it would have shown a week as done the
 * moment either walker finished, and the other half would never have been
 * chased.
 */
export async function gradesFor(
  venueId: string,
  weekStart: string,
): Promise<Map<House, { gradedAt: string; gradedBy: string }>> {
  const { data } = await db()
    .from("graded_weeks")
    .select("house, graded_at, graded_by")
    .eq("venue_id", venueId)
    .eq("week_start", weekStart);
  const rows = (data ?? []) as {
    house: House;
    graded_at: string;
    graded_by: string;
  }[];
  return new Map(
    rows.map((row) => [
      row.house,
      { gradedAt: row.graded_at, gradedBy: row.graded_by },
    ]),
  );
}

/**
 * Which venues have had a given week graded.
 *
 * The dashboard needs this per row, not just as a total. A venue whose every
 * task was sent back has nothing signed off, so read through the approval
 * count alone a finished review of a failing venue looked exactly like a
 * venue nobody had opened — which is precisely the venue you most need to
 * know you have dealt with.
 */
export async function gradedVenueIds(
  weekStart: string,
  house?: House,
): Promise<Set<string>> {
  let query = db()
    .from("graded_weeks")
    .select("venue_id")
    .eq("week_start", weekStart);
  if (house) query = query.eq("house", house);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.venue_id as string));
}

/**
 * Who closed out each house's week, per venue.
 *
 * The dashboard used a set of ids, which answers "was this graded" and nothing
 * else, and the row then had to say so in colour alone: the same digit in two
 * shades, meaning "scored nought" or "nobody has looked at it yet". Those are
 * opposite facts and a grey nought and a yellow nought are not far enough
 * apart to carry them — least of all in a screenshot, which is how this table
 * mostly gets read.
 *
 * A name is the shortest honest thing to put in the column. It answers whether
 * the week is closed and who to ask about it in the same breath, and it cannot
 * be confused with a score.
 *
 * One query for the week rather than one per house. Membership still works the
 * way the callers expect, because a Map has `has` too.
 */
export async function gradersByHouse(
  weekStart: string,
): Promise<Map<House, Map<string, string>>> {
  const { data, error } = await db()
    .from("graded_weeks")
    .select("venue_id, house, graded_by")
    .eq("week_start", weekStart);
  if (error) throw new Error(error.message);

  const byHouse = new Map<House, Map<string, string>>(
    HOUSES.map((house) => [house, new Map<string, string>()]),
  );
  for (const row of (data ?? []) as {
    venue_id: string;
    house: House;
    graded_by: string | null;
  }[]) {
    // Graded is graded even where the signature did not survive: an empty
    // name must not read as an ungraded week.
    byHouse.get(row.house)?.set(row.venue_id, row.graded_by?.trim() || "—");
  }
  return byHouse;
}

/**
 * Venues whose week is closed out in every house they are scored on.
 *
 * The gate on resetting a board, and the "N of 21" on the admin screen. Either
 * grade alone is not a closed week: a venue told it could reset because the
 * dining room had been signed off would clear a kitchen nobody had looked at.
 *
 * Asked per venue, not company-wide, because a bar has no kitchen grade to
 * wait for and would otherwise never be allowed to reset its board.
 */
export async function fullyGradedVenueIds(
  weekStart: string,
): Promise<Set<string>> {
  const venues = await getVenues();
  const sets = new Map(
    await Promise.all(
      scoredHouses(weekStart).map(
        async (house) =>
          [house, await gradedVenueIds(weekStart, house)] as const,
      ),
    ),
  );
  return new Set(
    venues
      .filter((venue) => {
        const owed = housesFor(venue, weekStart);
        // A venue scored on nothing this week has nothing to wait for.
        return owed.every((house) => sets.get(house)?.has(venue.id));
      })
      .map((venue) => venue.id),
  );
}
