import "server-only";

import { db } from "./supabase";
import { dueOnNight } from "./due";
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
  /**
   * The room, where the position runs one list per room. Carried so a report
   * can tell three deep cleans apart; without it they arrive as three rows
   * reading the same words.
   */
  room: string | null;
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
  /**
   * Who checked things off: the initials typed on the ticks, each once, in
   * the order they first appeared. A fail with no name on it is a fail
   * nobody can act on, and the names were already on every tick.
   */
  checked_by: string[];
  /** Signed with items still open — the state worth a conversation. */
  signed_with_gaps: boolean;
  /** What the signer said about leaving them. On the bar, not behind a tap. */
  open_reason: string | null;
  /**
   * Items ticked that asked for a photo, video or note and got none. Not a
   * fail, and not folded into the score: a tick with nothing behind it is
   * a different problem from a tick that never happened, and the report
   * says so beside the fails rather than by pretending it is one.
   */
  proof_missing: number;
  /**
   * What was left open, by name. "3 still open" is a count somebody has to
   * go and look up; "the Sysco order, the carts" is a thing they can act on
   * from the report, which is the only reason the report exists.
   */
  open_titles: string[];
  /** How many times a signature on this night has been undone and redone. */
  reopened: number;
  /**
   * The last thing that happened on the night: the latest tick or the
   * signature, whichever is later. After the 4am roll this is what says
   * whether the list is still being walked or has gone quiet.
   */
  last_activity: string | null;
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

/**
 * One line of the list a night was signed against, frozen at the signature.
 *
 * Stored on close_nights.list_at_signing by certifyNight — the lines, their
 * proof, and who ticked them, as they stood that night. See listAtSigning in
 * checklists/actions.ts for where it is written.
 */
export type SignedItem = {
  item_id: string;
  position: number;
  title: string;
  proof: { kind: string }[] | null;
  section: string | null;
  ticked: boolean;
  initials: string | null;
  ticked_at: string | null;
};

/**
 * The frozen list a certified night was signed against, or null when there
 * isn't one to read.
 *
 * A report must score an old night against the list that existed that night,
 * not today's. Items get reordered, renamed and retired, so joining a past
 * night to the live table remeasured it every time somebody edited the list —
 * a night done exactly as written came back with a box unchecked and things
 * "still open". The signature froze the real list for exactly this; this reads
 * it back.
 */
export function signedList(listAtSigning: unknown): SignedItem[] | null {
  if (!Array.isArray(listAtSigning) || listAtSigning.length === 0) return null;
  return listAtSigning as SignedItem[];
}

export async function closeStatus(
  night: string = currentNight(),
): Promise<CloseStatusRow[]> {
  const { data: checklistRows, error: checklistError } = await db()
    .from("close_checklists")
    .select("id, venue_id, house, role, phase, room")
    .eq("active", true);
  if (checklistError) throw new Error(checklistError.message);
  const checklists = (checklistRows ?? []) as {
    id: string;
    venue_id: string;
    house: "FOH" | "HOH";
    role: string;
    room: string | null;
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
        .select("id, checklist_id, section, title, proof")
        .in("checklist_id", ids)
        .eq("active", true),
      db()
        .from("close_nights")
        .select(
          "id, checklist_id, certified_at, certified_by, open_reason, history, list_at_signing",
        )
        .in("checklist_id", ids)
        .eq("night", night),
    ]);

  const code = new Map(
    ((venueRows ?? []) as { id: string; code: string }[]).map((v) => [
      v.id,
      v.code,
    ]),
  );
  const items = (itemRows ?? []) as {
    id: string;
    checklist_id: string;
    section: string | null;
    title: string;
    proof: { kind: string }[] | null;
  }[];
  const nights = (nightRows ?? []) as {
    id: string;
    checklist_id: string;
    certified_at: string | null;
    certified_by: string | null;
    open_reason: string | null;
    history: unknown[] | null;
    list_at_signing: unknown;
  }[];

  // Two more columns on a query that was already running. The timestamps are
  // what the pace is read from, and fetching them separately would be a
  // second round trip for rows already in hand.
  let ticks: {
    night_id: string;
    item_id: string;
    initials: string | null;
    created_at: string;
    client_at: string | null;
  }[] = [];
  if (nights.length > 0) {
    const { data: tickRows } = await db()
      .from("close_ticks")
      .select("night_id, item_id, initials, created_at, client_at")
      .order("created_at")
      .in(
        "night_id",
        nights.map((n) => n.id),
      );
    ticks = (tickRows ?? []) as typeof ticks;
  }
  // What arrived against what was asked for, on the same nights.
  let proofRows: { night_id: string; item_id: string }[] = [];
  if (nights.length > 0) {
    const { data } = await db()
      .from("close_proof")
      .select("night_id, item_id")
      .in(
        "night_id",
        nights.map((n) => n.id),
      );
    proofRows = (data ?? []) as typeof proofRows;
  }
  const proofOf = new Set(proofRows.map((p) => `${p.night_id}:${p.item_id}`));

  const nightOf = new Map(nights.map((n) => [n.checklist_id, n]));
  const tickOf = new Set<string>();
  const timesOn = new Map<string, { at: string; claimedAt: string | null }[]>();
  const whoOn = new Map<string, string[]>();
  // Ticks arrive oldest first, so the last one written per night wins.
  const lastTickOn = new Map<string, string>();
  for (const t of ticks) {
    tickOf.add(`${t.night_id}:${t.item_id}`);
    lastTickOn.set(t.night_id, t.created_at);
    const who = t.initials?.trim().toUpperCase();
    if (who) {
      const names = whoOn.get(t.night_id) ?? [];
      if (!names.includes(who)) names.push(who);
      whoOn.set(t.night_id, names);
    }
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
      const row = nightOf.get(list.id);
      const certified = Boolean(row?.certified_at);
      // A certified night is scored against the list it was signed against,
      // not today's. Reordering, renaming or retiring an item changes the live
      // table and used to reach backwards into every recorded night — the
      // reordered item that landed at position 1 showed as unchecked, and a
      // finished night read as two still open. The signature froze the real
      // list; a live night has no snapshot and is measured against the items
      // as they stand now, which is correct because it is being walked now.
      const frozen = certified ? signedList(row?.list_at_signing) : null;
      // Only the items this night asked for. A deep clean carries one job per
      // weekday under a heading that names the day, and counting all seven
      // against tonight reported a list done exactly as written as signed
      // with six still open — a failure, on the report, for doing it right.
      // Anything ticked counts whether or not it was owed, so a job done on
      // the wrong day is still visible rather than quietly dropped.
      const asked: {
        id: string;
        title: string;
        proofLen: number;
        tickedHere: boolean;
      }[] = frozen
        ? frozen
            .filter((i) => dueOnNight(i.section, night) || i.ticked)
            .map((i) => ({
              id: i.item_id,
              title: i.title,
              proofLen: i.proof?.length ?? 0,
              tickedHere: i.ticked,
            }))
        : items
            .filter(
              (i) =>
                i.checklist_id === list.id &&
                (dueOnNight(i.section, night) ||
                  (row ? tickOf.has(`${row.id}:${i.id}`) : false)),
            )
            .map((i) => ({
              id: i.id,
              title: i.title,
              proofLen: i.proof?.length ?? 0,
              tickedHere: row ? tickOf.has(`${row.id}:${i.id}`) : false,
            }));
      const owed = asked.length;
      const ticked = asked.filter((i) => i.tickedHere).length;
      return {
        night,
        checklist_id: list.id,
        night_ends_at: endsAt,
        venue_code: code.get(list.venue_id) ?? "—",
        house: list.house,
        role: list.role,
        room: list.room ?? null,
        phase: list.phase,
        items_on_list: owed,
        ticked,
        open: Math.max(0, owed - ticked),
        untouched: owed > 0 && ticked === 0 && !certified,
        empty: owed === 0,
        certified,
        certified_by: row?.certified_by ?? null,
        certified_at: row?.certified_at ?? null,
        checked_by: row ? (whoOn.get(row.id) ?? []) : [],
        signed_with_gaps: certified && ticked < owed,
        open_reason: row?.open_reason?.trim() || null,
        proof_missing: row
          ? asked.filter(
              (i) =>
                i.proofLen > 0 &&
                i.tickedHere &&
                !proofOf.has(`${row.id}:${i.id}`),
            ).length
          : 0,
        open_titles: row
          ? asked.filter((i) => !i.tickedHere).map((i) => i.title)
          : asked.map((i) => i.title),
        reopened: Array.isArray(row?.history) ? row.history.length : 0,
        last_activity: row
          ? ([lastTickOn.get(row.id), row.certified_at]
              .filter((at): at is string => Boolean(at))
              .sort()
              .pop() ?? null)
          : null,
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
