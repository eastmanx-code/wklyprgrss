import "server-only";

import { db } from "./supabase";
import { currentNight, nightEndsAt, shiftNights } from "./night";

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
      // Every venue, deliberately. `venues.active` governs membership of the
      // weekly walkthrough — whether a venue appears in that login picker —
      // and the close product is a different programme with a different roll.
      // Filtering on it dropped the pilot venue, which is not in the
      // walkthrough at all. The checklist's own `active` flag is the gate
      // here: a list that should not be in tonight's feed gets stood down as
      // a list.
      db().from("venues").select("id, code"),
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

  let ticks: { night_id: string; item_id: string }[] = [];
  if (nights.length > 0) {
    const { data: tickRows } = await db()
      .from("close_ticks")
      .select("night_id, item_id")
      .in(
        "night_id",
        nights.map((n) => n.id),
      );
    ticks = (tickRows ?? []) as { night_id: string; item_id: string }[];
  }

  const nightOf = new Map(nights.map((n) => [n.checklist_id, n]));
  const tickedOn = new Map<string, number>();
  for (const t of ticks) {
    tickedOn.set(t.night_id, (tickedOn.get(t.night_id) ?? 0) + 1);
  }

  const endsAt = nightEndsAt(night).toISOString();

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
