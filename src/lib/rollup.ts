import { type Cadence, cadenceOf, dueOnNight, makeCadenceDue } from "./due";
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
  nightsReadLive,
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

/**
 * Ids to a request. An `in` filter rides in the address, and a few hundred
 * ids at thirty seven characters each is an address long enough to be turned
 * away. A hundred keeps it short, and the requests run side by side.
 */
const ID_CHUNK = 100;
/** Fewer lists to a request for nights, because each row carries its frozen list. */
const NIGHT_LIST_CHUNK = 50;

/** One paged read per slice of ids, all at once, as one list. */
async function inChunks<T>(
  ids: string[],
  size: number,
  read: (chunk: string[]) => Promise<T[]>,
): Promise<T[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size)
    chunks.push(ids.slice(i, i + size));
  return (await Promise.all(chunks.map(read))).flat();
}

/** A row once, should a page boundary move under a read and hand it back twice. */
function onceEach<T>(rows: T[], key: (row: T) => string): T[] {
  return [...new Map(rows.map((row) => [key(row), row])).values()];
}

/**
 * Everything the window needs.
 *
 * Paged, every read. A single select stops at a thousand rows and this used to
 * take whatever thousand came back: one venue's month is thirteen thousand
 * ticks, and every venue's is three thousand nights and five thousand items. A
 * list that was worked and never signed read as never opened whenever its
 * ticks fell outside the slice, and which lists did so changed from one load
 * to the next. A read that fails now throws, where it used to count as no
 * rows and score the venue on nothing.
 *
 * Not every tick, though. Fifty seven thousand of them is fifty eight requests
 * to read rows the arithmetic never looks at. A night with a frozen list is
 * scored from that list, so its ticks are not read. What is read:
 *
 * - the ticks on nights with no frozen list, which are scored from them, and
 * - the ticks on weekly and monthly items on any night, which decide the one
 *   night of the period such an item is scored on.
 *
 * scripts/check-rollup.mjs holds that the report comes out the same from
 * those as from all of them.
 */
async function load(
  venueIds: string[] | null,
  window: string[],
): Promise<Loaded | null> {
  // Pages are cut on the id, the one order that cannot skip or repeat a row,
  // and an id is random. So each read is put back in the order a person would
  // expect before anything is counted: lists as they were made, items as they
  // sit on the list, nights oldest first. The lines that name lists and the
  // ties in a ranking come out in that order, and the same on every load.
  const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

  const checklists = (
    await selectAll<ChecklistRow & { created_at: string }>((from, to) => {
      let query = db()
        .from("close_checklists")
        .select("id, venue_id, house, role, phase, room, created_at")
        .eq("active", true);
      if (venueIds) query = query.in("venue_id", venueIds);
      return query.order("id").range(from, to);
    })
  ).sort((a, b) => byText(a.created_at, b.created_at) || byText(a.id, b.id));
  if (checklists.length === 0) return null;

  const checklistIds = checklists.map((c) => c.id);
  const listOrder = new Map(checklistIds.map((id, i) => [id, i]));

  type RawItem = ItemRow & { position: number };
  type RawNight = Omit<NightRow, "signed"> & {
    list_at_signing: unknown;
    created_at: string;
  };
  const [itemRows, nightRows] = await Promise.all([
    inChunks(checklistIds, ID_CHUNK, (chunk) =>
      selectAll<RawItem>((from, to) =>
        db()
          .from("close_items")
          .select("id, checklist_id, title, title_es, section, days, position")
          .in("checklist_id", chunk)
          .eq("active", true)
          .order("id")
          .range(from, to),
      ),
    ),
    inChunks(checklistIds, NIGHT_LIST_CHUNK, (chunk) =>
      selectAll<RawNight>((from, to) =>
        db()
          .from("close_nights")
          .select(
            "id, checklist_id, night, certified_at, certified_by, list_at_signing, created_at",
          )
          .in("checklist_id", chunk)
          .gte("night", window[0])
          .lte("night", window[window.length - 1])
          .order("id")
          .range(from, to),
      ),
    ),
  ]);

  const items: ItemRow[] = onceEach(itemRows, (i) => i.id).sort(
    (a, b) =>
      (listOrder.get(a.checklist_id) ?? 0) -
        (listOrder.get(b.checklist_id) ?? 0) ||
      a.position - b.position ||
      byText(a.id, b.id),
  );
  // The frozen list rides along on each certified night, so the report scores
  // an old night against the list it was signed against rather than today's.
  const nights: NightRow[] = onceEach(nightRows, (n) => n.id)
    .sort(
      (a, b) =>
        byText(a.night, b.night) ||
        byText(a.created_at, b.created_at) ||
        byText(a.id, b.id),
    )
    .map((n) => ({
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

  if (nights.length === 0) return { checklists, items, nights, ticks: [] };

  const liveNightIds = nightsReadLive(nights).map((n) => n.id);
  const cadenceItemIds = items
    .filter((i) => cadenceOf(i.section) !== null)
    .map((i) => i.id);
  // A tick is written during its night, never before it: across every tick on
  // record the earliest is eleven hours after its night's date began in UTC.
  // A day before the window opens is a floor no tick in the window is under,
  // and it keeps this read from growing with every month the app has run.
  const floor = `${shiftNights(window[0], -1)}T00:00:00Z`;
  const inWindow = new Set(nights.map((n) => n.id));

  const [liveTicks, cadenceTicks] = await Promise.all([
    inChunks(liveNightIds, ID_CHUNK, (chunk) =>
      selectAll<TickRow>((from, to) =>
        db()
          .from("close_ticks")
          .select("night_id, item_id")
          .in("night_id", chunk)
          .order("id")
          .range(from, to),
      ),
    ),
    inChunks(cadenceItemIds, ID_CHUNK, (chunk) =>
      selectAll<TickRow>((from, to) =>
        db()
          .from("close_ticks")
          .select("night_id, item_id")
          .in("item_id", chunk)
          .gte("created_at", floor)
          .order("id")
          .range(from, to),
      ),
    ),
  ]);
  const ticks = onceEach(
    [...liveTicks, ...cadenceTicks.filter((t) => inWindow.has(t.night_id))],
    (t) => `${t.night_id}:${t.item_id}`,
  );

  return { checklists, items, nights, ticks };
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

  const nightDateOf = new Map(data.nights.map((n) => [n.id, n.night]));
  const venueOfList = new Map(data.checklists.map((c) => [c.id, c.venue_id]));
  const runningByVenue = new Map<string, Set<string>>();
  for (const n of data.nights) {
    const venue = venueOfList.get(n.checklist_id);
    if (!venue) continue;
    const held = runningByVenue.get(venue) ?? new Set<string>();
    held.add(n.night);
    runningByVenue.set(venue, held);
  }
  const tickNightsByItem = new Map<string, string[]>();
  for (const t of data.ticks) {
    if (!cadenceByItem.has(t.item_id)) continue;
    const date = nightDateOf.get(t.night_id);
    if (!date) continue;
    const held = tickNightsByItem.get(t.item_id) ?? [];
    held.push(date);
    tickNightsByItem.set(t.item_id, held);
  }
  for (const [id, dates] of tickNightsByItem)
    tickNightsByItem.set(id, [...new Set(dates)].sort());
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
