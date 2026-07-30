import Link from "next/link";

import { ThemeToggle } from "./ThemeToggle";
import { getSession } from "@/lib/session";

/**
 * Persistent corner controls. Help sits here rather than inside any one screen
 * so it's reachable from everywhere without cluttering the boards.
 */
export async function CornerMenu() {
  const session = await getSession();

  return (
    <nav className="fixed right-4 bottom-4 z-50 flex items-center gap-2">
      {session ? (
        <Link
          href="/help"
          className="btn-ghost shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
        >
          {/* Short on a phone: the full label is wide enough to sit over the
              last line of content. */}
          <span className="sm:hidden">Help</span>
          <span className="hidden sm:inline">How to use this</span>
        </Link>
      ) : null}
      <ThemeToggle />
    </nav>
  );
}
