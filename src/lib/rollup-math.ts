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
 * An item is OPEN on a night when there is no tick for it, and every night in
 * the window counts. Not only the nights somebody opened the list: a venue
 * that never opens its close checklist has not scored zero misses, it has
 * missed everything, and a denominator that quietly skipped those nights would
 * report the venue with the worst habits as the cleanest.
 *
 * A night is CERTIFIED when every checklist the venue runs has a signature on
 * it. One list signed out of three is not a certified night.
 *
 * COMPLETE means certified with nothing left open. The strip separates the two
 * because "signed with gaps" is a different conversation from "nobody signed",
 * and collapsing them loses the one a GM can act on tonight.
 */

export type MissedRow = {
  house: "FOH" | "HOH";
  role: string;
  phase: "open" | "mid" | "close";
  item: string;
  /** Nights the item finished with no tick against it. */
  open: number;
  of: number;
};

/** How many nights the report looks back over. */
export const WINDOW_NIGHTS = 30;

export type NightState = "c" | "g" | "m";

export type Rollup = {
  nights: number;
  certified: number;
  /** One character per night, oldest first. */
  strip: string;
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
};
export type ItemRow = { id: string; checklist_id: string; title: string };
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
export function computeRollup(data: Loaded, window: string[]): Rollup {
  const { checklists, items, nights, ticks } = data;

  const ticked = new Set(ticks.map((t) => `${t.night_id}:${t.item_id}`));
  const itemsOf = new Map<string, ItemRow[]>();
  for (const item of items) {
    const list = itemsOf.get(item.checklist_id) ?? [];
    list.push(item);
    itemsOf.set(item.checklist_id, list);
  }
  const nightAt = new Map<string, NightRow>();
  for (const night of nights) nightAt.set(`${night.checklist_id}:${night.night}`, night);

  // Per night, across every checklist the venue runs.
  let certified = 0;
  const strip = window
    .map((night) => {
      let allCertified = true;
      let allComplete = true;
      for (const list of checklists) {
        const row = nightAt.get(`${list.id}:${night}`);
        if (!row?.certified_at) {
          allCertified = false;
          allComplete = false;
          continue;
        }
        const owed = itemsOf.get(list.id) ?? [];
        if (owed.some((item) => !ticked.has(`${row.id}:${item.id}`))) allComplete = false;
      }
      if (allCertified) certified += 1;
      return (allCertified ? (allComplete ? "c" : "g") : "m") as NightState;
    })
    .join("");

  // What keeps getting left open. Every night in the window is a chance to
  // have done it, whether or not anyone opened the list.
  const missed: MissedRow[] = items
    .map((item) => {
      const list = checklists.find((c) => c.id === item.checklist_id)!;
      let open = 0;
      for (const night of window) {
        const row = nightAt.get(`${list.id}:${night}`);
        if (!row || !ticked.has(`${row.id}:${item.id}`)) open += 1;
      }
      return {
        house: list.house,
        role: list.role,
        phase: list.phase,
        item: item.title,
        open,
        of: window.length,
      };
    })
    .filter((row) => row.open > 0)
    .sort((a, b) => b.open - a.open);

  // Completion by role, over the same window and the same denominator.
  const byRole = [...new Set(checklists.map((c) => c.role))]
    .map((role) => {
      const lists = checklists.filter((c) => c.role === role);
      let done = 0;
      let of = 0;
      for (const list of lists) {
        const owed = itemsOf.get(list.id) ?? [];
        of += owed.length * window.length;
        for (const night of window) {
          const row = nightAt.get(`${list.id}:${night}`);
          if (!row) continue;
          done += owed.filter((item) => ticked.has(`${row.id}:${item.id}`)).length;
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

  return { nights: window.length, certified, strip, missed, byRole, certifiers };
}


/** Per venue, over the same window and the same denominator. */
export function computeGroup(
  data: Loaded,
  window: string[],
  codeOf: Map<string, string>,
): GroupRow[] {
  const { checklists, items, nights, ticks } = data;
  const ticked = new Set(ticks.map((t) => `${t.night_id}:${t.item_id}`));
  const nightAt = new Map<string, NightRow>();
  for (const night of nights) nightAt.set(`${night.checklist_id}:${night.night}`, night);

  const totals = new Map<string, { done: number; of: number }>();
  for (const list of checklists) {
    const owed = items.filter((item) => item.checklist_id === list.id);
    const code = codeOf.get(list.venue_id) ?? "—";
    const running = totals.get(code) ?? { done: 0, of: 0 };
    running.of += owed.length * window.length;
    for (const night of window) {
      const row = nightAt.get(`${list.id}:${night}`);
      if (!row) continue;
      running.done += owed.filter((item) => ticked.has(`${row.id}:${item.id}`)).length;
    }
    totals.set(code, running);
  }

  return [...totals.entries()]
    .map(([code, t]) => ({ code, ...t }))
    .filter((row) => row.of > 0)
    .sort((a, b) => b.done / b.of - a.done / a.of);
}
