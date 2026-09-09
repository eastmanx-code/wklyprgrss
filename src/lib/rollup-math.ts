/**
 * The arithmetic behind the report, with nothing to fetch.
 *
 * Deliberately free of imports — no `server-only`, no database — so the same
 * function runs on the server and can be checked against fixtures somebody
 * worked out by hand. A report that has never been tested is a report that
 * gets believed and should not be. Same reasoning as night.ts.
 *
 * Three definitions carry the whole thing, and they are the arguable part.
 *
 * An item is OPEN on a night when there is no tick for it, and the nights that
 * count are the nights the venue was RUNNING — nights it opened at least one
 * list. Not only the nights somebody opened that particular list: a venue that
 * never touches its close checklist has not scored zero misses, it has missed
 * everything, and a denominator that skipped those nights would report the
 * venue with the worst habits as the cleanest.
 *
 * But a night before a venue joined, or a night it was dark, is not a night it
 * missed anything. Counting all thirty made a venue in its first week read
 * "30 of 30" on every single line: nothing ranked, nothing moved, and the one
 * panel whose whole job is putting the worst thing at the top put everything
 * at the top. Four nights on the board is a small denominator and an honest
 * one, and the nights strip is where "they are barely using it" belongs.
 *
 * The strip and the headline count LISTS SIGNED, not nights certified. A
 * night used to count only when every list the venue runs was signed, which
 * put the bar where nobody clears it: the best night the pilot venue ever had,
 * thirteen of fifteen signed, read "0 of 4 certified", and a manager asked
 * which two were missed. So the number is lists, the strip shows how much of
 * each night got signed, and the two that were not are named.
 */

export type MissedRow = {
  house: "FOH" | "HOH";
  role: string;
  phase: "open" | "mid" | "close";
  item: string;
  /** The same item in Spanish, where somebody has written it. */
  itemEs: string | null;
  /** Nights the item finished with no tick against it. */
  open: number;
  of: number;
};

/** How many nights the report looks back over. */
export const WINDOW_NIGHTS = 30;

/** Every list signed · most signed · half or fewer signed. */
export type NightState = "c" | "g" | "m";

/** A list on the night it was not signed, by name. */
export type UnsignedList = { role: string; room: string | null; phase: string };

export type Rollup = {
  /** Nights the venue was running, not nights on the calendar. */
  nights: number;
  /** Nights where every list was signed. */
  certified: number;
  /** Lists signed, over every list on every running night. */
  signed: number;
  owed: number;
  /** One character per night, oldest first. */
  strip: string;
  /**
   * The lists nobody signed on the most recent running night. The question a
   * manager actually asks of "13 of 15" is "which two", and a report that
   * makes him ask is a report he stops reading.
   */
  unsigned: { night: string; lists: UnsignedList[] } | null;
  missed: MissedRow[];
  byRole: { role: string; done: number; of: number }[];
  certifiers: { who: string; nights: number }[];
};

export type GroupRow = { code: string; done: number; of: number };

export type ChecklistRow = {
  id: string;
  venue_id: string;
  house: "FOH" | "HOH";
  role: string;
  phase: "open" | "mid" | "close";
  /** So three deep cleans can be told apart when one of them is unsigned. */
  room?: string | null;
};
/**
 * Whether an item was owed on a night.
 *
 * Passed in rather than imported, because this module is a leaf on purpose:
 * no imports is what lets scripts/check-rollup.mjs compile and run it with no
 * database and no bundler. The real rule lives in due.ts and the caller hands
 * it over; the fixtures hand over the same one, so what is proved here is what
 * runs.
 *
 * Defaults to "everything, always", which is what every list without day
 * headings means and what this file assumed before deep clean lists existed.
 */
export type IsDue = (item: ItemRow, night: string) => boolean;

const ALWAYS: IsDue = () => true;

/**
 * The nights of the window this venue was actually running.
 *
 * A night with no row on any of its lists is a night the app was not in use
 * there — before the venue joined, or a Monday it was shut. Neither is a night
 * it left something open.
 *
 * Read off the rows rather than from a start date on the venue, because a
 * start date is a thing somebody has to remember to set and this is a thing
 * that cannot be wrong.
 */
function runningNights(nights: NightRow[], window: string[]): string[] {
  const had = new Set(nights.map((n) => n.night));
  return window.filter((night) => had.has(night));
}

export type ItemRow = {
  id: string;
  checklist_id: string;
  title: string;
  title_es?: string | null;
  /**
   * The heading, because one that names a weekday is a rota.
   *
   * A deep clean item is owed one night in seven. Counting it against all
   * seven made every one of them look six sevenths missed for ever, put them
   * at the top of the list of things nobody does, and dragged the venue's
   * whole score down for running the list correctly.
   */
  section?: string | null;
};
export type NightRow = {
  id: string;
  checklist_id: string;
  night: string;
  certified_at: string | null;
  certified_by: string | null;
};
export type TickRow = { night_id: string; item_id: string };

export type Loaded = {
  checklists: ChecklistRow[];
  items: ItemRow[];
  nights: NightRow[];
  ticks: TickRow[];
};

/**
 * The arithmetic, separated from the fetching so it can be tested against
 * fixtures. Every number on the report comes out of here, and a report that
 * has never been checked against a case somebody worked out by hand is a
 * report that gets believed and should not be.
 */
export function computeRollup(
  data: Loaded,
  window: string[],
  isDue: IsDue = ALWAYS,
): Rollup {
  const { checklists, items, nights, ticks } = data;

  // One venue's rows. Every caller passes one; the running nights of two
  // venues merged together would credit each with the other's nights.
  const live = runningNights(nights, window);

  const ticked = new Set(ticks.map((t) => `${t.night_id}:${t.item_id}`));
  const itemsOf = new Map<string, ItemRow[]>();
  for (const item of items) {
    const list = itemsOf.get(item.checklist_id) ?? [];
    list.push(item);
    itemsOf.set(item.checklist_id, list);
  }
  const nightAt = new Map<string, NightRow>();
  for (const night of nights)
    nightAt.set(`${night.checklist_id}:${night.night}`, night);

  // Per night, across every checklist the venue runs: how many got signed.
  let certified = 0;
  let signed = 0;
  let unsigned: Rollup["unsigned"] = null;
  const strip = live
    .map((night) => {
      const missing: UnsignedList[] = [];
      for (const list of checklists) {
        const row = nightAt.get(`${list.id}:${night}`);
        if (row?.certified_at) signed += 1;
        else
          missing.push({
            role: list.role,
            room: list.room ?? null,
            phase: list.phase,
          });
      }
      const done = checklists.length - missing.length;
      if (missing.length === 0) certified += 1;
      // The window is oldest first, so the last one through here is the most
      // recent night, which is the one somebody reads in the morning.
      unsigned = { night, lists: missing };
      const state: NightState =
        missing.length === 0 ? "c" : done > missing.length ? "g" : "m";
      return state;
    })
    .join("");
  const owed = checklists.length * live.length;

  // What keeps getting left open. Every night the venue was running is a
  // chance to have done it, whether or not anyone opened this list.
  const missed: MissedRow[] = items
    .map((item) => {
      const list = checklists.find((c) => c.id === item.checklist_id)!;
      let open = 0;
      let asked = 0;
      for (const night of live) {
        // A night this item was not owed on is not a night it was missed on.
        if (!isDue(item, night)) continue;
        asked += 1;
        const row = nightAt.get(`${list.id}:${night}`);
        if (!row || !ticked.has(`${row.id}:${item.id}`)) open += 1;
      }
      return {
        house: list.house,
        role: list.role,
        phase: list.phase,
        item: item.title,
        itemEs: item.title_es ?? null,
        open,
        of: asked,
      };
    })
    .filter((row) => row.of > 0 && row.open > 0)
    // Count first, then rate. Sorted by rate, a deep clean job owed one night
    // and missed once sat at 100% above restrooms missed three nights of
    // four, on a panel called "what keeps getting left open". A thing missed
    // once has not kept doing anything.
    .sort((a, b) => b.open - a.open || b.open / b.of - a.open / a.of);

  // Completion by role, over the same window and the same denominator.
  const byRole = [...new Set(checklists.map((c) => c.role))]
    .map((role) => {
      const lists = checklists.filter((c) => c.role === role);
      let done = 0;
      let of = 0;
      for (const list of lists) {
        const owed = itemsOf.get(list.id) ?? [];
        for (const night of live) {
          // Only the items this night actually asked for, on both sides of
          // the fraction. A rota item counted in the denominator every night
          // and achievable on one is a score nobody can move.
          const due = owed.filter((item) => isDue(item, night));
          of += due.length;
          const row = nightAt.get(`${list.id}:${night}`);
          if (!row) continue;
          done += due.filter((item) =>
            ticked.has(`${row.id}:${item.id}`),
          ).length;
        }
      }
      return { role, done, of };
    })
    .filter((row) => row.of > 0)
    .sort((a, b) => b.done / b.of - a.done / a.of);

  const counts = new Map<string, number>();
  for (const night of nights) {
    if (!night.certified_at || !night.certified_by) continue;
    const who = night.certified_by.trim();
    counts.set(who, (counts.get(who) ?? 0) + 1);
  }
  const certifiers = [...counts.entries()]
    .map(([who, count]) => ({ who, nights: count }))
    .sort((a, b) => b.nights - a.nights);

  return {
    nights: live.length,
    certified,
    signed,
    owed,
    strip,
    unsigned,
    missed,
    byRole,
    certifiers,
  };
}

/** Per venue, over the same window and the same denominator. */
export function computeGroup(
  data: Loaded,
  window: string[],
  codeOf: Map<string, string>,
  isDue: IsDue = ALWAYS,
): GroupRow[] {
  const { checklists, items, nights, ticks } = data;
  const ticked = new Set(ticks.map((t) => `${t.night_id}:${t.item_id}`));
  const nightAt = new Map<string, NightRow>();
  for (const night of nights)
    nightAt.set(`${night.checklist_id}:${night.night}`, night);

  // Running nights per venue, not one set shared. Venues join in different
  // weeks and close on different days, and a shared set would score a venue
  // against nights its neighbour was open.
  const venueOf = new Map(checklists.map((c) => [c.id, c.venue_id]));
  const liveAt = new Map<string, Set<string>>();
  for (const night of nights) {
    const venue = venueOf.get(night.checklist_id);
    if (!venue) continue;
    const held = liveAt.get(venue);
    if (held) held.add(night.night);
    else liveAt.set(venue, new Set([night.night]));
  }

  const totals = new Map<string, { done: number; of: number }>();
  for (const list of checklists) {
    const owed = items.filter((item) => item.checklist_id === list.id);
    const code = codeOf.get(list.venue_id) ?? "—";
    const running = totals.get(code) ?? { done: 0, of: 0 };
    const live = liveAt.get(list.venue_id);
    for (const night of window) {
      if (!live?.has(night)) continue;
      // Same rule as the per role figure: a rota item counts on the nights it
      // is owed and on no others, or a venue is marked down for running the
      // deep clean the way it is written.
      const due = owed.filter((item) => isDue(item, night));
      running.of += due.length;
      const row = nightAt.get(`${list.id}:${night}`);
      if (!row) continue;
      running.done += due.filter((item) =>
        ticked.has(`${row.id}:${item.id}`),
      ).length;
    }
    totals.set(code, running);
  }

  return [...totals.entries()]
    .map(([code, t]) => ({ code, ...t }))
    .filter((row) => row.of > 0)
    .sort((a, b) => b.done / b.of - a.done / a.of);
}
