import "server-only";

import { db, selectAll } from "./supabase";

/**
 * The Reading Club membership pipeline, read out of the two PeopleVine mirrors
 * that bst-ops/peoplevine fills twice a day.
 *
 * WHY A MIRROR AND NOT A LIVE CALL. PeopleVine never records when a status
 * changed. The REST API gives today's status and nothing else, so the only way
 * to answer "how long has this person been waiting", which is the whole
 * question, is to keep stamping what we see. peoplevine_stage_history is that
 * stamp and peoplevine_people.stage_since is the answer.
 *
 * TWO SOURCES BEHIND THOSE TABLES, AND THEY DISAGREE IN A USEFUL WAY.
 * The REST API owns membership: is_member and was_member are authoritative.
 * The control panel applicant grid owns the application status, because that
 * status exists nowhere else, not on the customer record and not in any of the
 * 223 REST paths. Where the two disagree, membership wins, and the disagreement
 * itself is worth showing, which is what needsChecking is for.
 */

/** B's words for the stages, 2026-10-31. The database keeps PeopleVine's. */
export const STAGE_LABEL: Record<string, string> = {
  FLAGGED: "APPROVED BY CH",
  APPROVED: "APPROVED BY CH",
  REVIEW: "MAYBE",
  WAITING: "MAYBE",
  APPLIED: "NEW",
  MEMBER: "MEMBER",
  FORMER: "FORMER MEMBER",
  REJECTED: "NO",
};

/**
 * The order the pipeline actually runs in, B 2026-10-31: "We approve members by
 * flagging, onsite team then goes, invites them for an intro, onboards, then
 * flips them to onboarded once done and they are members."
 */
const STAGE_ORDER = ["APPLIED", "REVIEW", "FLAGGED", "MEMBER", "FORMER", "REJECTED"];

export type Person = {
  customer_id: number;
  full_name: string | null;
  email: string | null;
  mobile: string | null;
  stage: string | null;
  stage_since: string | null;
  applied_on: string | null;
  member_since: string | null;
  app_status_raw: string | null;
  is_member: boolean;
  was_member: boolean;
};

export type StageCount = {
  stage: string;
  label: string;
  people: number;
  live: number;
  oldestDays: number | null;
};

export type Waiting = {
  customer_id: number;
  name: string;
  email: string | null;
  days: number;
  appliedOn: string | null;
};

export type BillingRow = {
  customer_id: number | null;
  name: string;
  invoices: number;
  pastDue: number;
  oldestDays: number;
};

export type Decline = {
  name: string;
  amount: number;
  when: string;
  brand: string | null;
  lastFour: string | null;
};

export type Snapshot = {
  pulledAt: string | null;
  members: number;
  formerMembers: number;
  waitingOnIntro: Waiting[];
  newThisWeek: number;
  stages: StageCount[];
  /** On the grid as onboarded, with no membership record either way. */
  needsChecking: number;
  pastDueTotal: number;
  pastDueMembers: BillingRow[];
  declines30: { count: number; amount: number; rows: Decline[] };
  openInvoices30: { count: number; amount: number };
};

const DAY = 24 * 60 * 60 * 1000;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / DAY));
}

/**
 * The house account, not a person. B, 2026-10-31: "Ignore Wlk In Customer,
 * thats the house account." It holds 209 of the 331 aged open invoices and
 * $71,485 of the $86,688, so leaving it in overstates what members owe by about
 * five times. Dropped from every figure on this page.
 */
const HOUSE_ACCOUNT = /^walk\s?-?\s?in customer$/i;

function tidyName(raw: string | null, id: number): string {
  const name = (raw ?? "").replace(/\s+/g, " ").trim();
  return name || `Customer ${id}`;
}

export async function snapshot(): Promise<Snapshot> {
  const client = db();

  // The select string has to be ONE literal. Concatenating it with + leaves
  // the client unable to infer the row type and the builder comes back as
  // GenericStringError[], which fails the build with nothing obviously wrong
  // on the line. Every other caller in this repo passes a single literal.
  const people = await selectAll<Person>((from, to) =>
    client
      .from("peoplevine_people")
      .select(
        "customer_id, full_name, email, mobile, stage, stage_since, applied_on, member_since, app_status_raw, is_member, was_member",
      )
      .range(from, to),
  );

  const billing = await selectAll<{
    customer_id: number | null;
    full_name: string | null;
    status: string;
    amount: number | null;
    amount_due: number | null;
    charged_on: string | null;
    brand: string | null;
    last_four: string | null;
  }>((from, to) =>
    client
      .from("peoplevine_billing")
      .select(
        "customer_id, full_name, status, amount, amount_due, charged_on, brand, last_four",
      )
      .range(from, to),
  );

  const { data: freshest } = await client
    .from("peoplevine_people")
    .select("last_seen_at")
    .order("last_seen_at", { ascending: false })
    .limit(1);
  const pulledAt = freshest?.[0]?.last_seen_at ?? null;

  const members = people.filter((p) => p.is_member).length;
  const formerMembers = people.filter((p) => !p.is_member && p.was_member).length;

  // THE QUEUE. B approved these people and nobody has walked them in. Anyone
  // who has since become a member is not waiting, which is why membership is
  // filtered out here rather than trusted from the status.
  const waitingOnIntro: Waiting[] = people
    .filter(
      (p) =>
        !p.is_member &&
        !p.was_member &&
        (p.stage === "FLAGGED" || p.stage === "APPROVED"),
    )
    .map((p) => ({
      customer_id: p.customer_id,
      name: tidyName(p.full_name, p.customer_id),
      email: p.email,
      days: daysSince(p.stage_since ?? p.applied_on) ?? 0,
      appliedOn: p.applied_on,
    }))
    .sort((a, b) => b.days - a.days);

  const newThisWeek = people.filter((p) => {
    const d = daysSince(p.applied_on);
    return d !== null && d <= 7;
  }).length;

  // Live means an application inside the last 90 days. Everything older is
  // five years of sediment and mixing the two hides the handful of people who
  // are actually waiting right now.
  const byStage = new Map<string, Person[]>();
  for (const p of people) {
    if (!p.stage) continue;
    const key = p.stage === "WAITING" ? "REVIEW" : p.stage; // B: waiting folds into reviewing
    const list = byStage.get(key) ?? [];
    list.push(p);
    byStage.set(key, list);
  }

  const stages: StageCount[] = STAGE_ORDER.filter((s) => byStage.has(s)).map((stage) => {
    const list = byStage.get(stage) ?? [];
    const ages = list
      .map((p) => daysSince(p.stage_since ?? p.applied_on))
      .filter((d): d is number => d !== null);
    return {
      stage,
      label: STAGE_LABEL[stage] ?? stage,
      people: list.length,
      live: list.filter((p) => {
        const d = daysSince(p.applied_on);
        return d !== null && d <= 90;
      }).length,
      oldestDays: ages.length ? Math.max(...ages) : null,
    };
  });

  // Marked onboarded on the grid and carrying no membership record at all.
  // Either the onboarding never finished or somebody set the status by hand.
  const needsChecking = people.filter(
    (p) => p.app_status_raw === "onboarded" && !p.is_member && !p.was_member,
  ).length;

  const open = billing.filter((b) => b.status === "invoiced");
  const aged = open.filter((b) => (daysSince(b.charged_on) ?? 0) > 90);

  const owed = new Map<string, BillingRow>();
  for (const b of aged) {
    const name = tidyName(b.full_name, b.customer_id ?? 0);
    const due = Number(b.amount_due ?? 0);
    if (HOUSE_ACCOUNT.test(name)) continue;
    const key = `${b.customer_id ?? name}`;
    const row = owed.get(key) ?? {
      customer_id: b.customer_id,
      name,
      invoices: 0,
      pastDue: 0,
      oldestDays: 0,
    };
    row.invoices += 1;
    row.pastDue += due;
    row.oldestDays = Math.max(row.oldestDays, daysSince(b.charged_on) ?? 0);
    owed.set(key, row);
  }
  const pastDueMembers = [...owed.values()].sort((a, b) => b.pastDue - a.pastDue);
  const pastDueTotal = pastDueMembers.reduce((n, r) => n + r.pastDue, 0);

  const notHouse = (b: { full_name: string | null; customer_id: number | null }) =>
    !HOUSE_ACCOUNT.test(tidyName(b.full_name, b.customer_id ?? 0));

  const recentOpen = open.filter(
    (b) => notHouse(b) && (daysSince(b.charged_on) ?? 9999) <= 30,
  );

  const declined = billing
    .filter(
      (b) =>
        b.status === "declined" &&
        notHouse(b) &&
        (daysSince(b.charged_on) ?? 9999) <= 30,
    )
    .sort((a, b) => Date.parse(b.charged_on ?? "") - Date.parse(a.charged_on ?? ""));

  return {
    pulledAt,
    members,
    formerMembers,
    waitingOnIntro,
    newThisWeek,
    stages,
    needsChecking,
    pastDueTotal,
    pastDueMembers,
    declines30: {
      count: declined.length,
      amount: declined.reduce((n, b) => n + Number(b.amount ?? 0), 0),
      rows: declined.slice(0, 25).map((b) => ({
        name: tidyName(b.full_name, b.customer_id ?? 0),
        amount: Number(b.amount ?? 0),
        when: b.charged_on ?? "",
        brand: b.brand,
        lastFour: b.last_four,
      })),
    },
    openInvoices30: {
      count: recentOpen.length,
      amount: recentOpen.reduce((n, b) => n + Number(b.amount_due ?? 0), 0),
    },
  };
}

/** Members who are current, for the roll. Not shown by default, kept for later. */
export function isCurrentMember(p: Person): boolean {
  return p.is_member;
}
