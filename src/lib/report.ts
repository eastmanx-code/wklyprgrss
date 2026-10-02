import "server-only";

import { looksLikeAName } from "./name";
import {
  buildReportText,
  type BoardScore,
  type ReportInput,
} from "./report-format";
import {
  WEEKLY_ITEM_TARGET,
  boardAutoFailed,
  getVenues,
  housesFor,
  latestByItem,
  statusFor,
  tierOf,
} from "./status";
import { db, selectAll } from "./supabase";
import type { House, Submission } from "./types";
import {
  formatWeekStart,
  mostRecentCompletedWeek,
  shiftWeeks,
} from "./week";

/**
 * Builds the weekly walkthrough card text straight off the live board, so the
 * report and the board can never disagree about a score. It is the same
 * numbers the dashboard draws: a house is graded on the ten it owes, a board
 * short of its ten by the Thursday deadline is a locked fail, and the score is
 * what got signed off, not what got handed in.
 *
 * Everything mechanical here is exact. The opener and the voice sections are a
 * first draft off these numbers, which is why nothing in this file posts
 * anything: it returns the text, and the person reads it, sharpens it, and
 * pastes it themselves.
 */

type Row = { id: string; venue_id: string; active: boolean; house: House };

type SubRow = Pick<
  Submission,
  | "item_id"
  | "week_start"
  | "created_at"
  | "review"
  | "progress"
  | "author"
  | "assisted_by"
>;

/** A name, or nothing if the box was filled with something that is not one. */
function cleanName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (!value || !looksLikeAName(value)) return null;
  return value;
}

/**
 * The people named in an assist box. One box can hold several — "Dan & Rubi",
 * "Jorge Dominguez, Gabriela Leon" — so it is split on the few separators that
 * actually show up before each piece is judged on its own.
 */
function splitAssists(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\s*(?:,|&|\+|\/|\band\b)\s*/i)
    .map((piece) => cleanName(piece))
    .filter((name): name is string => name !== null);
}

/** Case- and spacing-insensitive, so one person entered two ways counts once. */
function dedupeKey(name: string): string {
  return name.toLowerCase();
}

/**
 * Score every board for one week, keyed by `${code}|${house}`, counting only
 * the houses each venue actually runs and that are live that week.
 */
function scoreWeek(
  weekStart: string,
  now: Date,
  venues: { id: string; code: string; houses: House[] }[],
  keyByItem: Map<string, string>,
  builtByKey: Map<string, number>,
  subs: SubRow[],
): BoardScore[] {
  const ofWeek = subs.filter((s) => s.week_start === weekStart);

  const boards: BoardScore[] = [];
  for (const venue of venues) {
    for (const house of housesFor(venue, weekStart)) {
      const key = `${venue.id}|${house}`;
      // Count a board's filings against every item that has ever belonged to
      // it, active or retired. The report only ever shows completed weeks, and
      // a board that rebuilds its ten each week retires last week's cards once
      // the deadline has passed. Filtering to the board's currently-active
      // items would drop a finished week's filings the moment it was reset for
      // the next week, reading a week that passed as a fail. That broke the
      // movement section, and the reported week too once boards reset after the
      // Thursday deadline. The structural "built" count below still reads the
      // live board, so a board stripped below ten is still shown as short.
      const mine = ofWeek.filter((s) => keyByItem.get(s.item_id) === key);
      const latest = latestByItem(mine as unknown as Submission[]);
      const latestRows = [...latest.values()] as unknown as SubRow[];

      const filed = latestRows.length;
      const approved = latestRows.filter((s) => s.review === "approved").length;
      const sentBack = latestRows.filter((s) => s.review === "sent_back").length;
      const rolling = latestRows.filter(
        (s) => s.progress === "another_cycle",
      ).length;

      // Filers, most items first, one row per person however they spelled it.
      const authorCount = new Map<string, { name: string; items: number }>();
      for (const s of latestRows) {
        const name = cleanName(s.author);
        if (!name) continue;
        const k = dedupeKey(name);
        const held = authorCount.get(k);
        if (held) held.items += 1;
        else authorCount.set(k, { name, items: 1 });
      }

      // Assists, counted once per item per person.
      const assistCount = new Map<string, { name: string; items: number }>();
      for (const s of latestRows) {
        const names = new Set(splitAssists(s.assisted_by).map(dedupeKey));
        const display = new Map(
          splitAssists(s.assisted_by).map((n) => [dedupeKey(n), n]),
        );
        for (const k of names) {
          const held = assistCount.get(k);
          if (held) held.items += 1;
          else assistCount.set(k, { name: display.get(k) ?? k, items: 1 });
        }
      }

      const status = statusFor(filed, WEEKLY_ITEM_TARGET, weekStart, now);
      const tier = status === "FAIL" ? "fail" : tierOf(approved, WEEKLY_ITEM_TARGET);

      boards.push({
        code: venue.code,
        house,
        built: builtByKey.get(key) ?? 0,
        filed,
        approved,
        sentBack,
        rolling,
        missed: boardAutoFailed(filed, weekStart, now),
        tier,
        authors: [...authorCount.values()].sort((a, b) => b.items - a.items),
        assists: [...assistCount.values()].sort((a, b) => b.items - a.items),
      });
    }
  }
  return boards;
}

export type WeeklyReport = {
  weekStart: string;
  weekLabel: string;
  text: string;
};

/**
 * The report for one week. Defaults to the most recent week whose deadline has
 * passed — the newest week there is a verdict to report.
 */
export async function weeklyReport(
  weekStart: string = mostRecentCompletedWeek(),
  now: Date = new Date(),
): Promise<WeeklyReport> {
  const lastWeek = shiftWeeks(weekStart, -1);

  const venues = (await getVenues()).map((v) => ({
    id: v.id,
    code: v.code,
    houses: v.houses,
  }));

  const items = await selectAll<Row>((from, to) =>
    db().from("items").select("id, venue_id, active, house").range(from, to),
  );

  const builtByKey = new Map<string, number>();
  // Every item, active or retired, mapped to its board. A completed week counts
  // its filings against this, so retiring last week's cards cannot erase last
  // week's filing. `built` counts the active cards only, so a stripped board
  // still reads as short.
  const keyByItem = new Map<string, string>();
  for (const item of items) {
    const key = `${item.venue_id}|${item.house}`;
    keyByItem.set(item.id, key);
    if (!item.active) continue;
    builtByKey.set(key, (builtByKey.get(key) ?? 0) + 1);
  }

  const subs = await selectAll<SubRow>(
    (from, to) =>
      db()
        .from("submissions")
        .select(
          "item_id, week_start, created_at, review, progress, author, assisted_by",
        )
        .is("cleared_at", null)
        .in("week_start", [weekStart, lastWeek])
        .range(from, to) as unknown as PromiseLike<{
        data: SubRow[] | null;
        error: { message: string } | null;
      }>,
  );

  const input: ReportInput = {
    weekLabel: formatWeekStart(weekStart),
    thisWeek: scoreWeek(weekStart, now, venues, keyByItem, builtByKey, subs),
    lastWeek: scoreWeek(lastWeek, now, venues, keyByItem, builtByKey, subs),
  };

  return {
    weekStart,
    weekLabel: input.weekLabel,
    text: buildReportText(input),
  };
}
