import Link from "next/link";
import { redirect } from "next/navigation";

import { CloseBar } from "@/components/close/CloseBar";
import { MissedList } from "@/components/close/MissedList";
import { NewChecklistForm } from "@/components/close/NewChecklistForm";
import { houseName, roleSlug, type House, type Phase } from "@/lib/checklists";
import { currentNight, formatNight } from "@/lib/night";
import { venueRollup } from "@/lib/rollup";
import { closeVenueId } from "@/lib/close-venue";
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

  const venue = await closeVenueId(session);

  const { data: listRows } = venue
    ? await db()
        .from("close_checklists")
        .select("id, house, role, phase")
        .eq("venue_id", venue)
        .eq("active", true)
    : { data: [] };

  const lists = (listRows ?? []) as Row[];

  /**
   * Which lists are already signed for tonight.
   *
   * The colour on this screen is the night draining away. Everything starts
   * lit because nothing is signed, and a position goes quiet when every list
   * under it has been closed out — so the page is loud exactly while there is
   * work in it, and the same accent means the same thing it means on the
   * walkthrough board: this wants something from you.
   */
  const signed = new Set<string>();
  if (lists.length > 0) {
    const { data: nightRows } = await db()
      .from("close_nights")
      .select("checklist_id, certified_at")
      .eq("night", night)
      .in(
        "checklist_id",
        lists.map((l) => l.id),
      );
    for (const row of (nightRows ?? []) as {
      checklist_id: string;
      certified_at: string | null;
    }[]) {
      if (row.certified_at) signed.add(row.checklist_id);
    }
  }

  /** Nothing left open under this position tonight. */
  const positionDone = (house: House, role: string) =>
    lists
      .filter((l) => l.house === house && l.role === role)
      .every((l) => signed.has(l.id));

  /**
   * Real nights only. No sample rows.
   *
   * Until a list is signed there is nothing to report, and the screen used to
   * fill the gap with invented figures — "Stanchions polished · 9 of 30
   * nights" on a venue that has never signed anything. A manager reading that
   * on login has no way to tell it from tracking, and the first thing it
   * taught anybody was that the number cannot be trusted.
   */
  const real = venue ? await venueRollup(venue) : null;

  /**
   * The positions a house runs, each once.
   *
   * Not the lists. A position owns up to three of them and printing all three
   * here put the whole building on one screen: two houses, every role, every
   * phase, and a count on each. You pick the position you are working and the
   * lists are one tap in.
   */
  const positionsIn = (house: House) => {
    const roles = [
      ...new Set(lists.filter((l) => l.house === house).map((l) => l.role)),
    ];
    return roles.sort((a, b) => a.localeCompare(b));
  };

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <header className="mb-5">
        <span className="pill pill-pending">Review build</span>
        <p className="label mt-3">{formatNight(night)}</p>
        <h1 className="mt-2 text-metric font-medium">Checklists</h1>
        <p className="label mt-2">
          Pick your position · lit means still open tonight
        </p>
      </header>

      {/* Above the clipboard, not behind a link. What keeps getting missed is
          the reason any of this exists, and a report you have to go and ask
          for is a report nobody reads. */}
      {real ? (
        <section className="panel border-warn/30 mb-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="card-title">What&apos;s getting missed</h2>
            <p className="label">Last {real.nights} nights</p>
          </div>

          <div className="mt-4">
            {real.missed.length === 0 ? (
              <p className="note text-muted">
                Nothing left open in the window.
              </p>
            ) : (
              <MissedList rows={real.missed.slice(0, 4)} />
            )}
          </div>

          <Link
            href="/close/rollup"
            className="ring-card-border text-ink mt-4 inline-flex min-h-11 items-center gap-2 rounded px-4 text-label tracking-[0.08em] ring-1"
          >
            Full report
            <span className="text-muted">by role, by night, by venue</span>
          </Link>
        </section>
      ) : (
        <section className="panel-quiet mb-5">
          <h2 className="card-title">What&apos;s getting missed</h2>
          <p className="note text-muted mt-2 leading-relaxed">
            Nothing signed off yet. This fills in from the first night somebody
            signs a list and shows what keeps being left open.
          </p>
        </section>
      )}

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
            positionsIn(house).length === 0 ? null : (
              <section key={house} className="panel">
                <h2 className="card-title">{houseName(house)}</h2>

                {/* Cards, not rows off a hairline. A position is the thing
                    you are here to tap, and a list of names divided by rules
                    reads as a table of contents — the tap target has to look
                    like one. */}
                <ul className="mt-4 space-y-2">
                  {positionsIn(house).map((role) => (
                    <li key={role}>
                      <Link
                        href={`/close/position/${house.toLowerCase()}/${roleSlug(role)}`}
                        className={`flex min-h-14 items-center justify-between gap-3 rounded px-4 py-3 ${
                          positionDone(house, role)
                            ? "bg-inset text-muted ring-divider ring-1 ring-inset"
                            : "bg-warn text-on-warn hover:bg-warn/90"
                        }`}
                      >
                        <span className="text-body tracking-[0.08em]">
                          {role}
                        </span>
                        {positionDone(house, role) ? (
                          <span className="label">Signed</span>
                        ) : (
                          <span aria-hidden>→</span>
                        )}
                      </Link>
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
