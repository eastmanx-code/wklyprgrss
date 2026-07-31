import Link from "next/link";
import { redirect } from "next/navigation";

import { CompanyHero } from "@/components/CompanyHero";
import { VenueRows } from "@/components/VenueRows";
import { getSession } from "@/lib/session";
import { getDashboard } from "@/lib/status";
import { deadlineFor, formatDeadline, formatWeekStart } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const { weekStart, rows, itemsDone, itemsTarget, finishes, history } =
    await getDashboard();
  const ownVenueId = session.role === "leader" ? session.venueId : null;
  const passing = rows.filter((row) => row.status === "PASS").length;
  const failing = rows.filter((row) => row.status === "FAIL").length;
  const setup = rows.filter((row) => row.status === "SETUP").length;
  const pendingCount = rows.filter((row) => row.status === "PENDING").length;
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

      <CompanyHero
        percent={percent}
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

      <div className="grid grid-cols-12 gap-4">
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
