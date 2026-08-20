import Link from "next/link";
import { redirect } from "next/navigation";

import { CompanyHero } from "@/components/CompanyHero";
import { NarrativeStrip } from "@/components/NarrativeStrip";
import { VenueRows } from "@/components/VenueRows";
import { GradeAll } from "@/components/admin/GradeAll";
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

/**
 * The same week the board shows, with the same dashboard — the only thing
 * admin adds is where a venue row leads: the screen with approve and send-back
 * on it, rather than the read-only one.
 */
export default async function AdminDashboardPage() {
  if ((await getSession())?.role !== "admin") redirect("/admin/login");

  const { weekStart, rows, itemsDone, itemsTarget, finishes, history } =
    await getDashboard();
  // Scored on approvals, in the buckets the weekly note is written in. A
  // venue wins by winning every house that counts, not by the two averaged.
  const wins = rows.filter(venueIsWin).length;
  const missed = rows.filter((row) => venueApproved(row) === 0).length;
  const partial = rows.length - wins - missed;
  const winRate = rows.length ? Math.round((wins / rows.length) * 100) : 0;

  // The finished week, and whether it has been closed for everyone. Grading is
  // the thing every venue is waiting on before it can reset.
  const gradedWeek = mostRecentCompletedWeek();
  // The set, not just the total: the rows show the grade venue by venue, and
  // counting the live ones here keeps "N of 21" honest when a graded venue is
  // later stood down.
  const gradedIds = await gradedVenueIdsByHouse(gradedWeek);
  // Closed out means closed out in every house that counts. Counted off either
  // grade alone, "21 of 21" would have appeared with half the walks unread.

  return (
    <main>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="label">Week of {formatWeekStart(weekStart)}</p>
          <h1 className="text-metric mt-2 tracking-normal">
            Everyone&apos;s progress
          </h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/admin/codes" className="btn-ghost">
            Codes
          </Link>
          <Link href="/board" className="btn-ghost">
            Board
          </Link>
        </div>
      </header>

      <GradeAll
        weekStart={gradedWeek}
        weekLabel={formatWeekStart(gradedWeek)}
        houses={scoredHouses(gradedWeek).map((house) => ({
          house,
          // Counted against the live rows, not the raw grade rows: "N of 21"
          // stays honest when a graded venue is later stood down.
          graded: rows.filter((row) => gradedIds.get(house)?.has(row.venue.id))
            .length,
        }))}
        total={rows.length}
      />

      <NarrativeStrip
        deadlineMs={deadlineFor(weekStart).getTime()}
        itemsDone={itemsDone}
        itemsTarget={itemsTarget}
        activeVenues={rows.length}
      />

      <div className="grid grid-cols-12 gap-4">
        <CompanyHero
          winRate={winRate}
          percent={
            itemsTarget ? Math.round((itemsDone / itemsTarget) * 100) : 0
          }
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
          hrefPrefix="/admin/venue/"
          finishedAt={Object.fromEntries(finishes.map((f) => [f.code, f.at]))}
          gradedByHouse={gradedIds}
        />
      </div>
    </main>
  );
}
