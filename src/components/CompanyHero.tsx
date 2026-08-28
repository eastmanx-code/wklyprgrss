import { Card } from "./Card";
import { Dial } from "./Dial";
import { Trend } from "./Trend";
import { WIN_RATIO, type HouseTotals } from "@/lib/status";
import { houseName } from "@/lib/types";
import { formatFinish, formatWeekStart } from "@/lib/week";

/**
 * Secondary metric: 11px label in the one grey, 28px value in white, and a
 * quiet line under it saying what the number counts.
 */
function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="label">{label}</p>
      <p
        className={`text-metric mt-1 leading-[1.2] tracking-normal tabular-nums ${
          accent ? "text-warn" : "text-ink"
        }`}
      >
        {value}
      </p>
      {sub ? <p className="label mt-1 truncate">{sub}</p> : null}
    </div>
  );
}

/**
 * One band per house: ring, eight-week line, and every number that house is
 * judged on — all on one row.
 *
 * It was five cards before, one measure each, and a screen of mostly empty
 * panel. Split up they read as unrelated readings; on one row they are one
 * house's week, and both houses fit on one screen where they can be compared.
 *
 * Nothing here averages the two. Front of house at 95% and heart of house at
 * 24% come out as 65%, which describes neither and buries the half that needs
 * the attention.
 *
 * Every figure states what it counts. A dashboard of bare numbers gets read as
 * whatever the viewer assumes, and "missed" in particular needs to say what it
 * counts before anyone acts on it.
 */
const TARGET = Math.round(WIN_RATIO * 100);

export function CompanyHero({ byHouse }: { byHouse: HouseTotals[] }) {
  return (
    <>
      {byHouse.map((totals) => {
        // Same series the chart plots, so the two cannot disagree.
        const lastWeek =
          totals.history.length > 1
            ? totals.history[totals.history.length - 2]
            : undefined;
        // Every venue that runs this house, counted once. The five bars with
        // no heart of house are not in its denominator.
        const venues = totals.wins + totals.partial + totals.missed;
        const winRate = venues ? Math.round((totals.wins / venues) * 100) : 0;
        const first = totals.finishes[0];
        const last = totals.finishes[totals.finishes.length - 1];
        const hasTrend = totals.history.length > 1;
        const hasLast = Boolean(last && last.code !== first?.code);
        /**
         * The headline is the score, not the upload rate.
         *
         * The ring showed filing: a new photo on all ten. That is the easiest
         * thing on the board and the number that only goes up, and it sat in
         * the biggest type on the page while the outcome — how much of it
         * actually passed — was a small figure off to the side. Front of house
         * filed 95% this week and signed off 80% of it.
         *
         * A house in practice has nothing signed off, so it keeps filing as
         * its headline and says so.
         */
        const headline = totals.scored
          ? totals.itemsTarget
            ? Math.round((totals.itemsApproved / totals.itemsTarget) * 100)
            : 0
          : totals.percent;
        const behind = totals.scored && headline < TARGET;
        const priorHeadline = lastWeek
          ? totals.scored
            ? lastWeek.approvedPercent
            : lastWeek.percent
          : undefined;

        return (
          <Card
            key={totals.house}
            title={houseName(totals.house)}
            hint={
              totals.scored
                ? `${venues} venues · share of the week's work signed off · ${TARGET}% signed off is a win`
                : `${venues} venues · share of the week's work filed · practice, not scored yet`
            }
            className="col-span-12"
          >
            <div className="grid gap-6 lg:grid-cols-[200px_1fr_auto]">
              {/* Where the week landed. */}
              <div>
                <Dial
                  percent={headline}
                  tone={behind ? "var(--warn)" : "var(--ink)"}
                  caption={
                    totals.scored
                      ? `${totals.itemsApproved} of ${totals.itemsTarget} signed off`
                      : `${totals.itemsDone} of ${totals.itemsTarget} filed`
                  }
                  size={200}
                />
                <p className="label mt-1 text-center">
                  {priorHeadline === undefined
                    ? "First week"
                    : `Last week ${priorHeadline}%`}
                </p>
              </div>

              {/* Whether that is the direction of travel. Beside the ring
                  rather than a screen below it: apart, each is half an answer
                  and the reader has to hold one in their head to use the
                  other. */}
              {hasTrend ? (
                <Trend
                  points={totals.history}
                  labelLeft={formatWeekStart(totals.history[0].weekStart)}
                  labelRight="This week"
                  target={totals.scored ? TARGET : undefined}
                  showApproved={totals.scored}
                />
              ) : (
                <div />
              )}

              {/* And what it cost. Five figures in a fixed block, so the two
                  houses' numbers sit in the same columns and can be read down
                  as well as across. */}
              <div className="grid grid-cols-3 gap-x-6 gap-y-5 lg:w-[420px]">
                {/* A house still in practice has no verdicts to report.
                    Printed anyway, "Missed 11" reads as eleven failures on a
                    board most of them have not finished building. */}
                {totals.scored ? (
                  <>
                    <Stat
                      label="Wins"
                      value={totals.wins}
                      sub={`${winRate}% of venues`}
                    />
                    {/* What it counts, rather than a grade for it. "Partial"
                        is a word for a bucket, not a thing that happened to
                        anybody, and it left the reader working out which side
                        of a pass it sat on. */}
                    <Stat label="Under 8" value={totals.partial} />
                    {/* Says what the number is. This column counts houses
                        with nothing signed off at all, so calling it "missed"
                        — or "fails" — put a word on it that the cards below
                        were using for a different thing: five venues were
                        drawn as failures while this said fails: 0, because
                        they had each got something approved. */}
                    <Stat
                      label="None signed off"
                      value={totals.missed}
                      accent={totals.missed > 0}
                    />
                  </>
                ) : (
                  <p className="text-body text-muted col-span-3 leading-[1.5]">
                    Crews are building and walking this board. Scores start the
                    week it goes live.
                  </p>
                )}

                {/* Always present, with an empty state. Hidden until someone
                    finished, they looked like they had gone missing on a week
                    where nobody had. */}
                <Stat
                  label="First in"
                  value={first ? first.code : "—"}
                  sub={first ? formatFinish(first.at) : "nobody yet"}
                />
                <Stat
                  label="Last in"
                  value={hasLast ? last.code : "—"}
                  sub={hasLast ? formatFinish(last.at) : "one board so far"}
                />
                {/* Filing is the input, and it belongs beside the outcome
                    rather than in place of it.
                
                    For a house still in practice the ring is already showing
                    filing, so repeating it here says nothing; what explains
                    the figure is how many venues have written a list at all. */}
                {totals.scored ? (
                  <Stat
                    label="Filed"
                    value={`${totals.percent}%`}
                    sub={`${totals.itemsDone} of ${totals.itemsTarget}`}
                  />
                ) : (
                  <Stat
                    label="Boards built"
                    value={totals.boardsBuilt}
                    sub={`of ${venues} venues`}
                    accent={totals.boardsBuilt < venues}
                  />
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </>
  );
}
