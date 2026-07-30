import { notFound, redirect } from "next/navigation";

import { PhotoSubmitForm } from "@/components/PhotoSubmitForm";
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
  const photos = await signedUrls(submissions.map((s) => s.photo_url));

  const weekStart = currentWeekStart();
  const thisWeek = submissions.filter((s) => s.week_start === weekStart);
  // Newest submission decides the state — same rule as the grid, so the two
  // screens can never disagree.
  const current = thisWeek[0];
  const sentBack = current?.review === "sent_back";
  const rolling = !sentBack && current?.progress === "another_cycle";
  const doneThisWeek = Boolean(current) && !sentBack;

  return (
    <main>
      <BackLink href="/venue">All items</BackLink>

      <header className="mt-4 mb-6">
        <p className="label">Item</p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight">
          {item.title}
        </h1>
        <div className="mt-3">
          {sentBack ? (
            <span className="pill pill-fail">Redo</span>
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

      <PhotoSubmitForm itemId={item.id} />

      <section className="mt-10">
        <h2 className="label mb-3">History · newest first</h2>

        {submissions.length === 0 ? (
          <p className="text-sm text-muted">Nothing submitted yet.</p>
        ) : (
          <ul className="space-y-3">
            {submissions.map((submission) => {
              const url = photos.get(submission.photo_url);
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
                  <div className="mt-3">
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
                  </div>
                  <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
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
