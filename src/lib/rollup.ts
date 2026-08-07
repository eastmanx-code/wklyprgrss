import "server-only";

import { currentNight, shiftNights } from "./night";
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

/** The window, oldest first, ending with the night in progress. */
export function nightWindow(
  count = WINDOW_NIGHTS,
  from = currentNight(),
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
    .select("id, venue_id, house, role, phase")
    .eq("active", true);
  if (venueIds) checklistQuery = checklistQuery.in("venue_id", venueIds);

  const { data: checklistRows } = await checklistQuery;
  const checklists = (checklistRows ?? []) as ChecklistRow[];
  if (checklists.length === 0) return null;

  const checklistIds = checklists.map((c) => c.id);

  const [{ data: itemRows }, { data: nightRows }] = await Promise.all([
    db()
      .from("close_items")
      .select("id, checklist_id, title")
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
  return computeRollup(data, window);
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

  return computeGroup(data, window, codeOf);
}
