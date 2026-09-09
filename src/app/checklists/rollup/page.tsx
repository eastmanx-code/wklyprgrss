import { redirect } from "next/navigation";

import { MissedList } from "@/components/checklists/MissedList";
import { BackLink } from "@/components/ui";
import { formatNight } from "@/lib/night";
import { groupRollup, venueRollup } from "@/lib/rollup";
import { listName } from "@/lib/slug";
import { closeVenueId, closeVenueName } from "@/lib/close-venue";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Two buckets, no legend. Quiet grey for a night where every list was done
 * and signed, yellow for a night where something was not. Twenty-four blocks
 * shouting "fine" would drown the six that are the point of the page, and
 * three shades needed a key to read.
 */
const NIGHT_STATE: Record<string, string> = {
  c: "bg-ink/20",
  m: "bg-warn",
};

/** Lists checked off and signed off, out of ten. The same score everywhere. */
function scoreOf(done: number, of: number): number {
  return of === 0 ? 0 : Math.round((done / of) * 10);
}

/**
 * A bar with the score on the end of it. Coloured by the same bands the
 * tiers use, fail at five and under and neutral at six or seven, so a bar
 * here and a row on the group screen agree about what yellow means.
 */
function Bar({ done, of }: { done: number; of: number }) {
  const pct = of === 0 ? 0 : Math.round((done / of) * 100);
  const score = scoreOf(done, of);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <span className="bg-inset h-1.5 min-w-0 flex-1 rounded-[1px]">
        <span
          className={`block h-full rounded-[1px] ${
            score <= 5 ? "bg-warn" : score <= 7 ? "bg-warn/40" : "bg-ink/30"
          }`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="label w-8 shrink-0 text-right tabular-nums">
        {score}/10
      </span>
    </span>
  );
}

/**
 * The report the whole thing is for: not whether tonight is done, but what
 * keeps not getting done.
 *
 * Every figure is read from signed nights. It was once built against sample
 * data so the shape could be argued with before anything was stored, and that
 * turned out to be the worse of the two failures: a fabricated month that
 * reads as real teaches a manager that the numbers here cannot be trusted,
 * which is a lesson that outlives the sample. A venue with nothing recorded
 * now gets one honest line instead.
 */
export default async function RollupPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const venue = await closeVenueId(session);
  const venueName = venue ? await closeVenueName(venue) : null;

  const real = venue ? await venueRollup(venue) : null;
  const group = real ? await groupRollup() : null;

  /**
   * Nothing recorded, nothing reported.
   *
   * This page used to fill itself with invented figures so a venue in its
   * first week could see the shape of the report. What it actually produced
   * was a confident month of tracking for lists nobody had ever signed, with
   * item names and hit rates a reader had no way to tell from real ones.
   * An empty report says the true thing and says it in one line.
   */
  if (!real) {
    return (
      <main className="close-flow mx-auto max-w-2xl pb-4">
        <BackLink href="/checklists">All checklists</BackLink>
        <header className="mt-4 mb-5">
          <p className="label">{venueName ?? "This venue"}</p>
          <h1 className="mt-2 text-metric font-medium">
            What&apos;s getting missed
          </h1>
        </header>
        <section className="panel-quiet">
          <p className="note text-muted leading-relaxed">
            Nothing signed off yet. The report starts the night somebody signs a
            list and builds from there: what got left open, by role, by night
            and by venue.
          </p>
        </section>
      </main>
    );
  }

  const nights = real.nights;
  const strip = real.strip;
  const latest = real.latest;
  const missed = real.missed;
  const byRole = real.byRole;
  const certifiers = real.certifiers;
  const venues = group ?? [];

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <BackLink href="/checklists">All checklists</BackLink>

      <header className="mt-4 mb-5">
        {/* Named from the row, not typed in. It read "Night Hawk" on every
            venue's report, including the ones that are not Night Hawk. */}
        <p className="label">
          {venueName ? `${venueName} · ` : ""}
          {nights} nights so far
        </p>
        <h1 className="mt-2 text-metric font-medium">
          What&apos;s getting missed
        </h1>
      </header>

      {/* Pinned. Every figure below it is a way of asking the same question,
          and the answer is easier to hold onto when the month is still on
          screen while you read them — the two yellow squares are what the rest
          of the page is explaining. Laid out tight and full-bleed, because a
          header that costs half a phone screen is not a header. */}
      <section className="border-card-border bg-paper sticky top-0 z-30 -mx-4 mb-4 border-b px-4 py-3">
        <div className="flex items-baseline justify-between gap-4">
          <p className="label">Score · checked off and signed off</p>
          <p className="text-title tabular-nums tracking-[0.08em]">
            {scoreOf(real.done, real.of)}/10
          </p>
        </div>
        <div
          className="mt-2.5 grid max-w-[22rem] grid-cols-10 gap-1"
          aria-hidden
        >
          {strip.split("").map((code, index) => (
            <span
              key={index}
              className={`aspect-square rounded-[2px] ${NIGHT_STATE[code] ?? "bg-inset"}`}
            />
          ))}
        </div>
        {/* The answer to "which ones", on the page, so nobody has to ask.
            Two lines, because they are two different conversations. */}
        {latest && latest.notSigned.length > 0 ? (
          <p className="note text-warn mt-3">
            Not signed off {formatNight(latest.night)}:{" "}
            {latest.notSigned
              .map((l) => `${listName(l.role, l.room)} ${l.phase}`)
              .join(" · ")}
          </p>
        ) : null}
        {latest && latest.notDone.length > 0 ? (
          <p className="note text-warn mt-1">
            Not checked off {formatNight(latest.night)}:{" "}
            {latest.notDone
              .map((l) => `${listName(l.role, l.room)} ${l.phase}`)
              .join(" · ")}
          </p>
        ) : null}
        {latest &&
        latest.notSigned.length === 0 &&
        latest.notDone.length === 0 ? (
          <p className="note text-muted mt-3">
            Every list checked off and signed off {formatNight(latest.night)}.
          </p>
        ) : null}
      </section>

      <div className="space-y-4">
        {/* The point of the whole exercise. */}
        <section className="panel border-warn/30">
          <p className="label">Left undone most often</p>
          <div className="mt-3">
            <MissedList rows={missed.slice(0, 12)} />
          </div>
          {missed.length === 0 ? (
            <p className="note text-muted mt-1">
              Nothing left undone in the last {nights} nights.
            </p>
          ) : null}
        </section>

        <section className="panel">
          <p className="label">Each position</p>
          <ul className="mt-3 space-y-3">
            {byRole.map((row) => (
              <li key={row.role} className="flex items-center gap-3">
                <span className="label w-24 shrink-0">{row.role}</span>
                <Bar done={row.done} of={row.of} />
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <p className="label">Who signs</p>
          <ul className="mt-3">
            {certifiers.length === 0 ? (
              <li className="note text-muted">Nobody has signed a list yet.</li>
            ) : null}
            {certifiers.map((row) => (
              <li
                key={row.who}
                className="border-divider flex items-baseline justify-between gap-4 border-t py-2.5 first:border-t-0"
              >
                <span className="text-body">{row.who}</span>
                <span className="label tabular-nums">
                  {row.nights} {row.nights === 1 ? "list" : "lists"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* One level up: the same question asked of the whole group. */}
        <section className="panel">
          <p className="label">Across the group</p>
          <p className="note text-muted mt-2">
            {group
              ? `The same report, asked of ${venues.length} ${venues.length === 1 ? "venue" : "venues"} rather than one.`
              : "The same report, asked of 26 venues rather than one."}
          </p>
          <ul className="mt-3 space-y-3">
            {venues.map((row) => (
              <li key={row.code} className="flex items-center gap-3">
                <span className="label w-16 shrink-0">{row.code}</span>
                <Bar done={row.done} of={row.of} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="label mt-6">Counted over the last {nights} nights.</p>
    </main>
  );
}
