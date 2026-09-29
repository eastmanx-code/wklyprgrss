import Link from "next/link";
import { redirect } from "next/navigation";

import { CompanyHero } from "@/components/CompanyHero";
import { NarrativeStrip } from "@/components/NarrativeStrip";
import { VenueRows } from "@/components/VenueRows";
import { WeekStats } from "@/components/WeekStats";
import { getSession, venueOfSession } from "@/lib/session";
import { getDashboard, gradersByHouse } from "@/lib/status";
import {
  deadlineFor,
  formatDeadline,
  formatWeekStart,
  isDeadlinePassed,
  mostRecentCompletedWeek,
} from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const { weekStart, rows, byHouse } = await getDashboard();
  const ownVenueId = venueOfSession(session);
  // Leaders see the grade too — it is the thing that gates their reset, so
  // "has mine been closed out yet" should be answerable from the board.
  // Per house, because the grade is per house — one set for both would have
  // marked the kitchen closed out on the strength of the dining room.
  const gradedIds = await gradersByHouse(mostRecentCompletedWeek());
  // Before the due time nothing is gradeable, so the whole board reads as
  // filing rather than scoring — no review queue, no fails, no zero-scored
  // rings on a day nothing was owed.
  const deadlinePassed = isDeadlinePassed(weekStart);
  const deadlineLabel = formatDeadline(weekStart);

  // An active title, the way the walkthroughs board reads: the number the week
  // is about, not the word for it. Before the deadline that number is filing;
  // after it, what got signed off.
  const filed = byHouse.reduce((n, h) => n + h.itemsDone, 0);
  const signed = byHouse.reduce((n, h) => n + h.itemsApproved, 0);
  const target = byHouse.reduce((n, h) => n + h.itemsTarget, 0);

  return (
    <main>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="label">
            Everyone&apos;s progress · week of {formatWeekStart(weekStart)}
          </p>
          <h1 className="text-metric mt-2 tracking-normal">
            {deadlinePassed
              ? `${signed} of ${target} signed off`
              : `${filed} of ${target} filed`}
          </h1>
        </div>
        <Link
          href={session.role === "admin" ? "/admin" : "/home"}
          className="btn-ghost"
        >
          {session.role === "admin" ? "Admin" : "My venue"}
        </Link>
      </header>

      <NarrativeStrip
        deadlineMs={deadlineFor(weekStart).getTime()}
        deadlineLabel={formatDeadline(weekStart)}
        byHouse={byHouse}
        activeVenues={rows.length}
      />

      <div className="grid grid-cols-12 gap-4">
        <WeekStats
          rows={rows}
          gradedByHouse={gradedIds}
          deadlinePassed={deadlinePassed}
          deadlineLabel={deadlineLabel}
        />

        <CompanyHero
          byHouse={byHouse}
          deadlinePassed={deadlinePassed}
          deadlineLabel={deadlineLabel}
        />

        <VenueRows
          rows={rows}
          hrefPrefix="/board/"
          ownVenueId={ownVenueId}
          gradedByHouse={gradedIds}
          deadlinePassed={deadlinePassed}
          deadlineLabel={deadlineLabel}
        />
      </div>
    </main>
  );
}
