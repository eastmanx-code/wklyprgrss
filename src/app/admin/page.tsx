import Link from "next/link";
import { redirect } from "next/navigation";

import {
  CompanyRollup,
  DotStrip,
  StatusPill,
  VenueJumpBar,
} from "@/components/ui";
import { getSession } from "@/lib/session";
import { getDashboard } from "@/lib/status";
import { db } from "@/lib/supabase";
import { AdminPins, type AdminPin } from "@/components/admin/AdminPins";
import { formatDeadline, formatWeekStart } from "@/lib/week";

export const dynamic = "force-dynamic";

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

  return (
    <main>
      <header className="mb-6">
        <div>
          <p className="label">Week of {formatWeekStart(weekStart)}</p>
          <h1 className="mt-2 text-2xl font-medium tracking-tight">
            All venues
          </h1>
          <p className="label mt-2">Due {formatDeadline(weekStart)}</p>
        </div>
      </header>

      <CompanyRollup
        itemsDone={itemsDone}
        itemsTarget={itemsTarget}
        venuesPassing={passing}
        venuesTotal={rows.length}
        statuses={rows.map((row) => row.status)}
      />

      {venuesUnderConfigured.length > 0 ? (
        <div className="panel-quiet mb-5">
          <p className="label">Setup incomplete</p>
          <p className="note mt-2">
            {`${venuesUnderConfigured.length} of ${rows.length} venues don't have 10 items yet`}
          </p>
          <p className="label mt-2 leading-relaxed">
            {venuesUnderConfigured.join(" · ")}
          </p>
        </div>
      ) : null}

      {failing > 0 ? (
        <p className="label mb-5 text-fail">
          {failing} {failing === 1 ? "venue has" : "venues have"} already missed
          this week
        </p>
      ) : null}

      <VenueJumpBar venues={rows.map((row) => row.venue)} />

      <div className="mb-2 flex items-center gap-3 px-2">
        <span className="label w-14">Venue</span>
        <span className="label flex-1">Progress</span>
        <span className="label w-16 text-right">Streak</span>
      </div>

      <ul className="stagger space-y-2">
        {rows.map((row) => (
          <li
            key={row.venue.id}
            id={`venue-${row.venue.code}`}
            className="scroll-mt-4"
          >
            <Link
              href={`/admin/venue/${row.venue.id}`}
              className="panel panel-link flex items-center gap-3 px-4 py-3"
            >
              <span className="w-14 shrink-0 font-mono text-sm font-medium">
                {row.venue.code}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="flex items-center gap-2">
                  <StatusPill status={row.status} />
                  <span className="label">
                    {row.doneCount}/10
                  </span>
                </span>
                <DotStrip done={row.doneCount} total={row.activeCount} />
              </span>

              <span className="w-16 shrink-0 text-right">
                {row.failStreak > 0 ? (
                  <span className="font-mono text-sm text-fail tabular-nums">
                    {row.failStreak}w
                  </span>
                ) : (
                  <span className="label">—</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <h2 className="label mb-3">Admin codes</h2>
        <AdminPins pins={(adminPins ?? []) as AdminPin[]} />
      </section>

      <p className="mt-8 text-center">
        <Link href="/board" className="label hover:text-ink">
          Shared board
        </Link>
      </p>
    </main>
  );
}
