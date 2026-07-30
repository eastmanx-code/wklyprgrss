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
    <nav className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-end gap-2">
      <DeadlineCountdown deadlineMs={deadlineMs} />

      {home ? (
        <Link
          href={home}
          className="btn-ghost shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
        >
          {isAdmin ? "All venues" : "Mine"}
        </Link>
      ) : null}

      {session && !isAdmin ? (
        <Link
          href="/board"
          className="btn-ghost shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
        >
          All
        </Link>
      ) : null}

      <Link
        href="/help"
        className="btn-ghost shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
      >
        How to
      </Link>

      {session ? (
        <form action={logout}>
          <button
            type="submit"
            className="btn-ghost shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
          >
            Out
          </button>
        </form>
      ) : null}

      <ThemeToggle />
    </nav>
  );
}
