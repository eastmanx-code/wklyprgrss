import Link from "next/link";
import { redirect } from "next/navigation";

import { CloseBar } from "@/components/close/CloseBar";
import { BackLink } from "@/components/ui";
import { previousNight } from "@/lib/close-status";
import { nightCompliance } from "@/lib/compliance";
import { currentNight, formatNight, isNightOver } from "@/lib/night";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * How the buildings did, and which one you want.
 *
 * Compliance is not a third product sitting beside the checklists, it is the
 * report on them, so it leads this page rather than owning a card of its own
 * on the way in. The rollup at the top is last night across the group; every
 * venue below carries its own score for the same night, so the list you pick
 * a location from is also the list that says which location needs you.
 *
 * A leader never sees this. They have one building and the app already knows
 * which.
 */
export default async function LocationsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "admin") redirect("/close");

  // The night with a verdict on it. Before the roll at 4am that is still last
  // night; after it, the one that just ended.
  const tonight = currentNight();
  const night = isNightOver(tonight) ? tonight : previousNight(tonight);

  const [{ data: venueRows }, { data: listRows }, scored] = await Promise.all([
    db().from("venues").select("id, code, name").order("code"),
    db().from("close_checklists").select("venue_id").eq("active", true),
    nightCompliance(night),
  ]);

  const venues = (venueRows ?? []) as {
    id: string;
    code: string;
    name: string | null;
  }[];

  const counts = new Map<string, number>();
  for (const row of (listRows ?? []) as { venue_id: string }[]) {
    counts.set(row.venue_id, (counts.get(row.venue_id) ?? 0) + 1);
  }

  const scoreOf = new Map(scored.map((v) => [v.code, v]));

  const failedLists = scored.reduce((n, v) => n + v.failed, 0);
  const failingVenues = scored.filter((v) => v.tier === "fail").length;
  const signed = scored.reduce((n, v) => n + v.listsSigned, 0);
  const lists = scored.reduce((n, v) => n + v.listsTotal, 0);

  const nameOf = (v: { code: string; name: string | null }) =>
    v.name && v.name !== v.code ? v.name : v.code;

  /** Running a list, worst night first. Then everybody else. */
  const withLists = venues
    .filter((v) => (counts.get(v.id) ?? 0) > 0)
    .sort((a, b) => {
      const order = { fail: 0, neutral: 1, good: 2 } as const;
      const sa = scoreOf.get(a.code);
      const sb = scoreOf.get(b.code);
      if (!sa || !sb) return a.code.localeCompare(b.code);
      return (
        order[sa.tier] - order[sb.tier] ||
        sa.score - sb.score ||
        a.code.localeCompare(b.code)
      );
    });
  const without = venues.filter((v) => (counts.get(v.id) ?? 0) === 0);

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <BackLink href="/home">Home</BackLink>

      <header className="mt-4 mb-5">
        <p className="label">Checklists · {formatNight(night)}</p>
        <h1 className="text-metric mt-2 font-medium">Last night</h1>
      </header>

      {/* The rollup, above the picker. Whoever opens this at nine in the
          morning wants the verdict before the menu, and a report you have to
          go and ask for is a report nobody reads. */}
      {lists === 0 ? (
        <section className="panel-quiet mb-6">
          <h2 className="card-title">Nothing to report</h2>
          <p className="note text-muted mt-2 leading-relaxed">
            No venue was running a list on {formatNight(night)}. This fills in
            from the first night somebody signs one.
          </p>
        </section>
      ) : (
        <section className="panel border-warn/30 mb-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-metric tabular-nums">
                {signed}
                <span className="text-muted">/{lists}</span>
              </p>
              <p className="label mt-1">Lists signed</p>
            </div>
            <div>
              <p
                className={`text-metric tabular-nums ${
                  failedLists > 0 ? "text-warn" : ""
                }`}
              >
                {failedLists}
              </p>
              <p className="label mt-1">Lists failed</p>
            </div>
            <div>
              <p
                className={`text-metric tabular-nums ${
                  failingVenues > 0 ? "text-warn" : ""
                }`}
              >
                {failingVenues}
              </p>
              <p className="label mt-1">Venues failing</p>
            </div>
          </div>

          {/* Wraps as two lines rather than two ragged halves of one. At 390
              the hint could not sit beside the label and broke mid-phrase, so
              it gets its own line and the whole thing stays one target. */}
          <Link
            href={`/close/compliance?night=${night}`}
            className="ring-card-border text-ink mt-4 flex min-h-11 flex-col justify-center gap-0.5 rounded px-4 py-2 text-label tracking-[0.08em] ring-1 sm:inline-flex sm:flex-row sm:items-center sm:gap-2"
          >
            <span>Full report</span>
            <span className="text-muted">who signed, what was left</span>
          </Link>
        </section>
      )}

      <h2 className="card-title">Pick a location</h2>

      {withLists.length === 0 ? (
        <p className="note text-muted mt-2 leading-relaxed">
          No venue has a checklist on it. Pick one below and start the first
          list.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {withLists.map((venue) => {
            const row = scoreOf.get(venue.code);
            return (
              <li key={venue.id}>
                <VenueLink
                  id={venue.id}
                  name={nameOf(venue)}
                  code={venue.code}
                  failed={row?.tier === "fail"}
                  note={
                    row
                      ? `${row.score}/10 · ${row.listsSigned} of ${row.listsTotal} signed`
                      : `${counts.get(venue.id) ?? 0} lists`
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* Still listed, still openable. A venue with no lists is where somebody
          goes to write the first one, so hiding it would hide the only way to
          start. Quiet, because it is not where the work is. */}
      {without.length > 0 ? (
        <section className="mt-6">
          <h2 className="card-title">No lists yet</h2>
          <ul className="mt-3 space-y-2">
            {without.map((venue) => (
              <li key={venue.id}>
                <VenueLink
                  id={venue.id}
                  name={nameOf(venue)}
                  code={venue.code}
                  failed={false}
                  note="Start one"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <CloseBar back="/home" />
    </main>
  );
}

function VenueLink({
  id,
  name,
  code,
  note,
  failed,
}: {
  id: string;
  name: string;
  code: string;
  note: string;
  failed: boolean;
}) {
  return (
    <Link
      href={`/close/enter/${id}`}
      className={`flex min-h-14 flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[4px] px-4 py-3 ${
        failed
          ? "bg-warn text-on-warn hover:bg-warn/90"
          : "bg-inset hover:ring-muted/30 hover:ring-1 hover:ring-inset"
      }`}
    >
      <span className="text-body tracking-[0.06em]">{name}</span>
      {name === code ? null : (
        <span
          className={`text-label tracking-[0.08em] ${
            failed ? "text-on-warn" : "text-muted"
          }`}
        >
          {code}
        </span>
      )}
      <span
        className={`ml-auto text-label tabular-nums tracking-[0.08em] ${
          failed ? "text-on-warn" : "text-muted"
        }`}
      >
        {note}
      </span>
    </Link>
  );
}
