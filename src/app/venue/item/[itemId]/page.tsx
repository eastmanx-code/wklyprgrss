import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PhotoView } from "@/components/PhotoView";

import { setItemActive } from "@/app/admin/actions";
import { DeleteEntry } from "@/components/DeleteEntry";
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
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { itemId } = await params;
  const { edit } = await searchParams;

  // A leader may open their own venue's items; an admin may open any. Same
  // screen for both — the two roles differ only in who can approve.
  const session = await getSession();
  if (!session) redirect("/");

  const { data, error } = await db()
    .from("items")
    .select("id, venue_id, title, position, active")
    .eq("id", itemId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const item = data as Item | null;
  if (!item || !item.active) notFound();
  if (session.role === "leader" && session.venueId !== item.venue_id) {
    notFound();
  }

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
  // A sent-back entry is not amended — that flow asks for a fresh photo and
  // comment, and quietly editing the rejected one past a review is a different
  // thing. Everything else this week can be corrected in place.
  const editable = Boolean(current) && !sentBack;
  const amending = editable && edit === "1";

  // On an ongoing item the most recent earlier photo is the before. Uses the
  // last photo rather than strictly last week's, so a gap doesn't blank it.
  const previous = submissions.find((s) => s.week_start < weekStart);
  const previousUrl = previous ? photos.get(previous.photo_url) : undefined;

  return (
    <main className="mx-auto max-w-2xl">
      <BackLink
        href={
          session.role === "admin" ? `/admin/venue/${item.venue_id}` : "/venue"
        }
      >
        All items
      </BackLink>

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
          <div className="mt-3">
            {previousUrl ? (
              <PhotoView
                src={previousUrl}
                className="aspect-[4/3] rounded-[8px]"
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

      {/* Amend, rather than file a second entry.
          Fixing a typo used to mean re-typing the comment, re-picking both
          photos, and leaving two entries under one week — which reads in the
          history as two weeks of work. Correcting what you just wrote is not a
          second week. */}
      {amending ? (
        <>
          <div className="panel-quiet mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="note">Editing this week&apos;s entry.</p>
            <Link href={`/venue/item/${item.id}`} className="btn-ghost">
              Cancel
            </Link>
          </div>
          {/* Keyed, so switching into amend actually remounts the form.
              Without it React reuses the instance across the navigation, the
              useState initialisers never run again, and the prefilled comment
              arrives as an empty box — which is the exact re-typing this was
              built to remove. */}
          <PhotoSubmitForm
            key="amend"
            doneHref={
              session.role === "admin"
                ? `/admin/venue/${item.venue_id}`
                : "/venue"
            }
            itemId={item.id}
            currentPhotoUrl={photos.get(current.photo_url) ?? null}
            editing={{
              submissionId: current.id,
              comment: current.comment,
              author: current.author,
              assistedBy: current.assisted_by ?? "",
              progress: current.progress,
              beforeUrl: current.before_photo_url
                ? (photos.get(current.before_photo_url) ?? null)
                : null,
              wasApproved: current.review === "approved",
            }}
          />
        </>
      ) : (
        <>
          {editable ? (
            <div className="mb-3">
              <Link
                href={`/venue/item/${item.id}?edit=1`}
                className="btn-ghost"
              >
                Edit this week&apos;s entry
              </Link>
              <p className="label mt-2">
                Fix the comment or swap a photo without filing a second entry.
              </p>
            </div>
          ) : null}

          <PhotoSubmitForm
            key="new"
            doneHref={
              session.role === "admin"
                ? `/admin/venue/${item.venue_id}`
                : "/venue"
            }
            itemId={item.id}
            currentPhotoUrl={
              current && !sentBack
                ? (photos.get(current.photo_url) ?? null)
                : null
            }
          />
        </>
      )}

      <section className="mt-8">
        <form action={setItemActive}>
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="venueId" value={item.venue_id} />
          <input type="hidden" name="active" value="false" />
          <input
            type="hidden"
            name="redirectTo"
            value={
              session.role === "admin"
                ? `/admin/venue/${item.venue_id}`
                : "/venue"
            }
          />
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
                            <PhotoView
                              src={beforeUrl}
                              className="h-full w-full"
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
                        <PhotoView
                          src={url}
                          className="aspect-[4/3] rounded-[8px]"
                        />
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
                  {/* Approved entries are the record of a week and stay put.
                      Everything else is still the venue's to take back. */}
                  {submission.review === "approved" ? null : (
                    <DeleteEntry submissionId={submission.id} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
