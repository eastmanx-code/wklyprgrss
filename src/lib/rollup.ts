import { type Cadence, cadenceOf, dueOnNight, makeCadenceDue } from "./due";
import "server-only";

import { currentNight, isNightOver, shiftNights } from "./night";
import {
  chunksOf,
  computeGroup,
  computeRollup,
  nightsNeedingTicks,
  tickNightsOf,
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
import { db, selectAll } from "./supabase";

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

/** How many list ids, and how many night ids, go over in one request. */
const LISTS_PER_READ = 40;
const NIGHTS_PER_READ = 100;

type StoredNight = Omit<NightRow, "signed"> & { list_at_signing: unknown };

/**
 * Everything the window needs.
 *
 * Paged, every read. A single select stops at a thousand rows and says nothing
 * when it does. This loader used to make four of them, and by November 2026
 * three were being cut short: Stock's items (1,127), every venue's nights taken
 * together (3,277), and the ticks almost everywhere (Born & Raised alone had
 * 13,693 in the window). A venue's page was scored on whichever thousand ticks
 * came back, and the all-locations page on whichever thousand nights.
 *
 * Three things keep it correct and no slower:
 * - Lists and nights are asked for in runs of ids, side by side, so no request
 *   carries hundreds of ids in its address and the big ones overlap in time.
 * - Each run is paged in id order, so pages cannot overlap or skip.
 * - Ticks are read only for nights with no frozen list. A signed night is
 *   scored from its own snapshot, so its ticks were being fetched and thrown
 *   away. See nightsNeedingTicks.
 *
 * A failed read throws. It used to come back as no rows, and no rows reads as
 * a venue that did nothing.
 */
async function load(
  venueIds: string[] | null,
  window: string[],
): Promise<Loaded | null> {
  const checklists = await selectAll<ChecklistRow>((from, to) => {
    let query = db()
      .from("close_checklists")
      .select("id, venue_id, house, role, phase, room")
      .eq("active", true);
    if (venueIds) query = query.in("venue_id", venueIds);
    return query.order("id").range(from, to);
  });
  if (checklists.length === 0) return null;

  const listRuns = chunksOf(
    checklists.map((c) => c.id),
    LISTS_PER_READ,
  );

  const [itemRuns, nightRuns] = await Promise.all([
    Promise.all(
      listRuns.map((ids) =>
        selectAll<ItemRow>((from, to) =>
          db()
            .from("close_items")
            .select("id, checklist_id, title, title_es, section, days")
            .in("checklist_id", ids)
            .eq("active", true)
            .order("id")
            .range(from, to),
        ),
      ),
    ),
    Promise.all(
      listRuns.map((ids) =>
        selectAll<StoredNight>((from, to) =>
          db()
            .from("close_nights")
            .select(
              "id, checklist_id, night, certified_at, certified_by, list_at_signing",
            )
            .in("checklist_id", ids)
            .gte("night", window[0])
            .lte("night", window[window.length - 1])
            .order("id")
            .range(from, to),
        ),
      ),
    ),
  ]);

  const items = itemRuns.flat();
  // The frozen list rides along on each certified night, so the report scores
  // an old night against the list it was signed against rather than today's.
  const nights: NightRow[] = nightRuns.flat().map((n) => ({
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

  const tickRuns = await Promise.all(
    chunksOf(nightsNeedingTicks(nights), NIGHTS_PER_READ).map((ids) =>
      selectAll<TickRow>((from, to) =>
        db()
          .from("close_ticks")
          .select("night_id, item_id")
          .in("night_id", ids)
          .order("id")
          .range(from, to),
      ),
    ),
  );

  return { checklists, items, nights, ticks: tickRuns.flat() };
}

/**
 * The due rule a report scores with, cadence-aware, built from the rows a load
 * already holds.
 *
 * A weekly or monthly item is owed once per period, so it is scored on one
 * night of the period — the night it was done, or the last night the venue was
 * open once an empty period has closed — and ignored on every other. Everything
 * else keeps the ordinary weekday rule. Keyed by item id and venue, so one
 * builder serves a single-venue report and the all-venue pass alike. When a
 * load carries no cadence items it falls straight back to the weekday rule.
 */
function cadenceDueFor(data: Loaded): IsDue {
  const cadenceByItem = new Map<string, Cadence>();
  for (const it of data.items) {
    const c = cadenceOf(it.section);
    if (c) cadenceByItem.set(it.id, c);
  }
  if (cadenceByItem.size === 0)
    return (item, night) => dueOnNight(item.section, night, item.days);

  const venueOfList = new Map(data.checklists.map((c) => [c.id, c.venue_id]));
  const runningByVenue = new Map<string, Set<string>>();
  for (const n of data.nights) {
    const venue = venueOfList.get(n.checklist_id);
    if (!venue) continue;
    const held = runningByVenue.get(venue) ?? new Set<string>();
    held.add(n.night);
    runningByVenue.set(venue, held);
  }
  // Frozen lists for signed nights, live ticks for the rest: the same two
  // sources the score itself reads.
  const tickNightsByItem = tickNightsOf(data, (id) => cadenceByItem.has(id));
  const runningNightsByItem = new Map<string, string[]>();
  const listOfItem = new Map(data.items.map((it) => [it.id, it.checklist_id]));
  for (const id of cadenceByItem.keys()) {
    const venue = venueOfList.get(listOfItem.get(id) ?? "");
    const running = venue ? runningByVenue.get(venue) : undefined;
    runningNightsByItem.set(id, running ? [...running].sort() : []);
  }
  return makeCadenceDue({
    cadenceByItem,
    tickNightsByItem,
    runningNightsByItem,
    today: currentNight(),
  });
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
  return computeRollup(data, window, cadenceDueFor(data));
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

  const isDue: IsDue = cadenceDueFor(data);

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

  return computeGroup(data, window, codeOf, cadenceDueFor(data));
}
