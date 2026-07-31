import Link from "next/link";

import { DeadlineCountdown } from "./DeadlineCountdown";
import { ThemeToggle } from "./ThemeToggle";
import { logout } from "@/app/actions";
import { getSession } from "@/lib/session";
import { currentWeekStart, deadlineFor } from "@/lib/week";

/**
 * Persistent corner controls: where you are in the week, how to get back, help,
 * a way out, and the theme. Reachable from every screen, so no page is a dead
 * end — which was the state of the board and item pages before.
 *
 * Collapsed to a single chip, because six controls in a row had grown wide
 * enough to be the widest thing on the screen and to sit over the content on a
 * tablet. It opens on hover where there is a pointer and on a tap where there
 * isn't: a <details> gives the tap for free, and the hover is one CSS rule on
 * top. No client component, so it stays on the server like the rest of the bar.
 */
export async function CornerMenu() {
  const session = await getSession();
  const deadlineMs = deadlineFor(currentWeekStart()).getTime();

  // Admin's home already lists every venue, so a separate Board link would go
  // to a read-only copy of the page they're on. Leaders get both: their own
  // board, and everyone's.
  const isAdmin = session?.role === "admin";
  const home = session ? (isAdmin ? "/admin" : "/venue") : null;

  return (
    /* Sized to its content now rather than pinned across the phone, so the
       collapsed state is genuinely small. */
    <nav className="fixed right-4 bottom-4 z-50">
      <details className="ww-menu">
        <summary className="border-warn/60 bg-surface text-warn flex h-14 cursor-pointer items-center justify-center gap-2 rounded-[8px] border px-4">
          <span className="label text-warn">Menu</span>
          <span className="ww-menu-caret" aria-hidden />
        </summary>

        <div className="border-card-border bg-surface/90 ww-menu-items absolute right-0 bottom-0 h-14 items-center justify-end gap-2 rounded-[8px] border px-2 backdrop-blur-md sm:gap-3 sm:px-3">
          <span className="hidden sm:contents">
            <DeadlineCountdown deadlineMs={deadlineMs} />
            <span className="bg-card-border h-6 w-px" aria-hidden />
          </span>

          {home ? (
            <Link href={home} className="btn-ghost">
              {isAdmin ? "All venues" : "Mine"}
            </Link>
          ) : null}

          {session && !isAdmin ? (
            <Link href="/board" className="btn-ghost">
              All
            </Link>
          ) : null}

          {/* Work in progress, and named so. It is on the live site to be
              looked at, not to be relied on. */}
          {session ? (
            <Link href="/close" className="btn-ghost">
              Chcklst &gt; WIP
            </Link>
          ) : null}

          <Link href="/help" className="btn-ghost">
            How to
          </Link>

          <span className="bg-card-border h-6 w-px" aria-hidden />

          {session ? (
            <form action={logout}>
              <button type="submit" className="btn-ghost">
                Out
              </button>
            </form>
          ) : null}

          <ThemeToggle />
        </div>
      </details>
    </nav>
  );
}
