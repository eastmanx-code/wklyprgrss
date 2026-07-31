import Link from "next/link";
import { redirect } from "next/navigation";

import { VenueHero } from "@/components/VenueHero";
import { AddItemSlot } from "@/components/admin/AddItemSlot";
import { DonePill, PhotoPlaceholder, emptySlots } from "@/components/ui";
import { signedUrls } from "@/lib/photos";
import { getSession } from "@/lib/session";
import { WEEKLY_ITEM_TARGET, getLeaderBoard, getVenue } from "@/lib/status";
import {
  deadlineFor,
  formatDeadline,
  formatLastUpload,
  formatWeekStart,
} from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function VenuePage() {
  const session = await getSession();
  if (session?.role !== "leader") redirect("/");

  const venue = await getVenue(session.venueId);
  if (!venue) redirect("/");

  const board = await getLeaderBoard(venue.id);
  const thumbs = await signedUrls(
    [...board.latest.values()].map((s) => s.photo_url),
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
        done={board.doneItemIds.size}
        total={WEEKLY_ITEM_TARGET}
        configured={board.items.length}
        redo={board.sentBackItemIds.size}
        status={board.status}
        deadlineMs={deadlineFor(board.weekStart).getTime()}
        deadlineLabel={formatDeadline(board.weekStart)}
      />

      {/* Always ten tiles. A venue with four items set up should read as six
          slots missing, not as a short but complete-looking board.

          One tile per row on a phone. Two columns left each card about 140px of
          usable width, which is narrower than the task name it has to hold —
          names wrapped to a stack of fragments and the naming field ran out of
          room mid-placeholder. */}
      <ul className="stagger grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {board.items.map((item) => {
          const latest = board.latest.get(item.id);
          const thumb = latest ? thumbs.get(latest.photo_url) : undefined;
          const done = board.doneItemIds.has(item.id);

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
                  </div>
                ) : (
                  <PhotoPlaceholder />
                )}
                <p className="caps mt-3 text-body leading-snug font-medium break-words">
                  {item.title}
                </p>
                <p className="label mt-1">
                  {latest
                    ? `Last photo · ${formatLastUpload(latest.created_at)}`
                    : "No photo yet"}
                </p>
                <div className="mt-2">
                  {board.sentBackItemIds.has(item.id) ? (
                    <span className="pill pill-warn">Redo</span>
                  ) : board.rollingItemIds.has(item.id) ? (
                    <span className="pill pill-rolling">Rolling</span>
                  ) : (
                    <DonePill done={done} />
                  )}
                </div>
              </Link>
            </li>
          );
        })}

        {emptySlots(board.items.length, WEEKLY_ITEM_TARGET).map((slot) => (
          <AddItemSlot key={`slot-${slot}`} venueId={venue.id} index={slot} />
        ))}
      </ul>

      <p className="mt-8">
        <Link href="/board" className="label hover:text-ink">
          See how every venue is doing
        </Link>
      </p>
    </main>
  );
}
