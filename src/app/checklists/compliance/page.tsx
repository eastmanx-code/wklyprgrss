import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/Card";
import { RunCard } from "@/components/checklists/RunCard";
import { BackLink } from "@/components/ui";
import { NightStrip, ScoreBar } from "@/components/checklists/Compliance";
import {
  nightCompliance,
  nightTrend,
  type VenueCompliance,
} from "@/lib/compliance";
import { closeVenueId } from "@/lib/close-venue";
import { currentNight, formatNight, isNightOver } from "@/lib/night";
import { nightWindow } from "@/lib/rollup";
import { getSession } from "@/lib/session";
import { shortOf } from "@/lib/short";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Which lists failed last night, and who signed the ones that did.
 *
 * The rollup is a month of pattern and `/checklists` is tonight's clipboard. This
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
  let mineName: string | null = null;
  // Everyone but an admin. Written as "leader", a manager fell through to the
  // group view and read who signed what at all twenty one venues.
  if (session.role !== "admin") {
    const mine = await closeVenueId(session);
    const { data } = mine
      ? await db()
          .from("venues")
          .select("code, name")
          .eq("id", mine)
          .maybeSingle()
      : { data: null };
    const row = data as { code: string; name: string | null } | null;
    venues = venues.filter((v) => v.code === row?.code);
    mineName = row
      ? row.name && row.name !== row.code
        ? row.name
        : row.code
      : null;
  }

  // One ruler, summed. Done and signed, not signed, not done and still going
  // add up to the lists, on every venue and so here too.
  const sum = (pick: (v: VenueCompliance) => number) =>
    venues.reduce((n, v) => n + pick(v), 0);
  const lists = sum((v) => v.total);
  const done = sum((v) => v.done);
  const notSigned = sum((v) => v.notSigned);
  const notDone = sum((v) => v.notDone);
  const short = notSigned + notDone;

  const of = (tier: "good" | "neutral" | "fail") =>
    venues.filter((v) => v.tier === tier);

  // The shape behind the night. Drawn only for a leader's own venue or the
  // whole group, never for a single venue on the group screen.
  const window = nightWindow(30, night);
  const trend = await nightTrend(window);
  // Only the nights something ran. Charted over the whole window, the line
  // began with three flat weeks at nought that were not bad nights, they were
  // nights before the venue had the app.
  const ran = trend.filter((t) => t.ran);
  const points = ran.map((t) => ({
    weekStart: t.night,
    // One line, lists done and signed. Two lines needed a legend.
    percent: t.done,
    approvedPercent: t.done,
  }));

  // Two buckets, the same as the rollup's strip: every list done and signed,
  // or something was not.
  // Running nights only. Thirty calendar squares over a venue four nights
  // into the app painted twenty six of them "nothing signed" for nights the
  // app did not exist, which is the 30 of 30 mistake wearing a different hat.
  const strip = ran.map((t) => ({
    night: t.night,
    state: t.done >= 100 ? ("complete" as const) : ("short" as const),
  }));

  // Best and worst are only a comparison when there is something to compare
  // to. With one venue running they are the same row printed twice.
  const ranked = [...venues].sort((a, b) => b.score - a.score);
  const best = ranked.length > 1 ? ranked[0] : null;
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  /**
   * Where back goes.
   *
   * An admin arrived from the list of locations, which is also the report
   * they were reading; a leader has one building and came off their own
   * clipboard. Sending both to the same place would have sent one of them
   * somewhere they had never been.
   */
  const back =
    session.role === "admin" ? "/checklists/locations" : "/checklists";

  return (
    <main>
      {/* Three screens deep by the time you are in a list, and this one had
          no way out but the browser. The bar at the foot is a phone control
          and easy to miss on a desk. */}
      <BackLink href={back}>
        {session.role === "admin" ? "All locations" : "Checklists"}
      </BackLink>

      {/* The board's own header shape: the period, then the answer. */}
      <header className="mt-4 mb-6">
        <p className="label">
          {mineName ? `${mineName} · ` : ""}
          {formatNight(night)} · {over ? "night closed" : "still running"}
        </p>
        <h1 className="text-metric mt-2 tracking-normal">Close compliance</h1>
      </header>

      {/* The month, tappable. The arrows walked one night at a time, which
          answers "what happened last night" and nothing else: finding the
          Tuesday three weeks ago took twenty taps. */}
      <NightStrip
        nights={strip}
        current={night}
        base="/checklists/compliance"
      />

      {venues.length > 0 && ran.length >= 2 ? (
        <div className="mt-4">
          <RunCard
            done={done}
            total={lists}
            nights={points.length}
            points={points}
            failed={short > 0}
            labelLeft={formatNight(ran[0].night)}
            labelRight={formatNight(night)}
            best={best}
            worst={worst}
          />
        </div>
      ) : null}

      <div className="mt-4">
        <Card
          title="Last night"
          hint={[
            ...(short === 0 && lists > 0
              ? [over ? "every list done and signed" : "nothing short yet"]
              : []),
            ...(notSigned > 0 ? [`${notSigned} not signed`] : []),
            ...(notDone > 0 ? [`${notDone} not done`] : []),
            ...(over ? [] : ["still running"]),
          ].join(" · ")}
        >
          {venues.length === 0 ? (
            <p className="note text-muted mt-4 leading-relaxed">
              Nothing to report. A venue appears here once it has a list written
              against it.
            </p>
          ) : null}

          <Tier title="Fail" venues={of("fail")} night={night} />
          <Tier title="Neutral" venues={of("neutral")} night={night} />
          <Tier title="Good" venues={of("good")} night={night} />

          <p className="label mt-6">
            Score is lists done and signed, out of ten.
          </p>
        </Card>
      </div>
    </main>
  );
}

/** A group heading and its rows, or nothing when the group is empty. */
function Tier({
  title,
  venues,
  night,
}: {
  title: string;
  venues: VenueCompliance[];
  night: string;
}) {
  if (venues.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="label border-divider border-t pt-4">
        {title} · {venues.length}
      </p>
      <ul className="-mx-3 mt-2 space-y-[2px]">
        {venues.map((venue) => (
          <li key={venue.code}>
            <Link
              href={`/checklists/compliance/${venue.code}?night=${night}`}
              className="block"
            >
              <ScoreBar
                score={venue.score}
                code={venue.code}
                tier={venue.tier}
                note={shortOf(venue)}
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
