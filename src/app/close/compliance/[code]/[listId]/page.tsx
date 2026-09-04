import { notFound, redirect } from "next/navigation";

import { BackLink } from "@/components/ui";
import { phaseName } from "@/lib/checklists";
import { listDetail } from "@/lib/compliance";
import { closeVenueId, venueNameOf } from "@/lib/close-venue";
import { currentNight, formatClock, formatNight } from "@/lib/night";
import { describeLag, describeSpan } from "@/lib/pace";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One list, one night, item by item.
 *
 * The three columns here are stored on every tick and shown on no other
 * screen: which items finished, who tapped each one, and when. Open items
 * lead, because the things nobody did are the reason this page is being read.
 */
export default async function ListCompliancePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string; listId: string }>;
  searchParams: Promise<{ night?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const { code: rawCode, listId } = await params;
  const code = rawCode.toUpperCase();
  const asked = (await searchParams).night;
  const night = asked && NIGHT.test(asked) ? asked : currentNight();

  // The list has to belong to the venue in the path, and a leader has to own
  // that venue. Without the first check any list id renders under any code.
  const { data: ownerRow } = await db()
    .from("close_checklists")
    .select("venue_id, venues(code)")
    .eq("id", listId)
    .maybeSingle();
  const owner = ownerRow as {
    venue_id: string;
    venues: { code: string } | null;
  } | null;
  if (!owner || owner.venues?.code?.toUpperCase() !== code) notFound();

  if (session.role === "leader") {
    const mine = await closeVenueId(session);
    if (mine !== owner.venue_id) notFound();
  }

  const detail = await listDetail(listId, night);
  if (!detail) notFound();

  const name = await venueNameOf(code);
  const open = detail.items.filter((i) => !i.ticked);
  const signed = Boolean(detail.certifiedAt);

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <BackLink href={`/close/compliance/${code}?night=${night}`}>
        {name}
      </BackLink>

      {/* Three screens deep, with a phase for a heading, this was the only
          page in the flow that never said which building it was describing. */}
      <header className="mt-4 mb-5">
        <p className="label">
          {name} · {formatNight(night)} · {detail.house} · {detail.role}
        </p>
        <h1 className="text-metric mt-2 font-medium">
          {phaseName(detail.phase)} checklist
        </h1>
      </header>

      {/* The signature, and the two timestamps either side of it. A list
          signed three minutes after the last tick and four hours before the
          doors shut is the whole story of the night, and no count shows it. */}
      <section
        className={`rounded-[4px] px-4 py-3 ${
          signed && open.length > 0 ? "bg-warn text-on-warn" : "bg-inset"
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-body">
            {signed
              ? `Signed by ${detail.certifiedBy?.trim() || "somebody unnamed"}`
              : "Never signed"}
          </span>
          <span className="text-body tabular-nums">
            {detail.ticked} of {detail.owed}
          </span>
        </div>
        <p
          className={`mt-1 text-label tracking-[0.08em] ${
            signed && open.length > 0 ? "text-on-warn" : "text-muted"
          }`}
        >
          {signed && detail.certifiedAt
            ? `${formatClock(detail.certifiedAt)}${
                detail.lastTickAt
                  ? ` · last tick ${formatClock(detail.lastTickAt)}`
                  : ""
              }${open.length > 0 ? ` · ${open.length} left open` : " · all clear"}`
            : detail.lastTickAt
              ? `Last tick ${formatClock(detail.lastTickAt)} · ${open.length} left open`
              : "Nobody opened this list"}
        </p>
        {detail.reopened > 0 ? (
          <p
            className={`mt-1 text-label tracking-[0.08em] ${
              signed && open.length > 0 ? "text-on-warn" : "text-warn"
            }`}
          >
            Signature undone and redone {detail.reopened}{" "}
            {detail.reopened === 1 ? "time" : "times"}
          </p>
        ) : null}
      </section>

      {/* How the ticks arrived, which no count on this page can say.
          A list can be ten out of ten, signed, and thumbed through at the
          bar; that is the case this section exists for and the only one it
          can see. Deliberately worded as evidence rather than a verdict:
          somebody who walked with paper and entered it after produces the
          same shape, and a report that called that cheating would be wrong
          often enough to stop being read. */}
      {detail.pace.burst ? (
        <section className="bg-warn text-on-warn mt-2 rounded-[4px] px-4 py-3">
          <p className="text-body">Ticked too fast to have been walked</p>
          <p className="text-on-warn mt-1 text-label tracking-[0.08em]">
            {detail.pace.note}
          </p>
          <p className="text-on-warn mt-2 text-label leading-relaxed">
            There is no route through a building at that pace. Worth asking
            about: working off paper and entering it after looks the same from
            here.
          </p>
        </section>
      ) : detail.pace.ticks >= 2 ? (
        <p className="label mt-2">
          Walked over {describeSpan(detail.pace.spanSeconds)} ·{" "}
          {detail.pace.secondsPerItem >= 60
            ? `about ${Math.round(detail.pace.secondsPerItem / 60)} minutes an item`
            : `${detail.pace.secondsPerItem} seconds an item`}
        </p>
      ) : null}

      {/* The lag is a fact, never an accusation. It used to mean somebody was
          backfilling; since the offline queue shipped it also means somebody
          walked a cellar with no signal, and the two cannot be told apart by
          arrival time. What separates them is the pace above. */}
      {detail.pace.late ? (
        <p className="note text-muted mt-2 leading-relaxed">
          These ticks reached the server {describeLag(detail.pace.lagMinutes)}{" "}
          after the phone says they were taken. That is what a list walked
          without signal looks like, and it is also what backfilling looks like.
          The pace above is what tells them apart.
        </p>
      ) : null}

      {detail.pace.impossible ? (
        <p className="note text-warn mt-2 leading-relaxed">
          A tick claims a time this night never contained, so that phone{"'"}s
          clock is wrong or was set by hand. Read the times on this page as the
          server{"'"}s, not the device{"'"}s.
        </p>
      ) : null}

      {detail.items.length === 0 ? (
        <section className="panel mt-3">
          <p className="note text-muted leading-relaxed">
            Nothing is written on this list yet, so there was nothing to walk.
          </p>
        </section>
      ) : (
        <ul className="mt-3">
          {detail.items.map((item) => (
            <li
              key={item.id}
              className="border-divider grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t py-3 first:border-t-0"
            >
              <span className={`text-body ${item.ticked ? "" : "text-warn"}`}>
                {item.title}
              </span>
              <span
                className={`label shrink-0 tabular-nums ${
                  item.ticked ? "" : "text-warn"
                }`}
              >
                {item.ticked
                  ? `${item.initials ?? "no initials"}${
                      item.at ? ` · ${formatClock(item.at)}` : ""
                    }`
                  : "Open"}
              </span>
              {/* What the item asked for against what arrived. A ticked item
                  that owed a photograph and produced none is a tick with
                  nothing behind it. */}
              {item.proofWanted.length > 0 ? (
                <span
                  className={`col-span-2 text-label tracking-[0.08em] ${
                    item.ticked && item.proofGiven === 0
                      ? "text-warn"
                      : "text-muted"
                  }`}
                >
                  {item.proofWanted.join(" and ")} asked for ·{" "}
                  {item.proofGiven > 0
                    ? `${item.proofGiven} attached`
                    : "none attached"}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="label mt-5">
        Every tick carries the initials typed on it and the moment it was taken,
        so a shared iPad still says who did what.
      </p>
    </main>
  );
}
