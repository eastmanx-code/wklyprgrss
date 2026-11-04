import Link from "next/link";
import { redirect } from "next/navigation";

import { ChTaskComposer } from "@/components/admin/ChTaskComposer";
import { openCountsByVenue } from "@/lib/ch-tasks";
import { notAdminGoesTo } from "@/lib/app";
import { signedUrls } from "@/lib/photos";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Venue = { id: string; code: string; name: string | null };

/**
 * CH Tasks, owner side. Post a task to any venue, and see what is still open
 * and what has been cleared, with the photo proof.
 */
export default async function AdminTasksPage() {
  const session = await getSession();
  if (session?.role !== "admin") redirect(notAdminGoesTo(Boolean(session)));

  const { data: venueRows } = await db()
    .from("venues")
    .select("id, code, name")
    .eq("active", true)
    .order("code");
  const venues = (venueRows ?? []) as Venue[];
  const codeOf = new Map(venues.map((v) => [v.id, v.code]));

  const counts = await openCountsByVenue();
  const openList = venues
    .map((v) => ({ venue: v, open: counts.get(v.id) ?? 0 }))
    .filter((row) => row.open > 0)
    .sort((a, b) => b.open - a.open);

  // The last handful cleared anywhere, newest first, with the done photo.
  const { data: doneRows } = await db()
    .from("ch_tasks")
    .select("id, venue_id, title, done_at, done_by, done_photo_path")
    .not("done_at", "is", null)
    .order("done_at", { ascending: false })
    .limit(12);
  const done = (doneRows ?? []) as {
    id: string;
    venue_id: string;
    title: string;
    done_at: string;
    done_by: string | null;
    done_photo_path: string | null;
  }[];
  const doneUrls = await signedUrls(
    done
      .map((d) => d.done_photo_path)
      .filter((p): p is string => Boolean(p)),
  );

  const stoc = venues.find((v) => v.code === "STOC");
  const defaultVenueId = stoc?.id ?? venues[0]?.id ?? "";

  return (
    <main className="mx-auto max-w-md">
      <header className="mb-6">
        <p className="label">Owner · posts to the MOD list</p>
        <h1 className="text-metric mt-2 font-medium">CH Tasks</h1>
      </header>

      <ChTaskComposer venues={venues} defaultVenueId={defaultVenueId} />

      <section className="mt-8">
        <h2 className="card-title">Open now</h2>
        {openList.length === 0 ? (
          <p className="note text-muted mt-2">Nothing outstanding anywhere.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {openList.map(({ venue, open }) => (
              <li
                key={venue.id}
                className="label flex items-center justify-between"
              >
                <span>{venue.code}</span>
                <span className="tabular-nums">
                  {open} open
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 ? (
        <section className="mt-8">
          <h2 className="card-title">Recently cleared</h2>
          <ul className="mt-3 space-y-3">
            {done.map((d) => (
              <li key={d.id} className="flex items-start gap-3">
                {d.done_photo_path && doneUrls.get(d.done_photo_path) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={doneUrls.get(d.done_photo_path)!}
                    alt=""
                    className="bg-inset h-14 w-14 shrink-0 rounded object-cover"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="text-body break-words">{d.title}</p>
                  <p className="label text-muted mt-1">
                    {codeOf.get(d.venue_id) ?? ""}
                    {d.done_by ? ` · ${d.done_by}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-8">
        <Link href="/admin" className="label hover:text-ink">
          ← All venues
        </Link>
      </p>
    </main>
  );
}
