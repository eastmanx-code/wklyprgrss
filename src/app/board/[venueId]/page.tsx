import { notFound, redirect } from "next/navigation";

import { PhotoView } from "@/components/PhotoView";

import {
  Attribution,
  BackLink,
  DonePill,
  EmptySlot,
  PhotoPlaceholder,
  PurgedPhoto,
  StatusPill,
  emptySlots,
} from "@/components/ui";
import { livePhotoPaths, signedUrls } from "@/lib/photos";
import { getSession } from "@/lib/session";
import {
  WEEKLY_ITEM_TARGET,
  doneItemIdsFrom,
  getItems,
  getSubmissionsForItems,
  getVenue,
  houseScored,
  statusFor,
} from "@/lib/status";
import { HOUSES, houseName } from "@/lib/types";
import {
  currentWeekStart,
  formatLastUpload,
  formatWeekStart,
} from "@/lib/week";

export const dynamic = "force-dynamic";

/**
 * Read-only view of another venue's week. Everyone can see everyone — the point
 * is for leaders to learn from each other's work.
 */
export default async function BoardVenuePage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!(await getSession())) redirect("/");

  const venue = await getVenue(venueId);
  if (!venue) notFound();

  const items = await getItems(venue.id);
  const submissions = await getSubmissionsForItems(
    items.map((item) => item.id),
  );
  const photos = await signedUrls(livePhotoPaths(submissions));

  const weekStart = currentWeekStart();
  const doneThisWeek = doneItemIdsFrom(
    submissions.filter((s) => s.week_start === weekStart),
  );

  // Two lists, never one. Read as a single board of twenty, a venue with a
  // spotless dining room and an untouched kitchen would show a half-full bar
  // and read as halfway through the week rather than as one half not started.
  const houses = HOUSES.filter((house) => venue.houses.includes(house)).map(
    (house) => {
      const mine = items.filter((item) => item.house === house);
      const done = mine.filter((item) => doneThisWeek.has(item.id)).length;
      return {
        house,
        items: mine,
        done,
        status: statusFor(done, mine.length, weekStart, new Date()),
        scored: houseScored(house, weekStart),
      };
    },
  );

  const byItem = new Map<string, typeof submissions>();
  for (const submission of submissions) {
    const list = byItem.get(submission.item_id) ?? [];
    list.push(submission);
    byItem.set(submission.item_id, list);
  }

  return (
    <main>
      <BackLink href="/board">Everyone</BackLink>

      <header className="mt-4 mb-6">
        <p className="label">Venue</p>
        <h1 className="mt-2 font-mono text-metric font-medium">{venue.code}</h1>
        <p className="label mt-3">Week of {formatWeekStart(weekStart)}</p>
        <div className="mt-2 space-y-1.5">
          {houses.map((house) => (
            <div key={house.house} className="flex items-center gap-2">
              <StatusPill status={house.status} />
              <span className="label">
                {houseName(house.house)} · {house.done}/{WEEKLY_ITEM_TARGET}
                {house.scored ? "" : " · practice"}
              </span>
            </div>
          ))}
        </div>
      </header>

      {houses.map((group) => (
        <section key={group.house} className="mb-10">
          <h2 className="card-title mb-3">{houseName(group.house)}</h2>
          {/* One tile per row on a phone — see /venue for why two columns are too
          narrow for a task name. */}
          <ul className="stagger grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {group.items.map((item) => {
              const history = byItem.get(item.id) ?? [];
              const latest = history[0];
              const latestUrl = latest
                ? photos.get(latest.photo_url)
                : undefined;

              return (
                <li key={item.id} className="panel flex flex-col p-3">
                  <div className="relative">
                    {latestUrl ? (
                      <div className="bg-inset aspect-square overflow-hidden rounded-[8px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={latestUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : latest?.photo_purged_at ? (
                      <PurgedPhoto />
                    ) : (
                      <PhotoPlaceholder />
                    )}
                    <span className="absolute top-2 right-2">
                      <DonePill done={doneThisWeek.has(item.id)} />
                    </span>
                  </div>

                  <p className="caps mt-3 text-body leading-snug font-medium break-words">
                    {item.title}
                  </p>
                  <p className="label mt-1">
                    {latest
                      ? `Last photo · ${formatLastUpload(latest.created_at)}`
                      : "No photo yet"}
                  </p>

                  {latest ? (
                    <>
                      <p className="text-muted mt-2 line-clamp-3 text-body leading-relaxed">
                        {latest.comment}
                      </p>
                      <Attribution
                        author={latest.author}
                        assistedBy={latest.assisted_by}
                      />
                    </>
                  ) : null}

                  {history.length > 1 ? (
                    <details className="mt-3">
                      <summary className="label cursor-pointer select-none">
                        Earlier weeks · {history.length - 1}
                      </summary>
                      <ul className="mt-3 space-y-3">
                        {history.slice(1).map((submission) => {
                          const url = photos.get(submission.photo_url);
                          return (
                            <li key={submission.id} className="panel-quiet">
                              <p className="label">
                                Week of {formatWeekStart(submission.week_start)}
                              </p>
                              {url ? (
                                <PhotoView
                                  src={url}
                                  className="mt-3 aspect-[4/3] rounded-[8px]"
                                />
                              ) : null}
                              <p className="mt-3 text-body leading-relaxed whitespace-pre-wrap">
                                {submission.comment}
                              </p>
                              <Attribution
                                author={submission.author}
                                assistedBy={submission.assisted_by}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  ) : null}
                </li>
              );
            })}

            {emptySlots(group.items.length, WEEKLY_ITEM_TARGET).map((slot) => (
              <EmptySlot key={`slot-${group.house}-${slot}`} index={slot} />
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
