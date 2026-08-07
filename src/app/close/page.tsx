import Link from "next/link";
import { redirect } from "next/navigation";

import { CloseBar } from "@/components/close/CloseBar";
import { MissedList } from "@/components/close/MissedList";
import { NewChecklistForm } from "@/components/close/NewChecklistForm";
import {
  houseName,
  phaseName,
  PHASE_ORDER,
  slugFor,
  type House,
  type Phase,
} from "@/lib/checklists";
import { currentNight, formatNight } from "@/lib/night";
import { venueRollup } from "@/lib/rollup";
import { SAMPLE_MISSED, SAMPLE_NIGHTS } from "@/lib/rollup-sample";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Row = { id: string; house: House; role: string; phase: Phase };

/**
 * The clipboard. Front of house or heart of house, then the role, then open,
 * mid or close — you flip to yours rather than scrolling one long list.
 *
 * Built from the venue's own rows. It used to render forty slots from a fixed
 * list of roles invented in code, so every venue was shown the same MOD,
 * Bartender, Barback whether or not it splits a shift that way, and thirty-odd
 * of them permanently read "not set up". A venue writes the roles it actually
 * runs; an empty clipboard says so plainly and offers the way to start one.
 */
export default async function ChecklistsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const night = currentNight();

  let venue: string | null = null;
  if (session.role === "leader") venue = session.venueId;
  else {
    const { data } = await db()
      .from("venues")
      .select("id")
      .eq("code", "HAWK")
      .maybeSingle();
    venue = (data as { id: string } | null)?.id ?? null;
  }

  const { data: listRows } = venue
    ? await db()
        .from("close_checklists")
        .select("id, house, role, phase")
        .eq("venue_id", venue)
        .eq("active", true)
    : { data: [] };

  const lists = (listRows ?? []) as Row[];

  // How many items each list actually holds. A list with a name and nothing
  // in it is worse than no list — it reads as covered.
  const counts = new Map<string, number>();
  if (lists.length > 0) {
    const { data: itemRows } = await db()
      .from("close_items")
      .select("checklist_id")
      .in(
        "checklist_id",
        lists.map((l) => l.id),
      )
      .eq("active", true);
    for (const row of (itemRows ?? []) as { checklist_id: string }[]) {
      counts.set(row.checklist_id, (counts.get(row.checklist_id) ?? 0) + 1);
    }
  }

  const real = venue ? await venueRollup(venue) : null;
  const missed = real?.missed ?? SAMPLE_MISSED;
  const windowNights = real?.nights ?? SAMPLE_NIGHTS;

  const byHouse = (house: House) => {
    const roles = [
      ...new Set(lists.filter((l) => l.house === house).map((l) => l.role)),
    ];
    return roles
      .sort((a, b) => a.localeCompare(b))
      .map((role) => ({
        role,
        phases: lists
          .filter((l) => l.house === house && l.role === role)
          .sort(
            (a, b) =>
              PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase),
          ),
      }));
  };

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <header className="mb-5">
        <span className="pill pill-pending">Review build</span>
        <p className="label mt-3">{formatNight(night)}</p>
        <h1 className="mt-2 text-metric font-medium">Checklists</h1>
        <p className="label mt-2">
          {lists.length} {lists.length === 1 ? "list" : "lists"}
        </p>
      </header>

      {/* Above the clipboard, not behind a link. What keeps getting missed is
          the reason any of this exists, and a report you have to go and ask
          for is a report nobody reads. */}
      <section className="panel border-warn/30 mb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="card-title">What&apos;s getting missed</h2>
          <p className="label">Last {windowNights} nights</p>
        </div>

        <div className="mt-4">
          {missed.length === 0 ? (
            <p className="note text-muted">Nothing left open in the window.</p>
          ) : (
            <MissedList rows={missed.slice(0, 4)} />
          )}
        </div>

        <Link
          href="/close/rollup"
          className="ring-card-border text-ink mt-4 inline-flex min-h-11 items-center gap-2 rounded px-4 text-label tracking-[0.08em] ring-1"
        >
          Full report
          <span className="text-muted">by role, by night, by venue</span>
        </Link>

        {real ? null : (
          <p className="label mt-3">
            Sample figures. Real from the night the first list is signed.
          </p>
        )}
      </section>

      {lists.length === 0 ? (
        <section className="panel mb-5">
          <h2 className="card-title">No lists yet</h2>
          <p className="note text-muted mt-2 leading-relaxed">
            Start with the one your venue already runs on paper. A role, a
            phase, and the items in the order somebody walks them.
          </p>
        </section>
      ) : (
        <div className="mb-5 space-y-5">
          {(["FOH", "HOH"] as House[]).map((house) =>
            byHouse(house).length === 0 ? null : (
              <section key={house} className="panel">
                <h2 className="card-title">{houseName(house)}</h2>

                <ul className="mt-4 space-y-3">
                  {byHouse(house).map(({ role, phases }) => (
                    <li key={role} className="border-divider border-t pt-3">
                      <p className="text-body tracking-[0.08em]">{role}</p>

                      <ul className="mt-2 flex flex-wrap gap-2">
                        {phases.map((list) => {
                          const slug = slugFor(
                            list.house,
                            list.role,
                            list.phase,
                          );
                          const count = counts.get(list.id) ?? 0;
                          return (
                            <li key={list.id}>
                              <Link
                                href={`/close/${slug}`}
                                className={
                                  count > 0
                                    ? "bg-warn text-on-warn inline-flex min-h-11 items-center gap-2 rounded px-4 text-label tracking-[0.08em]"
                                    : "text-muted ring-card-border inline-flex min-h-11 items-center gap-2 rounded px-4 text-label tracking-[0.08em] ring-1 ring-inset"
                                }
                              >
                                {phaseName(list.phase)}
                                {/* A named list with nothing in it reads as
                                    covered, which is the one thing worse than
                                    an absent one. */}
                                <span className="opacity-70">
                                  {count > 0 ? `${count} items` : "empty"}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}

      <NewChecklistForm />

      <CloseBar back={session.role === "admin" ? "/admin" : "/venue"} />
    </main>
  );
}
