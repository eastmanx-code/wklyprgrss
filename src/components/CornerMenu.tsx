import Link from "next/link";

import { DeadlineCountdown } from "./DeadlineCountdown";
import { ThemeToggle } from "./ThemeToggle";
import { logout } from "@/app/actions";
import { getSession } from "@/lib/session";
import { currentWeekStart, deadlineFor } from "@/lib/week";

/**
 * Persistent corner controls. The countdown, help and sign-out live here
 * rather than inside any one screen, so they're reachable from the board, an
 * item page or help — not just the two screens that happened to have a header.
 *
 * Wraps rather than overflows: four pills is wider than a small phone.
 */
export async function CornerMenu() {
  const session = await getSession();
  const deadlineMs = deadlineFor(currentWeekStart()).getTime();

  return (
    <nav className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-end gap-2">
      <DeadlineCountdown deadlineMs={deadlineMs} />

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
            Sign out
          </button>
        </form>
      ) : null}

      <ThemeToggle />
    </nav>
  );
}
