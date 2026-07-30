import Link from "next/link";
import { redirect } from "next/navigation";

import {
  CompanyRollup,
  DotStrip,
  StatusPill,
  VenueJumpBar,
} from "@/components/ui";
import { getSession } from "@/lib/session";
import { getDashboard } from "@/lib/status";
import { formatDeadline, formatWeekStart } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const { weekStart, rows, itemsDone, itemsTarget } = await getDashboard();
  const ownVenueId = session.role === "leader" ? session.venueId : null;
  const passing = rows.filter((row) => row.status === "PASS").length;

  return (
    <main>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="label">Week of {formatWeekStart(weekStart)}</p>
          <h1 className="mt-2 text-2xl font-medium tracking-tight">
            Everyone&apos;s progress
          </h1>
          <p className="label mt-2">Due {formatDeadline(weekStart)}</p>
        </div>
        <Link
          href={session.role === "admin" ? "/admin" : "/venue"}
          className="btn-ghost"
        >
          {session.role === "admin" ? "Admin" : "My venue"}
        </Link>
      </header>

      <CompanyRollup
        itemsDone={itemsDone}
        itemsTarget={itemsTarget}
        venuesPassing={passing}
        venuesTotal={rows.length}
        statuses={rows.map((row) => row.status)}
      />

      <VenueJumpBar
        venues={rows.map((row) => row.venue)}
        ownVenueId={ownVenueId}
      />

      <ul className="stagger space-y-2">
        {rows.map((row) => (
          <li
            key={row.venue.id}
            id={`venue-${row.venue.code}`}
            className="scroll-mt-4"
          >
            <Link
              href={`/board/${row.venue.id}`}
              className="panel panel-link flex items-center gap-3 px-4 py-3"
            >
              <span className="w-14 shrink-0 font-mono text-sm font-medium">
                {row.venue.code}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="flex items-center gap-2">
                  <StatusPill status={row.status} />
                  <span className="label">
                    {row.doneCount}/{row.activeCount}
                  </span>
                  {row.venue.id === ownVenueId ? (
                    <span className="label">· you</span>
                  ) : null}
                </span>
                <DotStrip done={row.doneCount} total={row.activeCount} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
