import "server-only";

import { cadenceOf, periodStartOf } from "./due";
import { db } from "./supabase";

/**
 * Which cadence items on a list were already done earlier in their period.
 *
 * A WEEKLY or MONTHLY item is owed every night until it is done once, then it
 * clears for the rest of the week or month. "Done" is a tick on an earlier
 * night of the same period; tonight's own tick is deliberately not counted, so
 * a box ticked tonight still shows as owed-and-done rather than vanishing.
 *
 * Returned as a set of item ids, read by the crew list and the signature so the
 * two always agree on what tonight still asks for. An item that is not a cadence
 * item, or has not been done this period, is simply absent.
 */
export async function satisfiedEarlierThisPeriod(
  listId: string,
  night: string,
  items: { id?: string | null; section?: string | null }[],
): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  const cadenceItems = items.filter((it) => it.id && cadenceOf(it.section));
  if (cadenceItems.length === 0) return out;

  // The earliest period start across the cadence items, so one query covers
  // them all. A weekly item rolls back to its Monday, a monthly one to the
  // first; each item is matched against its own period below.
  const starts = cadenceItems
    .map((it) => periodStartOf(cadenceOf(it.section)!, night))
    .filter((s): s is string => Boolean(s));
  const from = starts.sort()[0];
  if (!from || from >= night) return out;

  const { data: priorNightRows } = await db()
    .from("close_nights")
    .select("id, night")
    .eq("checklist_id", listId)
    .gte("night", from)
    .lt("night", night);
  const priorNights = (priorNightRows ?? []) as { id: string; night: string }[];
  if (priorNights.length === 0) return out;

  const nightOf = new Map(priorNights.map((n) => [n.id, n.night]));
  const { data: priorTickRows } = await db()
    .from("close_ticks")
    .select("night_id, item_id")
    .in(
      "night_id",
      priorNights.map((n) => n.id),
    )
    .in(
      "item_id",
      cadenceItems.map((it) => it.id as string),
    );
  const priorTicks = (priorTickRows ?? []) as {
    night_id: string;
    item_id: string;
  }[];

  for (const it of cadenceItems) {
    const cadence = cadenceOf(it.section)!;
    const start = periodStartOf(cadence, night);
    if (!start) continue;
    const done = priorTicks.some((t) => {
      if (t.item_id !== it.id) return false;
      const on = nightOf.get(t.night_id);
      return Boolean(on) && periodStartOf(cadence, on!) === start;
    });
    if (done) out[it.id as string] = true;
  }
  return out;
}

/**
 * The same question across many lists at once, for the live board.
 *
 * closeStatus reads every venue's lists for one night in a handful of queries,
 * so it asks this once rather than per list: given the night's cadence items,
 * which were already done earlier in their period. Two queries total, matched
 * to each item's own week or month. Returns the ids that are satisfied.
 */
export async function satisfiedEarlierBatch(
  items: { id: string; checklist_id: string; section: string | null }[],
  night: string,
): Promise<Set<string>> {
  const done = new Set<string>();
  const cadenceItems = items.filter((it) => cadenceOf(it.section));
  if (cadenceItems.length === 0) return done;

  const starts = cadenceItems
    .map((it) => periodStartOf(cadenceOf(it.section)!, night))
    .filter((s): s is string => Boolean(s));
  const from = starts.sort()[0];
  if (!from || from >= night) return done;

  const listIds = [...new Set(cadenceItems.map((it) => it.checklist_id))];
  const { data: priorNightRows } = await db()
    .from("close_nights")
    .select("id, night")
    .in("checklist_id", listIds)
    .gte("night", from)
    .lt("night", night);
  const priorNights = (priorNightRows ?? []) as { id: string; night: string }[];
  if (priorNights.length === 0) return done;

  const nightOf = new Map(priorNights.map((n) => [n.id, n.night]));
  const { data: priorTickRows } = await db()
    .from("close_ticks")
    .select("night_id, item_id")
    .in(
      "night_id",
      priorNights.map((n) => n.id),
    )
    .in(
      "item_id",
      cadenceItems.map((it) => it.id),
    );
  const priorTicks = (priorTickRows ?? []) as {
    night_id: string;
    item_id: string;
  }[];
  // Which nights each item was ticked on, to match against its own period.
  const nightsByItem = new Map<string, string[]>();
  for (const t of priorTicks) {
    const on = nightOf.get(t.night_id);
    if (!on) continue;
    const held = nightsByItem.get(t.item_id) ?? [];
    held.push(on);
    nightsByItem.set(t.item_id, held);
  }
  for (const it of cadenceItems) {
    const cadence = cadenceOf(it.section)!;
    const start = periodStartOf(cadence, night);
    if (!start) continue;
    const ticks = nightsByItem.get(it.id) ?? [];
    if (ticks.some((on) => periodStartOf(cadence, on) === start))
      done.add(it.id);
  }
  return done;
}
