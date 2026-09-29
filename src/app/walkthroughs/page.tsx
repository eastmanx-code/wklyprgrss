import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/Card";
import { Dial } from "@/components/Dial";
import { BackLink } from "@/components/ui";
import { getSession, mayReachVenue } from "@/lib/session";
import {
  loadPortfolio,
  portfolioTotals,
  type PropertySummary,
} from "@/lib/walkthroughs";

export const dynamic = "force-dynamic";

/**
 * The whole portfolio on one screen: a ring for all of it, then every property
 * as a progress bar under it, worst first.
 *
 * The same read as the checklists locations page. The ring is how much of what
 * the walkthroughs asked for has been signed off with a photo behind it, and
 * the bars are that same measure per building, so the one that needs a visit is
 * the longest red bar at the top.
 */
export default async function WalkthroughsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const { properties } = await loadPortfolio();
  const visible =
    session.role === "admin"
      ? properties
      : properties.filter(
          (p) => p.venueId != null && mayReachVenue(session, p.venueId),
        );

  if (visible.length === 0) {
    return (
      <main>
        <BackLink href="/home">Home</BackLink>
        <header className="mt-4 mb-6">
          <p className="label">Walkthroughs</p>
          <h1 className="text-metric mt-2 tracking-normal">Nothing yet</h1>
        </header>
        <p className="note text-muted leading-relaxed">
          No property has a walkthrough on record for you.
        </p>
      </main>
    );
  }

  const totals = portfolioTotals(visible);
  const behind = totals.overdue > 0;

  // The four disjoint states of every actionable line, summing to actionable:
  // signed off, a photo up but not yet signed, past due, and not yet started.
  // The ring says 57%; this is what the other 43% is made of.
  const notStarted = Math.max(
    0,
    totals.actionable - totals.signed - totals.submitted - totals.overdue,
  );

  // How the buildings stand, not the tasks. A portfolio at 57% could be one
  // property dragging seven clean ones down or seven all half done, and the
  // ring reads the same either way.
  const fullySigned = visible.filter(
    (p) => p.actionable > 0 && p.signed === p.actionable,
  ).length;
  const behindCount = visible.filter((p) => p.overdue > 0).length;

  // The portfolio's own turnaround, weighted by how many signatures each
  // property's average rests on so a building with a single sign-off does not
  // swing it. One summary number the per-building race card does not carry.
  const timedProps = visible.filter(
    (p) => p.avgDaysToSign != null && p.signedTimed > 0,
  );
  const signedTimedTotal = timedProps.reduce((n, p) => n + p.signedTimed, 0);
  const portfolioAvgDays = signedTimedTotal
    ? Math.round(
        (timedProps.reduce(
          (s, p) => s + (p.avgDaysToSign as number) * p.signedTimed,
          0,
        ) /
          signedTimedTotal) *
          10,
      ) / 10
    : null;

  return (
    <main>
      <BackLink href="/home">Home</BackLink>

      <header className="mt-4 mb-6">
        <p className="label">
          {totals.properties}{" "}
          {totals.properties === 1 ? "property" : "properties"} · signed off with
          a photo behind it
        </p>
        <h1 className="text-metric mt-2 tracking-normal">Walkthroughs</h1>
      </header>

      <Turnaround properties={visible} />

      <Card
        className="mt-6"
        title="All properties"
        hint={`${totals.signed} of ${totals.actionable} signed off · ${
          totals.overdue > 0 ? `${totals.overdue} overdue` : "none overdue"
        }`}
      >
        {/* Ring and the graph that breaks it down — waiting on a signature is
            a different problem from nobody having started. */}
        <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[180px_1fr] lg:items-center">
          <div className="mx-auto w-full max-w-[180px] lg:mx-0">
            <Dial
              percent={totals.percent}
              tone={behind ? "var(--warn)" : "var(--ink)"}
              caption={`${totals.signed} of ${totals.actionable} signed off`}
              size={180}
            />
          </div>

          <div className="flex min-w-0 flex-col justify-center">
            <CompositionBar
              total={totals.actionable}
              segments={stateSegments({
                signed: totals.signed,
                waiting: totals.submitted,
                overdue: totals.overdue,
                notStarted,
              })}
            />
          </div>
        </div>

        {/* The numbers, in a row across the bottom rather than a column down
            the side: a tall rail of three left most of the card empty. */}
        <hr className="border-divider my-5 border-0 border-t" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <Stat
            label="Overdue tasks"
            value={totals.overdue}
            accent={totals.overdue > 0}
          />
          <Stat
            label="Avg to sign-off"
            value={portfolioAvgDays != null ? `${portfolioAvgDays}d` : "—"}
            sub={
              signedTimedTotal
                ? `across ${signedTimedTotal} sign-offs`
                : "none yet"
            }
          />
          <Stat
            label="Seen before"
            value={totals.repeats}
            sub="found on an earlier walk"
            accent={totals.repeats > 0}
          />
          <Stat
            label="Fully signed"
            value={`${fullySigned}/${totals.properties}`}
            sub={behindCount > 0 ? `${behindCount} behind` : "none behind"}
          />
        </div>

        <hr className="border-divider my-5 border-0 border-t" />
        <p className="label mb-3">By property · worst first</p>

        {/* Every building as a bar. This is the leaderboard: worst first, the
            reason to open the page sitting at the top. */}
        <ul className="space-y-2">
          {visible.map((p) => (
            <PropertyBar key={p.id} property={p} />
          ))}
        </ul>
      </Card>
    </main>
  );
}

/**
 * The race: how fast a signed item goes from the walk to the signature, per
 * building, fastest at the top. The rest of the page is worst first and about
 * how much is left; this is the one place a building that is quick to close
 * things out gets the top spot, and the one that sits on them is named.
 *
 * Speed, not volume: a fuller bar is a faster average, the leader fills it and
 * everyone else trails. Volume is on the row as the count the average rests on,
 * so a two-day average off a single signature reads as what it is.
 */
function Turnaround({ properties }: { properties: PropertySummary[] }) {
  const timed = properties
    .filter((p) => p.avgDaysToSign != null)
    .sort(
      (a, b) =>
        (a.avgDaysToSign as number) - (b.avgDaysToSign as number) ||
        b.signedTimed - a.signedTimed ||
        a.name.localeCompare(b.name),
    );
  if (timed.length === 0) return null;

  const fastest = timed[0];
  const slowest = timed[timed.length - 1];
  const fastestDays = fastest.avgDaysToSign as number;
  const race = timed.length > 1;

  return (
    <Card
      title="Sign-off speed"
      hint="days from the walk to sign-off · signed items only · fastest wins"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Podium
          tag="Fastest"
          name={fastest.name}
          days={fastestDays}
          count={fastest.signedTimed}
        />
        {race ? (
          <Podium
            tag="Slowest"
            name={slowest.name}
            days={slowest.avgDaysToSign as number}
            count={slowest.signedTimed}
            accent
          />
        ) : null}
      </div>

      {race ? (
        <>
          <hr className="border-divider my-5 border-0 border-t" />
          <ol className="space-y-2.5">
            {timed.map((p, i) => {
              const days = p.avgDaysToSign as number;
              // Fuller is faster: the leader's average sets 100%, and a
              // property twice as slow fills half the track.
              const fill = days > 0 ? Math.round((fastestDays / days) * 100) : 100;
              const isSlowest = i === timed.length - 1;
              const lead = i === 0;
              return (
                <li
                  key={p.id}
                  title={`${p.name} · ${days}d avg · ${p.signedTimed} sign-${
                    p.signedTimed === 1 ? "off" : "offs"
                  }`}
                  className="flex items-center gap-3"
                >
                  <span className="label w-5 shrink-0 text-right tabular-nums">
                    {i + 1}
                  </span>
                  <span className="text-title w-16 shrink-0 truncate tracking-normal">
                    {p.name}
                  </span>
                  <div className="bg-inset h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(fill, 4)}%`,
                        background: isSlowest ? "var(--warn)" : "var(--ink)",
                        opacity: lead || isSlowest ? 1 : 0.5,
                      }}
                    />
                  </div>
                  <span
                    className={`label shrink-0 tabular-nums ${
                      isSlowest ? "text-warn" : ""
                    }`}
                  >
                    {days}d
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </Card>
  );
}

/** One end of the race, named and dated. Fastest in ink, slowest in warn. */
function Podium({
  tag,
  name,
  days,
  count,
  accent = false,
}: {
  tag: string;
  name: string;
  days: number;
  count: number;
  accent?: boolean;
}) {
  return (
    <div className="bg-inset rounded-[6px] p-4">
      <p className="label">{tag}</p>
      <p
        className={`text-title mt-1 tracking-normal ${
          accent ? "text-warn" : "text-ink"
        }`}
      >
        {name}
      </p>
      <p
        className={`text-metric mt-1 leading-[1.1] tracking-normal tabular-nums ${
          accent ? "text-warn" : "text-ink"
        }`}
      >
        {days}
        <span className="text-title">d</span>
      </p>
      <p className="label mt-1">
        avg of {count} sign-{count === 1 ? "off" : "offs"}
      </p>
    </div>
  );
}

/** One part of a stacked bar. Fill is the two-tone status colour, never rank. */
type Segment = {
  label: string;
  value: number;
  fill: string;
  opacity?: number;
};

/**
 * The four disjoint states of an actionable line, in one fixed order, so the
 * portfolio summary and every property row below it read the same way. Signed
 * and waiting share the ink hue at two weights; overdue is the one warn call;
 * not started is the faint track. Identity is carried by the key and the row
 * labels, never colour alone.
 */
function stateSegments(counts: {
  signed: number;
  waiting: number;
  overdue: number;
  notStarted: number;
}): Segment[] {
  return [
    { label: "Signed", value: counts.signed, fill: "var(--ink)" },
    {
      label: "Waiting to sign",
      value: counts.waiting,
      fill: "var(--ink)",
      opacity: 0.4,
    },
    { label: "Overdue", value: counts.overdue, fill: "var(--warn)" },
    { label: "Not started", value: counts.notStarted, fill: "var(--inset)" },
  ];
}

/** One property's line broken into the same four states as the portfolio. */
function propertySegments(p: PropertySummary): Segment[] {
  return stateSegments({
    signed: p.signed,
    waiting: p.submitted,
    overdue: p.overdue,
    notStarted: Math.max(0, p.actionable - p.signed - p.submitted - p.overdue),
  });
}

/**
 * The stacked bar itself, no key. One shape used at the top for the whole
 * portfolio and again per building below — the small multiple that lets eight
 * boards be compared at a glance because they are all drawn the same way. A 2px
 * surface gap sits between parts so a part reads as a part rather than a shade
 * change, a part carries a floor so a count of one still shows, and a zero part
 * is dropped.
 */
function SegmentBar({
  total,
  segments,
  className = "h-2.5",
}: {
  total: number;
  segments: Segment[];
  className?: string;
}) {
  const shown = segments.filter((s) => s.value > 0);
  return (
    <div
      className={`bg-paper flex w-full gap-[2px] overflow-hidden rounded-full ${className}`}
    >
      {shown.map((s) => (
        <div
          key={s.label}
          className="h-full"
          style={{
            width: `${Math.max((s.value / total) * 100, 2)}%`,
            background: s.fill,
            opacity: s.opacity ?? 1,
          }}
          title={`${s.label}: ${s.value}`}
        />
      ))}
    </div>
  );
}

/**
 * The portfolio bar and its key. The bar is the proportion — how much of the
 * gap under the ring is a signature away versus untouched — and the key names
 * each part with its count and its share, so the reader gets the number without
 * hovering and the percentage without doing the division.
 */
function CompositionBar({
  total,
  segments,
}: {
  total: number;
  segments: Segment[];
}) {
  if (total <= 0) {
    return (
      <p className="note text-muted leading-relaxed">
        No actionable work on record yet.
      </p>
    );
  }
  const share = (v: number) => {
    const p = (v / total) * 100;
    return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
  };
  return (
    <div>
      <SegmentBar total={total} segments={segments} className="h-10" />

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ background: s.fill, opacity: s.opacity ?? 1 }}
              aria-hidden
            />
            <span className="label">
              {s.label} <span className="text-ink tabular-nums">{s.value}</span>
              {s.value > 0 ? ` · ${share(s.value)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
      <p
        className={`text-metric mt-1 leading-[1.2] tracking-normal tabular-nums ${
          accent ? "text-warn" : "text-ink"
        }`}
      >
        {value}
      </p>
      {sub ? <p className="label mt-1 leading-snug">{sub}</p> : null}
    </div>
  );
}

function fmtDate(date: string | null): string {
  if (!date) return "no walk yet";
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed)) return date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

/**
 * One building, and the door into it. The bar is the same four-state stack as
 * the portfolio above, so a row is read the same way the summary is — the whole
 * point of a small multiple. A single fill coloured red when anything was late
 * used to say "this board is bad" when most of it might be signed; the stack
 * says exactly how much is signed, waiting, overdue and untouched instead.
 */
function PropertyBar({ property: p }: { property: PropertySummary }) {
  const overdue = p.overdue > 0 ? ` · ${p.overdue} overdue` : "";
  const waiting = p.submitted > 0 ? ` · ${p.submitted} waiting` : "";
  return (
    <li>
      <Link
        href={`/walkthroughs/${p.id}`}
        title={`${p.name} · ${p.signed} of ${p.actionable} signed${overdue}${waiting}`}
        className="bg-inset hover:ring-muted/30 block rounded-[6px] p-4 ring-1 ring-inset ring-transparent"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-title tracking-normal">{p.name}</span>
          <span className="label flex items-center gap-2 whitespace-nowrap">
            {p.overdue > 0 ? (
              <span className="text-warn">{p.overdue} overdue</span>
            ) : null}
            <span className="tabular-nums">
              {p.signed}/{p.actionable}
            </span>
            <span aria-hidden>→</span>
          </span>
        </div>

        <SegmentBar
          total={p.actionable}
          segments={propertySegments(p)}
          className="mt-3 h-2.5"
        />

        <p className="label mt-2">walked {fmtDate(p.lastWalk)}</p>
      </Link>
    </li>
  );
}
