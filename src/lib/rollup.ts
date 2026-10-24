import { dueOnNight } from "./due";
import "server-only";

import { currentNight, isNightOver, shiftNights } from "./night";
import {
  computeGroup,
  computeRollup,
  type ChecklistRow,
  type GroupRow,
  type IsDue,
  type ItemRow,
  type Loaded,
  type NightRow,
  type Rollup,
  type TickRow,
  WINDOW_NIGHTS,
} from "./rollup-math";
import { db } from "./supabase";

/**
 * The report, fetched. The arithmetic lives in rollup-math.ts, which has no
 * imports and is tested against fixtures; this file's whole job is getting the
 * right rows into it.
 */

export type { GroupRow, Rollup };
export { WINDOW_NIGHTS };

/**
 * The last closed night. Before the 4am roll that is last night; after it,
 * the one that just ended. A night still running is not a night that
 * missed anything yet.
 */
export function lastClosedNight(): string {
  const tonight = currentNight();
  return isNightOver(tonight) ? tonight : shiftNights(tonight, -1);
}

/**
 * The window, oldest first, ending with the last closed night. Ended with
 * the night in progress, every item nobody had reached yet at nine in the
 * evening counted as missed, and tonight sat in the report as its worst
 * night every night.
 */
export function nightWindow(
  count = WINDOW_NIGHTS,
  from = lastClosedNight(),
): string[] {
  return Array.from({ length: count }, (_, i) =>
    shiftNights(from, i - (count - 1)),
  );
}

/** Everything the window needs, in four queries rather than one per night. */
async function load(
  venueIds: string[] | null,
  window: string[],
): Promise<Loaded | null> {
  let checklistQuery = db()
    .from("close_checklists")
    .select("id, venue_id, house, role, phase, room")
    .eq("active", true);
  if (venueIds) checklistQuery = checklistQuery.in("venue_id", venueIds);

  const { data: checklistRows } = await checklistQuery;
  const checklists = (checklistRows ?? []) as ChecklistRow[];
  if (checklists.length === 0) return null;

  const checklistIds = checklists.map((c) => c.id);

  const [{ data: itemRows }, { data: nightRows }] = await Promise.all([
    db()
      .from("close_items")
      .select("id, checklist_id, title, title_es, section, days")
      .in("checklist_id", checklistIds)
      .eq("active", true),
    db()
      .from("close_nights")
      .select(
        "id, checklist_id, night, certified_at, certified_by, list_at_signing",
      )
      .in("checklist_id", checklistIds)
      .gte("night", window[0])
      .lte("night", window[window.length - 1]),
  ]);

  const items = (itemRows ?? []) as ItemRow[];
  // The frozen list rides along on each certified night, so the report scores
  // an old night against the list it was signed against rather than today's.
  const nights: NightRow[] = (
    (nightRows ?? []) as (Omit<NightRow, "signed"> & {
      list_at_signing: unknown;
    })[]
  ).map((n) => ({
    id: n.id,
    checklist_id: n.checklist_id,
    night: n.night,
    certified_at: n.certified_at,
    certified_by: n.certified_by,
    signed: Array.isArray(n.list_at_signing)
      ? (
          n.list_at_signing as {
            item_id: string;
            title?: string | null;
            section?: string | null;
            days?: string[] | null;
            ticked?: boolean;
          }[]
        ).map((s) => ({
          item_id: s.item_id,
          title: s.title ?? null,
          section: s.section ?? null,
          days: s.days ?? null,
          ticked: Boolean(s.ticked),
        }))
      : null,
  }));

  let ticks: TickRow[] = [];
  if (nights.length > 0) {
    const { data: tickRows } = await db()
      .from("close_ticks")
      .select("night_id, item_id")
      .in(
        "night_id",
        nights.map((n) => n.id),
      );
    ticks = (tickRows ?? []) as TickRow[];
  }

  return { checklists, items, nights, ticks };
}

/**
 * One venue's report, or null when nothing has been recorded yet — the caller
 * shows the sample in that case rather than a page of confident zeroes.
 */
export async function venueRollup(venueId: string): Promise<Rollup | null> {
  const window = nightWindow();
  const data = await load([venueId], window);
  if (!data || data.nights.length === 0) return null;
  // The rota rule, handed to a module that keeps itself import free.
  return computeRollup(data, window, (item, night) =>
    dueOnNight(item.section, night, item.days),
  );
}

/**
 * Every venue's full report, computed in one pass.
 *
 * groupRollup answers "what share does each venue get done"; this answers the
 * same and everything the single-venue report answers too, for every venue at
 * once. The window is loaded once and the arithmetic runs per venue in memory,
 * so the all-locations dash can show each venue's standing, each venue's
 * nightly line, and what is being missed across the whole company without a
 * query per building.
 *
 * Null until one venue records a night. Venues with no running night are left
 * out, the same as everywhere else: a venue not using the app yet is not a
 * venue missing everything.
 */
export async function groupRollupDetailed(): Promise<
  { code: string; name: string | null; rollup: Rollup }[] | null
> {
  const window = nightWindow();
  const data = await load(null, window);
  if (!data || data.nights.length === 0) return null;

  const { data: venueRows } = await db()
    .from("venues")
    .select("id, code, name");
  const venues = (venueRows ?? []) as {
    id: string;
    code: string;
    name: string | null;
  }[];

  const isDue: IsDue = (item, night) =>
    dueOnNight(item.section, night, item.days);

  const out: { code: string; name: string | null; rollup: Rollup }[] = [];
  for (const venue of venues) {
    // The venue's own rows, filtered out of the one load. computeRollup counts
    // running nights off the rows it is handed, so one venue's rows in means
    // one venue's nights scored.
    const checklists = data.checklists.filter((c) => c.venue_id === venue.id);
    if (checklists.length === 0) continue;
    const listIds = new Set(checklists.map((c) => c.id));
    const items = data.items.filter((i) => listIds.has(i.checklist_id));
    const nights = data.nights.filter((n) => listIds.has(n.checklist_id));
    const nightIds = new Set(nights.map((n) => n.id));
    const ticks = data.ticks.filter((t) => nightIds.has(t.night_id));
    const rollup = computeRollup(
      { checklists, items, nights, ticks },
      window,
      isDue,
    );
    if (rollup.nights === 0) continue;
    out.push({ code: venue.code, name: venue.name, rollup });
  }

  // Worst first, by share done and signed: the building that needs the call is
  // the one a group lead wants at the top.
  return out.sort(
    (a, b) =>
      a.rollup.done / Math.max(1, a.rollup.of) -
      b.rollup.done / Math.max(1, b.rollup.of),
  );
}

/**
 * The same question one level up: every venue that has a checklist, ranked by
 * how much of it actually gets done. Null until one of them records a night.
 */
export async function groupRollup(): Promise<GroupRow[] | null> {
  const window = nightWindow();
  const data = await load(null, window);
  if (!data || data.nights.length === 0) return null;

  const { data: venueRows } = await db().from("venues").select("id, code");
  const codeOf = new Map(
    ((venueRows ?? []) as { id: string; code: string }[]).map((v) => [
      v.id,
      v.code,
    ]),
  );

  return computeGroup(data, window, codeOf, (item, night) =>
    dueOnNight(item.section, night, item.days),
  );
}
