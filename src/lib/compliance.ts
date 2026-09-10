import "server-only";

import { closeStatus, type CloseStatusRow } from "./close-status";
import { db } from "./supabase";
import { dueOnNight } from "./due";
import { listName } from "./slug";
import {
  carriesForward,
  currentNight,
  formatClock,
  isNightOver,
  nightEndsAt,
  shiftNights,
} from "./night";
import { paceOf, type Pace } from "./pace";
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

/**
 * Which pile a list goes in on the night page, in the order a person reads
 * them: what nobody signed, what was signed with things left, what is done,
 * what is still going. Plainer than pass and fail, which are verdicts, and a
 * manager reading this at ten in the morning wants to know what happened,
 * not what the app decided about it.
 */
export type ListGroup = "unsigned" | "gaps" | "done" | "going" | "empty";

/**
 * One fact about a list, as a label and a value: "checked off · 18 of 20 by
 * DA", "signed off · nobody". A row used to be one sentence with dots in it,
 * and at thirty-four items and two names the sentence ran to two lines and
 * the eye had nowhere to land. Lines it is.
 */
export type Fact = { label: string; value: string; warn?: boolean };

export type ListVerdict = {
  row: CloseStatusRow;
  state: ListState;
  group: ListGroup;
  /** "YB Bartender close": the list, with its room where it has one. */
  name: string;
  /** The same verdict as lines, for the page that lists them. */
  facts: Fact[];
  /** Why, in the words the row itself justifies. Shown on the list. */
  reason: string;
  /**
   * The pace, when it is worth saying out loud, and null when it is not.
   *
   * Kept apart from `state` on purpose. A list ticked three seconds an item
   * was not walked, but there are honest ways to produce that: a cook who
   * worked off paper and entered it after, a manager catching up a section
   * they stood and watched. Folding it into Fail would put the report in an
   * argument it cannot win. It sits next to the verdict instead, and a person
   * decides.
   */
  flag: string | null;
};

/**
 * One venue's night, counted in lists.
 *
 * One ruler. A list is done and signed, or it is not signed, or it was
 * signed with something not done; while the night is still running it can
 * also be still going. Those add up to `total`, always, and the score is
 * done and signed over total. Items are not counted here at all: they
 * belong to a list's own row, and a page that scored items and counted
 * lists read as two reports that disagreed.
 */
export type VenueCompliance = {
  code: string;
  /** Lists checked off and signed off, out of lists on the night, in tenths. */
  score: number;
  tier: "good" | "neutral" | "fail";
  lists: ListVerdict[];
  /** Every list that has something written on it. */
  total: number;
  /** Checked off and signed off: every item owed that night, and a name. */
  done: number;
  /** Signed, with something left on it. */
  notDone: number;
  /** Not signed off, and the night is over. */
  notSigned: number;
  /** Still being worked, because the night is not over yet. */
  going: number;
  /**
   * Whether anything was recorded on the night at all: a tick or a signature
   * on any list. A venue that was dark on a Monday has fifteen lists with
   * nothing on them, and that is not fifteen fails, it is a night off. The
   * rollup already skips such nights; the night page and the venue row read
   * this to do the same.
   */
  ran: boolean;
};

/** The ten-point scale the weekly board already uses. */
export function scoreOf(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 10);
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
  // Never set. We do not fail on time, only on what was not done and what
  // was not signed, and a pace on the row read as a third kind of failure
  // however it was worded. The field stays so the shape does not change.
  const flag = null;

  // "YB Bartender close", so the row says which list without a badge above
  // it. The phase is already a word; it does not need translating into one.
  const name = `${listName(row.role, row.room)} ${row.phase}`;

  if (row.empty) {
    return {
      row,
      flag,
      state: "empty",
      group: "empty",
      name,
      facts: [{ label: "items", value: "nothing written on it yet" }],
      reason: `${listName(row.role, row.room)} · nothing written on it yet`,
    };
  }
  const count = `${row.ticked}/${row.items_on_list}`;
  // Who, and when. The when was missing, and a card that says "signed by
  // Ethan" on a night that ran from four in the afternoon to four in the
  // morning leaves the reader to guess which end. A signature with no name
  // typed is still a signature, and says so rather than reading as nobody.
  const who = row.certified_by?.trim();
  const at = row.certified_at ? formatClock(row.certified_at) : "";
  const signature = [who || "no name", at].filter(Boolean).join(" · ");
  // Who checked things off, from the initials on the ticks. Every fail
  // names a person or says plainly that nobody put their initials to it.
  const by =
    row.checked_by.length > 0 ? row.checked_by.join(", ") : "no initials";
  const checked = `${count} checked off · ${by}`;
  // Ticked with nothing behind it. Shown beside the fails, not among them.
  const proof: Fact[] =
    row.proof_missing > 0
      ? [
          {
            label: "missing photo or video",
            value: `${row.proof_missing} ${
              row.proof_missing === 1 ? "item" : "items"
            }`,
          },
        ]
      : [];

  if (row.certified) {
    if (row.open > 0) {
      // The things themselves, where there are few enough to read. Three
      // names is a to-do list; nine is a count.
      const left = leftWords(row.open_titles);
      return {
        row,
        flag,
        state: "fail",
        group: "gaps",
        name,
        facts: [
          { label: "checked off", value: `${count} · ${by}` },
          { label: "signed off", value: signature },
          { label: "not checked off", value: left, warn: true },
          ...proof,
        ],
        reason: `${name} · ${checked} · signed off ${signature} · not checked off: ${left}`,
      };
    }
    return {
      row,
      flag,
      state: "pass",
      group: "done",
      name,
      facts: [
        { label: "checked off", value: `${count} · ${by}` },
        { label: "signed off", value: signature },
        ...proof,
      ],
      reason: `${name} · checked off by ${by} · signed off ${signature}`,
    };
  }

  if (row.untouched) {
    return {
      row,
      flag,
      state: nightOver ? "fail" : "open",
      group: nightOver ? "unsigned" : "going",
      name,
      facts: nightOver
        ? [
            { label: "checked off", value: "nothing, by nobody", warn: true },
            { label: "signed off", value: "nobody", warn: true },
          ]
        : [{ label: "checked off", value: "not started" }],
      reason: nightOver
        ? `${name} · nobody checked anything off · nobody signed off`
        : `${name} · not started`,
    };
  }

  return {
    row,
    flag,
    state: nightOver ? "fail" : "open",
    group: nightOver ? "unsigned" : "going",
    name,
    facts: [
      { label: "checked off", value: `${count} · ${by}` },
      nightOver
        ? { label: "signed off", value: "nobody", warn: true }
        : { label: "signed off", value: "not yet · in progress" },
      ...proof,
    ],
    reason: nightOver
      ? `${name} · ${checked} · nobody signed off`
      : `${name} · ${checked} · in progress`,
  };
}

/**
 * What was left, said as things rather than as a number where that is short
 * enough to read. Titles on these lists run to a paragraph, so each is cut
 * to its first clause: up to the first full stop, colon or comma, and no
 * more than a few words. "Detail both carts" is the thing; the rest of the
 * sentence is on the list's own page.
 */
function leftWords(titles: string[]): string {
  if (titles.length === 0) return "nothing";
  if (titles.length > 3) return `${titles.length} things`;
  return titles
    .map((t) => {
      const first = t.split(/[.:,(]/)[0].trim();
      return first.length > 32 ? `${first.slice(0, 30).trim()}…` : first;
    })
    .join(", ")
    .toLowerCase();
}

/** The order a shift runs in, which is not the order the alphabet runs in. */
const PHASE_ORDER: Record<string, number> = { open: 0, mid: 1, close: 2 };

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
  // The night is over at 4am, unless this list is still being walked. A
  // close that ran past four was touched minutes ago; calling it a fail at
  // 4:08 while the barback is still ticking is what had a manager reading
  // the roll as a cutoff. The same rule the tick screen files work under.
  const nightOver = isNightOver(night, now);
  const overFor = (row: CloseStatusRow) =>
    nightOver && !carriesForward(row.last_activity, now);

  const byVenue = new Map<string, CloseStatusRow[]>();
  for (const row of rows) {
    const held = byVenue.get(row.venue_code);
    if (held) held.push(row);
    else byVenue.set(row.venue_code, [row]);
  }

  const venues: VenueCompliance[] = [];
  for (const [code, venueRows] of byVenue) {
    const lists = venueRows
      .map((row) => verdictOf(row, overFor(row)))
      .sort(
        (a, b) =>
          STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
          // Then the shape of the night: opens, mids, closes. Sorted by role
          // first, the passes read as a scramble of phases and the page had
          // no order a person could see.
          PHASE_ORDER[a.row.phase] - PHASE_ORDER[b.row.phase] ||
          a.row.role.localeCompare(b.row.role),
      );

    // Empty lists are out of both halves of the ratio. Nobody can tick an item
    // that was never written, and counting the zero against the venue would
    // report a setup mistake as a crew failure.
    const count = (group: ListGroup) =>
      lists.filter((l) => l.group === group).length;
    const done = count("done");
    const total = lists.length - count("empty");

    venues.push({
      code,
      score: scoreOf(done, total),
      tier: tierOf(done, total),
      lists,
      total,
      done,
      notDone: count("gaps"),
      notSigned: count("unsigned"),
      going: count("going"),
      ran: venueRows.some((r) => r.ticked > 0 || r.certified),
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
  /** The room, where the position runs one list per room. */
  room: string | null;
  house: "FOH" | "HOH";
  phase: "open" | "mid" | "close";
  items: ItemOutcome[];
  ticked: number;
  owed: number;
  certifiedBy: string | null;
  /**
   * The second signature, and whether it came off the same phone.
   *
   * A list nobody checked is the honest answer to a question the old record
   * could not answer at all. `sameDevice` is not proof of anything on its own:
   * a shared iPad behind the bar makes it true for two genuinely different
   * people. It is worth showing next to the two names and letting a person
   * decide, which is the same rule the pace reading follows.
   */
  verifiedBy: string | null;
  verifiedAt: string | null;
  sameDevice: boolean;
  certifiedAt: string | null;
  /** What was still open at the moment somebody signed, as stored then. */
  openAtSigning: number | null;
  /** The last tick of the night, which is when work actually stopped. */
  lastTickAt: string | null;
  reopened: number;
  /** How the ticks arrived: the pace of them, and how late they landed. */
  pace: Pace;
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
    .select("id, house, role, room, phase")
    .eq("id", checklistId)
    .maybeSingle();
  const list = listRow as {
    id: string;
    house: "FOH" | "HOH";
    role: string;
    room: string | null;
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
      .select(
        "id, certified_at, certified_by, verified_at, verified_by, certified_device, verified_device, open_at_signing, history",
      )
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
    verified_at: string | null;
    verified_by: string | null;
    certified_device: string | null;
    verified_device: string | null;
    open_at_signing: unknown;
    history: unknown[] | null;
  } | null;

  let ticks: {
    item_id: string;
    initials: string | null;
    created_at: string;
    client_at: string | null;
  }[] = [];
  let proof: { item_id: string }[] = [];
  if (stored) {
    const [t, p] = await Promise.all([
      db()
        .from("close_ticks")
        .select("item_id, initials, created_at, client_at")
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

  const outcomes: ItemOutcome[] = items
    /**
     * Only what this night asked for.
     *
     * A deep clean list files its seven items under seven day headings, one
     * per night. Reporting all seven every night turned a finished job into
     * six misses, which is the same lie the tick screen was telling and lands
     * in the place it actually gets acted on.
     *
     * An item filed under another day that somebody did anyway stays in, so
     * getting ahead is still credited. Only the ones nobody was asked for and
     * nobody did drop out.
     */
    .filter((item) => dueOnNight(item.section, night) || tickOf.has(item.id))
    .map((item) => {
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
    room: list.room,
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
    verifiedBy: stored?.verified_by ?? null,
    verifiedAt: stored?.verified_at ?? null,
    sameDevice: Boolean(
      stored?.certified_device &&
      stored.certified_device === stored.verified_device,
    ),
    openAtSigning: Array.isArray(stored?.open_at_signing)
      ? stored.open_at_signing.length
      : null,
    lastTickAt: times.length > 0 ? times[times.length - 1] : null,
    reopened: Array.isArray(stored?.history) ? stored.history.length : 0,
    pace: paceOf(
      ticks.map((t) => ({ at: t.created_at, claimedAt: t.client_at })),
      { start: nightEndsAt(shiftNights(night, -1)), end: nightEndsAt(night) },
    ),
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
    // Named with the room, or three deep cleans collapse into one row and
    // "Deep clean failed 3 of 3" hides which bar nobody did.
    const named = listName(list.row.role, list.row.room);
    const held = roles.get(named) ?? { failed: 0, of: 0 };
    held.of += 1;
    if (list.state === "fail") held.failed += 1;
    roles.set(named, held);
  }
  return [...roles.entries()]
    .map(([role, counts]) => ({ role, ...counts }))
    .filter((r) => r.failed > 0)
    .sort((a, b) => b.failed - a.failed || a.role.localeCompare(b.role));
}

/**
 * The shape of the last few weeks, one point per night.
 *
 * Two measures, in lists, the same ruler as every other number. Signed is
 * the easier one: a name on the list. Done and signed is the one the report
 * is scored on, and the gap between the two lines is the lists somebody
 * signed with things still left on them.
 *
 * Four queries for the whole window rather than one per night. Thirty nights
 * at four queries each is a hundred and twenty round trips for a sparkline.
 */
export async function nightTrend(
  window: string[],
): Promise<{ night: string; done: number; signed: number; ran: boolean }[]> {
  if (window.length === 0) return [];

  const { data: checklistRows } = await db()
    .from("close_checklists")
    .select("id")
    .eq("active", true);
  const ids = ((checklistRows ?? []) as { id: string }[]).map((c) => c.id);
  if (ids.length === 0) return [];

  const [{ data: itemRows }, { data: nightRows }] = await Promise.all([
    db()
      .from("close_items")
      .select("id, checklist_id, section")
      .in("checklist_id", ids)
      .eq("active", true),
    db()
      .from("close_nights")
      .select("id, checklist_id, night, certified_at")
      .in("checklist_id", ids)
      .gte("night", window[0])
      .lte("night", window[window.length - 1]),
  ]);

  const items = (itemRows ?? []) as {
    id: string;
    checklist_id: string;
    section: string | null;
  }[];
  const nights = (nightRows ?? []) as {
    id: string;
    checklist_id: string;
    night: string;
    certified_at: string | null;
  }[];

  let ticks: { night_id: string; item_id: string }[] = [];
  if (nights.length > 0) {
    const { data } = await db()
      .from("close_ticks")
      .select("night_id, item_id")
      .in(
        "night_id",
        nights.map((n) => n.id),
      );
    ticks = (data ?? []) as { night_id: string; item_id: string }[];
  }

  const ticked = new Set(ticks.map((t) => `${t.night_id}:${t.item_id}`));
  const itemsOf = new Map<string, typeof items>();
  for (const item of items) {
    const held = itemsOf.get(item.checklist_id) ?? [];
    held.push(item);
    itemsOf.set(item.checklist_id, held);
  }

  // Done and signed: a name on it, and every item owed that night ticked.
  // The same rule the rollup and the night page use, or the line and the
  // ring disagree about the same night.
  const complete = (row: { id: string; checklist_id: string; night: string }) =>
    (itemsOf.get(row.checklist_id) ?? [])
      .filter((item) => dueOnNight(item.section, row.night))
      .every((item) => ticked.has(`${row.id}:${item.id}`));

  // Every list that exists is owed every night in the window. A night nobody
  // opened has to count against the total or the quietest night reads as the
  // cleanest, which is the same trap the status feed was built to avoid.
  const listsPerNight = ids.length;

  return window.map((night) => {
    const rows = nights.filter((n) => n.night === night);
    const signedRows = rows.filter((r) => r.certified_at);
    const signed = signedRows.length;
    const done = signedRows.filter(complete).length;
    return {
      night,
      done: listsPerNight === 0 ? 0 : (done / listsPerNight) * 100,
      signed: listsPerNight === 0 ? 0 : (signed / listsPerNight) * 100,
      // Whether anybody opened anything at all. A night before the programme
      // started is not a night at nought, and a line that runs flat along the
      // floor for three weeks and then climbs is not a trend, it is the date
      // the app was installed. The calendar strip still wants every night,
      // which is why this is a flag rather than a shorter list.
      ran: rows.length > 0,
    };
  });
}
