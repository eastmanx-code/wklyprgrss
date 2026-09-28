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
              segments={[
                { label: "Signed", value: totals.signed, fill: "var(--ink)" },
                {
                  label: "Awaiting review",
                  value: totals.submitted,
                  fill: "var(--ink)",
                  opacity: 0.4,
                },
                {
                  label: "Overdue",
                  value: totals.overdue,
                  fill: "var(--warn)",
                },
                {
                  label: "Not started",
                  value: notStarted,
                  fill: "var(--inset)",
                },
              ]}
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
            label="Awaiting review"
            value={totals.submitted}
            sub="photo up, not signed"
          />
          <Stat
            label="Repeats"
            value={totals.repeats}
            sub="raised again"
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
      title="Turnaround race"
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
                <li key={p.id} className="flex items-center gap-3">
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
        avg over {count} signed
      </p>
    </div>
  );
}

/**
 * One horizontal bar, the whole portfolio's actionable work sorted into where
 * it stands. A stacked bar rather than four numbers because the point is the
 * proportion: how much of the gap under the ring is a signature away versus
 * untouched. Segments carry a floor so a count of one still shows as a tick
 * rather than vanishing, and a zero segment is dropped entirely.
 */
function CompositionBar({
  total,
  segments,
}: {
  total: number;
  segments: {
    label: string;
    value: number;
    fill: string;
    opacity?: number;
  }[];
}) {
  if (total <= 0) {
    return (
      <p className="note text-muted leading-relaxed">
        No actionable work on record yet.
      </p>
    );
  }
  const shown = segments.filter((s) => s.value > 0);
  return (
    <div>
      <div className="bg-inset flex h-10 w-full overflow-hidden rounded-[6px]">
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

      {/* The key, each segment named with its count so the bar is readable
          without hovering it. */}
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
 * One building as a progress bar, and the door into it. The fill is its signed
 * share; the count and any overdue ride the same line, red when late.
 */
function PropertyBar({ property }: { property: PropertySummary }) {
  const behind = property.overdue > 0;
  const fill = property.actionable
    ? Math.round((property.signed / property.actionable) * 100)
    : 0;
  return (
    <li>
      <Link
        href={`/walkthroughs/${property.id}`}
        className="bg-inset hover:ring-muted/30 block rounded-[6px] p-4 ring-1 ring-inset ring-transparent"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-title tracking-normal">{property.name}</span>
          <span className="label flex items-center gap-2 whitespace-nowrap">
            {property.overdue > 0 ? (
              <span className="text-warn">{property.overdue} overdue</span>
            ) : null}
            <span className="tabular-nums">
              {property.signed}/{property.actionable}
            </span>
            <span aria-hidden>→</span>
          </span>
        </div>

        {/* The bar. */}
        <div className="bg-paper mt-3 h-2 w-full overflow-hidden rounded-full">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(fill, property.signed > 0 ? 3 : 0)}%`,
              background: behind ? "var(--warn)" : "var(--ink)",
            }}
          />
        </div>

        <p className="label mt-2">walked {fmtDate(property.lastWalk)}</p>
      </Link>
    </li>
  );
}
