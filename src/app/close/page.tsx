import Link from "next/link";
import { redirect } from "next/navigation";

import { logout } from "@/app/actions";
import { CloseChecklist } from "@/components/close/CloseChecklist";
import { getSession } from "@/lib/session";
import { currentNight, formatNight } from "@/lib/night";

export const dynamic = "force-dynamic";

/**
 * The nightly close, for review.
 *
 * Behind the same sign-in as everything else, because it is on the live site
 * and a checklist naming a venue's routine is not something to leave open. It
 * saves nothing yet — the point is to put the flow on a real phone in a real
 * venue at a real 2am and find out what breaks.
 */
export default async function ClosePage() {
  const session = await getSession();
  if (!session) redirect("/");

  // 4am Pacific, so a close signed at 1:30am files under the night it belongs
  // to rather than the calendar day the clock had rolled over to.
  const night = currentNight();

  return (
    /* close-flow suppresses the global corner bar — see globals.css. */
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <header className="mb-5">
        <span className="pill pill-pending">Prototype · nothing is saved</span>
        {/* A signed record has to show which night on its face. */}
        <p className="label mt-3">
          Night Hawk · MOD close · {formatNight(night)}
        </p>
        <h1 className="mt-2 text-metric font-medium">Close checklist</h1>
      </header>

      <CloseChecklist />

      <p className="label mt-6">
        A review build. Reloading the page clears the night.
      </p>

      {/* Only what this flow needs. The deadline countdown and venue nav are
          dashboard context, and on a tablet the full bar sat over item 7. */}
      <nav className="border-card-border bg-surface/90 fixed right-4 bottom-4 left-4 z-50 flex h-14 items-center justify-end gap-2 rounded-[8px] border px-2 backdrop-blur-md sm:left-auto sm:gap-3 sm:px-3">
        <Link href={session.role === "admin" ? "/admin" : "/venue"} className="btn-ghost">
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
