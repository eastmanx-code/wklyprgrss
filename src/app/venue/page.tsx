import Link from "next/link";
import { redirect } from "next/navigation";

import { ClearFinished } from "@/components/ClearFinished";
import { StartOver } from "@/components/StartOver";
import {
  HouseHeading,
  VenueHero,
  type HouseProgress,
} from "@/components/VenueHero";
import { AddItemSlot } from "@/components/admin/AddItemSlot";
import { DonePill, PhotoPlaceholder, emptySlots } from "@/components/ui";
import { livePhotoPaths, signedUrls } from "@/lib/photos";
import { getSession } from "@/lib/session";
import {
  WEEKLY_ITEM_TARGET,
  countUnapproved,
  fullyGradedVenueIds,
  getLeaderBoard,
  getVenue,
  gradesFor,
  houseStartWeek,
} from "@/lib/status";
import {
  deadlineFor,
  formatDeadline,
  formatLastUpload,
  formatWeekStart,
  mostRecentCompletedWeek,
} from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function VenuePage() {
  const session = await getSession();
  if (session?.role !== "leader") redirect("/");

  const venue = await getVenue(session.venueId);
  if (!venue) redirect("/");

  // Only the halves this venue runs. A bar gets one section, not a kitchen
  // full of empty slots it can never fill.
  const board = await getLeaderBoard(venue.id, venue.houses);
  const unapproved = await countUnapproved(venue.id);
  // Reset waits on the grade for the week that has actually finished — the one
  // the signed-off work belongs to, not the one just started.
  const gradedWeek = mostRecentCompletedWeek();
  // Every house's grade, and whether the week is closed in all of them. Two
  // people grade and each signs their own, so one signature is not a closed
  // week: a venue reset on the strength of the dining room alone would clear a
  // kitchen nobody had looked at.
  const grades = await gradesFor(venue.id, gradedWeek);
  const fullyGraded = (await fullyGradedVenueIds(gradedWeek)).has(venue.id);
  // Both shots, not just the headline one. A tile that showed only the after
  // made a before uploaded the same week invisible, which a leader read as the
  // second photo overriding the first.
  const thumbs = await signedUrls(livePhotoPaths([...board.latest.values()]));

  const progress = new Map<string, HouseProgress>(
    board.houses.map((house) => [
      house.house,
      {
        house: house.house,
        done: house.doneItemIds.size,
        total: WEEKLY_ITEM_TARGET,
        configured: house.items.length,
        redo: house.sentBackItemIds.size,
        status: house.status,
        scored: house.scored,
        scoredFrom: house.scored
          ? null
          : formatWeekStart(houseStartWeek(house.house)),
      },
    ]),
  );

  const finished = board.houses.reduce(
    (sum, house) => sum + house.approvedItemIds.size,
    0,
  );

  return (
    <main>
      <header className="mb-6">
        <p className="label">Week of {formatWeekStart(board.weekStart)}</p>
        <h1 className="text-metric mt-2 truncate tracking-normal">
          {venue.name && venue.name !== venue.code ? venue.name : venue.code}
        </h1>
      </header>

      <VenueHero
        missed={board.houses.some(
          (house) => house.scored && house.status === "FAIL",
        )}
        deadlineMs={deadlineFor(board.weekStart).getTime()}
        deadlineLabel={formatDeadline(board.weekStart)}
      />

      {/* One section per house, front of house first.
      
          Two walks, two people, two scores — and one page, because it is one
          building and one deadline. Run together as a single grid of twenty
          they would have been one job nobody owned; separated, each list is
          the length it has always been and each has its own bar above it. */}
      {board.houses.map((house) => (
        <section key={house.house} className="mb-10">
          <HouseHeading progress={progress.get(house.house)!} />

          {/* Always ten tiles. A house with four items set up should read as
              six slots missing, not as a short but complete-looking board.

              One tile per row on a phone. Two columns left each card about
              140px of usable width, which is narrower than the task name it
              has to hold — names wrapped to a stack of fragments and the
              naming field ran out of room mid-placeholder. */}
          <ul className="stagger grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {house.items.map((item) => {
              const latest = board.latest.get(item.id);
              const thumb = latest ? thumbs.get(latest.photo_url) : undefined;
              const beforeThumb = latest?.before_photo_url
                ? thumbs.get(latest.before_photo_url)
                : undefined;
              const done = house.doneItemIds.has(item.id);
              const stale = board.staleWeeks.get(item.id) ?? 0;
              const rolling = board.rollingWeeks.get(item.id) ?? 0;

              return (
                <li key={item.id}>
                  <Link
                    href={`/venue/item/${item.id}`}
                    className="panel panel-link flex h-full flex-col p-3"
                  >
                    {thumb ? (
                      <div className="relative aspect-square overflow-hidden rounded-xl bg-panel">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumb}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        {/* The pair, inset. Small on purpose — the current
                            state is still the headline; this only says a
                            before exists and is one tap away. */}
                        {beforeThumb ? (
                          <span className="border-paper/80 absolute bottom-2 left-2 block size-12 overflow-hidden rounded-lg border-2 shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={beforeThumb}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <PhotoPlaceholder />
                    )}
                    <p className="caps mt-3 text-body leading-snug font-medium break-words">
                      {item.title}
                    </p>
                    {/* When it was submitted, and whether that is a problem.
                        "Jul 14 · 19d" makes you do the arithmetic; the second
                        line is the answer the arithmetic was for. Two weeks is
                        the threshold because one week behind is simply this
                        week not being done yet, which the pill below already
                        says. */}
                    <p className="label mt-1">
                      {latest
                        ? `Last photo · ${formatLastUpload(latest.created_at)}`
                        : "No photo yet"}
                    </p>
                    {latest && stale >= 2 ? (
                      <p className="label text-warn mt-1">
                        No new photo in {stale} weeks
                      </p>
                    ) : rolling >= 3 ? (
                      <p className="label text-warn mt-1">
                        Rolling {rolling} weeks
                      </p>
                    ) : null}
                    {/* The task as it stands, not what happened this week.
                        Every one of these is a different job in a different
                        part of the building, so a task signed off on Friday
                        asking for another photograph on Monday is asking for
                        waste. */}
                    <div className="mt-2">
                      {house.sentBackItemIds.has(item.id) ? (
                        <span className="pill pill-warn">Redo</span>
                      ) : house.approvedItemIds.has(item.id) ? (
                        <span className="pill pill-done">Approved</span>
                      ) : house.rollingItemIds.has(item.id) ? (
                        <span className="pill pill-rolling">Rolling</span>
                      ) : (
                        <DonePill done={done} />
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}

            {emptySlots(house.items.length, WEEKLY_ITEM_TARGET).map((slot) => (
              <AddItemSlot
                key={`slot-${house.house}-${slot}`}
                venueId={venue.id}
                house={house.house}
                index={slot}
              />
            ))}
          </ul>
        </section>
      ))}

      {/* Under both boards, not over them.
      
          Resetting used to lead the page, on the reasoning that it is the
          first thing to do in a week. With two lists above it that reasoning
          stopped holding: a control that changes the shape of both boards sat
          above either of them, so the first thing on the screen was a button
          about the boards rather than the boards. Whoever is resetting will
          scroll; whoever is walking the building should not have to. */}
      <ClearFinished
        venueId={venue.id}
        finished={finished}
        graded={fullyGraded}
        grades={board.houses.map((house) => ({
          house: house.house,
          gradedBy: grades.get(house.house)?.gradedBy ?? null,
          scored: house.scored,
        }))}
        weekLabel={formatWeekStart(gradedWeek)}
      />

      <StartOver venueId={venue.id} pending={unapproved} />

      <p className="mt-8">
        <Link href="/board" className="label hover:text-ink">
          See how every venue is doing
        </Link>
      </p>
    </main>
  );
}
