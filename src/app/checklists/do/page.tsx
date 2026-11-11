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
import { openCount } from "@/lib/ch-tasks";
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
  /** Which part of the building this list belongs to, e.g. The Reading Club. */
  room: string | null;
  /** A venue's own menu cluster, overriding the room for grouping only. */
  menu_group: string | null;
};

/**
 * The block a list sits under in the menu: its own menu_group if a venue set
 * one, otherwise the room it belongs to. This is what lets STOC pull its bar
 * tabs into a "Seneca Bar" group without moving any list out of its room.
 */
const groupOf = (row: {
  menu_group: string | null;
  room: string | null;
}): string | null => {
  const named = row.menu_group?.trim();
  if (named) return named;
  const room = row.room?.trim();
  return room || null;
};

/**
 * The clipboard. Front of house or heart of house, then the venue it belongs
 * to, then the role — you flip to yours rather than scrolling one long list.
 *
 * This is the "do the work" area, one tap off the stats. The dash a shift
 * lands on reports the month; this is where tonight's lists get ticked and
 * signed. Built from the venue's own rows: a venue writes the roles it runs,
 * and an empty clipboard says so plainly and offers the way to start one.
 *
 * The positions are grouped by room where the building runs more than one, so
 * a space that shares one app login — Seneca and The Reading Club under STOC —
 * reads as two blocks, each with only its own tabs. Before this they were one
 * alphabetical run with nothing naming the venue, and the crew of the room
 * whose tabs did not say its name walked past them.
 */
export default async function DoChecklistsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const venue = await closeVenueId(session);
  // An admin who has not picked a building yet gets the list of them.
  if (!venue && session.role === "admin") redirect("/checklists/locations");
  const venueName = venue ? await closeVenueName(venue) : null;

  // CH Tasks are the MOD's walk-around punch list, so the way in shows for
  // managers only, not the whole crew on the venue code.
  const chOpen = mayManage(session) && venue ? await openCount(venue) : 0;

  const { data: listRows } = venue
    ? await db()
        .from("close_checklists")
        .select("id, house, role, role_es, phase, room, menu_group")
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

  // The lists under one position, scoped to the room it is shown in. A role
  // that runs in two rooms — a bar deep clean in both Seneca and The Reading
  // Club — is two chips, and each reads only its own room's state.
  const listsFor = (house: House, role: string, room: string | null) =>
    lists.filter(
      (l) => l.house === house && l.role === role && groupOf(l) === room,
    );

  const status = new Map(
    (venue ? await closeStatus(night, venue) : []).map((row) => [
      row.checklist_id,
      row,
    ]),
  );

  /**
   * Every list under this position, in this room, is signed, or is a weekly
   * list tonight does not ask for. A manager who has signed the open and the
   * close is done for the night; the weekly list staying lit all week is what
   * sent people back in to tick a finished list a second time.
   */
  const positionDone = (house: House, role: string, room: string | null) =>
    listsFor(house, role, room).every(
      (l) => signed.has(l.id) || Boolean(status.get(l.id)?.standby),
    );
  const positionNote = (
    house: House,
    role: string,
    room: string | null,
  ): { en: string; es: string; urgent: boolean } | null => {
    const open = listsFor(house, role, room).filter((l) => !signed.has(l.id));
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

  // The venues in a house, then the roles in each. A house with no rooms —
  // the kitchen, run as one — comes back as a single group with no name, which
  // renders exactly as the flat list always did. The nameless group (positions
  // that run the whole building, like the MOD) sorts first; named rooms follow
  // alphabetically, since there is no running order between them.
  type Group = { room: string | null; roles: string[] };
  const groupsIn = (house: House): Group[] => {
    const inHouse = lists.filter((l) => l.house === house);
    const rooms = [...new Set(inHouse.map(groupOf))].sort((a, b) => {
      if (a === b) return 0;
      if (a === null) return -1;
      if (b === null) return 1;
      return a.localeCompare(b);
    });
    return rooms.map((room) => ({
      room,
      roles: [
        ...new Set(
          inHouse.filter((l) => groupOf(l) === room).map((l) => l.role),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    }));
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

      {mayManage(session) ? (
        <Link
          href="/checklists/tasks"
          className="mb-5 flex min-h-14 items-center justify-between gap-3 rounded-[6px] px-5 py-4 text-title tracking-[0.02em] ring-1 ring-inset ring-divider hover:bg-inset"
        >
          <span>
            <T en="CH Tasks" es="Tareas CH" />
            {chOpen > 0 ? (
              <span className="label text-muted ml-2 tabular-nums">
                {chOpen} <T en="open" es="abiertas" />
              </span>
            ) : null}
          </span>
          <span aria-hidden>→</span>
        </Link>
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
          {(["FOH", "HOH"] as House[]).map((house) => {
            const groups = groupsIn(house);
            if (groups.length === 0) return null;
            return (
              <section key={house} className="panel">
                <h2 className="card-title">
                  <T en={houseName(house)} es={HOUSE_ES[house]} />
                </h2>

                {groups.map((group, gi) => (
                  <div
                    key={group.room ?? "_general"}
                    className={gi === 0 ? "mt-4" : "mt-6"}
                  >
                    {/* The room names itself in both languages, the same as a
                        room does deeper in. A house run as one room has no name
                        here and the block reads as the plain list it was. */}
                    {group.room ? (
                      <p className="label text-muted mb-2 tracking-[0.12em]">
                        {group.room}
                      </p>
                    ) : null}

                    <ul className="space-y-2">
                      {group.roles.map((role) => {
                        const done = positionDone(house, role, group.room);
                        const note = positionNote(house, role, group.room);
                        return (
                          <li key={`${group.room ?? ""}-${role}`}>
                            <Link
                              href={`/checklists/position/${house.toLowerCase()}/${roleSlug(role)}`}
                              className={`flex min-h-14 items-center justify-between gap-3 rounded px-4 py-3 ${
                                done
                                  ? "bg-inset text-muted ring-divider ring-1 ring-inset"
                                  : "bg-warn text-on-warn hover:bg-warn/90"
                              }`}
                            >
                              <span className="text-body tracking-[0.08em]">
                                <T en={role} es={roleEs.get(role) ?? role} />
                              </span>
                              {done ? (
                                <span className="label">
                                  <T en="Signed" es="Firmada" />
                                </span>
                              ) : note ? (
                                <span
                                  className={`label ${note.urgent ? "font-medium" : ""}`}
                                >
                                  <T en={note.en} es={note.es} />
                                  <span aria-hidden> →</span>
                                </span>
                              ) : (
                                <span aria-hidden>→</span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </section>
            );
          })}
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
