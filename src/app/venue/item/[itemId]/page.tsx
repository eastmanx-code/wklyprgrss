import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PhotoView } from "@/components/PhotoView";

import { reviewSubmission, setItemActive } from "@/app/admin/actions";
import { DeleteEntry } from "@/components/DeleteEntry";
import { PhotoSubmitForm } from "@/components/PhotoSubmitForm";
import { ChangeVerdict } from "@/components/admin/ChangeVerdict";
import { RenameItemForm } from "@/components/admin/RenameItemForm";
import { SendBack } from "@/components/admin/SendBack";
import { SubmitButton } from "@/components/admin/SubmitButton";
import {
  Attribution,
  BackLink,
  DonePill,
  EmptyNote,
  PurgedPhoto,
  ReviewPill,
} from "@/components/ui";
import { livePhotoPaths, signedUrls } from "@/lib/photos";
import { getSession } from "@/lib/session";
import { getSubmissionsForItems } from "@/lib/status";
import { db } from "@/lib/supabase";
import type { Item, Submission } from "@/lib/types";
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

  // A leader may open their own venue's items; an admin may open any. The two
  // then get different screens: filing and grading are different jobs.
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
  const photos = await signedUrls(livePhotoPaths(submissions));

  const weekStart = currentWeekStart();
  const thisWeek = submissions.filter((s) => s.week_start === weekStart);
  // Newest submission decides the state — same rule as the grid, so the two
  // screens can never disagree.
  const current = thisWeek[0];
  // Sent back is measured against the newest entry of any week, not just this
  // one. Reading only the current week meant a rejection stopped being visible
  // the moment the week turned, and the leader who had to act on it saw a
  // blank tile instead.
  const sentBack = submissions[0]?.review === "sent_back";
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

  if (session.role === "admin") {
    const { data: venue } = await db()
      .from("venues")
      .select("code")
      .eq("id", item.venue_id)
      .maybeSingle();

    return (
      <GradeItem
        item={item}
        venueCode={(venue as { code: string } | null)?.code ?? null}
        current={current}
        photos={photos}
        previous={previous ?? null}
      />
    );
  }

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
        /* The photograph that was rejected, not a note about it.
           Every task here is a different job somewhere else in the building,
           so "sent back" on its own tells somebody nothing about what to walk
           to. The shot they filed is the only thing that says which corner,
           which shelf, which door — and without it they are guessing at a task
           they may have done a week ago. */
        <section className="panel border-warn/30 mb-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="label text-warn">Sent back · take a new photo</p>
            <p className="label">
              {formatWeekStart(submissions[0].week_start)}
            </p>
          </div>
          {/* What they actually want doing, when they said.
              Without it a rejection is "do it again" with no idea what was
              wrong, so the leader redoes what they think was meant and can be
              sent back a second time over the same misunderstanding. */}
          {submissions[0].review_note ? (
            <p className="text-body mt-3 leading-relaxed whitespace-pre-wrap">
              {submissions[0].review_note}
            </p>
          ) : null}
          <div className="mt-3">
            {photos.get(submissions[0].photo_url) ? (
              <PhotoView
                src={photos.get(submissions[0].photo_url)!}
                className="aspect-[4/3] rounded-[8px]"
              />
            ) : (
              <PurgedPhoto aspect="wide" />
            )}
          </div>
          <p className="mt-3 text-body leading-relaxed whitespace-pre-wrap">
            {submissions[0].comment}
          </p>
          <p className="label mt-2">
            This is what you sent. Do the job again and file a new photo and
            comment to clear it.
          </p>
        </section>
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

      {previous && !sentBack ? (
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
            doneHref="/venue"
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
            doneHref="/venue"
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
                  {/* Done or not, on every entry, in the leader's own words.
                      The state was only ever printed when the answer was "one
                      more cycle", so a finished card said nothing and read
                      exactly like a card nobody had answered. The wording is
                      copied from the buttons they actually tapped — "this is
                      done", "one more cycle" — so the record and the form
                      cannot drift into two vocabularies for one answer. */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={
                        submission.progress === "another_cycle"
                          ? "pill pill-rolling"
                          : "pill pill-done"
                      }
                    >
                      {submission.progress === "another_cycle"
                        ? "One more cycle"
                        : "This is done"}
                    </span>
                    <ReviewPill review={submission.review} />
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

/**
 * What an admin opens a task for: the photo, what was said about it, and the
 * two buttons.
 *
 * A MOD asked to rule on a task from inside it rather than from the venue
 * board, and the first pass gave him the leader's screen with a verdict panel
 * pushed into the middle of it — the filing form, the amend link, the retire
 * button and the whole submission history still sat around the decision. None
 * of that is grading. Filing is the leader's job and this reader never does
 * it, so the screen is only the evidence and the call.
 */
function GradeItem({
  item,
  venueCode,
  current,
  photos,
  previous,
}: {
  item: Item;
  venueCode: string | null;
  /** This week's entry, or nothing filed yet. */
  current: Submission | undefined;
  photos: Map<string, string>;
  /** The last photo from an earlier week, for a before-and-after read. */
  previous: Submission | null;
}) {
  const url = current ? photos.get(current.photo_url) : undefined;
  const beforeUrl = current?.before_photo_url
    ? photos.get(current.before_photo_url)
    : undefined;
  // Only one before is worth showing. A same-week shot is the pair the leader
  // filed; without one, the last photo of any earlier week is the comparison.
  const paired = Boolean(current?.before_photo_url);
  const previousUrl = previous ? photos.get(previous.photo_url) : undefined;

  return (
    <main className="mx-auto max-w-2xl">
      <BackLink href={`/admin/venue/${item.venue_id}`}>
        {venueCode ? `${venueCode} board` : "Venue board"}
      </BackLink>

      <header className="mt-4 mb-6">
        <p className="label">Grading</p>
        <h1 className="text-metric mt-2 tracking-normal">{item.title}</h1>
      </header>

      {current ? (
        <>
          <section className="panel">
            <div className="flex items-baseline justify-between gap-3">
              <p className="label">
                Week of {formatWeekStart(current.week_start)}
              </p>
              <p className="label">{formatTimestamp(current.created_at)}</p>
            </div>

            {/* Stacked on a phone, side by side from a tablet up. Two 150px
                thumbnails is not a comparison — at that size neither shot
                shows the dust anyone is being judged on. */}
            <div
              className={`mt-3 ${paired ? "grid gap-2 sm:grid-cols-2" : ""}`}
            >
              {paired ? (
                <figure>
                  {beforeUrl ? (
                    <PhotoView
                      src={beforeUrl}
                      className="aspect-[4/3] rounded-[8px]"
                    />
                  ) : (
                    <PurgedPhoto aspect="wide" />
                  )}
                  <figcaption className="label mt-2">Before</figcaption>
                </figure>
              ) : null}

              <figure>
                {url ? (
                  <PhotoView src={url} className="aspect-[4/3] rounded-[8px]" />
                ) : (
                  <PurgedPhoto aspect="wide" />
                )}
                {paired ? (
                  <figcaption className="label mt-2">After</figcaption>
                ) : null}
              </figure>
            </div>

            <p className="mt-3 text-body leading-relaxed whitespace-pre-wrap">
              {current.comment}
            </p>
            <Attribution
              author={current.author}
              assistedBy={current.assisted_by}
            />

            {/* Their own answer on whether the job is finished. It changes what
                the verdict means: approving an item marked for another cycle
                would sign off work its own author says is not done. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={
                  current.progress === "another_cycle"
                    ? "pill pill-rolling"
                    : "pill pill-done"
                }
              >
                {current.progress === "another_cycle"
                  ? "One more cycle"
                  : "This is done"}
              </span>
              <ReviewPill review={current.review} />
            </div>
          </section>

          <section className="panel mt-3">
            <p className="card-title">Your call</p>
            <div className="mt-3 flex flex-col gap-2">
              {current.review === "pending" ? (
                <>
                  {current.progress === "done" ? (
                    <form action={reviewSubmission}>
                      <input
                        type="hidden"
                        name="submissionId"
                        value={current.id}
                      />
                      <input
                        type="hidden"
                        name="venueId"
                        value={item.venue_id}
                      />
                      <input type="hidden" name="review" value="approved" />
                      <SubmitButton pendingLabel="Approving…">
                        Approve
                      </SubmitButton>
                    </form>
                  ) : (
                    <p className="label">
                      Marked for another cycle, so there is nothing to approve
                      yet.
                    </p>
                  )}
                  <SendBack submissionId={current.id} venueId={item.venue_id} />
                </>
              ) : (
                <ChangeVerdict
                  submissionId={current.id}
                  venueId={item.venue_id}
                  review={current.review as "approved" | "sent_back"}
                />
              )}
            </div>
          </section>

          {/* Kept small and last. It is context for the call, not the thing
              being ruled on. */}
          {!paired && previous ? (
            <section className="panel-quiet mt-3 flex items-start gap-3">
              <div className="w-24 shrink-0">
                {previousUrl ? (
                  <PhotoView
                    src={previousUrl}
                    className="aspect-[4/3] rounded-[6px]"
                    hint={false}
                  />
                ) : (
                  <PurgedPhoto aspect="wide" />
                )}
              </div>
              <div className="min-w-0">
                <p className="label">
                  Last time · {formatWeekStart(previous.week_start)}
                </p>
                <p className="mt-2 text-body leading-relaxed whitespace-pre-wrap">
                  {previous.comment}
                </p>
              </div>
            </section>
          ) : null}
        </>
      ) : previous ? (
        /* Nothing this week, but something before — which is the state a
           sent-back item sits in when nobody redid it. Saying only "nothing
           filed" hides why: the photo that was rejected, and the week it was
           rejected in, are the whole explanation. */
        <section className="panel">
          <div className="flex items-baseline justify-between gap-3">
            <p className="label text-warn">Nothing filed this week</p>
            <p className="label">
              Last filed {formatWeekStart(previous.week_start)}
            </p>
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
          <Attribution
            author={previous.author}
            assistedBy={previous.assisted_by}
          />
          <div className="mt-3">
            <ReviewPill review={previous.review} />
          </div>
          <p className="label mt-3">
            Nothing to rule on until a new photo comes in.
          </p>
        </section>
      ) : (
        <EmptyNote>Nothing has ever been filed on this item.</EmptyNote>
      )}
    </main>
  );
}
