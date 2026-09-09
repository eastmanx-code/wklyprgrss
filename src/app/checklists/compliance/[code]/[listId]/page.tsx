import { listName } from "@/lib/slug";
import { notFound, redirect } from "next/navigation";

import { BackLink } from "@/components/ui";
import { phaseName } from "@/lib/checklists";
import { listDetail } from "@/lib/compliance";
import { closeVenueId, venueNameOf } from "@/lib/close-venue";
import { currentNight, formatClock, formatNight } from "@/lib/night";
import { describeLag } from "@/lib/pace";
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

  // Anybody but an admin: their own venue and no other.
  if (session.role !== "admin") {
    const mine = await closeVenueId(session);
    if (mine !== owner.venue_id) notFound();
  }

  const detail = await listDetail(listId, night);
  if (!detail) notFound();

  const name = await venueNameOf(code);
  const open = detail.items.filter((i) => !i.ticked);
  const signed = Boolean(detail.certifiedAt);
  const short = open.length > 0 || !signed;
  // Who checked things off: the initials on the ticks, each once.
  const by = [
    ...new Set(
      detail.items
        .filter((i) => i.ticked && i.initials)
        .map((i) => i.initials!.toUpperCase()),
    ),
  ].join(", ");

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <BackLink href={`/checklists/compliance/${code}?night=${night}`}>
        {name}
      </BackLink>

      {/* Three screens deep, with a phase for a heading, this was the only
          page in the flow that never said which building it was describing. */}
      <header className="mt-4 mb-5">
        <p className="label">
          {name} · {formatNight(night)} · {detail.house} ·{" "}
          {listName(detail.role, detail.room)}
        </p>
        <h1 className="text-metric mt-2 font-medium">
          {phaseName(detail.phase)} checklist
        </h1>
      </header>

      {/* One bar, the same bar as every other level: the verdict on the
          right, who checked and who signed underneath. */}
      <div
        className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 rounded-[4px] px-4 py-3 ${
          short ? "bg-warn text-on-warn" : "bg-inset"
        }`}
      >
        <span className="text-body font-medium">
          {detail.ticked} of {detail.owed} checked off
        </span>
        <span className="text-label font-medium tracking-[0.08em] whitespace-nowrap uppercase">
          {!signed
            ? "not signed off"
            : open.length > 0
              ? "not checked off"
              : "checked off and signed off"}
        </span>
        <span
          className={`col-span-2 text-label tracking-[0.08em] uppercase ${
            short ? "text-on-warn/80" : "text-muted"
          }`}
        >
          checked off{" "}
          <span className={open.length > 0 ? "text-on-warn font-medium" : ""}>
            {by
              ? `by ${by}`
              : detail.ticked > 0
                ? "by no initials"
                : "by nobody"}
          </span>
          {" · "}signed off{" "}
          <span className={!signed ? "text-on-warn font-medium" : ""}>
            {signed
              ? `${detail.certifiedBy?.trim() || "no name"}${
                  detail.certifiedAt
                    ? ` ${formatClock(detail.certifiedAt)}`
                    : ""
                }`
              : "nobody"}
          </span>
          {detail.verifiedBy
            ? ` · verified ${detail.verifiedBy.trim()}${
                detail.verifiedAt ? ` ${formatClock(detail.verifiedAt)}` : ""
              }${detail.sameDevice ? " · same phone" : ""}`
            : ""}
          {detail.reopened > 0
            ? ` · signature undone ${detail.reopened} ${detail.reopened === 1 ? "time" : "times"}`
            : ""}
        </span>
      </div>

      {/* The lag is a fact, never an accusation. Since the offline queue
          shipped it mostly means somebody worked a cellar with no signal. */}
      {detail.pace.late ? (
        <p className="note text-muted mt-2 leading-relaxed">
          These reached the server {describeLag(detail.pace.lagMinutes)} after
          the phone says they were signed off. That is what a list done without
          signal looks like.
        </p>
      ) : null}

      {detail.pace.impossible ? (
        <p className="note text-warn mt-2 leading-relaxed">
          One item claims a time this night never contained, so that phone{"'"}s
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
                  : "not checked off"}
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
    </main>
  );
}
