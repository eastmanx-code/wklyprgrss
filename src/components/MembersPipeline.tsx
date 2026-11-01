import { Dial } from "./Dial";
import { MembershipCurve } from "./MembershipCurve";
import type { Snapshot } from "@/lib/peoplevine";

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

function pacific(iso: string | null): string {
  if (!iso) return "not pulled yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "not pulled yet";
  return d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
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
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="label">{label}</p>
      {/* A size above the dashboard's 28px stat. These are the figures the
          page exists to show and at 28px they read as a caption. */}
      <p
        className={`mt-1 text-[40px] leading-[1.1] tracking-normal tabular-nums ${
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
  className = "",
  children,
}: {
  title: string;
  hint?: string;
  right?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="card-title">{title}</h2>
        {right ? <p className="label">{right}</p> : null}
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
    <li className="bg-inset flex items-baseline gap-x-3 rounded-[4px] px-3 py-3">
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
  const rejected = byStage("REJECTED");

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
          · {count(snap.formerMembers)} former · pulled {pacific(snap.pulledAt)}
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
        <Panel
          className="col-span-12"
          title="Membership"
          hint={`${count(onFile)} people have applied since ${snap.growth.length ? snap.growth[0].month.slice(0, 4) : "launch"} · everyone counts at the stage they sit at today`}
          right={flatMonths > 0 ? `nobody joined in ${count(flatMonths)} months` : undefined}
        >
          <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)_auto]">
            <div>
              <Dial
                percent={onFile ? Math.round((snap.members / onFile) * 100) : 0}
                tone="var(--ink)"
                caption={`${count(snap.members)} of ${count(onFile)} who applied`}
                size={200}
              />
              <p className="label mt-1 text-center">
                {count(snap.formerMembers)} more joined and left
              </p>
            </div>

            {snap.growth.length > 1 ? (
              <MembershipCurve points={snap.growth} flatMonths={flatMonths} />
            ) : (
              <div />
            )}

            <div className="grid grid-cols-3 gap-x-8 gap-y-6">
              <Stat
                label="New"
                value={count(applied?.people ?? 0)}
                sub={`${count(applied?.live ?? 0)} in 90 days`}
              />
              <Stat
                label="Maybe"
                value={count(review?.people ?? 0)}
                sub={`${count(review?.live ?? 0)} in 90 days`}
              />
              <Stat
                label="Approved by CH"
                value={count(flagged?.people ?? 0)}
                accent={(flagged?.people ?? 0) > 0}
                sub={overAYear ? `${count(overAYear)} over a year` : "none stuck"}
              />
              <Stat
                label="Members"
                value={count(snap.members)}
                sub={`${count(snap.formerMembers)} former`}
              />
              <Stat
                label="Rejected"
                value={count(rejected?.people ?? 0)}
                sub="all time"
              />
              <Stat
                label="Applied this week"
                value={count(snap.newThisWeek)}
                sub="last seven days"
              />
            </div>
          </div>
        </Panel>

        {/* Then the names. Longest wait first, because the oldest one has been
            invisible the longest. */}
        <Panel
          className="col-span-12"
          title="Waiting on an intro"
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

        <Panel
          className="col-span-12"
          title="Money"
          hint="The house walk-in account is excluded from every figure here."
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
            <Stat
              label="Past due"
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
              value={money(snap.openInvoices30.amount)}
              sub={`${count(snap.openInvoices30.count)} open invoices`}
            />
          </div>
        </Panel>

        {snap.pastDueMembers.length > 0 ? (
          <Panel
            className="col-span-12 lg:col-span-6"
            title="Who owes it"
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
            <p className="label mt-3">
              A card only shows here once something tried to bill it
            </p>
          </Panel>
        ) : null}

        {snap.needsChecking > 0 ? (
          <section className="panel-quiet col-span-12">
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
