import { Card } from "./Card";
import type { Snapshot } from "@/lib/peoplevine";

/**
 * The Reading Club membership board.
 *
 * It answers one question first, the one B asked: who did we say yes to that
 * nobody has walked in, and how long have they been waiting. That is the top of
 * the page and everything else is context underneath it.
 *
 * It is deliberately not a CRM. No search, no filters, no per-person drill in.
 * PeopleVine has all of that and nobody looks at it, because none of it
 * surfaces the queue. This surfaces the queue.
 *
 * WRITTEN SECOND. The first version hand rolled its own container, its own
 * tables and its own greys, and read as a flat grey sheet that did not belong
 * to this site. It is built from Card, the inset row and the shared tones now,
 * the same parts the board and the dashboard use, and it carries no container
 * of its own because the layout already provides one. Two containers was the
 * odd spacing.
 */

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

const exact = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
 * The big figure inside a Card. Same scale as the dashboard's Stat: 28px value
 * in ink, 11px label in the one grey, and a line underneath saying what it
 * counts, because a bare number gets read as whatever the viewer assumes.
 */
function Figure({
  value,
  sub,
  accent = false,
}: {
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p
        className={`text-metric leading-[1.2] tracking-normal tabular-nums ${
          accent ? "text-warn" : "text-ink"
        }`}
      >
        {value}
      </p>
      {sub ? <p className="label mt-2 leading-snug">{sub}</p> : null}
    </div>
  );
}

/** One person in a queue. A wait past a year gets the warn bar, like a fail. */
function WaitRow({
  name,
  right,
  note,
  bad = false,
}: {
  name: string;
  right: string;
  note?: string;
  bad?: boolean;
}) {
  return (
    <li
      className={`bg-inset flex flex-wrap items-baseline gap-x-3 rounded-[4px] px-3 py-3 ${
        bad ? "bg-warn text-on-warn" : ""
      }`}
    >
      <span
        className={`text-title min-w-0 flex-1 truncate tracking-normal ${
          bad ? "text-on-warn" : "text-ink"
        }`}
      >
        {name}
      </span>
      {note ? (
        <span className={`label shrink-0 ${bad ? "text-on-warn" : ""}`}>{note}</span>
      ) : null}
      <span
        className={`text-title w-28 shrink-0 text-right tracking-normal tabular-nums ${
          bad ? "text-on-warn" : "text-ink"
        }`}
      >
        {right}
      </span>
    </li>
  );
}

export function MembersPipeline({ snap }: { snap: Snapshot }) {
  const queue = snap.waitingOnIntro;
  const overAYear = queue.filter((q) => q.days >= 365).length;
  const liveTotal = snap.stages.reduce((n, s) => n + s.live, 0);

  return (
    <main>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label">The Reading Club · membership</p>
          <h1 className="text-metric mt-2 tracking-normal">
            {snap.members.toLocaleString("en-US")} members
          </h1>
          <p className="label mt-2">Pulled {pacific(snap.pulledAt)} Pacific</p>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4">
        <Card
          className="col-span-12 sm:col-span-4"
          title="Waiting on an intro"
          hint="Approved by CH, nobody has invited them in"
        >
          <Figure
            value={queue.length}
            accent={queue.length > 0}
            sub={overAYear ? `${overAYear} of them over a year` : "nobody is stuck"}
          />
        </Card>

        <Card
          className="col-span-12 sm:col-span-4"
          title="Applied this week"
          hint="New applications in the last seven days"
        >
          <Figure value={snap.newThisWeek} sub={`${liveTotal} live inside 90 days`} />
        </Card>

        <Card
          className="col-span-12 sm:col-span-4"
          title="Former members"
          hint="Were members, are not now"
        >
          <Figure value={snap.formerMembers} />
        </Card>

        {/* THE POINT OF THE PAGE. Longest wait first, because the oldest one
            has been invisible the longest. */}
        <section className="panel col-span-12">
          <header className="flex min-h-12 flex-wrap items-baseline justify-between gap-x-4">
            <h2 className="card-title">Waiting on an intro</h2>
            <p className="label">{queue.length} people, longest first</p>
          </header>
          <hr className="border-divider my-4 border-0 border-t" />
          {queue.length === 0 ? (
            <p className="note text-muted">Nobody is waiting.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {queue.map((q) => (
                <WaitRow
                  key={q.customer_id}
                  name={q.name}
                  note={q.appliedOn ? `applied ${shortDate(q.appliedOn)}` : undefined}
                  right={`${q.days.toLocaleString("en-US")} days`}
                  bad={q.days >= 365}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="panel col-span-12">
          <header className="flex min-h-12 flex-wrap items-baseline justify-between gap-x-4">
            <h2 className="card-title">Pipeline</h2>
            <p className="label">Live means they applied inside 90 days</p>
          </header>
          <hr className="border-divider my-4 border-0 border-t" />
          <ul className="flex flex-col gap-2">
            {snap.stages.map((s) => (
              <li
                key={s.stage}
                className="bg-inset flex flex-wrap items-baseline gap-x-3 rounded-[4px] px-3 py-3"
              >
                <span className="text-title text-ink min-w-0 flex-1 truncate tracking-normal">
                  {s.label}
                </span>
                <span className="label shrink-0">
                  {s.oldestDays === null
                    ? ""
                    : `oldest ${s.oldestDays.toLocaleString("en-US")} days`}
                </span>
                <span
                  className={`text-title w-14 shrink-0 text-right tracking-normal tabular-nums ${
                    s.live > 0 ? "text-ink" : "text-muted"
                  }`}
                >
                  {s.live.toLocaleString("en-US")}
                </span>
                <span className="text-title text-muted w-20 shrink-0 text-right tracking-normal tabular-nums">
                  {s.people.toLocaleString("en-US")}
                </span>
              </li>
            ))}
          </ul>
          <p className="label mt-3">Live, then everyone at that stage</p>
        </section>

        <Card
          className="col-span-12 sm:col-span-4"
          title="Past due"
          hint="Open invoices older than 90 days"
        >
          <Figure
            value={money(snap.pastDueTotal)}
            accent={snap.pastDueTotal > 0}
            sub={`${snap.pastDueMembers.length} people`}
          />
        </Card>

        <Card
          className="col-span-12 sm:col-span-4"
          title="Cards declined"
          hint="Charges the card refused, last 30 days"
        >
          <Figure
            value={snap.declines30.count}
            accent={snap.declines30.count > 0}
            sub={money(snap.declines30.amount)}
          />
        </Card>

        <Card
          className="col-span-12 sm:col-span-4"
          title="Billed this month"
          hint="Raised in the last 30 days, not yet settled"
        >
          <Figure
            value={money(snap.openInvoices30.amount)}
            sub={`${snap.openInvoices30.count} open invoices`}
          />
        </Card>

        {snap.pastDueMembers.length > 0 ? (
          <section className="panel col-span-12 lg:col-span-6">
            <header className="flex min-h-12 flex-wrap items-baseline justify-between gap-x-4">
              <h2 className="card-title">Who owes it</h2>
              <p className="label">Over 90 days</p>
            </header>
            <hr className="border-divider my-4 border-0 border-t" />
            <ul className="flex flex-col gap-2">
              {snap.pastDueMembers.slice(0, 12).map((r) => (
                <WaitRow
                  key={`${r.customer_id}-${r.name}`}
                  name={r.name}
                  note={`${r.invoices} ${r.invoices === 1 ? "invoice" : "invoices"} · oldest ${r.oldestDays.toLocaleString("en-US")} days`}
                  right={exact(r.pastDue)}
                  bad={r.pastDue >= 1000}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {snap.declines30.rows.length > 0 ? (
          <section className="panel col-span-12 lg:col-span-6">
            <header className="flex min-h-12 flex-wrap items-baseline justify-between gap-x-4">
              <h2 className="card-title">Declined</h2>
              <p className="label">Last 30 days</p>
            </header>
            <hr className="border-divider my-4 border-0 border-t" />
            <ul className="flex flex-col gap-2">
              {snap.declines30.rows.slice(0, 12).map((d, i) => (
                <WaitRow
                  key={`${d.name}-${d.when}-${i}`}
                  name={d.name}
                  note={[shortDate(d.when), d.lastFour ? `•••• ${d.lastFour}` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                  right={exact(d.amount)}
                />
              ))}
            </ul>
            <p className="label mt-3">
              A card only shows here once something tried to bill it
            </p>
          </section>
        ) : null}

        {snap.needsChecking > 0 ? (
          <section className="panel-quiet col-span-12">
            <p className="label">Needs checking</p>
            <p className="attest mt-2">
              {snap.needsChecking} people are marked onboarded on the application
              side and carry no membership record at all, current or former.
              Either the onboarding never finished or the status was set by hand.
            </p>
          </section>
        ) : null}
      </div>

      <footer className="border-divider mt-10 border-0 border-t pt-6">
        <p className="label">Prepared by CH Projects</p>
        <p className="label mt-2 leading-relaxed">
          Membership and dates from the PeopleVine REST API. Application status
          from the control panel applicant grid, the only place it exists. Money
          from PeopleVine transactions. The house walk-in account is excluded
          throughout. Six single days in the 2021 launch period exceed the
          grid&apos;s row limit, so a small number of applications from those
          days are not counted.
        </p>
      </footer>
    </main>
  );
}
