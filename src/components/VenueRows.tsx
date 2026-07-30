import Link from "next/link";

import { DotStrip, StatusPill } from "./ui";
import type { VenueWeekSummary } from "@/lib/types";

/**
 * The all-venues list, shared by the board and the admin page.
 *
 * The two pages are the same view of the same week — the only difference is
 * where a row leads: the board to a read-only venue, admin to the screen with
 * approve and send-back on it. Keeping one component means they can't drift.
 */
export function VenueRows({
  rows,
  hrefPrefix,
  ownVenueId = null,
}: {
  rows: VenueWeekSummary[];
  hrefPrefix: string;
  ownVenueId?: string | null;
}) {
  return (
    <>
      <div className="mb-2 flex items-center gap-3 px-2">
        <span className="label w-14">Venue</span>
        <span className="label flex-1">Progress</span>
        <span className="label w-16 text-right">Streak</span>
      </div>

      <ul className="stagger space-y-2">
        {rows.map((row) => (
          <li
            key={row.venue.id}
            id={`venue-${row.venue.code}`}
            className="scroll-mt-4"
          >
            <Link
              href={`${hrefPrefix}${row.venue.id}`}
              className="panel panel-link flex items-center gap-3 px-4 py-3"
            >
              <span className="w-14 shrink-0 font-mono text-sm font-medium">
                {row.venue.code}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="flex items-center gap-2">
                  <StatusPill status={row.status} />
                  <span className="label">{row.doneCount}/10</span>
                  {row.venue.id === ownVenueId ? (
                    <span className="label">· you</span>
                  ) : null}
                </span>
                <DotStrip done={row.doneCount} total={row.activeCount} />
              </span>

              <span className="w-16 shrink-0 text-right">
                {row.failStreak > 0 ? (
                  <span className="text-fail font-mono text-sm tabular-nums">
                    {row.failStreak}w
                  </span>
                ) : (
                  <span className="label">—</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
