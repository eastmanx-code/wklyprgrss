import Link from "next/link";
import { redirect } from "next/navigation";

import { CompanyHero } from "@/components/CompanyHero";
import { NarrativeStrip } from "@/components/NarrativeStrip";
import { VenueRows } from "@/components/VenueRows";
import { getSession } from "@/lib/session";
import {
  getDashboard,
  gradedVenueIdsByHouse,
  scoredHouses,
  venueApproved,
  venueIsWin,
} from "@/lib/status";
import {
  deadlineFor,
  formatDeadline,
  formatWeekStart,
  mostRecentCompletedWeek,
} from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const { weekStart, rows, itemsDone, itemsTarget, finishes, history } =
    await getDashboard();
  const ownVenueId = session.role === "leader" ? session.venueId : null;
  // Leaders see the grade too — it is the thing that gates their reset, so
  // "has mine been closed out yet" should be answerable from the board.
  // Per house, because the grade is per house — one set for both would have
  // marked the kitchen closed out on the strength of the dining room.
  const gradedIds = await gradedVenueIdsByHouse(mostRecentCompletedWeek());
  // Scored on approvals, in the buckets the weekly note is written in. A
  // venue wins by winning every house that counts, not by the two averaged.
  const wins = rows.filter(venueIsWin).length;
  const missed = rows.filter((row) => venueApproved(row) === 0).length;
  const partial = rows.length - wins - missed;
  const winRate = rows.length ? Math.round((wins / rows.length) * 100) : 0;

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
        activeVenues={rows.length}
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
          deadlineLabel={formatDeadline(weekStart)}
          deadlineMs={deadlineFor(weekStart).getTime()}
          finishes={finishes}
          history={history}
          houses={scoredHouses(weekStart).length}
        />

        <VenueRows
          rows={rows}
          hrefPrefix="/board/"
          ownVenueId={ownVenueId}
          finishedAt={Object.fromEntries(finishes.map((f) => [f.code, f.at]))}
          gradedByHouse={gradedIds}
        />
      </div>
    </main>
  );
}
