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
 * One ruler. A list is DONE AND SIGNED, or it is not: either nobody signed
 * it, or it was signed with something not done. Every number here is lists
 * counted that way, and the three states add up to the total. Items appear
 * only in the ranked list of what keeps getting left, which is a list of
 * items and reads as one. A night used to count only when every list was
 * signed, which put the bar where nobody clears it, and the strip and the
 * score and the ring each used a different ruler, so one night read as 99%
 * and 80% and 0 of 4 at once.
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

/**
 * Two buckets, no legend. A night where every list was done and signed, or a
 * night where something was not. Three shades needed a key to read, and a
 * strip that needs a key is a strip nobody reads.
 */
export type NightState = "c" | "m";

/** A list, by name, for the lines that say which ones. */
export type NamedList = { role: string; room: string | null; phase: string };

export type Rollup = {
  /** Nights the venue was running, not nights on the calendar. */
  nights: number;
  /** Nights where every list was done and signed. */
  certified: number;
  /** Lists done and signed, over every list on every running night. */
  done: number;
  of: number;
  /** One character per night, oldest first. */
  strip: string;
  /**
   * Which lists, on the most recent running night. The question a manager
   * actually asks of "12 of 15" is "which three", and a report that makes
   * him ask is a report he stops reading.
   */
  latest: {
    night: string;
    notSigned: NamedList[];
    notDone: NamedList[];
  } | null;
  missed: MissedRow[];
  /**
   * Per position: items done over items owed across the running nights, and
   * how many of those nights the position opened a list at all. The second
   * number is what explains the first. A barback at 50% who opened the list
   * on two nights of four and did everything on both is not half a barback.
   */
  /** Per position, lists done and signed over lists owed, same ruler. */
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

  // Done and signed: a signature, and every item owed that night signed off.
  const complete = (list: ChecklistRow, night: string, row?: NightRow) =>
    Boolean(row?.certified_at) &&
    (itemsOf.get(list.id) ?? [])
      .filter((item) => isDue(item, night))
      .every((item) => ticked.has(`${row!.id}:${item.id}`));
  const named = (list: ChecklistRow): NamedList => ({
    role: list.role,
    room: list.room ?? null,
    phase: list.phase,
  });

  // Per night, across every checklist the venue runs: how many were done and
  // signed, and which were not, sorted into the two ways of not being.
  let certified = 0;
  let done = 0;
  let latest: Rollup["latest"] = null;
  const strip = live
    .map((night) => {
      const notSigned: NamedList[] = [];
      const notDone: NamedList[] = [];
      for (const list of checklists) {
        const row = nightAt.get(`${list.id}:${night}`);
        if (complete(list, night, row)) done += 1;
        else if (row?.certified_at) notDone.push(named(list));
        else notSigned.push(named(list));
      }
      const short = notSigned.length + notDone.length;
      if (short === 0) certified += 1;
      // The window is oldest first, so the last one through here is the most
      // recent night, which is the one somebody reads in the morning.
      latest = { night, notSigned, notDone };
      const state: NightState = short === 0 ? "c" : "m";
      return state;
    })
    .join("");
  const of = checklists.length * live.length;

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

  // Per position, the same ruler: its lists, done and signed, over every
  // running night.
  const byRole = [...new Set(checklists.map((c) => c.role))]
    .map((role) => {
      const lists = checklists.filter((c) => c.role === role);
      let done = 0;
      let of = 0;
      for (const list of lists) {
        for (const night of live) {
          of += 1;
          if (complete(list, night, nightAt.get(`${list.id}:${night}`)))
            done += 1;
        }
      }
      return { role, done, of };
    })
    .filter((row) => row.of > 0)
    .sort((a, b) => b.done / b.of - a.done / a.of);

  // Keyed on the name as typed with case and spacing folded, so "Nikki
  // Milner" and "nikki milner" are one person, and shown the way it was
  // first typed. A signature with no name, or the word null a phone once
  // sent, is nobody and is not a signer.
  const counts = new Map<string, { who: string; nights: number }>();
  for (const night of nights) {
    if (!night.certified_at || !night.certified_by) continue;
    const who = night.certified_by.trim().replace(/\s+/g, " ");
    if (!who || who.toLowerCase() === "null") continue;
    const key = who.toLowerCase();
    const held = counts.get(key) ?? { who, nights: 0 };
    held.nights += 1;
    counts.set(key, held);
  }
  const certifiers = [...counts.values()].sort((a, b) => b.nights - a.nights);

  return {
    nights: live.length,
    certified,
    done,
    of,
    strip,
    latest,
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
      // Lists, the same ruler as everywhere else: done and signed means a
      // signature and every item owed that night signed off.
      running.of += 1;
      const row = nightAt.get(`${list.id}:${night}`);
      if (
        row?.certified_at &&
        owed
          .filter((item) => isDue(item, night))
          .every((item) => ticked.has(`${row.id}:${item.id}`))
      )
        running.done += 1;
    }
    totals.set(code, running);
  }

  return [...totals.entries()]
    .map(([code, t]) => ({ code, ...t }))
    .filter((row) => row.of > 0)
    .sort((a, b) => b.done / b.of - a.done / a.of);
}
