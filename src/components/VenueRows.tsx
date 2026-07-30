import Link from "next/link";

import { Card } from "./Card";

import { WEEKLY_ITEM_TARGET } from "@/lib/status";
import { formatFinish } from "@/lib/week";
import type { VenueWeekSummary } from "@/lib/types";

/**
 * The all-venues list: code, a thin bar, and the count.
 *
 * A bar per venue rather than ten circles per venue — twenty-seven venues is
 * 270 circles, which is a texture, not a reading. Circles are kept for the
 * leader's own page, where there are only ten of them.
 *
 * The two pages are the same view of the same week; the only difference is
 * where a row leads: the board to a read-only venue, admin to the screen with
 * approve and send-back on it.
 */
export function VenueRows({
  rows,
  hrefPrefix,
  ownVenueId = null,
  finishedAt = {},
}: {
  rows: VenueWeekSummary[];
  hrefPrefix: string;
  ownVenueId?: string | null;
  /** venue code -> when it reached ten, for the venues that got there. */
  finishedAt?: Record<string, string>;
}) {
  return (
    <Card
      title="Every venue"
      hint={`Photos done out of ${WEEKLY_ITEM_TARGET} · finish time, or missed-week run`}
    >
      <ul className="stagger">
        {rows.map((row) => {
          const finished = finishedAt[row.venue.code];
          const percent = (row.doneCount / WEEKLY_ITEM_TARGET) * 100;

          return (
            <li
              key={row.venue.id}
              id={`venue-${row.venue.code}`}
              className="border-ink/10 scroll-mt-4 border-b last:border-0"
            >
              <Link
                href={`${hrefPrefix}${row.venue.id}`}
                className="hover:bg-ink/5 -mx-2 flex items-center gap-4 rounded-lg px-2 py-3 transition-colors"
              >
                <span className="w-14 shrink-0 font-mono text-sm font-medium">
                  {row.venue.code}
                </span>

                <span className="bg-ink/10 h-1.5 min-w-0 flex-1 overflow-hidden rounded-full">
                  <span
                    className={`block h-full rounded-full ${
                      row.status === "FAIL" ? "bg-fail" : "bg-ink"
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </span>

                <span className="label w-32 shrink-0 text-right">
                  {row.status === "SETUP"
                    ? "Not set up"
                    : finished
                      ? formatFinish(finished)
                      : row.failStreak > 0
                        ? `${row.doneCount}/${WEEKLY_ITEM_TARGET} · ${row.failStreak}w`
                        : `${row.doneCount}/${WEEKLY_ITEM_TARGET}`}
                  {row.venue.id === ownVenueId ? " · you" : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
