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
        {/* Ring and the numbers that make it, side by side and tight. */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          <div className="w-40 shrink-0">
            <Dial
              percent={totals.percent}
              tone={behind ? "var(--warn)" : "var(--ink)"}
              caption={`${totals.signed} of ${totals.actionable} signed off`}
              size={160}
            />
          </div>

          <div className="grid grid-cols-3 gap-x-10 gap-y-4">
            <Stat label="Open" value={totals.actionable - totals.signed} />
            <Stat
              label="Overdue tasks"
              value={totals.overdue}
              accent={totals.overdue > 0}
            />
            <Stat label="Signed" value={totals.signed} />
          </div>
        </div>

        {/* Every building as a bar. This is the leaderboard: worst first, the
            reason to open the page sitting at the top. */}
        <ul className="mt-6 space-y-2">
          {visible.map((p) => (
            <PropertyBar key={p.id} property={p} />
          ))}
        </ul>
      </Card>
    </main>
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
