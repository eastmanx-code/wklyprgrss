import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/Card";
import { Dial } from "@/components/Dial";
import { Trend } from "@/components/Trend";
import { CloseBar } from "@/components/close/CloseBar";
import { BackLink } from "@/components/ui";
import { NightNav, ScoreBar } from "@/components/close/Compliance";
import {
  nightCompliance,
  nightTrend,
  type VenueCompliance,
} from "@/lib/compliance";
import { closeVenueId } from "@/lib/close-venue";
import { currentNight, formatNight, isNightOver } from "@/lib/night";
import { nightWindow } from "@/lib/rollup";
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
  let mineName: string | null = null;
  if (session.role === "leader") {
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

  const failing = venues.filter((v) => v.tier === "fail");
  const listsFailed = venues.reduce((n, v) => n + v.failed, 0);
  const signed = venues.reduce((n, v) => n + v.listsSigned, 0);
  const lists = venues.reduce((n, v) => n + v.listsTotal, 0);

  const of = (tier: "good" | "neutral" | "fail") =>
    venues.filter((v) => v.tier === tier);

  // The shape behind the night. Drawn only for a leader's own venue or the
  // whole group, never for a single venue on the group screen.
  const window = nightWindow(30, night);
  const trend = await nightTrend(window);
  const points = trend.map((t) => ({
    weekStart: t.night,
    percent: t.ticked,
    approvedPercent: t.signed,
  }));

  // Items ticked across every list that was owed. The same measure the ring
  // on the weekly board carries, asked of a night instead of a week.
  const owed = venues.reduce((n, v) => n + v.owed, 0);
  const ticked = venues.reduce((n, v) => n + v.ticked, 0);
  const share = owed === 0 ? 0 : Math.round((ticked / owed) * 100);

  // Best and worst are only a comparison when there is something to compare
  // to. With one venue running they are the same row printed twice.
  const ranked = [...venues].sort((a, b) => b.score - a.score);
  const best = ranked.length > 1 ? ranked[0] : null;
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  const headline =
    venues.length === 0
      ? "No lists ran"
      : listsFailed > 0
        ? `${listsFailed} ${listsFailed === 1 ? "list" : "lists"} failed`
        : "Nothing failed";

  /**
   * Where back goes.
   *
   * An admin arrived from the list of locations, which is also the report
   * they were reading; a leader has one building and came off their own
   * clipboard. Sending both to the same place would have sent one of them
   * somewhere they had never been.
   */
  const back = session.role === "admin" ? "/close/locations" : "/close";

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

      <NightNav night={night} base="/close/compliance" />

      {/* The shape, before the list. Same furniture as the weekly board: the
          ring on the left, the run of nights beside it, the names that carry
          the night on the right. Each piece hides itself rather than drawing
          an empty one — the trend needs two nights before a line means
          anything, and best against worst needs two venues. */}
      {venues.length > 0 ? (
        <div className="mt-4">
          <Card title="The run" hint={`Last ${window.length} nights`}>
            <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[176px_minmax(0,1fr)_auto]">
              <Dial
                percent={share}
                caption={`${ticked} of ${owed} items ticked`}
                tone={listsFailed > 0 ? "var(--warn)" : "var(--ink)"}
              />

              {points.length > 1 ? (
                <Trend
                  points={points}
                  labelLeft={formatNight(window[0])}
                  labelRight={formatNight(night)}
                  target={80}
                />
              ) : (
                <p className="note text-muted self-center leading-relaxed">
                  One night of history. The run draws itself from the second.
                </p>
              )}

              {best && worst ? (
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-1">
                  <div>
                    <p className="label">Best</p>
                    <p className="text-title mt-1 tracking-[0.08em]">
                      {best.code}
                    </p>
                    <p className="label mt-1 tabular-nums">{best.score}/10</p>
                  </div>
                  <div>
                    <p className="label">Worst</p>
                    <p className="text-title text-warn mt-1 tracking-[0.08em]">
                      {worst.code}
                    </p>
                    <p className="label mt-1 tabular-nums">{worst.score}/10</p>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}

      <div className="mt-4">
        <Card
          title="Last night"
          hint={[
            `${lists} lists · ${signed} signed · ${failing.length} ${
              failing.length === 1 ? "venue" : "venues"
            } failing`,
            over
              ? "the night is over, so anything unsigned stayed unsigned"
              : "still running, so unsigned lists count as open rather than failed",
          ].join(" · ")}
        >
          <p
            className={`text-metric leading-[1.15] ${
              listsFailed > 0 ? "text-warn" : "text-ink"
            }`}
          >
            {headline}
          </p>

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
            Score is items ticked out of items owed, out of ten. Good 8 to 10 ·
            neutral 6 or 7 · fail 5 or under. A list nobody signed fails
            whatever its ticks say.
          </p>
        </Card>
      </div>

      <CloseBar back={back} />
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
    </div>
  );
}
