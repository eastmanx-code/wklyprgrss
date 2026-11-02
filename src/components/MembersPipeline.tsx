import { MembershipCurve } from "./MembershipCurve";
import type { FailingCard, Snapshot } from "@/lib/peoplevine";

/**
 * The Reading Club membership board.
 *
 * It answers one question first, the one B asked: who did we say yes to that
 * nobody has walked in, and how long have they been waiting.
 *
 * WRITTEN THIRD, AGAINST THE DASHBOARD. The first version hand rolled its own
 * container and its own tables. The second used the right components but still
 * read small and boxy beside the rest of the site. The dashboard's actual
 * language is a dense meta line under the title, one wide panel per subject,
 * a row of 28px figures with 11px labels over them, and a full warn bar for
 * anything failing. That is what this uses now.
 *
 * NAMES ARE NEVER TRUNCATED. B: "cant hide names". A board naming who owes
 * money and who has been waiting a year is useless if the name is an ellipsis,
 * so the rows wrap instead of clipping.
 */

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

const exact = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const count = (n: number) => n.toLocaleString("en-US");

function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1))
    .toLocaleDateString("en-US", { timeZone: "UTC", month: "short", year: "2-digit" })
    .toUpperCase();
}

function pacific(iso: string | null): string {
  if (!iso) return "not pulled yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "not pulled yet";
  return d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

/**
 * The dashboard's secondary metric, unchanged: 11px label in the one grey, a
 * 28px figure, and a quiet line saying what it counts. A bare number gets read
 * as whatever the viewer assumes.
 */
function Stat({
  label,
  value,
  sub,
  accent = false,
  money: isMoney = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
  /** Dollar figures take a smaller size: "$2,046,018" at 40px in a four
      column row runs straight into its neighbour, where "555" has room. */
  money?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="label">{label}</p>
      {/* A size above the dashboard's 28px stat. These are the figures the
          page exists to show and at 28px they read as a caption. */}
      <p
        className={`mt-1 ${isMoney ? "text-[28px]" : "text-[40px]"} leading-[1.1] tracking-normal tabular-nums ${
          accent ? "text-warn" : "text-ink"
        }`}
      >
        {value}
      </p>
      {sub ? <p className="label mt-1 leading-snug">{sub}</p> : null}
    </div>
  );
}

function Panel({
  title,
  hint,
  right,
  csv,
  className = "",
  children,
}: {
  title: string;
  hint?: string;
  right?: string;
  /** The export section name, which puts a download on this panel. */
  csv?: string;
  className?: string;
  children: React.ReactNode;
}) {
  // Square corners. B wanted it more angular, and a board of numbers reads
  // harder when every block is a lozenge.
  return (
    <section className={`panel rounded-none ${className}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="card-title">{title}</h2>
        <div className="flex items-baseline gap-x-4">
          {right ? <p className="label">{right}</p> : null}
          {/* A plain link, not a button: it is a GET that returns a file, so
              it opens in a new tab, survives a right click, and needs no
              javascript to work. */}
          {csv ? (
            <a
              href={`/members/export?section=${csv}`}
              className="label hover:text-ink underline underline-offset-4"
            >
              CSV
            </a>
          ) : null}
        </div>
      </header>
      {hint ? <p className="label mt-2">{hint}</p> : null}
      <hr className="border-divider my-4 border-0 border-t" />
      {children}
    </section>
  );
}

/**
 * One person: name and detail on the left, figure pinned right.
 *
 * TWO COLUMNS, NOT A WRAPPING ROW. As one flex-wrap row the amount was pushed
 * onto a line of its own the moment a long name and its note filled the width,
 * which left half the list with the figure dangling under it. The left column
 * is min-w-0 so the NOTE wraps under the name, never the name itself and never
 * the figure. B: "cant hide names".
 *
 * No full warn bar here. On the weekly board a yellow bar means that venue
 * failed, and on a list of twelve debtors it made three rows shout while the
 * rest got harder to read. The figure carries the warn colour instead.
 */
function PersonRow({
  name,
  note,
  value,
  bad = false,
}: {
  name: string;
  note?: string;
  value: string;
  bad?: boolean;
}) {
  return (
    <li className="bg-inset flex items-baseline gap-x-3 px-3 py-3">
      {/* ONE LINE PER PERSON. Three parts with one shrinking part: the name
          never clips because the name is the point, the figure never moves
          because the eye scans that column, and the detail in the middle
          truncates if the row is tight. It is the only part that can be lost
          without losing the row. Letting the whole row wrap put half the list
          on two lines with the amount adrift. */}
      <span className="text-title text-ink shrink-0 tracking-normal">{name}</span>
      {note ? <span className="label min-w-0 flex-1 truncate">{note}</span> : <span className="flex-1" />}
      <span
        className={`text-title shrink-0 text-right tracking-normal tabular-nums ${
          bad ? "text-warn" : "text-ink"
        }`}
      >
        {value}
      </span>
    </li>
  );
}

function FailingRow({ card }: { card: FailingCard }) {
  return (
    <li className="bg-inset flex items-baseline gap-x-3 px-3 py-3">
      <span className="text-title text-ink shrink-0 tracking-normal">{card.name}</span>
      <span className="label min-w-0 flex-1 truncate">
        {card.program ?? "membership"} · {exact(card.monthlyPrice)} a month
        {card.since ? ` · failing since ${shortDate(card.since)}` : ""}
        {card.lastVisit
          ? ` · last in ${shortDate(card.lastVisit)}`
          : " · not seen in the window"}
      </span>
      <span
        className={`text-title shrink-0 text-right tracking-normal tabular-nums ${
          (card.days ?? 0) >= 365 ? "text-warn" : "text-ink"
        }`}
      >
        {card.days === null ? "" : `${card.days.toLocaleString("en-US")} days`}
      </span>
    </li>
  );
}

export function MembersPipeline({ snap }: { snap: Snapshot }) {
  const queue = snap.waitingOnIntro;
  const overAYear = queue.filter((q) => q.days >= 365).length;
  const longest = queue.length ? queue[0].days : 0;
  const byStage = (stage: string) => snap.stages.find((s) => s.stage === stage);
  const onFile = snap.stages.reduce((n, s) => n + s.people, 0);
  // Months at the end of the curve where nobody joined. This is the stall,
  // stated as a number rather than left for the eye to find in the line.
  let flatMonths = 0;
  for (let i = snap.growth.length - 1; i >= 0 && snap.growth[i].joined === 0; i -= 1) {
    flatMonths += 1;
  }

  const applied = byStage("APPLIED");
  const review = byStage("REVIEW");
  const flagged = byStage("FLAGGED");
  // Applied and never got an answer: nobody opened it, or somebody opened it
  // and never decided. From the applicant's side those are the same thing.
  const noAnswer = (applied?.people ?? 0) + (review?.people ?? 0);
  const noAnswerLive = (applied?.live ?? 0) + (review?.live ?? 0);

  return (
    <main>
      {/* The dashboard's header: eyebrow, the one number that matters, then a
          dense meta line rather than three quiet cards doing the same job in
          five times the space. */}
      <header className="mb-6">
        <p className="label">The Reading Club · membership</p>
        <h1 className="text-metric mt-2 tracking-normal">
          {count(snap.members)} members
        </h1>
        {/* ITS OWN LINE. Buried at the end of the meta run nobody read it,
            and on a page of money figures the first question is how old they
            are. */}
        <p className="label mt-2">Data pulled {pacific(snap.pulledAt)} Pacific</p>
        <p className="label mt-2 leading-relaxed">
          {queue.length > 0 ? (
            <>
              <span className="text-warn">{count(queue.length)} waiting on an intro</span>
              {" · "}
            </>
          ) : null}
          {overAYear > 0 ? `${count(overAYear)} over a year · ` : ""}
          {longest > 0 ? `longest ${count(longest)} days · ` : ""}
          {count(snap.newThisWeek)} applied this week · {count(onFile)} people on file
          · {count(snap.formerMembers)} former
        </p>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* THE SHAPE OF IT, FIRST. B put the pipeline above the names: the
            stage counts are what he scans, the names are what he acts on once
            he has seen them. */}
        {/* ALL TIME IS THE FIGURE, RECENT IS THE FOOTNOTE. It was the other way
            round and Maybe read "0" against 485 people actually sitting there,
            because none of them applied inside 90 days. B: "90 days is maybe
            irrelevant and show all time". The 90 day cut was hiding the number
            rather than focusing it. */}
        {/* The hero band, the same shape as a house on the weekly dashboard:
            ring, plot, stat cluster, one row. Two panels were doing this job
            and neither carried any weight on its own. */}
        {/* ONE ROW OF FIGURES, THEN THE LINE. The ring is gone: B, 2026-10-31,
            "the 23% is not a really helpful number so doesnt need to be a
            highlight". Members as a share of everyone who ever applied is not
            a rate anybody acts on, and it was taking the largest block on the
            page to say so. */}
        <Panel
          className="col-span-12"
          title="Membership"
            csv="pipeline"
          hint={`${count(onFile)} people have applied since ${snap.growth.length ? snap.growth[0].month.slice(0, 4) : "launch"}`}
          right={flatMonths > 0 ? `nobody joined in ${count(flatMonths)} months` : undefined}
        >
          {/* WHAT B ACTUALLY DOES WITH THIS PAGE DECIDES WHAT IS ON IT.
              "192 former" under Members was lifetime churn with no date on it,
              so it could not answer whether anybody is leaving now. The useful
              line under Members is when the last one joined, which is where
              the stall shows first.
              "New 349" was the worst of it. Those are not new. They are
              applications going back to 2021 that nobody has ever opened, and
              with Maybe beside them it is 834 people who applied and never got
              an answer. That is one number, not two, and it is the biggest
              thing on the page after the queue.
              Rejected came off. 531 people we said no to years ago is not a
              number anybody acts on. */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Members"
              value={count(snap.members)}
              sub={
                snap.newestMemberOn
                  ? `newest joined ${shortDate(snap.newestMemberOn)}`
                  : undefined
              }
            />
            <Stat
              label="Approved by CH"
              value={count(flagged?.people ?? 0)}
              accent={(flagged?.people ?? 0) > 0}
              sub={overAYear ? `${count(overAYear)} over a year` : "none stuck"}
            />
            <Stat
              label="Never answered"
              value={count(noAnswer)}
              accent={noAnswer > 0}
              sub={`${count(noAnswerLive)} of them in 90 days`}
            />
            <Stat
              label="Applied this week"
              value={count(snap.newThisWeek)}
              sub="last seven days"
            />
          </div>

          {snap.growth.length > 1 ? (
            <div className="mt-8">
              <MembershipCurve points={snap.growth} flatMonths={flatMonths} />
            </div>
          ) : null}
        </Panel>

        {/* Then the names. Longest wait first, because the oldest one has been
            invisible the longest. */}
        <Panel
          className="col-span-12"
          title="Waiting on an intro"
            csv="waiting"
          hint="Approved by CH. Nobody has invited them in."
          right={`${count(queue.length)} people, longest first`}
        >
          {queue.length === 0 ? (
            <p className="note text-muted">Nobody is waiting.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {queue.map((q) => (
                <PersonRow
                  key={q.customer_id}
                  name={q.name}
                  note={q.appliedOn ? `applied ${shortDate(q.appliedOn)}` : undefined}
                  value={`${count(q.days)} days`}
                  bad={q.days >= 365}
                />
              ))}
            </ul>
          )}
        </Panel>

        {/* DUES AT THE POSTED RATE, NOT MONEY IN THE BANK. Active cards times
            the rate. It knows nothing about comps, so it reads a little above
            PeopleVine's own MRR, and the gap is the discounts. The failing
            figure is the one to act on: those are memberships the card is
            declining, which still read as members everywhere else. */}
        {snap.dues ? (
          <Panel
            className="col-span-12"
            title="Dues"
            csv="programs"
            hint="Active memberships at the posted rate. Comps and discounts are not in it."
            right={`${count(snap.dues.programs.length)} paid programs`}
          >
            <div className="grid grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-3">
              <Stat
                label="Monthly dues"
              money
                value={money(snap.dues.monthly)}
                sub="at the posted rate"
              />
              <Stat
                label="Annual run rate"
              money
                value={money(snap.dues.annual)}
                sub="twelve months at today's roll"
              />
              <Stat
                label="Failing"
              money
                value={money(snap.dues.atRisk)}
                accent={snap.dues.atRisk > 0}
                sub={`${count(snap.dues.failing)} memberships, ${money(snap.dues.atRisk * 12)} a year`}
              />
            </div>

            <ul className="mt-6 flex flex-col gap-2">
              {snap.dues.programs.map((p) => (
                <li
                  key={p.program_id}
                  className="bg-inset flex items-baseline gap-x-3 px-3 py-3"
                >
                  <span className="text-title text-ink shrink-0 tracking-normal">
                    {p.title ?? `Program ${p.program_id}`}
                  </span>
                  <span className="label min-w-0 flex-1 truncate">
                    {count(p.active_members)} active at{" "}
                    {exact(Number(p.monthly_price ?? 0))} a month
                    {p.failed_members ? ` · ${count(p.failed_members)} failing` : ""}
                  </span>
                  <span className="text-title text-ink shrink-0 text-right tracking-normal tabular-nums">
                    {money(Number(p.monthly_dues ?? 0) * 12)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {/* TWO LISTS, NOT ONE. B, 2026-11-02: "failing and never having been
            in in years is irrelevant". Somebody failing since 2023 who was in
            last week is drinking on a membership that stopped paying, and
            that is a phone call today. Somebody failing since 2023 who has not
            been seen is a record to close. Same status, opposite jobs.
            Last visit is a till transaction, not a billing attempt: being
            charged is not the same as turning up. */}
        {snap.dues && snap.dues.failingActive.length > 0 ? (
          <Panel
            className="col-span-12"
            title="Failing, still coming in"
            csv="failing-active"
            hint="Billing has failed and they have spent at the club inside six months. Call these."
            right={`${count(snap.dues.failingActive.length)} people · ${money(
              snap.dues.failingActive.reduce((n, f) => n + f.monthlyPrice * 12, 0),
            )} a year`}
          >
            <ul className="flex flex-col gap-2">
              {snap.dues.failingActive.slice(0, 25).map((f) => (
                <FailingRow key={`a-${f.customer_id}-${f.since ?? ""}`} card={f} />
              ))}
            </ul>
          </Panel>
        ) : null}

        {snap.dues && snap.dues.failingDormant.length > 0 ? (
          <Panel
            className="col-span-12"
            title="Failing, not seen"
            csv="failing-dormant"
            hint="Billing has failed and nothing has been spent at the club in six months. Close these."
            right={`${count(snap.dues.failingDormant.length)} people`}
          >
            <ul className="flex flex-col gap-2">
              {snap.dues.failingDormant.slice(0, 15).map((f) => (
                <FailingRow key={`d-${f.customer_id}-${f.since ?? ""}`} card={f} />
              ))}
            </ul>
            {snap.dues.failingDormant.length > 15 ? (
              <p className="label mt-3">
                {count(snap.dues.failingDormant.length - 15)} more
              </p>
            ) : null}
          </Panel>
        ) : null}

        {/* COLLECTED, NOT THE ROLL. The Dues panel above says what the
            membership is worth at the posted rate. This says what came in.
            They differ and the gap is the point: September collected $150,420
            of membership money against an $88,927 roll, because 773 charges
            landed on 457 people as arrears were caught up on the 95 cards in
            failed billing.
            THE SPLIT IS ON THE TRANSACTION TYPE, NOT ON HOW IT WAS PAID.
            Bucketing every card charge as dues read $256,607 for September,
            because members charge food and drink to their account and are
            billed monthly on the same card. */}
        {snap.revenue && snap.revenue.months.length > 0 ? (
          <Panel
            className="col-span-12"
            title="Collected"
            csv="revenue"
            hint="Money that actually landed, from the transaction ledger. Dues, the till, and everything else billed."
            right={`${count(snap.revenue.months.length)} months`}
          >
            <div className="grid grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Dues this year"
              money
                value={money(snap.revenue.yearDues)}
                sub="membership charges collected"
              />
              <Stat
                label="Food and drink this year"
              money
                value={money(snap.revenue.yearPos)}
                sub="rung up at the club"
              />
              <Stat
                label="Other billing this year"
              money
                value={money(snap.revenue.yearOther)}
                sub="house accounts and invoices"
              />
              <Stat
                label="Last full month"
              money
                value={
                  snap.revenue.lastFullMonth
                    ? money(
                        snap.revenue.lastFullMonth.dues_collected +
                          snap.revenue.lastFullMonth.pos_spend +
                          snap.revenue.lastFullMonth.other_collected,
                      )
                    : "0"
                }
                sub={
                  snap.revenue.lastFullMonth
                    ? monthName(snap.revenue.lastFullMonth.month)
                    : undefined
                }
              />
            </div>

            <ul className="mt-6 flex flex-col gap-2">
              {[...snap.revenue.months]
                .reverse()
                .slice(0, 13)
                .map((m) => (
                  <li
                    key={m.month}
                    className="bg-inset flex items-baseline gap-x-3 px-3 py-3"
                  >
                    <span className="text-title text-ink w-24 shrink-0 tracking-normal tabular-nums">
                      {monthName(m.month)}
                    </span>
                    <span className="label min-w-0 flex-1 truncate">
                      dues {money(m.dues_collected)} · food and drink{" "}
                      {money(m.pos_spend)}
                      {m.other_collected ? ` · other ${money(m.other_collected)}` : ""}
                    </span>
                    <span className="text-title text-ink shrink-0 text-right tracking-normal tabular-nums">
                      {money(m.dues_collected + m.pos_spend + m.other_collected)}
                    </span>
                  </li>
                ))}
            </ul>
          </Panel>
        ) : null}

        <Panel
          className="col-span-12"
          title="Money"
          hint="The house walk-in account is excluded from every figure here."
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
            <Stat
              label="Past due"
              money
              value={money(snap.pastDueTotal)}
              accent={snap.pastDueTotal > 0}
              sub={`${count(snap.pastDueMembers.length)} people, over 90 days`}
            />
            <Stat
              label="Cards declined"
              value={count(snap.declines30.count)}
              accent={snap.declines30.count > 0}
              sub={`${money(snap.declines30.amount)} in 30 days`}
            />
            <Stat
              label="Billed this month"
              money
              value={money(snap.openInvoices30.amount)}
              sub={`${count(snap.openInvoices30.count)} open invoices`}
            />
          </div>
        </Panel>

        {snap.pastDueMembers.length > 0 ? (
          <Panel
            className="col-span-12 lg:col-span-6"
            title="Who owes it"
            csv="past-due"
            right="Over 90 days"
          >
            <ul className="flex flex-col gap-2">
              {snap.pastDueMembers.slice(0, 12).map((r) => (
                <PersonRow
                  key={`${r.customer_id}-${r.name}`}
                  name={r.name}
                  note={`${count(r.invoices)} ${r.invoices === 1 ? "invoice" : "invoices"} · ${count(r.oldestDays)} days`}
                  value={exact(r.pastDue)}
                  bad={r.pastDue >= 1000}
                />
              ))}
            </ul>
          </Panel>
        ) : null}

        {snap.declines30.rows.length > 0 ? (
          <Panel
            className="col-span-12 lg:col-span-6"
            title="Declined"
            csv="declines"
            right="Last 30 days"
          >
            <ul className="flex flex-col gap-2">
              {snap.declines30.rows.slice(0, 12).map((d, i) => (
                <PersonRow
                  key={`${d.name}-${d.when}-${i}`}
                  name={d.name}
                  note={[
                    shortDate(d.when),
                    d.lastFour ? `${d.brand ?? "card"} ${d.lastFour}` : "",
                    d.tries > 1 ? `${d.tries} tries` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  value={exact(d.amount)}
                />
              ))}
            </ul>
          </Panel>
        ) : null}

        {snap.needsChecking > 0 ? (
          <section className="panel-quiet col-span-12 rounded-none">
            <p className="label">Needs checking</p>
            <p className="attest mt-2">
              {count(snap.needsChecking)} people are marked onboarded on the
              application side and carry no membership record at all, current or
              former. Either the onboarding never finished or the status was set
              by hand.
            </p>
          </section>
        ) : null}
      </div>

      <footer className="border-divider mt-10 border-0 border-t pt-6">
        <p className="label">Prepared by CH Projects</p>
        <p className="label mt-2 leading-relaxed">
          Membership and dates from the PeopleVine REST API. Application status
          from the control panel applicant grid, the only place it exists. Money
          from PeopleVine transactions. Six single days in the 2021 launch
          period exceed the grid&apos;s row limit, so a small number of
          applications from those days are not counted.
        </p>
      </footer>
    </main>
  );
}
