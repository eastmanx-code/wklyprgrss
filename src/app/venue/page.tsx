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
          slots missing, not as a short but complete-looking board. */}
      <ul className="stagger grid grid-cols-2 items-stretch gap-3 xl:grid-cols-5">
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
                <div className="mt-3 flex items-start justify-between gap-2">
                  <p className="caps text-body leading-snug font-medium">
                    {item.title}
                  </p>
                </div>
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

        {/* A venue owns its own list — same control the admin has. Only
              approving stays admin-only. */}
        {emptySlots(board.items.length, WEEKLY_ITEM_TARGET).map((slot) => (
          <AddItemSlot
            key={`slot-${slot}`}
            venueId={venue.id}
            index={slot}
            uploadPrefix="/venue/item/"
          />
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
