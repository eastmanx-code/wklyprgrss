import { redirect } from "next/navigation";

import { MissedList } from "@/components/close/MissedList";
import { BackLink } from "@/components/ui";
import { groupRollup, venueRollup } from "@/lib/rollup";
import { closeVenueId, closeVenueName } from "@/lib/close-venue";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * A severity ramp, not a good/bad flag.
 *
 * The grid read backwards: a complete night was a solid white block and a
 * night nobody certified was a small yellow one, so twenty-four blocks
 * shouting "fine" drowned the six that were the point of the page. Quiet grey
 * for the nights that went well, and one hue rising through it for the two
 * that didn't — soft where a night was signed with gaps, full where nobody
 * signed at all.
 */
const NIGHT_STATE: Record<string, string> = {
  c: "bg-ink/20",
  g: "bg-warn/40",
  m: "bg-warn",
};

function Bar({ done, of }: { done: number; of: number }) {
  const pct = Math.round((done / of) * 100);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <span className="bg-inset h-1.5 min-w-0 flex-1 rounded-[1px]">
        <span
          className={`block h-full rounded-[1px] ${
            pct < 75 ? "bg-warn" : pct < 90 ? "bg-warn/40" : "bg-ink/30"
          }`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="label tabular-nums shrink-0">{pct}%</span>
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
        <BackLink href="/close">All checklists</BackLink>
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
  const certified = real.certified;
  const missed = real.missed;
  const byRole = real.byRole;
  const certifiers = real.certifiers;
  const venues = group ?? [];

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <BackLink href="/close">All checklists</BackLink>

      <header className="mt-4 mb-5">
        {/* Named from the row, not typed in. It read "Night Hawk" on every
            venue's report, including the ones that are not Night Hawk. */}
        <p className="label">
          {venueName ? `${venueName} · ` : ""}last {nights} nights
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
          <p className="label">Nights certified</p>
          <p className="text-title tabular-nums tracking-[0.08em]">
            {certified} of {nights}
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
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
          <span className="label flex items-center gap-2">
            <span className="bg-ink/20 size-3 rounded-[2px]" />
            All complete
          </span>
          <span className="label flex items-center gap-2">
            <span className="bg-warn/40 size-3 rounded-[2px]" />
            Signed with gaps
          </span>
          <span className="label flex items-center gap-2">
            <span className="bg-warn size-3 rounded-[2px]" />
            Never certified
          </span>
        </div>
      </section>

      <div className="space-y-4">
        {/* The point of the whole exercise. */}
        <section className="panel border-warn/30">
          <p className="label">What keeps getting left open</p>
          <div className="mt-3">
            <MissedList rows={missed.slice(0, 12)} />
          </div>
          {missed.length === 0 ? (
            <p className="note text-muted mt-1">
              Nothing has been left open in the window. That is the whole goal,
              and it is rare enough to be worth checking the list is being used.
            </p>
          ) : (
            <p className="label mt-3">
              Ranked by how many nights the item finished with no tick against
              it.
            </p>
          )}
        </section>

        <section className="panel">
          <p className="label">By role · items completed</p>
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
          <p className="label">Certified by</p>
          <ul className="mt-3">
            {certifiers.length === 0 ? (
              <li className="note text-muted">
                Nobody has signed a night in this window.
              </li>
            ) : null}
            {certifiers.map((row) => (
              <li
                key={row.who}
                className="border-divider flex items-baseline justify-between gap-4 border-t py-2.5 first:border-t-0"
              >
                <span className="text-body">{row.who}</span>
                <span className="label tabular-nums">{row.nights} nights</span>
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

      <p className="label mt-6">
        {real
          ? `Counted over the last ${nights} nights. An item is open on a night with no tick against it, and every night in the window counts — including the ones nobody opened the list.`
          : "Every figure on this page is invented, to show the shape of the report. It becomes real the night the first checklist is stored."}
      </p>
    </main>
  );
}
