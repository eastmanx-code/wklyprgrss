import { notFound, redirect } from "next/navigation";

import { moveItem, setItemActive } from "@/app/admin/actions";
import { AddItemForm } from "@/components/admin/AddItemForm";
import { RenameItemForm } from "@/components/admin/RenameItemForm";
import { VenuePinForm } from "@/components/admin/VenuePinForm";
import { Attribution, BackLink, DonePill, StatusPill } from "@/components/ui";
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

export default async function AdminVenuePage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if ((await getSession())?.role !== "admin") redirect("/admin/login");

  const venue = await getVenue(venueId);
  if (!venue) notFound();

  const items = await getItems(venue.id, { includeInactive: true });
  const activeItems = items.filter((item) => item.active);
  const submissions = await getSubmissionsForItems(items.map((item) => item.id));
  const photos = await signedUrls(submissions.map((s) => s.photo_url));

  const weekStart = currentWeekStart();
  const doneThisWeek = new Set(
    submissions
      .filter((s) => s.week_start === weekStart)
      .map((s) => s.item_id),
  );
  const activeDone = activeItems.filter((item) =>
    doneThisWeek.has(item.id),
  ).length;
  const status = statusFor(
    activeDone,
    activeItems.length,
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
      <BackLink href="/admin">All venues</BackLink>

      <header className="mt-4 mb-6">
        <p className="label">Venue</p>
        <h1 className="mt-2 font-mono text-2xl font-medium tracking-tight">
          {venue.code}
        </h1>
        <div className="mt-3 flex items-center gap-2">
          <StatusPill status={status} />
          <span className="label">
            {activeDone}/{activeItems.length} this week ·{" "}
            {formatWeekStart(weekStart)}
          </span>
        </div>
      </header>

      <div className="space-y-3">
        <VenuePinForm venueId={venue.id} pin={venue.pin} />
        <AddItemForm venueId={venue.id} />
      </div>

      <section className="mt-8">
        <h2 className="label mb-3">Items</h2>

        {items.length === 0 ? (
          <p className="text-sm text-muted">No items yet. Add the first above.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item, index) => {
              const history = byItem.get(item.id) ?? [];
              return (
                <li
                  key={item.id}
                  className={`panel ${item.active ? "" : "opacity-60"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="label w-5 shrink-0">{index + 1}</span>
                    <RenameItemForm
                      itemId={item.id}
                      venueId={venue.id}
                      title={item.title}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {item.active ? (
                      <DonePill done={doneThisWeek.has(item.id)} />
                    ) : (
                      <span className="pill pill-pending">Inactive</span>
                    )}

                    <form action={moveItem}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="venueId" value={venue.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        className="btn-ghost"
                        disabled={index === 0}
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                    </form>

                    <form action={moveItem}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="venueId" value={venue.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        className="btn-ghost"
                        disabled={index === items.length - 1}
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                    </form>

                    <form action={setItemActive}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="venueId" value={venue.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={item.active ? "false" : "true"}
                      />
                      <button type="submit" className="btn-ghost">
                        {item.active ? "Deactivate" : "Reactivate"}
                      </button>
                    </form>
                  </div>

                  <details className="mt-3">
                    <summary className="label cursor-pointer select-none">
                      History · {history.length}
                    </summary>

                    {history.length === 0 ? (
                      <p className="mt-3 text-sm text-muted">
                        Nothing submitted yet.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-3">
                        {history.map((submission) => {
                          const url = photos.get(submission.photo_url);
                          return (
                            <li
                              key={submission.id}
                              className="panel-quiet"
                            >
                              <div className="flex items-baseline justify-between gap-3">
                                <p className="label">
                                  Week of{" "}
                                  {formatWeekStart(submission.week_start)}
                                </p>
                                <p className="label">
                                  {formatTimestamp(submission.created_at)}
                                </p>
                              </div>
                              {url ? (
                                <div className="mt-3 aspect-[4/3] overflow-hidden rounded-xl bg-surface">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              ) : null}
                              <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
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
                    )}
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
