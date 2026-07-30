import Link from "next/link";

import { DeadlineCountdown } from "./DeadlineCountdown";
import { ThemeToggle } from "./ThemeToggle";
import { currentWeekStart, deadlineFor } from "@/lib/week";

/**
 * Persistent corner controls. The countdown and help sit here rather than
 * inside any one screen, so the deadline is visible wherever you are —
 * including before sign-in, which is when someone is most likely to be lost.
 */
export function CornerMenu() {
  const deadlineMs = deadlineFor(currentWeekStart()).getTime();

  return (
    <nav className="fixed right-4 bottom-4 z-50 flex items-center gap-2">
      <DeadlineCountdown deadlineMs={deadlineMs} />
      <Link
        href="/help"
        className="btn-ghost shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
      >
        How to
      </Link>
      <ThemeToggle />
    </nav>
  );
}
