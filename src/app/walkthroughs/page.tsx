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
 * The whole portfolio, on one screen. A ring for all of it, and a dial per
 * property under it.
 *
 * The same shape as logging in and seeing the locations: the number that says
 * whether you need to do anything, before you open anything. Here the number is
 * how much of what the walkthroughs asked for has been signed off with a photo
 * behind it. Overdue is the red, because a commitment past its date is the
 * thing that gets a building opened.
 */
export default async function WalkthroughsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const { properties } = await loadPortfolio();
  // Admin sees every building. A manager sees only their own.
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
          {totals.properties} {totals.properties === 1 ? "property" : "properties"}{" "}
          · signed off with a photo behind it
        </p>
        <h1 className="text-metric mt-2 tracking-normal">Walkthroughs</h1>
      </header>

      {/* The portfolio ring, the Heart of House card asked of buildings. */}
      <Card
        title="All properties"
        hint={`${totals.signed} of ${totals.actionable} signed off · ${
          totals.overdue > 0 ? `${totals.overdue} overdue` : "none overdue"
        }`}
      >
        <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
          <div>
            <Dial
              percent={totals.percent}
              tone={behind ? "var(--warn)" : "var(--ink)"}
              caption={`${totals.signed} of ${totals.actionable} signed off`}
              size={200}
            />
          </div>

          <div className="grid grid-cols-3 gap-x-6 gap-y-5 self-center">
            <Stat label="Open" value={totals.actionable - totals.signed} />
            <Stat label="Overdue" value={totals.overdue} accent={totals.overdue > 0} />
            <Stat label="Signed" value={totals.signed} />
            <Stat label="Properties" value={totals.properties} />
            <Stat label="Repeats" value={totals.repeats} accent={totals.repeats > 0} />
            <Stat label="On you" value={totals.onB} sub="B owns, open" />
          </div>
        </div>
      </Card>

      {/* One dial per building, three or four across, cascading down. Worst
          first: the order loadPortfolio already put them in. */}
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((p) => (
          <PropertyTile key={p.id} property={p} />
        ))}
      </ul>
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
 * One building as a dial. The ring is its signed share; the line under it is
 * the walk date and, when there is one, the overdue count in red, which is the
 * reason to tap in.
 */
function PropertyTile({ property }: { property: PropertySummary }) {
  const behind = property.overdue > 0;
  return (
    <li>
      <Link
        href={`/walkthroughs/${property.id}`}
        className="bg-inset hover:ring-muted/40 flex h-full flex-col items-center gap-3 rounded-[6px] p-4 ring-1 ring-inset ring-transparent"
      >
        <Dial
          percent={property.percent}
          tone={behind ? "var(--warn)" : "var(--ink)"}
          caption=""
          label={`${property.signed}/${property.actionable}`}
          size={128}
        />
        <div className="text-center">
          <p className="text-title tracking-normal">{property.name}</p>
          <p className="label mt-1">{fmtDate(property.lastWalk)}</p>
          {property.overdue > 0 ? (
            <p className="text-label text-warn mt-1 tracking-[0.08em]">
              {property.overdue} overdue
            </p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
