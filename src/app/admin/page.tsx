import Link from "next/link";
import { redirect } from "next/navigation";

import { CompanyHero } from "@/components/CompanyHero";
import { NarrativeStrip } from "@/components/NarrativeStrip";
import { VenueRows } from "@/components/VenueRows";
import { getSession } from "@/lib/session";
import { getDashboard } from "@/lib/status";
import { deadlineFor, formatDeadline, formatWeekStart } from "@/lib/week";

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
  const passing = rows.filter((row) => row.status === "PASS").length;
  const failing = rows.filter((row) => row.status === "FAIL").length;
  const setup = rows.filter((row) => row.status === "SETUP").length;
  const pendingCount = rows.filter((row) => row.status === "PENDING").length;

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

      <NarrativeStrip
        deadlineMs={deadlineFor(weekStart).getTime()}
        itemsDone={itemsDone}
        itemsTarget={itemsTarget}
        activeVenues={rows.length - setup}
        notSetUp={setup}
      />

      <div className="grid grid-cols-12 gap-4">
        <CompanyHero
          percent={
            itemsTarget ? Math.round((itemsDone / itemsTarget) * 100) : 0
          }
          itemsDone={itemsDone}
          itemsTarget={itemsTarget}
          passing={passing}
          pending={pendingCount}
          failing={failing}
          setup={setup}
          deadlineLabel={formatDeadline(weekStart)}
          deadlineMs={deadlineFor(weekStart).getTime()}
          finishes={finishes}
          history={history}
        />

        <VenueRows
          rows={rows}
          hrefPrefix="/admin/venue/"
          finishedAt={Object.fromEntries(finishes.map((f) => [f.code, f.at]))}
        />
      </div>
    </main>
  );
}
