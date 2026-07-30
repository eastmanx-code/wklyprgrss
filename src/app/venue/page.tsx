import Link from "next/link";
import { redirect } from "next/navigation";

import { logout } from "@/app/actions";
import { WeekProgress } from "@/components/WeekProgress";
import { DonePill, EmptyNote, PhotoPlaceholder } from "@/components/ui";
import { signedUrls } from "@/lib/photos";
import { getSession } from "@/lib/session";
import { getLeaderBoard, getVenue } from "@/lib/status";
import { deadlineFor, formatDeadline, formatWeekStart } from "@/lib/week";

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
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="label">Venue</p>
          <h1 className="mt-2 truncate text-2xl font-medium tracking-tight">
            {venue.name && venue.name !== venue.code
              ? venue.name
              : venue.code}
          </h1>
        </div>
        <form action={logout}>
          <button type="submit" className="btn-ghost">
            Sign out
          </button>
        </form>
      </header>

      <WeekProgress
        done={board.doneItemIds.size}
        total={board.items.length}
        status={board.status}
        deadlineMs={deadlineFor(board.weekStart).getTime()}
        deadlineLabel={formatDeadline(board.weekStart)}
        weekLabel={formatWeekStart(board.weekStart)}
      />

      {board.items.length === 0 ? (
        <EmptyNote>
          No items set up for this venue yet. Your admin adds them.
        </EmptyNote>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {board.items.map((item) => {
            const latest = board.latest.get(item.id);
            const thumb = latest ? thumbs.get(latest.photo_url) : undefined;
            const done = board.doneItemIds.has(item.id);

            return (
              <li key={item.id}>
                <Link
                  href={`/venue/item/${item.id}`}
                  className="panel block h-full p-3 transition-opacity active:opacity-70"
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
                    <p className="caps text-sm leading-snug font-medium">
                      {item.title}
                    </p>
                  </div>
                  <div className="mt-2">
                    <DonePill done={done} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-center">
        <Link href="/board" className="label hover:text-ink">
          See how every venue is doing
        </Link>
      </p>
    </main>
  );
}
