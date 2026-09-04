import "server-only";

import { db } from "./supabase";
import { currentNight, nightEndsAt, shiftNights } from "./night";
import { paceOf, type Pace } from "./pace";

/**
 * Where every checklist stands, right now.
 *
 * The rollup answers "what keeps getting missed" over thirty nights. This
 * answers "what is the state of the building tonight", which is a different
 * question and the one a live board asks — and it has to answer it for lists
 * nobody has opened, because a list nobody opened is the whole point. A query
 * that only returned rows where somebody had started would show a quiet night
 * as a clean one.
 */
export type CloseStatusRow = {
  night: string;
  /** The list itself, so a report can link to the night it is describing. */
  checklist_id: string;
  night_ends_at: string;
  venue_code: string;
  house: "FOH" | "HOH";
  role: string;
  phase: "open" | "mid" | "close";
  items_on_list: number;
  ticked: number;
  open: number;
  /**
   * Nothing on the list has been touched tonight. False for a list with no
   * items on it — that one is not being ignored, it was never written, which
   * is a different problem and belongs in a different column.
   */
  untouched: boolean;
  /** Created but never filled in. Nobody can do a list with nothing on it. */
  empty: boolean;
  certified: boolean;
  certified_by: string | null;
  certified_at: string | null;
  /** Signed with items still open — the state worth a conversation. */
  signed_with_gaps: boolean;
  /** How many times a signature on this night has been undone and redone. */
  reopened: number;
  /**
   * How the ticks arrived, rather than how many.
   *
   * Every other column here answers "did it get done" and none of them can
   * tell a room that was checked from a screen that was thumbed through at
   * the bar. Carried on the row so the reports get it for free: the ticks
   * were already being fetched to be counted.
   */
  pace: Pace;
};

export async function closeStatus(
  night: string = currentNight(),
): Promise<CloseStatusRow[]> {
  const { data: checklistRows, error: checklistError } = await db()
    .from("close_checklists")
    .select("id, venue_id, house, role, phase")
    .eq("active", true);
  if (checklistError) throw new Error(checklistError.message);
  const checklists = (checklistRows ?? []) as {
    id: string;
    venue_id: string;
    house: "FOH" | "HOH";
    role: string;
    phase: "open" | "mid" | "close";
  }[];
  if (checklists.length === 0) return [];

  const ids = checklists.map((c) => c.id);

  const [{ data: venueRows }, { data: itemRows }, { data: nightRows }] =
    await Promise.all([
      // `close_active`, not `active`. The latter governs membership of the
      // weekly walkthrough — whether a venue appears in that login picker —
      // and the close is a different programme with a different roll, which
      // is why filtering on it once dropped the pilot venue entirely. Now
      // that the close has a flag of its own, that is the gate: a venue that
      // has left the programme stops appearing in the feed even if its old
      // lists are still sitting there.
      db().from("venues").select("id, code").eq("close_active", true),
      db()
        .from("close_items")
        .select("id, checklist_id")
        .in("checklist_id", ids)
        .eq("active", true),
      db()
        .from("close_nights")
        .select("id, checklist_id, certified_at, certified_by, history")
        .in("checklist_id", ids)
        .eq("night", night),
    ]);

  const code = new Map(
    ((venueRows ?? []) as { id: string; code: string }[]).map((v) => [
      v.id,
      v.code,
    ]),
  );
  const items = (itemRows ?? []) as { id: string; checklist_id: string }[];
  const nights = (nightRows ?? []) as {
    id: string;
    checklist_id: string;
    certified_at: string | null;
    certified_by: string | null;
    history: unknown[] | null;
  }[];

  // Two more columns on a query that was already running. The timestamps are
  // what the pace is read from, and fetching them separately would be a
  // second round trip for rows already in hand.
  let ticks: {
    night_id: string;
    item_id: string;
    created_at: string;
    client_at: string | null;
  }[] = [];
  if (nights.length > 0) {
    const { data: tickRows } = await db()
      .from("close_ticks")
      .select("night_id, item_id, created_at, client_at")
      .in(
        "night_id",
        nights.map((n) => n.id),
      );
    ticks = (tickRows ?? []) as typeof ticks;
  }

  const nightOf = new Map(nights.map((n) => [n.checklist_id, n]));
  const tickedOn = new Map<string, number>();
  const timesOn = new Map<string, { at: string; claimedAt: string | null }[]>();
  for (const t of ticks) {
    tickedOn.set(t.night_id, (tickedOn.get(t.night_id) ?? 0) + 1);
    const held = timesOn.get(t.night_id);
    const stamp = { at: t.created_at, claimedAt: t.client_at };
    if (held) held.push(stamp);
    else timesOn.set(t.night_id, [stamp]);
  }

  const ends = nightEndsAt(night);
  const endsAt = ends.toISOString();
  // The night's own bounds, for catching a device clock claiming a time the
  // night never contained. A night runs from one 4am roll to the next.
  const window = { start: nightEndsAt(shiftNights(night, -1)), end: ends };
  const NO_TICKS = paceOf([]);

  return checklists
    .filter((list) => code.has(list.venue_id))
    .map((list) => {
      const owed = items.filter((i) => i.checklist_id === list.id).length;
      const row = nightOf.get(list.id);
      const ticked = row ? (tickedOn.get(row.id) ?? 0) : 0;
      const certified = Boolean(row?.certified_at);
      return {
        night,
        checklist_id: list.id,
        night_ends_at: endsAt,
        venue_code: code.get(list.venue_id) ?? "—",
        house: list.house,
        role: list.role,
        phase: list.phase,
        items_on_list: owed,
        ticked,
        open: Math.max(0, owed - ticked),
        untouched: owed > 0 && ticked === 0 && !certified,
        empty: owed === 0,
        certified,
        certified_by: row?.certified_by ?? null,
        certified_at: row?.certified_at ?? null,
        signed_with_gaps: certified && ticked < owed,
        reopened: Array.isArray(row?.history) ? row.history.length : 0,
        pace: row ? paceOf(timesOn.get(row.id) ?? [], window) : NO_TICKS,
      };
    })
    .sort(
      (a, b) =>
        a.venue_code.localeCompare(b.venue_code) ||
        a.house.localeCompare(b.house) ||
        a.role.localeCompare(b.role),
    );
}

/** The night before the one given — for "how did last night finish". */
export function previousNight(night: string = currentNight()): string {
  return shiftNights(night, -1);
}
