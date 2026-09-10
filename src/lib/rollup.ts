import { dueOnNight } from "./due";
import "server-only";

import { currentNight, isNightOver, shiftNights } from "./night";
import {
  computeGroup,
  computeRollup,
  type ChecklistRow,
  type GroupRow,
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
      .select("id, checklist_id, title, title_es, section")
      .in("checklist_id", checklistIds)
      .eq("active", true),
    db()
      .from("close_nights")
      .select("id, checklist_id, night, certified_at, certified_by")
      .in("checklist_id", checklistIds)
      .gte("night", window[0])
      .lte("night", window[window.length - 1]),
  ]);

  const items = (itemRows ?? []) as ItemRow[];
  const nights = (nightRows ?? []) as NightRow[];

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
    dueOnNight(item.section, night),
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
    dueOnNight(item.section, night),
  );
}
