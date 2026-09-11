"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DeadlineCountdown } from "./DeadlineCountdown";
import { T } from "@/components/Lang";

/**
 * The two sections of the site, and the controls that belong to the one you
 * are standing in.
 *
 * The site began as the weekly board and the checklists were added to it, and
 * the menu never stopped saying so: a deadline countdown on every screen, a
 * bartender in the middle of a close being told how long until Thursday at
 * four. The menu now names the two sections as equals. The one you are in is
 * filled in, and only its own controls show. The weekly deadline is a weekly
 * thing and stays inside the weekly section.
 *
 * A client component because the menu lives in the layout and the layout does
 * not know where you are. The path does.
 */
export function SectionNav({
  isAdmin,
  deadlineMs,
}: {
  isAdmin: boolean;
  deadlineMs: number;
}) {
  const pathname = usePathname();
  const inChecklists = pathname.startsWith("/checklists");
  const inWeekly = ["/venue", "/board", "/admin"].some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );

  // Each section's front door for this role. An admin's checklists start at
  // every location; a leader's at their own lists. An admin's week is the
  // grading board; a leader's is their own venue.
  const checklistsHref = isAdmin ? "/checklists/locations" : "/checklists";
  const weeklyHref = isAdmin ? "/admin" : "/venue";

  const tab = (on: boolean) =>
    on
      ? "btn-ghost bg-ink text-paper hover:bg-ink whitespace-nowrap"
      : "btn-ghost whitespace-nowrap";

  return (
    <>
      <Link href={checklistsHref} className={tab(inChecklists)}>
        <T en="Checklists" es="Listas" />
      </Link>
      <Link href={weeklyHref} className={tab(inWeekly)}>
        <T en="Weekly" es="Semanal" />
      </Link>

      {inWeekly ? (
        <>
          <span className="bg-card-border h-6 w-px" aria-hidden />
          {/* Where the rest of the company stands. An admin's grading board
              already is every venue, so only a leader needs the second door. */}
          {isAdmin ? null : (
            <Link href="/board" className="btn-ghost whitespace-nowrap">
              <T en="Everyone" es="Todos" />
            </Link>
          )}
          <span className="hidden lg:contents">
            <DeadlineCountdown deadlineMs={deadlineMs} />
          </span>
        </>
      ) : null}
    </>
  );
}
