import Link from "next/link";
import { redirect } from "next/navigation";

import { enrolVenue } from "./actions";

import { Card } from "@/components/Card";
import { RunCard } from "@/components/close/RunCard";
import { CloseBar } from "@/components/close/CloseBar";
import { BackLink } from "@/components/ui";
import { previousNight } from "@/lib/close-status";
import {
  nightCompliance,
  nightTrend,
  type VenueCompliance,
} from "@/lib/compliance";
import { currentNight, formatNight, isNightOver } from "@/lib/night";
import { nightWindow } from "@/lib/rollup";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  code: string;
  score: string;
  tier: "good" | "neutral" | "fail" | null;
  note: string;
};

/**
 * How the buildings did last night, and which one you want.
 *
 * Written in the weekly board's language on purpose. It is the same company,
 * the same three tiers, the same lime bar for a fail, and somebody who has
 * read "Everyone's progress" already knows how to read this: a headline, then
 * groups worst first, then a bar per row with the number in a fixed column
 * down the left. A second product that invents its own layout is a second
 * product to learn.
 *
 * Compliance is not a separate destination either. It is the report on the
 * checklists, so it leads the page you pick a location from: the picker is
 * the report.
 *
 * A leader never sees this. They have one building and the app knows which.
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
    db()
      .from("venues")
      .select("id, code, name, active, close_active")
      .order("code"),
    db().from("close_checklists").select("venue_id").eq("active", true),
    nightCompliance(night),
  ]);

  const venues = (venueRows ?? []) as {
    id: string;
    code: string;
    name: string | null;
    active: boolean;
    close_active: boolean;
  }[];

  // In the programme, and the ones that could be. Membership is its own flag:
  // `active` governs the weekly walkthrough and a venue can run one without
  // the other. Before this existed the screen had to list the whole table,
  // which put twenty-six rows of "no lists yet" under the one venue running
  // them, and half of those were venues that had closed or never opened.
  const enrolled = venues.filter((v) => v.close_active);
  const candidates = venues.filter((v) => !v.close_active && v.active);

  const counts = new Map<string, number>();
  for (const row of (listRows ?? []) as { venue_id: string }[]) {
    counts.set(row.venue_id, (counts.get(row.venue_id) ?? 0) + 1);
  }

  const scoreOf = new Map<string, VenueCompliance>(
    scored.map((v) => [v.code, v]),
  );

  const failedLists = scored.reduce((n, v) => n + v.failed, 0);
  const signed = scored.reduce((n, v) => n + v.listsSigned, 0);
  const lists = scored.reduce((n, v) => n + v.listsTotal, 0);

  const lineFor = (venue: (typeof venues)[number]): Row => {
    const row = scoreOf.get(venue.code);
    return {
      id: venue.id,
      code: venue.code,
      score: row ? `${row.score}/10` : "—",
      tier: row?.tier ?? null,
      note: row
        ? `${row.listsSigned} of ${row.listsTotal} signed${
            row.failed > 0
              ? ` · ${row.failed} failed`
              : row.owed > row.ticked
                ? ` · ${row.owed - row.ticked} open`
                : ""
          }`
        : "No lists yet",
    };
  };

  const running = enrolled
    .filter((v) => (counts.get(v.id) ?? 0) > 0)
    .map(lineFor);
  const idle = enrolled
    .filter((v) => (counts.get(v.id) ?? 0) === 0)
    .map(lineFor);

  const of = (tier: "good" | "neutral" | "fail") =>
    running
      .filter((r) => r.tier === tier)
      .sort((a, b) => a.code.localeCompare(b.code));

  const fails = of("fail");

  // The same run the full report draws, on the screen a manager lands on.
  const window = nightWindow(30, night);
  const trend = await nightTrend(window);
  const points = trend.map((t) => ({
    weekStart: t.night,
    percent: t.ticked,
    approvedPercent: t.signed,
  }));
  const ticked = scored.reduce((n, v) => n + v.ticked, 0);
  const owed = scored.reduce((n, v) => n + v.owed, 0);
  // Only a comparison when there is something to compare against.
  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const best = ranked.length > 1 ? ranked[0] : null;
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  const headline =
    lists === 0
      ? "No lists ran"
      : failedLists > 0
        ? `${failedLists} ${failedLists === 1 ? "list" : "lists"} failed`
        : "Nothing failed";

  return (
    <main>
      <BackLink href="/home">Home</BackLink>

      {/* The board's own header shape: the period, then the answer. */}
      <header className="mt-4 mb-6">
        <p className="label">{formatNight(night)}</p>
        <h1 className="text-metric mt-2 tracking-normal">Last night</h1>
      </header>

      {lists > 0 ? (
        <div className="mb-4">
          <RunCard
            ticked={ticked}
            owed={owed}
            nights={window.length}
            points={points}
            failed={failedLists > 0}
            labelLeft={formatNight(window[0])}
            labelRight={formatNight(night)}
            best={best}
            worst={worst}
          />
        </div>
      ) : null}

      <Card
        title="Close checklists"
        hint={[
          `${lists} lists · ${signed} signed`,
          "good 8 to 10 · neutral 6 or 7 · fail 5 or under",
        ].join(" · ")}
      >
        {/* The answer, before the evidence. Same as the weekly card. */}
        <p
          className={`text-metric leading-[1.15] ${
            failedLists > 0 ? "text-warn" : "text-ink"
          }`}
        >
          {headline}
        </p>

        {lists === 0 ? (
          <p className="note text-muted mt-4 leading-relaxed">
            No venue was running a list on {formatNight(night)}. This fills in
            from the first night somebody signs one.
          </p>
        ) : (
          <Link
            href={`/close/compliance?night=${night}`}
            className="ring-card-border text-ink mt-6 inline-flex min-h-11 items-center gap-2 self-start rounded px-4 text-label tracking-[0.08em] ring-1"
          >
            Full report
            <span className="text-muted">who signed, what was left</span>
          </Link>
        )}

        <Tier title="Fail" rows={fails} />
        <Tier title="Neutral" rows={of("neutral")} />
        <Tier title="Good" rows={of("good")} />
        {/* Not a tier. A venue with no list is not failing the programme, it
            is not in it, and it is listed because that is where somebody goes
            to write the first one. */}
        <Tier title="In the programme, nothing written" rows={idle} />
      </Card>

      {/* Folded away. Adding a building is a thing you do once, and twenty
          rows of it above the one venue you are actually here for is the page
          reading as a directory rather than a report. */}
      {candidates.length > 0 ? (
        <details className="panel mt-4">
          <summary className="card-title cursor-pointer list-none">
            Add a location
            <span className="label ml-3">
              {candidates.length} not in the close yet
            </span>
          </summary>
          <p className="note text-muted mt-3 leading-relaxed">
            Adding a venue puts it in the nightly close and opens it, ready for
            its first list. It has no bearing on the weekly walkthrough.
          </p>
          <ul className="mt-4 space-y-2">
            {candidates.map((venue) => (
              <li key={venue.id}>
                <form action={enrolVenue}>
                  <input type="hidden" name="venueId" value={venue.id} />
                  <button
                    type="submit"
                    className="bg-inset hover:ring-muted/30 flex min-h-11 w-full flex-wrap items-baseline gap-x-3 rounded-[4px] px-3 py-2 text-left hover:ring-1 hover:ring-inset"
                  >
                    <span className="text-body w-16 shrink-0 tracking-[0.08em]">
                      {venue.code}
                    </span>
                    {venue.name && venue.name !== venue.code ? (
                      <span className="label">{venue.name}</span>
                    ) : null}
                    <span className="label ml-auto shrink-0">Add</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <CloseBar back="/home" />
    </main>
  );
}

/** A group heading and its rows, or nothing when the group is empty. */
function Tier({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="label border-divider border-t pt-4">
        {title} · {rows.length}
      </p>
      <ul className="-mx-3 mt-2 space-y-[2px]">
        {rows.map((row) => (
          <VenueBar key={row.id} row={row} />
        ))}
      </ul>
    </div>
  );
}

/**
 * One venue's night as a bar, in the weekly board's proportions.
 *
 * Same fixed columns, so the scores line up down the left however long the
 * names are, and the same one height whatever it scored. Order carries
 * severity; the bar does not grow to shout.
 */
function VenueBar({ row }: { row: Row }) {
  const failed = row.tier === "fail";
  return (
    <li>
      <Link
        href={`/close/enter/${row.id}`}
        className={`bg-inset flex flex-wrap items-baseline gap-x-3 rounded-[4px] px-3 py-3 ${
          failed
            ? "bg-warn text-on-warn hover:bg-warn/90"
            : "hover:ring-muted/30 hover:ring-1 hover:ring-inset"
        }`}
      >
        <span
          className={`text-title w-16 shrink-0 tracking-[0.08em] ${
            failed ? "text-on-warn" : "text-ink"
          }`}
        >
          {row.code}
        </span>
        <span
          className={`text-title w-16 shrink-0 tracking-normal tabular-nums ${
            failed
              ? "text-on-warn"
              : row.tier === "neutral"
                ? "text-warn"
                : row.tier === "good"
                  ? "text-ink"
                  : "text-muted"
          }`}
        >
          {row.score}
        </span>
        <span
          className={`label ml-auto shrink-0 text-right ${
            failed ? "text-on-warn" : ""
          }`}
        >
          {row.note}
        </span>
      </Link>
    </li>
  );
}
