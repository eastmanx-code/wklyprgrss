import { listName } from "@/lib/slug";
import { notFound, redirect } from "next/navigation";

import { Card } from "@/components/Card";
import { BackLink } from "@/components/ui";
import { phaseName } from "@/lib/checklists";
import { listDetail, type ItemOutcome } from "@/lib/compliance";
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
    <main className="close-flow mx-auto max-w-[960px] pb-4">
      <BackLink href={`/checklists/compliance/${code}?night=${night}`}>
        {name}
      </BackLink>

      {/* Three screens deep, with a phase for a heading, this was the only
          page in the flow that never said which building it was describing. */}
      <header className="mt-4 mb-6">
        <p className="label">
          {name} · {formatNight(night)} · {detail.house}
        </p>
        <h1 className="text-metric mt-2 font-medium">
          {listName(detail.role, detail.room)} · {phaseName(detail.phase)}
        </h1>
      </header>

      {/* One bar, the same bar as every other level: the count on the
          left, the verdict on the right. Yellow when it fell short. */}
      <div
        className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-[4px] px-5 py-4 ${
          short ? "bg-warn text-on-warn" : "bg-inset"
        }`}
      >
        <span className="text-body font-medium">
          {detail.ticked} of {detail.owed} checked off
          {open.length > 0 ? ` · ${open.length} not checked off` : ""}
        </span>
        <span className="text-label font-medium tracking-[0.08em] whitespace-nowrap uppercase">
          {!signed
            ? "not signed off"
            : open.length > 0
              ? `signed off with ${open.length} not checked off`
              : "checked off and signed off"}
        </span>
      </div>

      {/* The record of who, as its own card. It was one sentence under
          the bar, and a sign-off squeezed into a sentence reads as an
          aside rather than the accountability it is. Three rows, names
          in one column, times in another. */}
      <div className="mt-4">
        <Card
          title="Signed off"
          hint={
            signed
              ? "who checked, who signed, who verified"
              : "nobody signed this list"
          }
        >
          <dl className="grid grid-cols-[8rem_minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-3">
            <dt className="label">checked off by</dt>
            <dd className={`text-body ${by ? "" : "text-warn font-medium"}`}>
              {by || (detail.ticked > 0 ? "no initials" : "nobody")}
            </dd>
            <dd className="label tabular-nums">
              {detail.lastTickAt ? formatClock(detail.lastTickAt) : ""}
            </dd>

            <dt className="label">signed off by</dt>
            <dd
              className={`text-body ${signed ? "" : "text-warn font-medium"}`}
            >
              {signed ? detail.certifiedBy?.trim() || "no name" : "nobody"}
            </dd>
            <dd className="label tabular-nums">
              {detail.certifiedAt ? formatClock(detail.certifiedAt) : ""}
            </dd>

            <dt className="label">verified by</dt>
            <dd
              className={`text-body ${detail.verifiedBy ? "" : "text-muted"}`}
            >
              {detail.verifiedBy?.trim() || "nobody"}
              {detail.sameDevice ? (
                <span className="label block">same phone as the signature</span>
              ) : null}
            </dd>
            <dd className="label tabular-nums">
              {detail.verifiedAt ? formatClock(detail.verifiedAt) : ""}
            </dd>
          </dl>
          {detail.reopened > 0 ? (
            <p className="label text-warn mt-4">
              Signature undone {detail.reopened}{" "}
              {detail.reopened === 1 ? "time" : "times"}
            </p>
          ) : null}
        </Card>
      </div>

      {/* The lag is a fact, never an accusation. Since the offline queue
          shipped it mostly means somebody worked a cellar with no signal. */}
      {detail.pace.late ? (
        <p className="note text-muted mt-4 leading-relaxed">
          These reached the server {describeLag(detail.pace.lagMinutes)} after
          the phone says they were signed off. That is what a list done without
          signal looks like.
        </p>
      ) : null}

      {detail.pace.impossible ? (
        <p className="note text-warn mt-4 leading-relaxed">
          One item claims a time this night never contained, so that phone{"'"}s
          clock is wrong or was set by hand. Read the times on this page as the
          server{"'"}s, not the device{"'"}s.
        </p>
      ) : null}

      {/* The items, contained. What was not checked off first, in yellow;
          the rest folded under a count, because the missed work and the
          sign-off are the page and eighteen finished rows are the record. */}
      <div className="mt-4">
        <Card
          title="Items"
          hint={
            detail.items.length === 0
              ? "nothing written on this list yet"
              : open.length > 0
                ? `${open.length} not checked off · ${detail.ticked} checked off`
                : `all ${detail.ticked} checked off`
          }
        >
          {open.length > 0 ? (
            <ul className="mb-4">
              {open.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </ul>
          ) : null}

          {detail.ticked > 0 ? (
            <details className="group" open={open.length === 0}>
              <summary className="ring-card-border text-ink inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded px-4 text-label tracking-[0.08em] ring-1">
                Checked off · {detail.ticked}
                <span
                  className="text-muted transition-transform group-open:rotate-90"
                  aria-hidden
                >
                  ▸
                </span>
              </summary>
              <ul className="mt-4">
                {detail.items
                  .filter((i) => i.ticked)
                  .map((item) => (
                    <ItemRow key={item.id} item={item} />
                  ))}
              </ul>
            </details>
          ) : null}
        </Card>
      </div>
    </main>
  );
}

/**
 * One item as a row: a mark on the left, the item, and who and when in a
 * column of their own on the right. Yellow text where it was not checked
 * off. What the item asked for, and whether it arrived, on a line under.
 */
function ItemRow({ item }: { item: ItemOutcome }) {
  return (
    <li className="border-divider grid grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t py-4 first:border-t-0 first:pt-0">
      <span
        className={`label pt-0.5 ${item.ticked ? "text-muted" : "text-warn"}`}
        aria-hidden
      >
        {item.ticked ? "✓" : "·"}
      </span>
      <span
        className={`text-body leading-relaxed ${item.ticked ? "" : "text-warn font-medium"}`}
      >
        {item.title}
      </span>
      <span
        className={`label w-24 shrink-0 text-right tabular-nums ${
          item.ticked ? "" : "text-warn"
        }`}
      >
        {item.ticked
          ? `${item.initials ?? "no initials"}${
              item.at ? ` · ${formatClock(item.at)}` : ""
            }`
          : "not checked off"}
      </span>
      {item.proofWanted.length > 0 ? (
        <span
          className={`col-span-2 col-start-2 text-label tracking-[0.08em] ${
            item.ticked && item.proofGiven === 0 ? "text-warn" : "text-muted"
          }`}
        >
          {item.proofWanted.join(" and ")} asked for ·{" "}
          {item.proofGiven > 0
            ? `${item.proofGiven} attached`
            : "none attached"}
        </span>
      ) : null}
    </li>
  );
}
