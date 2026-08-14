import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PhotoView } from "@/components/PhotoView";

import {
  approveAllForVenue,
  moveItem,
  reviewSubmission,
  setItemActive,
} from "@/app/admin/actions";
import { AddItemForm } from "@/components/admin/AddItemForm";
import { ChangeVerdict } from "@/components/admin/ChangeVerdict";
import { GradeWeek } from "@/components/admin/GradeWeek";
import { AddItemSlot } from "@/components/admin/AddItemSlot";
import { RenameItemForm } from "@/components/admin/RenameItemForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { VenuePinForm } from "@/components/admin/VenuePinForm";
import { WipeVenue } from "@/components/admin/WipeVenue";
import {
  Attribution,
  BackLink,
  DonePill,
  PhotoPlaceholder,
  ReviewPill,
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
  gradeFor,
  latestByItem,
  statusFor,
} from "@/lib/status";
import {
  currentWeekStart,
  formatLastUpload,
  formatTimestamp,
  formatWeekStart,
  mostRecentCompletedWeek,
} from "@/lib/week";

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
  const submissions = await getSubmissionsForItems(
    items.map((item) => item.id),
  );
  const photos = await signedUrls(livePhotoPaths(submissions));

  const weekStart = currentWeekStart();
  const thisWeek = submissions.filter((s) => s.week_start === weekStart);
  const doneThisWeek = doneItemIdsFrom(thisWeek);

  // Newest surviving submission per item — the one under review.
  const latestThisWeek = latestByItem(thisWeek);
  /**
   * And the newest of any week, for tasks that carried over.
   *
   * A task that was not finished stays on the board into the new week, so the
   * work under review is not always this week's. Reading only the current week
   * meant that at midnight on Monday this screen went blind: no photograph, no
   * review pill, no approve or send-back, and a card that said "last photo Aug
   * 4" directly above "nothing submitted yet".
   */
  const latestEver = latestByItem(submissions);
  // Only work the leader has called done is actually reviewable — and a
  // carried-over task is every bit as reviewable as one filed this morning.
  const awaitingReview = activeItems.filter((item) => {
    const s = latestThisWeek.get(item.id) ?? latestEver.get(item.id);
    return s?.review === "pending" && s.progress === "done";
  }).length;
  const activeDone = activeItems.filter((item) =>
    doneThisWeek.has(item.id),
  ).length;
  const status = statusFor(
    activeDone,
    activeItems.length,
    weekStart,
    new Date(),
  );

  // The week the venue is waiting on a grade for.
  const gradedWeek = mostRecentCompletedWeek();
  const grade = await gradeFor(venue.id, gradedWeek);

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
        <h1 className="mt-2 font-mono text-metric font-medium">{venue.code}</h1>
        <div className="mt-3 flex items-center gap-2">
          <StatusPill status={status} />
          <span className="label">
            {activeDone}/{WEEKLY_ITEM_TARGET} this week ·{" "}
            {formatWeekStart(weekStart)}
          </span>
        </div>
      </header>

      {/* The grade gates their reset, so it leads — it is the thing a venue is
          waiting on, not a footnote under the review grid. */}
      <GradeWeek
        venueId={venue.id}
        weekStart={gradedWeek}
        weekLabel={formatWeekStart(gradedWeek)}
        gradedBy={grade?.gradedBy ?? null}
      />

      {/* This week at a glance: see it, approve it, or send it back. */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="label">
            This week · {awaitingReview} awaiting review
          </h2>
          {awaitingReview > 0 ? (
            <form action={approveAllForVenue}>
              <input type="hidden" name="venueId" value={venue.id} />
              <input type="hidden" name="weekStart" value={weekStart} />
              <SubmitButton className="btn btn-sm" pendingLabel="Approving…">
                Approve all
              </SubmitButton>
            </form>
          ) : null}
        </div>

        {/* One tile per row on a phone — see /venue for why two columns are too
            narrow for a task name. */}
        <ul className="stagger grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {activeItems.map((item) => {
            // This week's if there is one, otherwise the task as it stands —
            // an unfinished task carries into the new week and is still the
            // thing being judged.
            const submission =
              latestThisWeek.get(item.id) ?? latestEver.get(item.id);
            const carried = submission
              ? submission.week_start !== weekStart
              : false;
            const url = submission
              ? photos.get(submission.photo_url)
              : undefined;
            // Falls back to the last-ever upload, so a stale item still says
            // how long it has been neglected rather than just "nothing yet".
            const lastEver = byItem.get(item.id)?.[0];

            return (
              <li key={item.id} className="panel flex flex-col p-3">
                <Link
                  href={`/venue/item/${item.id}`}
                  className="flex flex-1 flex-col"
                >
                  <div className="relative">
                    {url ? (
                      <div className="bg-inset aspect-square overflow-hidden rounded-[8px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <PhotoPlaceholder />
                    )}
                    {submission ? (
                      <span className="absolute top-2 right-2">
                        <ReviewPill review={submission.review} />
                      </span>
                    ) : null}
                    {/* The leader's answer, on the photograph.
                        Said as a line of its own — "Leader says: this is
                        done" — it was a sixth stacked row of uppercase under
                        the picture, and in a five-column board it wrapped to
                        two. The card stopped being readable at a glance,
                        which is the only thing a card is for. In the corner it
                        costs no row at all and answers the question from
                        across the grid. Backed, because the rolling pill is an
                        outline and an outline on a photograph is nothing. */}
                    {submission ? (
                      <span className="bg-panel absolute bottom-2 left-2 rounded-[4px]">
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
                      </span>
                    ) : null}
                  </div>

                  <p className="caps mt-3 text-body leading-snug font-medium break-words">
                    {item.title}
                  </p>
                  {/* Just the date. "Last photo · " is four words of chrome
                      in front of three of content, and in a narrow column it
                      pushed a one-line fact onto two. Under a photograph, a
                      date is the photograph's date. */}
                  <p className="label mt-1">
                    {lastEver
                      ? formatLastUpload(lastEver.created_at)
                      : "No photo yet"}
                  </p>
                  {carried ? (
                    <p className="label text-warn mt-1">
                      Carried from {formatWeekStart(submission!.week_start)}
                    </p>
                  ) : null}
                </Link>

                {submission ? (
                  <>
                    <p className="text-muted mt-1.5 line-clamp-3 text-body leading-relaxed">
                      {submission.comment}
                    </p>
                    <Attribution
                      author={submission.author}
                      assistedBy={submission.assisted_by}
                    />

                    {/* Stacked and bottom-aligned: at five columns a tile is
                          too narrow for two pills side by side, and pushing them
                          down keeps every card's actions on the same line. */}
                    {/* A decision already made is not a decision to make.
                        Every card carried a review button regardless of state,
                        so a screen reading "0 awaiting review" still offered
                        ten of them — and Approve on a rejected task would have
                        signed off work that was never redone.

                        Buttons appear on work that is genuinely undecided,
                        whichever week it came from — a task filed last week and
                        never reviewed still needs a verdict. A verdict already
                        given is reopened by a new photograph, not by a button
                        that quietly overwrites it. */}
                    <div className="mt-auto flex flex-col gap-2 pt-3">
                      {submission.review !== "pending" ? (
                        <ChangeVerdict
                          submissionId={submission.id}
                          venueId={venue.id}
                          review={submission.review}
                        />
                      ) : null}

                      {/* Can't approve work the leader hasn't called done. */}
                      {submission.review === "pending" &&
                      submission.progress === "done" ? (
                        <form action={reviewSubmission}>
                          <input
                            type="hidden"
                            name="submissionId"
                            value={submission.id}
                          />
                          <input
                            type="hidden"
                            name="venueId"
                            value={venue.id}
                          />
                          <input type="hidden" name="review" value="approved" />
                          <SubmitButton pendingLabel="Approving…">
                            Approve
                          </SubmitButton>
                        </form>
                      ) : null}

                      {submission.review === "pending" ? (
                        <form action={reviewSubmission}>
                          <input
                            type="hidden"
                            name="submissionId"
                            value={submission.id}
                          />
                          <input
                            type="hidden"
                            name="venueId"
                            value={venue.id}
                          />
                          <input
                            type="hidden"
                            name="review"
                            value="sent_back"
                          />
                          <SubmitButton pendingLabel="Sending back…">
                            Send back
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="label mt-2">Never submitted</p>
                )}
              </li>
            );
          })}

          {/* Fillable in place — the board is where you can see what's
                missing, so it's where it should be added. */}
          {emptySlots(activeItems.length, WEEKLY_ITEM_TARGET).map((slot) => (
            <AddItemSlot key={`slot-${slot}`} venueId={venue.id} index={slot} />
          ))}
        </ul>
      </section>

      {/* Setup, not weekly work — tucked away so the review grid leads. */}
      <details className="mt-8">
        <summary className="label cursor-pointer select-none">
          Manage venue · items, order, PIN
        </summary>

        <div className="mt-4">
          <AddItemForm venueId={venue.id} />
        </div>

        <section className="mt-8">
          <h2 className="label mb-3">Items</h2>

          {items.length === 0 ? (
            <p className="text-body text-muted">
              No items yet. Add the first above.
            </p>
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
                        <p className="mt-3 text-body text-muted">
                          Nothing submitted yet.
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-3">
                          {history.map((submission) => {
                            const url = photos.get(submission.photo_url);
                            return (
                              <li key={submission.id} className="panel-quiet">
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
                      )}
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Last, and masked: the least-used control shouldn't sit in the most
            prominent spot, and a PIN on screen is a PIN over a shoulder. The
            form carries its own label, so no heading here. */}
        <section className="mt-8">
          <VenuePinForm venueId={venue.id} pin={venue.pin} />
        </section>

        {/* Last thing on the page, behind the disclosure. The warning states
            itself now, so it no longer needs a one-word heading to carry the
            weight. */}
        <section className="mt-10">
          <WipeVenue
            venueId={venue.id}
            venueCode={venue.code}
            itemCount={activeItems.length}
            photoCount={submissions.filter((s) => !s.photo_purged_at).length}
          />
        </section>
      </details>
    </main>
  );
}
