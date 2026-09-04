import "server-only";

import { closeStatus, type CloseStatusRow } from "./close-status";
import { db } from "./supabase";
import { currentNight, isNightOver } from "./night";
import { tierOf } from "./status";

/**
 * Who closed, who signed, and what was left open.
 *
 * The rollup answers "what keeps getting missed" over thirty nights and
 * `closeStatus` answers "where does every list stand right now". Neither
 * answers the question a GM actually opens the app with, which is: which of
 * my lists failed last night, and who signed the ones that did.
 *
 * Every figure here is arithmetic on rows that already exist. Nothing is
 * inferred, weighted or modelled — a compliance record that cannot be
 * recomputed from the same rows tomorrow is not a record.
 */

/**
 * Where one list finished.
 *
 * `open` is deliberately not a failure. A list with work still on it at
 * eleven at night is a list being worked, and a report that called that a
 * failure would be red every evening and ignored by the weekend. It becomes a
 * failure when the night ends with it still unsigned.
 */
export type ListState = "pass" | "fail" | "open" | "empty";

export type ListVerdict = {
  row: CloseStatusRow;
  state: ListState;
  /** Why, in the words the row itself justifies. Shown on the list. */
  reason: string;
};

export type VenueCompliance = {
  code: string;
  /** Items ticked out of items owed, scaled to ten. */
  score: number;
  tier: "good" | "neutral" | "fail";
  owed: number;
  ticked: number;
  lists: ListVerdict[];
  listsSigned: number;
  listsTotal: number;
  failed: number;
};

/** The ten-point scale the weekly board already uses. */
export function scoreOf(ticked: number, owed: number): number {
  if (owed === 0) return 0;
  return Math.round((ticked / owed) * 10);
}

/**
 * One list's verdict.
 *
 * A signature over open items is a failure and not a near miss. The whole
 * value of a close list is that somebody attested the room was in a state;
 * signing while four things are open attests to something that had not
 * happened, which is worse than not signing at all and is the reason
 * `open_at_signing` is stored.
 */
export function verdictOf(
  row: CloseStatusRow,
  nightOver: boolean,
): ListVerdict {
  if (row.empty) {
    return {
      row,
      state: "empty",
      reason: `${row.role} · nothing written on it yet`,
    };
  }

  const who = row.certified_by?.trim();
  const signed = who ? ` by ${who}` : "";

  if (row.certified) {
    if (row.open > 0) {
      return {
        row,
        state: "fail",
        reason: `${row.role} · signed${signed} with ${row.open} still open`,
      };
    }
    return {
      row,
      state: "pass",
      reason: `${row.role} · ${row.ticked} of ${row.items_on_list} · signed${signed}`,
    };
  }

  if (row.untouched) {
    return {
      row,
      state: nightOver ? "fail" : "open",
      reason: nightOver
        ? `${row.role} · never opened · 0 of ${row.items_on_list}`
        : `${row.role} · not started · 0 of ${row.items_on_list}`,
    };
  }

  return {
    row,
    state: nightOver ? "fail" : "open",
    reason: nightOver
      ? `${row.role} · ${row.ticked} of ${row.items_on_list} · nobody signed`
      : `${row.role} · ${row.ticked} of ${row.items_on_list} · in progress`,
  };
}

/** Fails first, then whatever is still open, then the ones that are done. */
const STATE_ORDER: Record<ListState, number> = {
  fail: 0,
  open: 1,
  empty: 2,
  pass: 3,
};

/**
 * Every venue running a list on this night, worst first.
 *
 * A venue with no lists at all does not appear. It is not failing the close
 * programme, it is not in it, and a page that scored it zero would be
 * reporting on a decision nobody made.
 */
export async function nightCompliance(
  night: string = currentNight(),
  now: Date = new Date(),
): Promise<VenueCompliance[]> {
  const rows = await closeStatus(night);
  const over = isNightOver(night, now);

  const byVenue = new Map<string, CloseStatusRow[]>();
  for (const row of rows) {
    const held = byVenue.get(row.venue_code);
    if (held) held.push(row);
    else byVenue.set(row.venue_code, [row]);
  }

  const venues: VenueCompliance[] = [];
  for (const [code, venueRows] of byVenue) {
    const lists = venueRows
      .map((row) => verdictOf(row, over))
      .sort(
        (a, b) =>
          STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
          a.row.role.localeCompare(b.row.role) ||
          a.row.phase.localeCompare(b.row.phase),
      );

    // Empty lists are out of both halves of the ratio. Nobody can tick an item
    // that was never written, and counting the zero against the venue would
    // report a setup mistake as a crew failure.
    const counted = venueRows.filter((r) => !r.empty);
    const owed = counted.reduce((n, r) => n + r.items_on_list, 0);
    const ticked = counted.reduce((n, r) => n + r.ticked, 0);

    venues.push({
      code,
      score: scoreOf(ticked, owed),
      tier: tierOf(ticked, owed),
      owed,
      ticked,
      lists,
      listsSigned: counted.filter((r) => r.certified).length,
      listsTotal: counted.length,
      failed: lists.filter((l) => l.state === "fail").length,
    });
  }

  const TIER_ORDER = { fail: 0, neutral: 1, good: 2 } as const;
  return venues.sort(
    (a, b) =>
      TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
      a.score - b.score ||
      a.code.localeCompare(b.code),
  );
}

export type ItemOutcome = {
  id: string;
  title: string;
  section: string | null;
  ticked: boolean;
  /** Who tapped it. The initials are typed per tick, not per session. */
  initials: string | null;
  at: string | null;
  /** What the item asked for, and whether it arrived. */
  proofWanted: ("photo" | "video" | "note")[];
  proofGiven: number;
};

export type ListDetail = {
  role: string;
  house: "FOH" | "HOH";
  phase: "open" | "mid" | "close";
  items: ItemOutcome[];
  ticked: number;
  owed: number;
  certifiedBy: string | null;
  certifiedAt: string | null;
  /** What was still open at the moment somebody signed, as stored then. */
  openAtSigning: number | null;
  /** The last tick of the night, which is when work actually stopped. */
  lastTickAt: string | null;
  reopened: number;
};

/**
 * One list, one night, item by item.
 *
 * The three columns a GM is actually after are here and nowhere else in the
 * app: which items finished, who tapped each one, and at what time. All three
 * have been stored on every tick since the first night and shown on no screen.
 */
export async function listDetail(
  checklistId: string,
  night: string,
): Promise<ListDetail | null> {
  const { data: listRow } = await db()
    .from("close_checklists")
    .select("id, house, role, phase")
    .eq("id", checklistId)
    .maybeSingle();
  const list = listRow as {
    id: string;
    house: "FOH" | "HOH";
    role: string;
    phase: "open" | "mid" | "close";
  } | null;
  if (!list) return null;

  const [{ data: itemRows }, { data: nightRow }] = await Promise.all([
    db()
      .from("close_items")
      .select("id, position, title, section, proof")
      .eq("checklist_id", checklistId)
      .eq("active", true)
      .order("position"),
    db()
      .from("close_nights")
      .select("id, certified_at, certified_by, open_at_signing, history")
      .eq("checklist_id", checklistId)
      .eq("night", night)
      .maybeSingle(),
  ]);

  const items = (itemRows ?? []) as {
    id: string;
    position: number;
    title: string;
    section: string | null;
    proof: { kind: "photo" | "video" | "note" }[] | null;
  }[];

  const stored = nightRow as {
    id: string;
    certified_at: string | null;
    certified_by: string | null;
    open_at_signing: unknown;
    history: unknown[] | null;
  } | null;

  let ticks: {
    item_id: string;
    initials: string | null;
    created_at: string;
  }[] = [];
  let proof: { item_id: string }[] = [];
  if (stored) {
    const [t, p] = await Promise.all([
      db()
        .from("close_ticks")
        .select("item_id, initials, created_at")
        .eq("night_id", stored.id),
      db().from("close_proof").select("item_id").eq("night_id", stored.id),
    ]);
    ticks = (t.data ?? []) as typeof ticks;
    proof = (p.data ?? []) as typeof proof;
  }

  const tickOf = new Map(ticks.map((t) => [t.item_id, t]));
  const proofCount = new Map<string, number>();
  for (const row of proof) {
    proofCount.set(row.item_id, (proofCount.get(row.item_id) ?? 0) + 1);
  }

  const outcomes: ItemOutcome[] = items.map((item) => {
    const tick = tickOf.get(item.id);
    return {
      id: item.id,
      title: item.title,
      section: item.section,
      ticked: Boolean(tick),
      initials: tick?.initials?.trim() || null,
      at: tick?.created_at ?? null,
      proofWanted: (item.proof ?? []).map((p) => p.kind),
      proofGiven: proofCount.get(item.id) ?? 0,
    };
  });

  const times = ticks
    .map((t) => t.created_at)
    .filter(Boolean)
    .sort();

  return {
    role: list.role,
    house: list.house,
    phase: list.phase,
    // Open first. The four things nobody did are the reason this screen is
    // being read; making a GM scroll past ten finished ones to find them is
    // the same as not showing them.
    items: [
      ...outcomes.filter((i) => !i.ticked),
      ...outcomes.filter((i) => i.ticked),
    ],
    ticked: outcomes.filter((i) => i.ticked).length,
    owed: outcomes.length,
    certifiedBy: stored?.certified_by ?? null,
    certifiedAt: stored?.certified_at ?? null,
    openAtSigning: Array.isArray(stored?.open_at_signing)
      ? stored.open_at_signing.length
      : null,
    lastTickAt: times.length > 0 ? times[times.length - 1] : null,
    reopened: Array.isArray(stored?.history) ? stored.history.length : 0,
  };
}

/**
 * Which positions are carrying the failures.
 *
 * Three fails at one venue read as a bad night; three fails that are all the
 * same position read as one conversation with one person, which is the more
 * useful of the two and is invisible until somebody groups on it.
 */
export function failuresByRole(
  lists: ListVerdict[],
): { role: string; failed: number; of: number }[] {
  const roles = new Map<string, { failed: number; of: number }>();
  for (const list of lists) {
    if (list.state === "empty") continue;
    const held = roles.get(list.row.role) ?? { failed: 0, of: 0 };
    held.of += 1;
    if (list.state === "fail") held.failed += 1;
    roles.set(list.row.role, held);
  }
  return [...roles.entries()]
    .map(([role, counts]) => ({ role, ...counts }))
    .filter((r) => r.failed > 0)
    .sort((a, b) => b.failed - a.failed || a.role.localeCompare(b.role));
}
