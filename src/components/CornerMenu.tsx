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
 * Wraps rather than overflows: five controls is wider than a small phone.
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
    /* Solid surface with a blur behind it: floating over a dot grid, the old
       translucent buttons picked up the pattern and read as damaged. Grouped
       status | nav | exit so the eye lands on three things, not six. */
    <nav className="border-card-border bg-surface/90 fixed right-4 bottom-4 z-50 flex h-14 max-w-[calc(100vw-2rem)] items-center gap-4 rounded-[8px] border px-3 backdrop-blur-md">
      <DeadlineCountdown deadlineMs={deadlineMs} />

      <span className="bg-card-border h-6 w-px" aria-hidden />

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
    </nav>
  );
}
