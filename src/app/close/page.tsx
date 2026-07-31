import Link from "next/link";
import { redirect } from "next/navigation";

import { CloseBar } from "@/components/close/CloseBar";
import { MissedList } from "@/components/close/MissedList";
import { SAMPLE_MISSED, SAMPLE_NIGHTS } from "@/lib/rollup-sample";
import {
  HOUSES,
  builtCount,
  forRole,
  phaseName,
  rolesIn,
} from "@/lib/checklists";
import { currentNight, formatNight } from "@/lib/night";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * The clipboard. Front of house or heart of house, then the role, then open,
 * mid or close — you flip to yours rather than scrolling one long list.
 *
 * A phase with no list yet says so, the same way the weekly board shows a slot
 * that has not been set up. Ten checklists that exist and thirty that are
 * silently absent is the state that lets a venue believe it is covered.
 */
export default async function ChecklistsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const night = currentNight();

  // Which lists actually exist, from the table. The tree in code is the shape;
  // the rows are the truth.
  let venue: string | null = null;
  if (session.role === "leader") venue = session.venueId;
  else {
    const { data } = await db().from("venues").select("id").eq("code", "HAWK").maybeSingle();
    venue = (data as { id: string } | null)?.id ?? null;
  }
  const { data: liveRows } = venue
    ? await db()
        .from("close_checklists")
        .select("house, role, phase")
        .eq("venue_id", venue)
        .eq("active", true)
    : { data: [] };
  const live = new Set(
    ((liveRows ?? []) as { house: string; role: string; phase: string }[]).map(
      (r) => `${r.house}|${r.role}|${r.phase}`.toLowerCase(),
    ),
  );

  const total = builtCount().total;
  const built = live.size;

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <header className="mb-5">
        <span className="pill pill-pending">Prototype · nothing is saved</span>
        <p className="label mt-3">Night Hawk · {formatNight(night)}</p>
        <h1 className="mt-2 text-metric font-medium">Checklists</h1>
        <p className="label mt-2">
          {built} of {total} built
        </p>
      </header>

      {/* Above the clipboard, not behind a link.
          What keeps getting missed is the reason any of this exists, and a
          report you have to go and ask for is a report nobody reads. The four
          worst offenders sit on the way in, whether or not anyone was looking
          for them. */}
      <section className="panel border-warn/30 mb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="card-title">What&apos;s getting missed</h2>
          <p className="label">Last {SAMPLE_NIGHTS} nights</p>
        </div>

        <div className="mt-4">
          <MissedList rows={SAMPLE_MISSED.slice(0, 4)} />
        </div>

        <Link
          href="/close/rollup"
          className="ring-card-border text-ink mt-4 inline-flex min-h-11 items-center gap-2 rounded px-4 text-label tracking-[0.08em] ring-1"
        >
          Full report
          <span className="text-muted">by role, by night, by venue</span>
        </Link>

        <p className="label mt-3">
          Sample figures. Real from the night the first list is signed.
        </p>
      </section>

      <div className="space-y-5">
        {HOUSES.map((house) => (
          <section key={house.key} className="panel">
            <h2 className="card-title">{house.name}</h2>

            <ul className="mt-4 space-y-3">
              {rolesIn(house.key).map((role) => (
                <li key={role} className="border-divider border-t pt-3">
                  <p className="text-body tracking-[0.08em]">{role}</p>

                  <ul className="mt-2 flex flex-wrap gap-2">
                    {forRole(house.key, role).map((list) =>
                      live.has(
                        `${list.house}|${list.role}|${list.phase}`.toLowerCase(),
                      ) ? (
                        <li key={list.slug}>
                          <Link
                            href={`/close/${list.slug}`}
                            className="bg-warn text-on-warn inline-flex min-h-11 items-center gap-2 rounded px-4 text-label tracking-[0.08em]"
                          >
                            {phaseName(list.phase)}
                          </Link>
                        </li>
                      ) : (
                        <li key={list.slug}>
                          {/* Not a link, because there is nothing behind it
                              yet. Shown anyway so the gap is visible. */}
                          <span className="text-muted ring-card-border inline-flex min-h-11 items-center gap-2 rounded px-4 text-label tracking-[0.08em] ring-1 ring-inset">
                            {phaseName(list.phase)}
                            <span className="opacity-60">not set up</span>
                          </span>
                        </li>
                      ),
                    )}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="label mt-6">
        A review build. Roles are a first guess — worth checking against how a
        shift is actually split before any of this becomes a table.
      </p>

      <CloseBar back={session.role === "admin" ? "/admin" : "/venue"} />
    </main>
  );
}
