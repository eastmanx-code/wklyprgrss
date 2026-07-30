import { notFound, redirect } from "next/navigation";

import { BackLink, DonePill, StatusPill } from "@/components/ui";
import { signedUrls } from "@/lib/photos";
import { getSession } from "@/lib/session";
import {
  getItems,
  getSubmissionsForItems,
  getVenue,
  statusFor,
} from "@/lib/status";
import { currentWeekStart, formatTimestamp, formatWeekStart } from "@/lib/week";

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
  const submissions = await getSubmissionsForItems(items.map((item) => item.id));
  const photos = await signedUrls(submissions.map((s) => s.photo_url));

  const weekStart = currentWeekStart();
  const doneThisWeek = new Set(
    submissions.filter((s) => s.week_start === weekStart).map((s) => s.item_id),
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
        <h1 className="mt-2 font-mono text-2xl font-medium tracking-tight">
          {venue.code}
        </h1>
        <div className="mt-3 flex items-center gap-2">
          <StatusPill status={status} />
          <span className="label">
            {doneThisWeek.size}/{items.length} · week of{" "}
            {formatWeekStart(weekStart)}
          </span>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-muted">No items set up yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const history = byItem.get(item.id) ?? [];
            const latest = history[0];
            const latestUrl = latest ? photos.get(latest.photo_url) : undefined;

            return (
              <li key={item.id} className="panel">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{item.title}</p>
                  <DonePill done={doneThisWeek.has(item.id)} />
                </div>

                {latestUrl ? (
                  <div className="mt-3 overflow-hidden rounded-xl bg-panel">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={latestUrl} alt="" className="w-full object-cover" />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">Nothing yet.</p>
                )}

                {latest ? (
                  <>
                    <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
                      {latest.comment}
                    </p>
                    <p className="label mt-2">
                      {formatTimestamp(latest.created_at)}
                    </p>
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
                              <div className="mt-3 overflow-hidden rounded-xl bg-surface">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt=""
                                  className="w-full object-cover"
                                />
                              </div>
                            ) : null}
                            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
                              {submission.comment}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
