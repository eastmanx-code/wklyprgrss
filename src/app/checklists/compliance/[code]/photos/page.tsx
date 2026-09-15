import { notFound, redirect } from "next/navigation";

import { Card } from "@/components/Card";
import { BackLink } from "@/components/ui";
import { phaseName } from "@/lib/checklists";
import { closeVenueId, venueNameOf } from "@/lib/close-venue";
import { currentNight, formatClock, formatNightSpan } from "@/lib/night";
import { nightPhotos, type NightPhoto } from "@/lib/night-photos";
import { signedUrls } from "@/lib/photos";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";
import { listName } from "@/lib/slug";

export const dynamic = "force-dynamic";

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Every photo the crew took on one night, one screen, each under the task it
 * stands for. The answer to "let me see last night's photos" without opening a
 * single list.
 */
export default async function NightPhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ night?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const code = (await params).code.toUpperCase();
  const asked = (await searchParams).night;
  const night = asked && NIGHT.test(asked) ? asked : currentNight();

  // A URL is not a permission: anybody but an admin sees their own venue only.
  if (session.role !== "admin") {
    const mine = await closeVenueId(session);
    const { data } = mine
      ? await db().from("venues").select("code").eq("id", mine).maybeSingle()
      : { data: null };
    if ((data as { code: string } | null)?.code !== code) notFound();
  }

  const name = await venueNameOf(code);
  const photos = await nightPhotos(code, night);
  const urls =
    photos.length > 0
      ? await signedUrls(photos.map((p) => p.path))
      : new Map<string, string>();
  const shown = photos.filter((p) => urls.get(p.path));

  return (
    <main className="close-flow mx-auto max-w-[960px] pb-4">
      <BackLink href={`/checklists/compliance/${code}?night=${night}`}>
        {name}
      </BackLink>

      <header className="mt-4 mb-6">
        <p className="label">
          {formatNightSpan(night)}
          {name === code ? "" : ` · ${code}`}
        </p>
        <h1 className="text-metric mt-2 leading-tight font-medium">
          Photos · {shown.length}
        </h1>
      </header>

      {shown.length === 0 ? (
        <Card title="Photos" hint="none on this night">
          <p className="note text-muted leading-relaxed">
            No photos were taken on this night, or none has uploaded yet.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown.map((shot, i) => (
            <PhotoTile key={i} shot={shot} url={urls.get(shot.path)!} />
          ))}
        </div>
      )}
    </main>
  );
}

/**
 * One shot, captioned with the task it was taken for and who took it. Tap it
 * for the full frame.
 */
function PhotoTile({ shot, url }: { shot: NightPhoto; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="bg-inset block overflow-hidden rounded-[6px]"
    >
      {shot.kind === "video" ? (
        <span className="bg-panel text-label flex aspect-square items-center justify-center tracking-[0.08em]">
          video
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={shot.itemTitle}
          className="aspect-square w-full object-cover"
        />
      )}
      <div className="p-2">
        <p className="text-label text-muted tracking-[0.08em] uppercase">
          {listName(shot.role, shot.room)} · {phaseName(shot.phase)}
        </p>
        <p className="text-body mt-0.5 leading-snug break-words">
          {shot.itemTitle}
        </p>
        <p className="label mt-1">
          {shot.initials ? `${shot.initials} · ` : ""}
          {shot.at ? formatClock(shot.at) : ""}
        </p>
      </div>
    </a>
  );
}
