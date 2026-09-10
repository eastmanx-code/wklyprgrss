import Link from "next/link";
import { redirect } from "next/navigation";

import { enrolVenue } from "./actions";

import { Card } from "@/components/Card";
import {
  ListBar,
  NightNav,
  NightStrip,
} from "@/components/checklists/Compliance";
import { RunCard } from "@/components/checklists/RunCard";
import { BackLink } from "@/components/ui";
import { T } from "@/components/Lang";
import { previousNight } from "@/lib/close-status";
import {
  nightCompliance,
  nightTrend,
  type VenueCompliance,
} from "@/lib/compliance";
import {
  currentNight,
  formatNight,
  formatNightEs,
  formatNightSpan,
  isNightOver,
  shiftNights,
} from "@/lib/night";
import { nightWindow } from "@/lib/rollup";
import { shortOf, shortOfEs } from "@/lib/short";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

type Row = {
  id: string;
  code: string;
  score: string;
  tier: "good" | "neutral" | "fail" | null;
  note: string;
  noteEs: string;
  /** The lists that failed, by name, with the fact that failed them. */
  fails: VenueCompliance["lists"];
};

/**
 * Every venue, one night. The admin's whole report, and the door into each
 * building.
 *
 * There is one fact under all of this: a list, on a night, was checked off
 * by somebody and signed off by somebody, or it was not. This screen is
 * those rows summed per venue, with the ones that failed named under each.
 * A venue's night is the same rows for one building; a list's night is one
 * row opened up. Nothing here is computed a second way.
 *
 * It used to be two screens, this one and a "close compliance" page that
 * was this one with a different heading, and every fix had to land twice.
 *
 * A leader never sees this. They have one building and the app knows which.
 */
export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ night?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "admin") redirect("/checklists");

  // The night with a verdict on it, unless one was asked for. Before the
  // roll at 4am that is still last night; after it, the one that just ended.
  const tonight = currentNight();
  const lastClosed = isNightOver(tonight) ? tonight : previousNight(tonight);
  const asked = (await searchParams).night;
  const night = asked && NIGHT.test(asked) ? asked : lastClosed;
  const over = isNightOver(night);

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
  // the other.
  const enrolled = venues.filter((v) => v.close_active);
  const candidates = venues.filter((v) => !v.close_active && v.active);

  const counts = new Map<string, number>();
  for (const row of (listRows ?? []) as { venue_id: string }[]) {
    counts.set(row.venue_id, (counts.get(row.venue_id) ?? 0) + 1);
  }

  const scoreOf = new Map<string, VenueCompliance>(
    scored.map((v) => [v.code, v]),
  );

  // One ruler, summed: lists checked off and signed off, over lists on the
  // night. The fails are the rest, and they are named below.
  const ranVenues = scored.filter((v) => v.ran);
  const lists = ranVenues.reduce((n, v) => n + v.total, 0);
  const done = ranVenues.reduce((n, v) => n + v.done, 0);
  const short = ranVenues.reduce((n, v) => n + v.notSigned + v.notDone, 0);

  const lineFor = (venue: (typeof venues)[number]): Row => {
    const row = scoreOf.get(venue.code);
    return {
      id: venue.id,
      code: venue.code,
      // The count, not a conversion. "8/10" beside "3 fails" on fifteen
      // lists made no sense; "12/15 · 3 fails" is the same fact, readable.
      score: row && row.ran ? `${row.done}/${row.total}` : "—",
      tier: row && row.ran ? row.tier : null,
      // Said twice, because the row is built on the server and the language
      // is on the device. The same words the venue's night opens with.
      note: !row
        ? "No lists yet"
        : !row.ran
          ? over
            ? "nothing recorded"
            : "nothing yet"
          : shortOf(row),
      noteEs: !row
        ? "Todavía sin listas"
        : !row.ran
          ? over
            ? "sin registro"
            : "todavía nada"
          : shortOfEs(row),
      fails: row && row.ran ? row.lists.filter((l) => l.state === "fail") : [],
    };
  };

  // Worst first. Knowing which building needs you is what the order is for.
  const TIER = { fail: 0, neutral: 1, good: 2 } as const;
  const running = enrolled
    .filter((v) => (counts.get(v.id) ?? 0) > 0)
    .map(lineFor)
    .sort(
      (a, b) =>
        (a.tier ? TIER[a.tier] : 3) - (b.tier ? TIER[b.tier] : 3) ||
        a.code.localeCompare(b.code),
    );
  const idle = enrolled
    .filter((v) => (counts.get(v.id) ?? 0) === 0)
    .map(lineFor);

  // The run. The window reaches tonight whichever night is open, so the
  // strip keeps every square and there is always a way forward; the chart
  // ends at the night being read.
  const window = nightWindow(30, night);
  const span: string[] = [...window];
  for (let n = shiftNights(night, 1); n <= tonight && span.length < 90; ) {
    span.push(n);
    n = shiftNights(n, 1);
  }
  const all = await nightTrend(span);
  // Only the nights something ran. Charted over the whole window, the line
  // began with three flat weeks at nought that were not bad nights, they were
  // nights before the venue had the app.
  const ran = all.filter((t) => t.ran && t.night <= night);
  const points = ran.map((t) => ({
    weekStart: t.night,
    percent: t.done,
    approvedPercent: t.done,
  }));
  // Two buckets, no legend: every list checked off and signed off, or not.
  const strip = all
    .filter((t) => t.ran)
    .map((t) => ({
      night: t.night,
      state:
        t.night > lastClosed
          ? ("open" as const)
          : t.done >= 100
            ? ("complete" as const)
            : ("short" as const),
    }));
  // Best and worst only when there is something to compare against.
  const ranked = [...ranVenues].sort((a, b) => b.score - a.score);
  const best = ranked.length > 1 ? ranked[0] : null;
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  return (
    <main>
      <BackLink href="/home">
        <T en="Home" es="Inicio" />
      </BackLink>

      {/* The night being read, and the way to the ones either side of it,
          in the header where a reader looks first for which night this is. */}
      <header className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="label">
            <T en={formatNightSpan(night)} es={formatNightEs(night)} />
            {over ? null : (
              <>
                {" · "}
                <T en="in progress" es="en curso" />
              </>
            )}
          </p>
          <h1 className="text-metric mt-2 tracking-normal">
            <T en="Locations" es="Lugares" />
          </h1>
        </div>
        <NightNav night={night} base="/checklists/locations" />
      </header>

      <div>
        <Card
          /* "Last night" only when it is; browsing back, the card is
             named for the night it shows. */
          title={
            !over ? (
              <T en="Tonight" es="Esta noche" />
            ) : night === lastClosed ? (
              <T en="Last night" es="Anoche" />
            ) : (
              <T en={formatNight(night)} es={formatNightEs(night)} />
            )
          }
          hint={
            lists === 0 ? (
              <T en="nothing running yet" es="todavía no hay nada corriendo" />
            ) : (
              /* The counts that make the score, so 8/10 beside 3 fails
                 reconciles at a glance: twelve of fifteen, three short,
                 eight in ten. */
              <T
                en={[
                  `${done} of ${lists} lists checked off and signed off`,
                  short > 0
                    ? `${short} ${short === 1 ? "fail" : "fails"}`
                    : over
                      ? "no fails"
                      : "no fails so far",
                  ...(over ? [] : ["in progress"]),
                ].join(" · ")}
                es={[
                  `${done} de ${lists} listas marcadas y firmadas`,
                  short > 0
                    ? `${short} ${short === 1 ? "falla" : "fallas"}`
                    : over
                      ? "sin fallas"
                      : "sin fallas hasta ahora",
                  ...(over ? [] : ["en curso"]),
                ].join(" · ")}
              />
            )
          }
        >
          {/* The month, tappable, inside the card it belongs to. One
              square per night the group ran; the arrows in the foot step
              one night at a time. */}
          {strip.length > 0 ? (
            <div className="mb-4">
              <NightStrip
                nights={strip}
                current={night}
                base="/checklists/locations"
              />
            </div>
          ) : null}

          {running.length === 0 && idle.length === 0 ? (
            <p className="note text-muted leading-relaxed">
              <T
                en="No venue is on the checklists yet. Add one below and write its first list."
                es="Todavía no hay ningún lugar en las listas. Agrega uno abajo y escribe su primera lista."
              />
            </p>
          ) : (
            <ul className="space-y-6">
              {[...running, ...idle].map((row) => (
                <VenueBar key={row.id} row={row} night={night} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* The run, under the night. What failed is the reason to open the
          page; how the month is going is the second thing. */}
      {lists > 0 && ran.length >= 2 ? (
        <div className="mt-6">
          <RunCard
            done={done}
            total={lists}
            nights={points.length}
            points={points}
            failed={short > 0}
            labelLeft={formatNight(ran[0].night)}
            labelRight={`${formatNight(night)}${over ? "" : " · so far"}`}
            over={over}
            best={best}
            worst={worst}
          />
        </div>
      ) : null}

      {/* Closed, one small button. Open, the same line is the heading with
          its own button to close it, and each venue's Add is a button with
          a boundary of its own. Every action gets a shape and space around
          it; "ADD A LOCATION HIDE" read as one sentence. */}
      {candidates.length > 0 ? (
        <details className="group mt-6">
          <summary className="ring-card-border text-ink inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded px-4 text-label tracking-[0.08em] ring-1 group-open:flex group-open:w-full group-open:justify-between group-open:px-0 group-open:text-title group-open:tracking-normal group-open:ring-0">
            <span>
              <span className="group-open:hidden">+ </span>
              <T en="Add a location" es="Agregar un lugar" />
            </span>
            <span className="ring-card-border hidden min-h-11 items-center rounded px-4 text-label tracking-[0.08em] ring-1 group-open:inline-flex">
              <T en="Hide" es="Ocultar" /> ↑
            </span>
          </summary>
          <div className="panel mt-3">
            <p className="note text-muted leading-relaxed">
              <T
                en="Adding a venue puts it on the checklists and opens it, ready for its first list. It has no bearing on the weekly walkthrough."
                es="Agregar un lugar lo pone en las listas y lo abre, listo para su primera lista. No afecta el recorrido semanal."
              />
            </p>
            <ul className="mt-4 space-y-3">
              {candidates.map((venue) => (
                <li
                  key={venue.id}
                  className="bg-inset flex items-center justify-between gap-4 rounded-[4px] px-4 py-2"
                >
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-3">
                    <span className="text-body w-16 shrink-0 tracking-[0.08em]">
                      {venue.code}
                    </span>
                    {venue.name && venue.name !== venue.code ? (
                      <span className="label">{venue.name}</span>
                    ) : null}
                  </span>
                  <form action={enrolVenue}>
                    <input type="hidden" name="venueId" value={venue.id} />
                    <button
                      type="submit"
                      className="ring-card-border text-ink hover:bg-hover inline-flex min-h-11 items-center rounded px-3 text-label tracking-[0.08em] ring-1"
                    >
                      + <T en="Add" es="Agregar" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </main>
  );
}

/**
 * One venue's night as a bar, in the weekly board's proportions, with the
 * lists that failed under it.
 *
 * One bar, one door: it opens the venue's night, because that is what this
 * page is for. Two doors on one bar, "do checklists" beside "3 fails", was
 * two boxes with a seam between them and a reader could not tell which was
 * the bar. Doing the checklists is a quiet line under the venue instead.
 */
function VenueBar({ row, night }: { row: Row; night: string }) {
  const failed = row.tier === "fail";
  const shell = failed
    ? "bg-warn text-on-warn hover:bg-warn/90"
    : "bg-inset hover:ring-muted/30 hover:ring-1 hover:ring-inset";
  return (
    <li>
      <Link
        href={
          row.tier
            ? `/checklists/compliance/${row.code}?night=${night}`
            : `/checklists/enter/${row.id}`
        }
        className={`flex flex-wrap items-baseline gap-x-3 rounded-[4px] px-4 py-3 ${shell}`}
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
          className={`label ml-auto flex items-center gap-2 whitespace-nowrap ${
            failed ? "text-on-warn" : ""
          }`}
        >
          <T en={row.note} es={row.noteEs} />
          <span aria-hidden>→</span>
        </span>
      </Link>
      {/* The same left edge as the venue's bar. */}
      {row.fails.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {row.fails.map((list) => (
            <ListBar
              key={list.row.checklist_id}
              list={list}
              code={row.code}
              night={night}
              full
            />
          ))}
        </ul>
      ) : null}
      <p className="mt-2">
        <Link
          href={`/checklists/enter/${row.id}`}
          className="label hover:text-ink inline-flex min-h-11 items-center gap-2 px-4"
        >
          <T en="Do the checklists" es="Hacer las listas" />
          <span aria-hidden>→</span>
        </Link>
      </p>
    </li>
  );
}
