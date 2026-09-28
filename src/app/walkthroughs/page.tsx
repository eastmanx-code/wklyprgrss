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

      <Card
        title="All properties"
        hint={`${totals.signed} of ${totals.actionable} signed off · ${
          totals.overdue > 0 ? `${totals.overdue} overdue` : "none overdue"
        }`}
      >
        {/* Ring, the graph that breaks it down, and the numbers that don't fit
            on the ring — one row, the way the weekly hero reads. */}
        <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[180px_1fr_auto] lg:items-center">
          <div className="mx-auto w-full max-w-[180px] lg:mx-0">
            <Dial
              percent={totals.percent}
              tone={behind ? "var(--warn)" : "var(--ink)"}
              caption={`${totals.signed} of ${totals.actionable} signed off`}
              size={180}
            />
          </div>

          {/* The graph: every actionable line, sorted into where it stands. It
              says what the ring's gap is — waiting on a signature is a
              different problem from nobody having started. */}
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
            <p className="label mt-4 leading-snug">
              {fullySigned} of {totals.properties} properties fully signed
              {behindCount > 0 ? ` · ${behindCount} behind` : ""}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-x-8 gap-y-4 lg:grid-cols-1 lg:gap-y-5">
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
              sub="raised on another walk"
              accent={totals.repeats > 0}
            />
          </div>
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
