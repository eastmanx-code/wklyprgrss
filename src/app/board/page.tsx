import Link from "next/link";
import { redirect } from "next/navigation";

import { CompanyHero } from "@/components/CompanyHero";
import { NarrativeStrip } from "@/components/NarrativeStrip";
import { VenueRows } from "@/components/VenueRows";
import { getSession } from "@/lib/session";
import { getDashboard, gradedVenueIdsByHouse } from "@/lib/status";
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

  const { weekStart, rows, byHouse } = await getDashboard();
  const ownVenueId = session.role === "leader" ? session.venueId : null;
  // Leaders see the grade too — it is the thing that gates their reset, so
  // "has mine been closed out yet" should be answerable from the board.
  // Per house, because the grade is per house — one set for both would have
  // marked the kitchen closed out on the strength of the dining room.
  const gradedIds = await gradedVenueIdsByHouse(mostRecentCompletedWeek());

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
        byHouse={byHouse}
        activeVenues={rows.length}
      />

      <div className="grid grid-cols-12 gap-4">
        <CompanyHero
          byHouse={byHouse}
          deadlineLabel={formatDeadline(weekStart)}
          deadlineMs={deadlineFor(weekStart).getTime()}
        />

        <VenueRows
          rows={rows}
          hrefPrefix="/board/"
          ownVenueId={ownVenueId}
          // A venue's row shows when it finished front of house, which is the
          // half it has always been judged on. The kitchen's own turnaround is
          // on its card above.
          finishedAt={Object.fromEntries(
            (byHouse.find((h) => h.house === "FOH")?.finishes ?? []).map(
              (f) => [f.code, f.at],
            ),
          )}
          gradedByHouse={gradedIds}
        />
      </div>
    </main>
  );
}
