import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/Card";
import { CloseBar } from "@/components/close/CloseBar";
import { NightNav, ScoreBar } from "@/components/close/Compliance";
import { nightCompliance, type VenueCompliance } from "@/lib/compliance";
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

  const headline =
    venues.length === 0
      ? "No lists ran"
      : listsFailed > 0
        ? `${listsFailed} ${listsFailed === 1 ? "list" : "lists"} failed`
        : "Nothing failed";

  return (
    <main>
      {/* The board's own header shape: the period, then the answer. */}
      <header className="mt-4 mb-6">
        <p className="label">
          {mineName ? `${mineName} · ` : ""}
          {formatNight(night)} · {over ? "night closed" : "still running"}
        </p>
        <h1 className="text-metric mt-2 tracking-normal">Close compliance</h1>
      </header>

      <NightNav night={night} base="/close/compliance" />

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

      <CloseBar back="/close" />
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
