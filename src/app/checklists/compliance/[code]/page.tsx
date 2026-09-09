import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ListBar, NightNav } from "@/components/checklists/Compliance";
import { Card } from "@/components/Card";
import { BackLink } from "@/components/ui";
import { nightCompliance, type ListGroup } from "@/lib/compliance";
import { closeVenueId, venueNameOf } from "@/lib/close-venue";
import { shortOf } from "@/lib/short";
import { currentNight, formatNightSpan } from "@/lib/night";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One venue's night, list by list, in plain words.
 *
 * It had a score bar, a panel explaining what pace means, a table of failures
 * by position, and a card per list stamped PASS or FAIL — four ways of saying
 * the same night, and a manager reading it at ten in the morning still had to
 * text to ask which two lists were missed. Now it is four piles in the order a
 * person asks about them: what nobody signed, what was signed with things
 * left, what is still going, what is done. Each row is a sentence with names
 * and times in it. No verdicts; verdicts are a thing the app decided, and the
 * report is for what happened.
 */
export default async function VenueCompliancePage({
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

  // Anybody but an admin reads their own venue and no other, whatever they
  // type in the address bar. The group screen filters its list; this one has
  // to enforce it, because a URL is not a permission.
  if (session.role !== "admin") {
    const mine = await closeVenueId(session);
    const { data } = mine
      ? await db().from("venues").select("code").eq("id", mine).maybeSingle()
      : { data: null };
    if ((data as { code: string } | null)?.code !== code) notFound();
  }

  const venue = (await nightCompliance(night)).find((v) => v.code === code);
  if (!venue) notFound();

  const name = await venueNameOf(code);
  const pile = (group: ListGroup) =>
    venue.lists.filter((list) => list.group === group);
  // Not signed off first, then signed with something left: the worse fail
  // on top.
  const fails = [...pile("unsigned"), ...pile("gaps")];

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <BackLink
        href={
          session.role === "admin"
            ? `/checklists/locations?night=${night}`
            : "/checklists"
        }
      >
        {session.role === "admin" ? "All locations" : "Checklists"}
      </BackLink>

      {/* The night, the venue, the score, and the way to the nights either
          side, all in the header. */}
      <header className="mt-4 mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="label">
            {formatNightSpan(night)}
            {name === code ? "" : ` · ${code}`}
          </p>
          <h1 className="text-metric mt-2 leading-tight font-medium break-words">
            {name}
          </h1>
          {/* Yellow the moment anything is short, so the line reads as a
              verdict before the bars do. The counts that make the score
              sit beside it. */}
          <p
            className={`note mt-2 ${
              venue.notSigned + venue.notDone > 0 ? "text-warn" : "text-muted"
            }`}
          >
            <span className="text-title tabular-nums">{venue.score}/10</span>
            {" · "}
            {venue.done} of {venue.total} checked off and signed off
            {" · "}
            {shortOf(venue)}
          </p>
        </div>
        <NightNav night={night} base={`/checklists/compliance/${code}`} />
      </header>

      {/* One panel, every list a bar, fails first. The same bars the weekly
          board uses: name in the row, the verdict at the right, the facts in
          small type under. It was two solid yellow cards with a paragraph
          per list and a page of dead space under them. */}
      <Card
        title="Lists"
        hint={[
          fails.length > 0
            ? `${fails.length} ${fails.length === 1 ? "fail" : "fails"}`
            : "no fails",
          ...(pile("going").length > 0
            ? [`${pile("going").length} still going`]
            : []),
          ...(pile("done").length > 0
            ? [`${pile("done").length} checked off and signed off`]
            : []),
        ].join(" · ")}
      >
        {fails.length > 0 ? (
          <>
            <ul className="space-y-3">
              {fails.map((list) => (
                <ListBar
                  key={list.row.checklist_id}
                  list={list}
                  code={code}
                  night={night}
                  full
                />
              ))}
            </ul>
          </>
        ) : null}

        {pile("going").length > 0 ? (
          <>
            <p className="label mt-5">Still going · {pile("going").length}</p>
            <ul className="mt-2 space-y-3">
              {pile("going").map((list) => (
                <ListBar
                  key={list.row.checklist_id}
                  list={list}
                  code={code}
                  night={night}
                />
              ))}
            </ul>
          </>
        ) : null}

        {pile("done").length > 0 ? (
          <details className="group mt-5">
            <summary className="label hover:text-ink flex min-h-11 cursor-pointer list-none items-center gap-2">
              <span>Checked off and signed off · {pile("done").length}</span>
              <span
                className="text-muted transition-transform group-open:rotate-90"
                aria-hidden
              >
                ▸
              </span>
            </summary>
            <ul className="mt-2 space-y-3">
              {pile("done").map((list) => (
                <ListBar
                  key={list.row.checklist_id}
                  list={list}
                  code={code}
                  night={night}
                />
              ))}
            </ul>
          </details>
        ) : null}

        {pile("empty").length > 0 ? (
          <>
            <p className="label mt-5">
              Nothing written on the list yet · {pile("empty").length}
            </p>
            <ul className="mt-2 space-y-3">
              {pile("empty").map((list) => (
                <ListBar
                  key={list.row.checklist_id}
                  list={list}
                  code={code}
                  night={night}
                />
              ))}
            </ul>
          </>
        ) : null}

        {/* The thirty-night view, in the foot of the same card. */}
        <p className="border-divider mt-5 border-t pt-4">
          <Link
            href={`/checklists/rollup?code=${code}`}
            className="label hover:text-ink inline-flex min-h-11 items-center gap-2"
          >
            What keeps getting missed · last 30 nights
            <span aria-hidden>→</span>
          </Link>
        </p>
      </Card>
    </main>
  );
}
