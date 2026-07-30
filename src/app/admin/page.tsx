import Link from "next/link";
import { redirect } from "next/navigation";

import { CompanyHero } from "@/components/CompanyHero";
import { VenueRows } from "@/components/VenueRows";
import { VenueJumpBar } from "@/components/ui";
import { AdminPins, type AdminPin } from "@/components/admin/AdminPins";
import { getSession } from "@/lib/session";
import { getDashboard } from "@/lib/status";
import { db } from "@/lib/supabase";
import { deadlineFor, formatDeadline, formatWeekStart } from "@/lib/week";

export const dynamic = "force-dynamic";

/**
 * The same week the board shows, with the same dashboard — the only thing
 * admin adds is where a venue row leads: the screen with approve and send-back
 * on it, rather than the read-only one.
 */
export default async function AdminDashboardPage() {
  if ((await getSession())?.role !== "admin") redirect("/admin/login");

  const { weekStart, rows, itemsDone, itemsTarget, venuesUnderConfigured } =
    await getDashboard();
  const { data: adminPins } = await db()
    .from("admin_pins")
    .select("id, pin, label")
    .order("created_at");

  const passing = rows.filter((row) => row.status === "PASS").length;
  const failing = rows.filter((row) => row.status === "FAIL").length;
  const notStarted = rows.filter((row) => row.doneCount === 0).length;

  return (
    <main>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="label">Week of {formatWeekStart(weekStart)}</p>
          <h1 className="mt-2 text-2xl font-medium tracking-tight">
            Everyone&apos;s progress
          </h1>
        </div>
        <Link href="/board" className="btn-ghost">
          Shared board
        </Link>
      </header>

      <CompanyHero
        percent={itemsTarget ? Math.round((itemsDone / itemsTarget) * 100) : 0}
        itemsDone={itemsDone}
        itemsTarget={itemsTarget}
        passing={passing}
        pending={rows.length - passing - failing}
        failing={failing}
        notStarted={notStarted}
        statuses={rows.map((row) => row.status)}
        deadlineLabel={formatDeadline(weekStart)}
        deadlineMs={deadlineFor(weekStart).getTime()}
      />

      {venuesUnderConfigured.length > 0 ? (
        <div className="panel-quiet mb-3">
          <p className="label">Setup incomplete</p>
          <p className="note mt-2">
            {`${venuesUnderConfigured.length} of ${rows.length} venues don't have 10 items yet`}
          </p>
          <p className="label mt-2 leading-relaxed">
            {venuesUnderConfigured.join(" · ")}
          </p>
        </div>
      ) : null}

      {/* Rarely used, so collapsed — but near the top, because buried under
          twenty-seven venue rows it may as well not exist. */}
      <details className="mb-5">
        <summary className="label cursor-pointer select-none">
          Admin codes · {(adminPins ?? []).length} extra
        </summary>
        <div className="mt-3">
          <AdminPins pins={(adminPins ?? []) as AdminPin[]} />
        </div>
      </details>

      <VenueJumpBar venues={rows.map((row) => row.venue)} />

      <VenueRows rows={rows} hrefPrefix="/admin/venue/" />
    </main>
  );
}
