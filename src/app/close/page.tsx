import Link from "next/link";
import { redirect } from "next/navigation";

import { logout } from "@/app/actions";
import {
  HOUSES,
  builtCount,
  forRole,
  phaseName,
  rolesIn,
} from "@/lib/checklists";
import { currentNight, formatNight } from "@/lib/night";
import { getSession } from "@/lib/session";

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
  const { built, total } = builtCount();

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
                      list.items.length > 0 ? (
                        <li key={list.slug}>
                          <Link
                            href={`/close/${list.slug}`}
                            className="bg-warn text-on-warn inline-flex min-h-11 items-center gap-2 rounded px-4 text-label tracking-[0.08em]"
                          >
                            {phaseName(list.phase)}
                            <span className="opacity-60">
                              {list.items.length} items
                            </span>
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

      <nav className="border-card-border bg-surface/90 fixed right-4 bottom-4 left-4 z-50 flex h-14 items-center justify-end gap-2 rounded-[8px] border px-2 backdrop-blur-md sm:left-auto sm:gap-3 sm:px-3">
        <Link
          href={session.role === "admin" ? "/admin" : "/venue"}
          className="btn-ghost"
        >
          Back
        </Link>
        <form action={logout}>
          <button type="submit" className="btn-ghost">
            Out
          </button>
        </form>
      </nav>
    </main>
  );
}
