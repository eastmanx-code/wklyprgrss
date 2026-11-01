import type { Snapshot } from "@/lib/peoplevine";

/**
 * The Reading Club membership board.
 *
 * It answers one question first, which is the question B asked: who did we say
 * yes to that nobody has walked in, and how long have they been waiting. That
 * is the top of the page and everything else is context underneath it.
 *
 * It is deliberately not a CRM. No search, no filters, no per-person drill in.
 * PeopleVine already has all of that and nobody looks at it, because none of it
 * surfaces the queue. This surfaces the queue.
 */

const money = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const whole = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-US");

function pacific(iso: string | null): string {
  if (!iso) return "NOT YET PULLED";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "NOT YET PULLED";
  return d
    .toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    .toUpperCase();
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "numeric",
      day: "numeric",
    })
    .toUpperCase();
}

/** A wait of a year or more is a different kind of problem to a wait of a week. */
function waitTone(days: number): string {
  if (days >= 365) return "text-[var(--color-ink)]";
  if (days >= 90) return "text-[var(--color-ink)]";
  return "text-[var(--color-muted)]";
}

function Metric({
  value,
  label,
  note,
}: {
  value: string;
  label: string;
  note?: string;
}) {
  return (
    <div className="panel">
      <p className="label">{label}</p>
      <p
        className="mt-3 font-mono tabular-nums"
        style={{ fontSize: "var(--text-metric)", lineHeight: 1.1 }}
      >
        {value}
      </p>
      {note ? <p className="note mt-2 text-[var(--color-muted)]">{note}</p> : null}
    </div>
  );
}

export function MembersPipeline({ snap }: { snap: Snapshot }) {
  const queue = snap.waitingOnIntro;
  const overAYear = queue.filter((q) => q.days >= 365).length;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24">
      <header className="pt-8 pb-6">
        <p className="label">The Reading Club</p>
        <h1 className="card-title mt-2" style={{ fontSize: "var(--text-metric)" }}>
          Membership
        </h1>
        <p className="note mt-2 text-[var(--color-muted)]">
          Pulled {pacific(snap.pulledAt)} Pacific
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric value={String(snap.members)} label="Members" />
        <Metric
          value={String(queue.length)}
          label="Approved by CH, waiting"
          note={overAYear ? `${overAYear} over a year` : undefined}
        />
        <Metric value={String(snap.newThisWeek)} label="Applied this week" />
      </section>

      {/* THE POINT OF THE PAGE. Longest wait first, because the oldest one is
          the one that has been invisible longest. */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="card-title">Waiting on an intro</h2>
          <p className="label">{queue.length} people</p>
        </div>
        <p className="note mt-2 text-[var(--color-muted)]">
          Approved by CH. Nobody has invited them in yet.
        </p>

        <div className="panel mt-4 p-0 overflow-hidden">
          {queue.length === 0 ? (
            <p className="note p-6 text-[var(--color-muted)]">Nobody is waiting.</p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--color-card-border)]">
                  <th className="label px-5 py-3">Name</th>
                  <th className="label px-5 py-3">Applied</th>
                  <th className="label px-5 py-3 text-right">Waiting</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((q) => (
                  <tr
                    key={q.customer_id}
                    className="row-hover border-b border-[var(--color-card-border)] last:border-0"
                  >
                    <td className="caps px-5 py-3 font-mono text-sm">{q.name}</td>
                    <td className="px-5 py-3 font-mono text-sm tabular-nums text-[var(--color-muted)]">
                      {q.appliedOn ? shortDate(q.appliedOn) : ""}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-mono text-sm tabular-nums ${waitTone(q.days)}`}
                    >
                      {q.days.toLocaleString("en-US")} days
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="card-title">Pipeline</h2>
        <p className="note mt-2 text-[var(--color-muted)]">
          Live means they applied inside 90 days. The rest is older than that.
        </p>
        <div className="panel mt-4 p-0 overflow-hidden">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--color-card-border)]">
                <th className="label px-5 py-3">Stage</th>
                <th className="label px-5 py-3 text-right">Live</th>
                <th className="label px-5 py-3 text-right">All</th>
                <th className="label px-5 py-3 text-right">Oldest</th>
              </tr>
            </thead>
            <tbody>
              {snap.stages.map((s) => (
                <tr
                  key={s.stage}
                  className="row-hover border-b border-[var(--color-card-border)] last:border-0"
                >
                  <td className="caps px-5 py-3 font-mono text-sm">{s.label}</td>
                  <td className="px-5 py-3 text-right font-mono text-sm tabular-nums">
                    {s.live.toLocaleString("en-US")}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-sm tabular-nums text-[var(--color-muted)]">
                    {s.people.toLocaleString("en-US")}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-sm tabular-nums text-[var(--color-muted)]">
                    {s.oldestDays === null
                      ? ""
                      : `${s.oldestDays.toLocaleString("en-US")} days`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="card-title">Money</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Metric
            value={whole(snap.pastDueTotal)}
            label="Past due over 90 days"
            note={`${snap.pastDueMembers.length} people`}
          />
          <Metric
            value={String(snap.declines30.count)}
            label="Cards declined, 30 days"
            note={whole(snap.declines30.amount)}
          />
          <Metric
            value={whole(snap.openInvoices30.amount)}
            label="Billed, last 30 days"
            note={`${snap.openInvoices30.count} open invoices`}
          />
        </div>

        {snap.pastDueMembers.length > 0 ? (
          <div className="panel mt-4 p-0 overflow-hidden">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--color-card-border)]">
                  <th className="label px-5 py-3">Owes</th>
                  <th className="label px-5 py-3 text-right">Amount</th>
                  <th className="label px-5 py-3 text-right">Invoices</th>
                  <th className="label px-5 py-3 text-right">Oldest</th>
                </tr>
              </thead>
              <tbody>
                {snap.pastDueMembers.slice(0, 20).map((r) => (
                  <tr
                    key={`${r.customer_id}-${r.name}`}
                    className="row-hover border-b border-[var(--color-card-border)] last:border-0"
                  >
                    <td className="caps px-5 py-3 font-mono text-sm">{r.name}</td>
                    <td className="px-5 py-3 text-right font-mono text-sm tabular-nums">
                      {money(r.pastDue)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-sm tabular-nums text-[var(--color-muted)]">
                      {r.invoices}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-sm tabular-nums text-[var(--color-muted)]">
                      {r.oldestDays.toLocaleString("en-US")} days
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {snap.declines30.rows.length > 0 ? (
          <div className="panel mt-4 p-0 overflow-hidden">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--color-card-border)]">
                  <th className="label px-5 py-3">Declined</th>
                  <th className="label px-5 py-3">Card</th>
                  <th className="label px-5 py-3 text-right">Amount</th>
                  <th className="label px-5 py-3 text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {snap.declines30.rows.map((d, i) => (
                  <tr
                    key={`${d.name}-${d.when}-${i}`}
                    className="row-hover border-b border-[var(--color-card-border)] last:border-0"
                  >
                    <td className="caps px-5 py-3 font-mono text-sm">{d.name}</td>
                    <td className="px-5 py-3 font-mono text-sm text-[var(--color-muted)]">
                      {[d.brand, d.lastFour].filter(Boolean).join(" ").toUpperCase()}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-sm tabular-nums">
                      {money(d.amount)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-sm tabular-nums text-[var(--color-muted)]">
                      {shortDate(d.when)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="note mt-3 text-[var(--color-muted)]">
          A card only shows as declined once something tried to bill it, so a
          member sitting on an expired card nobody has charged will not appear
          here. The house walk-in account is excluded throughout.
        </p>
      </section>

      {snap.needsChecking > 0 ? (
        <section className="mt-10">
          <h2 className="card-title">Needs checking</h2>
          <div className="panel-quiet mt-4">
            <p className="attest">
              {snap.needsChecking} people are marked onboarded on the application
              side and carry no membership record at all, current or former.
              Either the onboarding never finished or the status was set by hand.
            </p>
          </div>
        </section>
      ) : null}

      <footer className="mt-12 border-t border-[var(--color-card-border)] pt-6">
        <p className="label">Prepared by CH Projects</p>
        <p className="note mt-2 text-[var(--color-muted)]">
          Membership and dates from the PeopleVine REST API. Application status
          from the control panel applicant grid, which is the only place it
          exists. Money from PeopleVine transactions. Six single days in the 2021
          launch period exceed the grid&apos;s row limit and a small number of
          applications from those days are not counted.
        </p>
      </footer>
    </main>
  );
}
