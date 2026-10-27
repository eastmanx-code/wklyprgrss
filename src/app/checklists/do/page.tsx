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
import { boardNight } from "@/lib/active-night";
import { closeStatus } from "@/lib/close-status";
import { formatNight, formatNightEs } from "@/lib/night";
import { closeVenueId, closeVenueName } from "@/lib/close-venue";
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
 * This is the "do the work" area, one tap off the stats. The dash a shift
 * lands on reports the month; this is where tonight's lists get ticked and
 * signed. Built from the venue's own rows: a venue writes the roles it runs,
 * and an empty clipboard says so plainly and offers the way to start one.
 */
export default async function DoChecklistsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const venue = await closeVenueId(session);
  // An admin who has not picked a building yet gets the list of them.
  if (!venue && session.role === "admin") redirect("/checklists/locations");
  const venueName = venue ? await closeVenueName(venue) : null;

  const { data: listRows } = venue
    ? await db()
        .from("close_checklists")
        .select("id, house, role, role_es, phase")
        .eq("venue_id", venue)
        .eq("active", true)
    : { data: [] };

  const lists = (listRows ?? []) as Row[];

  const roleEs = new Map<string, string>();
  for (const row of lists) {
    const said = row.role_es?.trim();
    if (said && !roleEs.has(row.role)) roleEs.set(row.role, said);
  }

  // The night the board is on. After the 4am roll, while any list in the
  // building is still being walked, the board stays on the night it started.
  const night = await boardNight(lists.map((l) => l.id));

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

  const status = new Map(
    (await closeStatus(night)).map((row) => [row.checklist_id, row]),
  );
  const positionNote = (
    house: House,
    role: string,
  ): { en: string; es: string; urgent: boolean } | null => {
    const open = lists.filter(
      (l) => l.house === house && l.role === role && !signed.has(l.id),
    );
    const rows = open.map((l) => status.get(l.id)).filter(Boolean);
    const ticked = rows.reduce((n, r) => n + (r?.ticked ?? 0), 0);
    const total = rows.reduce((n, r) => n + (r?.items_on_list ?? 0), 0);
    if (rows.length === 0 || total === 0 || ticked === 0) return null;
    if (ticked >= total)
      return { en: "Done · not signed", es: "Hecho · sin firmar", urgent: true };
    return {
      en: `${ticked}/${total} done`,
      es: `${ticked}/${total} hechos`,
      urgent: false,
    };
  };

  const positionsIn = (house: House) => {
    const roles = [
      ...new Set(lists.filter((l) => l.house === house).map((l) => l.role)),
    ];
    return roles.sort((a, b) => a.localeCompare(b));
  };

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      {/* Back to the stats this came from, not out to the door. */}
      <BackLink href="/checklists">
        <T en="Stats" es="Estadísticas" />
      </BackLink>

      <header className="mb-5">
        <p className="label">
          {venueName ? `${venueName} · ` : ""}
          <T en={formatNight(night)} es={formatNightEs(night)} />
        </p>
        <h1 className="mt-2 text-metric font-medium">
          <T en="Do the checklists" es="Hacer las listas" />
        </h1>
        <p className="label mt-2">
          <T
            en="Pick your position · lit means not signed yet"
            es="Escoge tu puesto · lo iluminado no está firmado"
          />
        </p>
      </header>

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
                        ) : positionNote(house, role) ? (
                          <span
                            className={`label ${
                              positionNote(house, role)!.urgent
                                ? "font-medium"
                                : ""
                            }`}
                          >
                            <T
                              en={positionNote(house, role)!.en}
                              es={positionNote(house, role)!.es}
                            />
                            <span aria-hidden> →</span>
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

      {mayManage(session) ? <NewChecklistForm /> : null}

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
