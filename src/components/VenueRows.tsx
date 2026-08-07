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
          hint={`Approved out of ${WEEKLY_ITEM_TARGET} · a second figure means fewer were handed in`}
        >
          <ul>
            {active.map((row) => {
              const finished = finishedAt[row.venue.code];
              return (
                <li key={row.venue.id} id={`venue-${row.venue.code}`}>
                  <Link
                    href={`${hrefPrefix}${row.venue.id}`}
                    className="hover:bg-hover -mx-2 flex h-10 items-center gap-4 rounded-[4px] px-2 transition-colors"
                  >
                    <span className="text-body text-ink w-16 shrink-0 tracking-normal tabular-nums">
                      {row.venue.code}
                    </span>

                    <Segments done={row.approvedCount} />

                    {/* Meta gets its own column. Folded into the 72px count
                        it wrapped to a second line and broke the 40px row —
                        "THU 5:36 PM" is eleven characters in a slot that fits
                        about eight. Hidden on phones, where the count and the
                        bar are the whole story. */}
                    <span className="label hidden w-24 shrink-0 truncate text-right sm:block">
                      {finished
                        ? formatFinish(finished)
                        : row.failStreak > 0
                          ? `${row.failStreak}w missed`
                          : ""}
                      {row.venue.id === ownVenueId ? " · you" : ""}
                    </span>

                    <span className="text-body w-[104px] shrink-0 text-right whitespace-nowrap tracking-normal tabular-nums">
                      <span className="text-ink">
                        {row.approvedCount}/{WEEKLY_ITEM_TARGET}
                      </span>
                      {row.doneCount < WEEKLY_ITEM_TARGET ? (
                        <span className="text-warn"> · {row.doneCount} in</span>
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
                  className="bg-inset hover:bg-hover text-body text-muted flex h-10 items-center justify-center rounded-[4px] tracking-normal transition-colors"
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
