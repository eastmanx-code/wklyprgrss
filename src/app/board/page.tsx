import Link from "next/link";
import { redirect } from "next/navigation";

import { CompanyHero } from "@/components/CompanyHero";
import { NarrativeStrip } from "@/components/NarrativeStrip";
import { VenueRows } from "@/components/VenueRows";
import { getSession } from "@/lib/session";
import { WIN_THRESHOLD, getDashboard } from "@/lib/status";
import { deadlineFor, formatDeadline, formatWeekStart } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const { weekStart, rows, itemsDone, itemsTarget, finishes, history } =
    await getDashboard();
  const ownVenueId = session.role === "leader" ? session.venueId : null;
  const setup = rows.filter((row) => row.status === "SETUP").length;
  // Scored on approvals, in the buckets the weekly note is written in.
  const scored = rows.filter((row) => row.status !== "SETUP");
  const wins = scored.filter(
    (row) => row.approvedCount >= WIN_THRESHOLD,
  ).length;
  const partial = scored.filter(
    (row) => row.approvedCount > 0 && row.approvedCount < WIN_THRESHOLD,
  ).length;
  const missed = scored.filter((row) => row.approvedCount === 0).length;
  const winRate = scored.length ? Math.round((wins / scored.length) * 100) : 0;

  const percent = itemsTarget ? Math.round((itemsDone / itemsTarget) * 100) : 0;

  return (
    <main>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="label">Week of {formatWeekStart(weekStart)}</p>
          <h1 className="text-metric mt-2 tracking-normal">
            Everyone&apos;s progress
          </h1>
        </div>
        <Link
          href={session.role === "admin" ? "/admin" : "/venue"}
          className="btn-ghost"
        >
          {session.role === "admin" ? "Admin" : "My venue"}
        </Link>
      </header>

      <NarrativeStrip
        deadlineMs={deadlineFor(weekStart).getTime()}
        itemsDone={itemsDone}
        itemsTarget={itemsTarget}
        activeVenues={rows.length - setup}
        notSetUp={setup}
      />

      <div className="grid grid-cols-12 gap-4">
        <CompanyHero
          winRate={winRate}
          percent={percent}
          itemsDone={itemsDone}
          itemsTarget={itemsTarget}
          passing={wins}
          pending={partial}
          failing={missed}
          setup={setup}
          deadlineLabel={formatDeadline(weekStart)}
          deadlineMs={deadlineFor(weekStart).getTime()}
          finishes={finishes}
          history={history}
        />

        <VenueRows
          rows={rows}
          hrefPrefix="/board/"
          ownVenueId={ownVenueId}
          finishedAt={Object.fromEntries(finishes.map((f) => [f.code, f.at]))}
        />
      </div>
    </main>
  );
}
