import { notFound, redirect } from "next/navigation";

import { setItemActive } from "@/app/admin/actions";
import { PhotoSubmitForm } from "@/components/PhotoSubmitForm";
import { RenameItemForm } from "@/components/admin/RenameItemForm";
import { Attribution, BackLink, DonePill, PurgedPhoto } from "@/components/ui";
import { signedUrls } from "@/lib/photos";
import { getSession } from "@/lib/session";
import { getSubmissionsForItems } from "@/lib/status";
import { db } from "@/lib/supabase";
import type { Item } from "@/lib/types";
import { currentWeekStart, formatTimestamp, formatWeekStart } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;

  const session = await getSession();
  if (session?.role !== "leader") redirect("/");

  const { data, error } = await db()
    .from("items")
    .select("id, venue_id, title, position, active")
    .eq("id", itemId)
    .eq("venue_id", session.venueId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const item = data as Item | null;
  if (!item || !item.active) notFound();

  const submissions = await getSubmissionsForItems([item.id]);
  const photos = await signedUrls(
    submissions.flatMap((s) =>
      s.before_photo_url ? [s.photo_url, s.before_photo_url] : [s.photo_url],
    ),
  );

  const weekStart = currentWeekStart();
  const thisWeek = submissions.filter((s) => s.week_start === weekStart);
  // Newest submission decides the state — same rule as the grid, so the two
  // screens can never disagree.
  const current = thisWeek[0];
  const sentBack = current?.review === "sent_back";
  const rolling = !sentBack && current?.progress === "another_cycle";
  const doneThisWeek = Boolean(current) && !sentBack;

  // On an ongoing item the most recent earlier photo is the before. Uses the
  // last photo rather than strictly last week's, so a gap doesn't blank it.
  const previous = submissions.find((s) => s.week_start < weekStart);
  const previousUrl = previous ? photos.get(previous.photo_url) : undefined;

  return (
    <main className="mx-auto max-w-2xl">
      <BackLink href="/venue">All items</BackLink>

      <header className="mt-4 mb-6">
        <p className="label">Item</p>
        {/* The venue owns its own list, so the title is editable here rather
            than only from the admin screens. */}
        <div className="mt-2">
          <RenameItemForm
            itemId={item.id}
            venueId={item.venue_id}
            title={item.title}
          />
        </div>
        <div className="mt-3">
          {sentBack ? (
            <span className="pill pill-warn">Redo</span>
          ) : rolling ? (
            <span className="pill pill-rolling">Rolling</span>
          ) : (
            <DonePill done={doneThisWeek} />
          )}
        </div>
      </header>

      {sentBack ? (
        <div className="panel-quiet mb-5">
          <p className="note">
            Sent back by the admin. Submit a new photo and comment to clear it.
          </p>
        </div>
      ) : rolling ? (
        <div className="panel-quiet mb-5">
          <p className="note">
            Counted for the week of {formatWeekStart(weekStart)}, but marked as
            needing another cycle. It stays open until someone marks it done.
          </p>
        </div>
      ) : doneThisWeek ? (
        <div className="panel-quiet mb-5">
          <p className="note">
            Done for the week of {formatWeekStart(weekStart)}. Submitting again
            adds another entry — nothing is overwritten.
          </p>
        </div>
      ) : null}

      {previous ? (
        <section className="panel mb-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="label">Before · last photo</p>
            <p className="label">{formatWeekStart(previous.week_start)}</p>
          </div>
          <div className="mt-3 aspect-[4/3] overflow-hidden rounded-xl bg-panel">
            {previousUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previousUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <PurgedPhoto aspect="wide" />
            )}
          </div>
          <p className="mt-3 text-body leading-relaxed whitespace-pre-wrap">
            {previous.comment}
          </p>
          <p className="label mt-2">
            Shoot this week&apos;s from the same angle.
          </p>
        </section>
      ) : null}

      <PhotoSubmitForm
        itemId={item.id}
        currentPhotoUrl={
          current && !sentBack ? (photos.get(current.photo_url) ?? null) : null
        }
      />

      <section className="mt-8">
        <form action={setItemActive}>
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="venueId" value={item.venue_id} />
          <input type="hidden" name="active" value="false" />
          <input type="hidden" name="redirectTo" value="/venue" />
          <button type="submit" className="btn-ghost">
            Retire this item
          </button>
        </form>
        <p className="label mt-2">
          Stops it counting from next week. History is kept.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="label mb-3">History · newest first</h2>

        {submissions.length === 0 ? (
          <p className="text-body text-muted">Nothing submitted yet.</p>
        ) : (
          <ul className="space-y-3">
            {submissions.map((submission) => {
              const url = photos.get(submission.photo_url);
              const beforeUrl = submission.before_photo_url
                ? photos.get(submission.before_photo_url)
                : undefined;
              return (
                <li key={submission.id} className="panel">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="label">
                      Week of {formatWeekStart(submission.week_start)}
                    </p>
                    <p className="label">
                      {formatTimestamp(submission.created_at)}
                    </p>
                  </div>
                  {/* A same-week before means the work was executed that week;
                      show the pair. Otherwise just the one shot. */}
                  <div
                    className={`mt-3 ${
                      submission.before_photo_url
                        ? "grid grid-cols-2 gap-2"
                        : ""
                    }`}
                  >
                    {submission.before_photo_url ? (
                      <figure>
                        <div className="aspect-[4/3] overflow-hidden rounded-xl bg-panel">
                          {beforeUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={beforeUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <PurgedPhoto aspect="wide" />
                          )}
                        </div>
                        <figcaption className="label mt-2">Before</figcaption>
                      </figure>
                    ) : null}

                    <figure>
                      {url ? (
                        <div className="aspect-[4/3] overflow-hidden rounded-xl bg-panel">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <PurgedPhoto aspect="wide" />
                      )}
                      {submission.before_photo_url ? (
                        <figcaption className="label mt-2">After</figcaption>
                      ) : null}
                    </figure>
                  </div>
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
        )}
      </section>
    </main>
  );
}
