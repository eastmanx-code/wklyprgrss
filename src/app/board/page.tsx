import Link from "next/link";
import { redirect } from "next/navigation";

import { CompanyHero } from "@/components/CompanyHero";
import { VenueRows } from "@/components/VenueRows";
import { VenueJumpBar } from "@/components/ui";
import { getSession } from "@/lib/session";
import { getDashboard } from "@/lib/status";
import { deadlineFor, formatDeadline, formatWeekStart } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const { weekStart, rows, itemsDone, itemsTarget, finishes } =
    await getDashboard();
  const ownVenueId = session.role === "leader" ? session.venueId : null;
  const passing = rows.filter((row) => row.status === "PASS").length;
  const failing = rows.filter((row) => row.status === "FAIL").length;
  const pending = rows.length - passing - failing;
  const percent = itemsTarget ? Math.round((itemsDone / itemsTarget) * 100) : 0;

  return (
    <main>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="label">Week of {formatWeekStart(weekStart)}</p>
          <h1 className="mt-2 text-2xl font-medium tracking-tight">
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
        pending={pending}
        failing={failing}
        statuses={rows.map((row) => row.status)}
        deadlineLabel={formatDeadline(weekStart)}
        deadlineMs={deadlineFor(weekStart).getTime()}
        finishes={finishes}
      />

      <VenueJumpBar
        venues={rows.map((row) => row.venue)}
        ownVenueId={ownVenueId}
      />

      <VenueRows rows={rows} hrefPrefix="/board/" ownVenueId={ownVenueId} />
    </main>
  );
}
