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
  /** How many attempts this is. A gateway retries, and three rows for one
      charge reads as three members in trouble instead of one. */
  tries: number;
};

export type GrowthPoint = {
  /** YYYY-MM */
  month: string;
  /** Members who joined in that month and are still members. */
  joined: number;
  /** Running total of those. */
  total: number;
};

export type RevenueMonth = {
  month: string;
  dues_collected: number;
  pos_spend: number;
  other_collected: number;
};

export type Revenue = {
  months: RevenueMonth[];
  /** Calendar year to date. */
  yearDues: number;
  yearPos: number;
  yearOther: number;
  /** The most recent complete month, for a like for like line. */
  lastFullMonth: RevenueMonth | null;
};

export type Program = {
  program_id: number;
  title: string | null;
  monthly_price: number | null;
  active_members: number;
  failed_members: number;
  suspended_members: number;
  monthly_dues: number | null;
  dues_at_risk: number | null;
};

export type FailingCard = {
  customer_id: number;
  name: string;
  email: string | null;
  program: string | null;
  monthlyPrice: number;
  since: string | null;
  days: number | null;
  /** Still on the member roll despite the billing failing. */
  stillAMember: boolean;
};

export type Dues = {
  monthly: number;
  annual: number;
  atRisk: number;
  failing: number;
  programs: Program[];
  /** Who, oldest failure first. The count is not actionable; the list is. */
  failingCards: FailingCard[];
};

export type Snapshot = {
  pulledAt: string | null;
  members: number;
  /**
   * Dues at the posted rate, not money in the bank.
   *
   * Active cards times the monthly rate. It knows nothing about comps or
   * discounts, which is why PeopleVine's own MRR for Regular reads lower than
   * 430 times $200. The rates are transcribed from the control panel because
   * the API does not carry a price, and the transcription lives in
   * bst-ops/peoplevine/pull_peoplevine_dues.py with the date it was read.
   */
  /**
   * Money actually collected, by month, from the transaction ledger.
   * Separate from `dues`, which is the roll at the posted rate. Collected can
   * run above the roll when arrears are caught up, and that gap is the point.
   */
  revenue: Revenue | null;
  dues: Dues | null;
  /** The most recent join date. The stall shows up here before anywhere else. */
  newestMemberOn: string | null;
  /**
   * Today's members by the month they joined, running to the current total.
   *
   * IT IS NOT A HISTORY OF HEADCOUNT AND MUST NOT BE LABELLED AS ONE.
   * PeopleVine records member_since and nothing for the day a membership
   * ended, so anyone who has left is simply absent from this line. The curve
   * therefore reads low in the early years and is exact only at today's end,
   * where it lands on the real 555. What it does show honestly is when the
   * people who are still here arrived, and that is where the stall is visible.
   */
  growth: GrowthPoint[];
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

/**
 * Spanish and Portuguese compound surnames, where the last TWO words are the
 * family name and dropping either one renames the person. Lopez Cervantes is
 * not Adolfo's middle name.
 */
const COMPOUND_SURNAME =
  /^(de|del|de la|de los|la|las|los|van|von|da|das|dos|di|du|el|al|bin|ibn|mac|mc|o|st|san|santa)$/i;

const SURNAME_HEAD =
  /^(lopez|garcia|martinez|rodriguez|hernandez|gonzalez|perez|sanchez|ramirez|torres|flores|rivera|gomez|diaz|cruz|morales|reyes|gutierrez|ortiz|chavez|ruiz|alvarez|castillo|jimenez|vargas|romero|herrera|medina|aguilar|silva|santos|costa|ferreira|oliveira|souza|pereira|carvalho)$/i;

/**
 * The name as it goes on the board.
 *
 * MIDDLE NAMES COME OUT. B, 2026-10-31: "cut middle names perhaps?" Three and
 * four word names were the rows that ran long, and a middle name is the part
 * nobody needs to recognise somebody.
 *
 * A COMPOUND SURNAME IS NOT A MIDDLE NAME and keeps both words. Trimming
 * "Adolfo Lopez Cervantes" to "Adolfo Cervantes" does not shorten his name, it
 * changes it.
 */
/** Jr, Sr, III and the rest. A suffix is not a surname. */
const SUFFIX = /^(jr|jnr|sr|snr|ii|iii|iv|v|md|phd|dds|esq)\.?$/i;

function tidyName(raw: string | null, id: number): string {
  const name = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!name) return `Customer ${id}`;
  const parts = name.split(" ").filter(Boolean);
  if (parts.length <= 2) return name;

  // PULL THE SUFFIX OFF FIRST. Taking the last word as the surname turned Jim
  // Madaffer Jr into "Jim Jr", which is not a shorter name, it is the wrong
  // person. Found on the live page 2026-10-31.
  let suffix = "";
  const core = [...parts];
  if (SUFFIX.test(core[core.length - 1]) && core.length > 2) {
    suffix = " " + core.pop();
  }
  if (core.length <= 2) return core.join(" ") + suffix;

  const lastTwo = core[core.length - 2];
  if (COMPOUND_SURNAME.test(lastTwo) || SURNAME_HEAD.test(lastTwo)) {
    return `${core[0]} ${lastTwo} ${core[core.length - 1]}${suffix}`;
  }
  return `${core[0]} ${core[core.length - 1]}${suffix}`;
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

  const { data: revenueRows } = await client
    .from("peoplevine_revenue")
    .select("month, dues_collected, pos_spend, other_collected")
    .order("month", { ascending: true });

  // Named revMonths, not months: `months` is already the growth curve's list
  // of YYYY-MM strings a few lines above and the two collided.
  const revMonths = ((revenueRows ?? []) as RevenueMonth[]).map((m) => ({
    month: m.month,
    dues_collected: Number(m.dues_collected ?? 0),
    pos_spend: Number(m.pos_spend ?? 0),
    other_collected: Number(m.other_collected ?? 0),
  }));
  const thisYear = String(new Date().getFullYear());
  // The month in progress is not a month. Comparing a part month against full
  // ones draws a collapse that has not happened.
  const nowKey = new Date().toISOString().slice(0, 7);
  const complete = revMonths.filter((m) => m.month !== nowKey);
  const revenue: Revenue | null = revMonths.length
    ? {
        months: revMonths,
        yearDues: revMonths
          .filter((m) => m.month.startsWith(thisYear))
          .reduce((n, m) => n + m.dues_collected, 0),
        yearPos: revMonths
          .filter((m) => m.month.startsWith(thisYear))
          .reduce((n, m) => n + m.pos_spend, 0),
        yearOther: revMonths
          .filter((m) => m.month.startsWith(thisYear))
          .reduce((n, m) => n + m.other_collected, 0),
        lastFullMonth: complete.length ? complete[complete.length - 1] : null,
      }
    : null;

  const { data: programRows } = await client
    .from("peoplevine_programs")
    .select(
      "program_id, title, monthly_price, active_members, failed_members, suspended_members, monthly_dues, dues_at_risk",
    )
    .order("monthly_dues", { ascending: false, nullsFirst: false });

  const { data: failingRows } = await client
    .from("peoplevine_failing_cards")
    .select("customer_id, program_title, monthly_price, failing_since")
    .order("failing_since", { ascending: true, nullsFirst: false });

  // Names live on the people table, not on the card, so they are joined here
  // rather than copied at pull time: a name that is copied goes stale.
  const failingCards: FailingCard[] = ((failingRows ?? []) as {
    customer_id: number;
    program_title: string | null;
    monthly_price: number | null;
    failing_since: string | null;
  }[]).map((r) => {
    const who = people.find((p) => p.customer_id === r.customer_id);
    return {
      customer_id: r.customer_id,
      name: tidyName(who?.full_name ?? null, r.customer_id),
      email: who?.email ?? null,
      program: r.program_title,
      monthlyPrice: Number(r.monthly_price ?? 0),
      since: r.failing_since,
      days: daysSince(r.failing_since),
      stillAMember: Boolean(who?.is_member),
    };
  });

  const programs = (programRows ?? []) as Program[];
  const dues: Dues | null = programs.length
    ? {
        monthly: programs.reduce((n, p) => n + Number(p.monthly_dues ?? 0), 0),
        annual: programs.reduce((n, p) => n + Number(p.monthly_dues ?? 0), 0) * 12,
        atRisk: programs.reduce((n, p) => n + Number(p.dues_at_risk ?? 0), 0),
        failing: programs.reduce((n, p) => n + (p.failed_members ?? 0), 0),
        programs: programs.filter((p) => (p.monthly_price ?? 0) > 0),
        failingCards,
      }
    : null;

  const { data: freshest } = await client
    .from("peoplevine_people")
    .select("last_seen_at")
    .order("last_seen_at", { ascending: false })
    .limit(1);
  const pulledAt = freshest?.[0]?.last_seen_at ?? null;

  const members = people.filter((p) => p.is_member).length;
  const formerMembers = people.filter((p) => !p.is_member && p.was_member).length;

  // Today's members, bucketed by the month they joined, then run forward.
  // Months with nobody joining are filled in: dropping them would space the
  // axis by event rather than by time and draw a flat stretch as a climb.
  const perMonth = new Map<string, number>();
  for (const p of people) {
    if (!p.is_member || !p.member_since) continue;
    const key = p.member_since.slice(0, 7);
    perMonth.set(key, (perMonth.get(key) ?? 0) + 1);
  }
  const growth: GrowthPoint[] = [];
  const months = [...perMonth.keys()].sort();
  if (months.length) {
    const [fy, fm] = months[0].split("-").map(Number);
    const cursor = new Date(Date.UTC(fy, fm - 1, 1));
    const end = new Date();
    let running = 0;
    while (
      cursor.getUTCFullYear() < end.getUTCFullYear() ||
      (cursor.getUTCFullYear() === end.getUTCFullYear() &&
        cursor.getUTCMonth() <= end.getUTCMonth())
    ) {
      const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
      const joined = perMonth.get(key) ?? 0;
      running += joined;
      growth.push({ month: key, joined, total: running });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

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

  // ONE DECLINE PER PERSON PER CARD, NOT ONE PER ATTEMPT. A gateway retries a
  // failed charge, so the raw rows showed the same member three times on the
  // same day for the same amount, which reads as three members in trouble
  // rather than one card that needs replacing. Attempts are counted instead,
  // and the amount shown is the charge, never the sum of the retries.
  const declinedRaw = billing
    .filter(
      (b) =>
        b.status === "declined" &&
        notHouse(b) &&
        (daysSince(b.charged_on) ?? 9999) <= 30,
    )
    .sort((a, b) => Date.parse(b.charged_on ?? "") - Date.parse(a.charged_on ?? ""));

  const declinedBy = new Map<string, Decline>();
  for (const b of declinedRaw) {
    const name = tidyName(b.full_name, b.customer_id ?? 0);
    const key = `${b.customer_id ?? name}|${b.last_four ?? ""}|${Number(b.amount ?? 0)}`;
    const seen = declinedBy.get(key);
    if (seen) {
      seen.tries += 1;
      continue;
    }
    declinedBy.set(key, {
      name,
      amount: Number(b.amount ?? 0),
      when: b.charged_on ?? "",
      brand: b.brand,
      lastFour: b.last_four,
      tries: 1,
    });
  }
  const declined = [...declinedBy.values()];

  const newestMemberOn =
    people
      .filter((p) => p.is_member && p.member_since)
      .map((p) => p.member_since as string)
      .sort()
      .pop() ?? null;

  return {
    pulledAt,
    members,
    dues,
    revenue,
    newestMemberOn,
    growth,
    formerMembers,
    waitingOnIntro,
    newThisWeek,
    stages,
    needsChecking,
    pastDueTotal,
    pastDueMembers,
    declines30: {
      count: declined.length,
      amount: declined.reduce((n, b) => n + b.amount, 0),
      rows: declined.slice(0, 25),
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
