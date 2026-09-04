import Link from "next/link";
import { redirect } from "next/navigation";

import { CloseBar } from "@/components/close/CloseBar";
import { NightNav, ScoreBar } from "@/components/close/Compliance";
import { nightCompliance } from "@/lib/compliance";
import { closeVenueId } from "@/lib/close-venue";
import { currentNight, formatNight, isNightOver } from "@/lib/night";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Which lists failed last night, and who signed the ones that did.
 *
 * The rollup is a month of pattern and `/close` is tonight's clipboard. This
 * is the third question and the one a manager actually opens the app with:
 * one screen, worst venue first, and two taps to the item somebody skipped.
 *
 * Nothing here is modelled. Every figure is a count off rows that already
 * exist, so the same night recomputes to the same verdict tomorrow — which is
 * the only property that makes it a record rather than an opinion.
 */
export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ night?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const asked = (await searchParams).night;
  const night = asked && NIGHT.test(asked) ? asked : currentNight();
  const over = isNightOver(night);

  let venues = await nightCompliance(night);

  /**
   * A leader sees their own venue and no one else's.
   *
   * The weekly board is published to everybody on purpose, but that board is
   * a score per house. This one names the person who signed and the items
   * they left, at every venue in the group, which is a different thing to
   * hand a bartender.
   */
  if (session.role === "leader") {
    const mine = await closeVenueId(session);
    const { data } = mine
      ? await db().from("venues").select("code").eq("id", mine).maybeSingle()
      : { data: null };
    const code = (data as { code: string } | null)?.code;
    venues = venues.filter((v) => v.code === code);
  }

  const failing = venues.filter((v) => v.tier === "fail");
  const listsFailed = venues.reduce((n, v) => n + v.failed, 0);
  const signed = venues.reduce((n, v) => n + v.listsSigned, 0);
  const lists = venues.reduce((n, v) => n + v.listsTotal, 0);

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <header className="mt-4 mb-5">
        <p className="label">
          {formatNight(night)} · {over ? "night closed" : "still running"}
        </p>
        <h1 className="text-metric mt-2 font-medium">Close compliance</h1>
        {/* A night in progress is a progress bar and the same night at ten in
            the morning is a verdict. Saying which costs one line and stops an
            ordinary Tuesday evening reading as a building-wide failure. */}
        <p className="note text-muted mt-2 max-w-prose leading-relaxed">
          {over
            ? "The night is over, so anything unsigned stayed unsigned."
            : "The night is still running. Lists with work left on them are counted as open, not failed."}
        </p>
      </header>

      <NightNav night={night} base="/close/compliance" />

      {venues.length === 0 ? (
        <section className="panel mt-5">
          <h2 className="card-title">No lists on this night</h2>
          <p className="note text-muted mt-2 leading-relaxed">
            Nothing to report. A venue appears here once it has a list written
            against it.
          </p>
        </section>
      ) : (
        <>
          <section className="panel mt-5">
            {/* Figure over label, not under it. A label that wraps to two
                lines pushed its own number down a row, so three tiles that
                are meant to be read across came out on three baselines. */}
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
                    listsFailed > 0 ? "text-warn" : ""
                  }`}
                >
                  {listsFailed}
                </p>
                <p className="label mt-1">Lists failed</p>
              </div>
              <div>
                <p
                  className={`text-metric tabular-nums ${
                    failing.length > 0 ? "text-warn" : ""
                  }`}
                >
                  {failing.length}
                </p>
                <p className="label mt-1">Venues failing</p>
              </div>
            </div>
          </section>

          {/* Uniform bars, worst first, the tier carried by the fill. Same
              shape and the same three bands as the weekly board, so nobody
              has to learn a second scale to read a second product. */}
          <ul className="mt-3 space-y-2">
            {venues.map((venue) => (
              <li key={venue.code}>
                <Link
                  href={`/close/compliance/${venue.code}?night=${night}`}
                  className="block"
                >
                  <ScoreBar
                    score={venue.score}
                    code={venue.code}
                    tier={venue.tier}
                    note={
                      venue.failed > 0
                        ? `${venue.listsSigned} of ${venue.listsTotal} signed · ${venue.failed} failed`
                        : `${venue.listsSigned} of ${venue.listsTotal} signed · ${venue.owed - venue.ticked} open`
                    }
                  />
                </Link>
              </li>
            ))}
          </ul>

          <p className="label mt-5">
            Score is items ticked out of items owed, out of ten. 8 and above is
            good, 6 or 7 neutral, 5 and under a fail. A list nobody signed fails
            whatever its ticks say.
          </p>
        </>
      )}

      <CloseBar back="/close" />
    </main>
  );
}
