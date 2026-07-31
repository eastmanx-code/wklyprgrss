import Link from "next/link";

import { Card } from "./Card";
import { WEEKLY_ITEM_TARGET } from "@/lib/status";
import { formatFinish } from "@/lib/week";
import type { VenueWeekSummary } from "@/lib/types";

/**
 * Ten discrete segments, not a continuous fill.
 *
 * The metric is ten photos, so the bar should be countable: at 1/10 a
 * continuous fill is an unreadable sliver, while one lit segment out of ten
 * reads instantly. Fill is always white — the alert colour is reserved for
 * past due, failing and missed-week runs, and a yellow progress bar would say
 * "progress is bad".
 */
function Segments({ done }: { done: number }) {
  return (
    <span className="flex min-w-0 flex-1 gap-[2px]">
      {Array.from({ length: WEEKLY_ITEM_TARGET }, (_, i) => (
        <span
          key={i}
          className={`h-2 flex-1 rounded-[1px] ${
            i < done ? "bg-ink" : "bg-inset"
          }`}
        />
      ))}
    </span>
  );
}

/**
 * The all-venues list, split by whether a venue has anything to walk yet.
 *
 * Venues with no items collapse to code chips rather than rows: twenty-four
 * empty tracks imply progress was possible this week, and chips say "not
 * started" honestly.
 *
 * The two pages are the same view of the same week; the only difference is
 * where a row leads — the board to a read-only venue, admin to the screen with
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
  const active = rows.filter((row) => row.status !== "SETUP");
  const notSetUp = rows.filter((row) => row.status === "SETUP");

  return (
    <>
      {active.length > 0 ? (
        <Card
          className="col-span-12"
          title="Active venues"
          hint={`Photos done out of ${WEEKLY_ITEM_TARGET}`}
        >
          <ul>
            {active.map((row) => {
              const finished = finishedAt[row.venue.code];
              return (
                <li key={row.venue.id} id={`venue-${row.venue.code}`}>
                  <Link
                    href={`${hrefPrefix}${row.venue.id}`}
                    className="hover:bg-hover focus-visible:outline-warn -mx-2 flex h-10 items-center gap-4 rounded-[4px] px-2 transition-colors focus-visible:outline focus-visible:outline-1"
                  >
                    <span className="text-body text-ink w-16 shrink-0 tracking-normal tabular-nums">
                      {row.venue.code}
                    </span>

                    <Segments done={row.doneCount} />

                    <span className="text-body w-[72px] shrink-0 text-right tracking-normal tabular-nums">
                      {finished ? (
                        <span className="text-ink">
                          {formatFinish(finished)}
                        </span>
                      ) : (
                        <>
                          <span className="text-ink">
                            {row.doneCount}/{WEEKLY_ITEM_TARGET}
                          </span>
                          {row.failStreak > 0 ? (
                            <span className="text-muted">
                              {" "}
                              · {row.failStreak}w
                            </span>
                          ) : null}
                        </>
                      )}
                      {row.venue.id === ownVenueId ? (
                        <span className="text-muted"> · you</span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {notSetUp.length > 0 ? (
        <Card
          className="col-span-12"
          title="Not set up"
          hint="No items yet — nothing to miss"
        >
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {notSetUp.map((row) => (
              <li key={row.venue.id} id={`venue-${row.venue.code}`}>
                <Link
                  href={`${hrefPrefix}${row.venue.id}`}
                  className="bg-inset hover:bg-hover focus-visible:outline-warn text-body text-muted flex h-10 items-center justify-center rounded-[4px] tracking-normal transition-colors focus-visible:outline focus-visible:outline-1"
                >
                  {row.venue.code}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
