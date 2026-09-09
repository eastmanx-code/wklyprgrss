import Link from "next/link";
import { redirect } from "next/navigation";

import { T } from "@/components/Lang";
import { NewChecklistForm } from "@/components/checklists/NewChecklistForm";
import {
  HOUSE_ES,
  houseName,
  roleSlug,
  type House,
  type Phase,
} from "@/lib/checklists";
import { currentNight, formatNight, formatNightEs } from "@/lib/night";
import {
  closeVenueCode,
  closeVenueId,
  closeVenueName,
} from "@/lib/close-venue";
import { getSession, mayManage } from "@/lib/session";
import { db } from "@/lib/supabase";
import { BackLink } from "@/components/ui";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  house: House;
  role: string;
  role_es: string | null;
  phase: Phase;
};

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
  // An admin who has not picked a building yet gets the list of them. This
  // used to show them one venue chosen in code, with nothing on the page
  // saying which, which is how an admin edits the wrong venue's list.
  if (!venue && session.role === "admin") redirect("/checklists/locations");
  const venueName = venue ? await closeVenueName(venue) : null;
  const venueCode = venue ? await closeVenueCode(venue) : null;

  const { data: listRows } = venue
    ? await db()
        .from("close_checklists")
        .select("id, house, role, role_es, phase")
        .eq("venue_id", venue)
        .eq("active", true)
    : { data: [] };

  const lists = (listRows ?? []) as Row[];

  /**
   * The position, in Spanish, where somebody has written it.
   *
   * A role is free text on the checklist row and several rows share one: a
   * bartender has an open list and a close list. First non-empty wins, so a
   * position reads the same whichever of its lists carried the translation.
   */
  const roleEs = new Map<string, string>();
  for (const row of lists) {
    const said = row.role_es?.trim();
    if (said && !roleEs.has(row.role)) roleEs.set(row.role, said);
  }

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

  /** Every list under this position is signed. */
  const positionDone = (house: House, role: string) =>
    lists
      .filter((l) => l.house === house && l.role === role)
      .every((l) => signed.has(l.id));

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
      {/* The only close screen that had no way back at the top: it leaned on
          the bar at the foot, and the bar is gone. */}
      <BackLink
        href={session.role === "admin" ? "/checklists/locations" : "/home"}
      >
        {session.role === "admin" ? (
          <T en="All locations" es="Todas las ubicaciones" />
        ) : (
          <T en="Home" es="Inicio" />
        )}
      </BackLink>

      <header className="mb-5">
        <p className="label">
          {venueName ? `${venueName} · ` : ""}
          <T en={formatNight(night)} es={formatNightEs(night)} />
        </p>
        <h1 className="mt-2 text-metric font-medium">
          <T en="Checklists" es="Listas" />
        </h1>
        <p className="label mt-2">
          <T
            en="Pick your position · lit means not signed yet"
            es="Escoge tu puesto · lo iluminado no está firmado"
          />
        </p>
      </header>

      {/* The report is not on this screen. This is the clipboard the crew
          opens to tick and sign, and a month of misses above it is the
          public shame the report is not for. A manager gets one link to the
          venue's night; a leader gets the lists. */}
      {mayManage(session) && venueCode ? (
        <p className="mb-5">
          <Link
            href={`/checklists/compliance/${venueCode}`}
            className="ring-card-border text-ink inline-flex min-h-11 items-center gap-2 rounded px-4 text-label tracking-[0.08em] ring-1"
          >
            <T en="Last night" es="Anoche" />
            <span className="text-muted">
              <T en="what failed, who signed" es="qué falló, quién firmó" />
            </span>
          </Link>
        </p>
      ) : null}

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
                <h2 className="card-title">
                  <T en={houseName(house)} es={HOUSE_ES[house]} />
                </h2>

                {/* Cards, not rows off a hairline. A position is the thing
                    you are here to tap, and a list of names divided by rules
                    reads as a table of contents — the tap target has to look
                    like one. */}
                <ul className="mt-4 space-y-2">
                  {positionsIn(house).map((role) => (
                    <li key={role}>
                      <Link
                        href={`/checklists/position/${house.toLowerCase()}/${roleSlug(role)}`}
                        className={`flex min-h-14 items-center justify-between gap-3 rounded px-4 py-3 ${
                          positionDone(house, role)
                            ? "bg-inset text-muted ring-divider ring-1 ring-inset"
                            : "bg-warn text-on-warn hover:bg-warn/90"
                        }`}
                      >
                        <span className="text-body tracking-[0.08em]">
                          <T en={role} es={roleEs.get(role) ?? role} />
                        </span>
                        {positionDone(house, role) ? (
                          <span className="label">
                            <T en="Signed" es="Firmada" />
                          </span>
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

      {/* Starting a whole new list is an admin job, and the form sat here for
          anybody holding the venue code — which is everybody, since the code
          is on the QR by the rack. The server refuses it either way now; this
          is so nobody is offered a button that is going to say no. */}
      {mayManage(session) ? <NewChecklistForm /> : null}

      {/* The way out of the building you are in. Without it the cookie is a
          one-way door and the only way back to another venue is the address
          bar. */}
      {session.role === "admin" ? (
        <p className="mt-6">
          <Link href="/checklists/locations" className="label hover:text-ink">
            Switch location
          </Link>
        </p>
      ) : null}
    </main>
  );
}
