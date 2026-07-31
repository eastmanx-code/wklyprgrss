import { notFound, redirect } from "next/navigation";

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
import { signedUrls } from "@/lib/photos";
import { getSession } from "@/lib/session";
import {
  WEEKLY_ITEM_TARGET,
  doneItemIdsFrom,
  getItems,
  getSubmissionsForItems,
  getVenue,
  statusFor,
} from "@/lib/status";
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
  const photos = await signedUrls(
    submissions.flatMap((s) =>
      s.before_photo_url ? [s.photo_url, s.before_photo_url] : [s.photo_url],
    ),
  );

  const weekStart = currentWeekStart();
  const doneThisWeek = doneItemIdsFrom(
    submissions.filter((s) => s.week_start === weekStart),
  );
  const status = statusFor(
    doneThisWeek.size,
    items.length,
    weekStart,
    new Date(),
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
        <div className="mt-3 flex items-center gap-2">
          <StatusPill status={status} />
          <span className="label">
            {doneThisWeek.size}/{WEEKLY_ITEM_TARGET} · week of{" "}
            {formatWeekStart(weekStart)}
          </span>
        </div>
      </header>

      <ul className="stagger grid grid-cols-2 items-stretch gap-3 xl:grid-cols-5">
        {items.map((item) => {
          const history = byItem.get(item.id) ?? [];
          const latest = history[0];
          const latestUrl = latest ? photos.get(latest.photo_url) : undefined;

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

              <p className="caps mt-3 text-body leading-snug font-medium">
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
                            <div className="mt-3 aspect-[4/3] overflow-hidden rounded-xl bg-surface">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt=""
                                className="h-full w-full object-contain"
                              />
                            </div>
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

        {emptySlots(items.length, WEEKLY_ITEM_TARGET).map((slot) => (
          <EmptySlot key={`slot-${slot}`} index={slot} />
        ))}
      </ul>
    </main>
  );
}
