import Link from "next/link";
import { redirect } from "next/navigation";

import { CompanyHero } from "@/components/CompanyHero";
import { NarrativeStrip } from "@/components/NarrativeStrip";
import { VenueRows } from "@/components/VenueRows";
import { WeekStats } from "@/components/WeekStats";
import { GradeAll } from "@/components/admin/GradeAll";
import { getSession } from "@/lib/session";
import { getDashboard, gradersByHouse } from "@/lib/status";
import { HOUSES } from "@/lib/types";
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

  const { weekStart, rows, byHouse } = await getDashboard();

  // The finished week, and whether it has been closed for everyone. Grading is
  // the thing every venue is waiting on before it can reset.
  const gradedWeek = mostRecentCompletedWeek();
  // The set, not just the total: the rows show the grade venue by venue, and
  // counting the live ones here keeps "N of 21" honest when a graded venue is
  // later stood down.
  const gradedIds = await gradersByHouse(gradedWeek);
  // Closed out means closed out in every house that counts. Counted off either
  // grade alone, "21 of 21" would have appeared with half the walks unread.

  return (
    <main>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label">Week of {formatWeekStart(weekStart)}</p>
          <h1 className="text-metric mt-2 tracking-normal">
            Everyone&apos;s progress
          </h1>
        </div>
        {/* Wraps under the title on a narrow phone. Held on one line beside
            the heading these two buttons ran 27px past a 320px screen and put
            the whole page into a sideways scroll — for two links that are
            perfectly happy on their own row. */}
        <div className="flex flex-wrap gap-2">
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
        houses={HOUSES.filter((house) =>
          rows.some((row) => row.venue.houses.includes(house)),
        ).map((house) => {
          // Counted against the live rows, not the raw grade rows: "N of 21"
          // stays honest when a graded venue is later stood down. And only
          // against the venues that owe this house, so the four bars with no
          // kitchen are not sitting in the denominator waiting for a grade
          // that is never coming.
          const owed = rows.filter((row) => row.venue.houses.includes(house));
          return {
            house,
            graded: owed.filter((row) =>
              gradedIds.get(house)?.has(row.venue.id),
            ).length,
            total: owed.length,
          };
        })}
      />

      <NarrativeStrip
        deadlineMs={deadlineFor(weekStart).getTime()}
        deadlineLabel={formatDeadline(weekStart)}
        byHouse={byHouse}
        activeVenues={rows.length}
      />

      <div className="grid grid-cols-12 gap-4">
        <WeekStats rows={rows} gradedByHouse={gradedIds} audience="admin" />

        <CompanyHero byHouse={byHouse} />

        <VenueRows
          rows={rows}
          hrefPrefix="/admin/venue/"
          gradedByHouse={gradedIds}
          audience="admin"
        />
      </div>
    </main>
  );
}
