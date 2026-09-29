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
      {sub ? <p className="label mt-1 leading-snug">{sub}</p> : null}
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

export function CompanyHero({
  byHouse,
  deadlinePassed = true,
  deadlineLabel,
}: {
  byHouse: HouseTotals[];
  /**
   * Before the deadline nothing is signed off, so the ring shows filing rather
   * than a score of zero, which on a day nothing is due reads as failure.
   */
  deadlinePassed?: boolean;
  deadlineLabel?: string;
}) {
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
        const venues = totals.good + totals.neutral + totals.fail;
        const goodRate = venues ? Math.round((totals.good / venues) * 100) : 0;
        const first = totals.finishes[0];
        const last = totals.finishes[totals.finishes.length - 1];
        const hasLast = Boolean(last && last.code !== first?.code);
        // The trend keeps its weeks, but before the deadline it drops the week
        // in progress: plotting a day-two week as a finished point drew a cliff
        // off last week's height. Dropped, the line ends at the last week that
        // actually finished, which is the honest picture and still a real
        // multi-week chart rather than no chart at all.
        const trendPoints = deadlinePassed
          ? totals.history
          : totals.history.slice(0, -1);
        const showTrend = trendPoints.length > 1;
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
        // The score is the headline only once it can exist. Before the
        // deadline the ring shows filing, the same as a house still in
        // practice, so the biggest number on the page is never a zero on a day
        // nothing was owed.
        const showScore = totals.scored && deadlinePassed;
        const headline = showScore
          ? totals.itemsTarget
            ? Math.round((totals.itemsApproved / totals.itemsTarget) * 100)
            : 0
          : totals.percent;
        const behind = showScore && headline < TARGET;
        const priorHeadline = lastWeek
          ? showScore
            ? lastWeek.approvedPercent
            : lastWeek.percent
          : undefined;

        return (
          <Card
            key={totals.house}
            title={houseName(totals.house)}
            hint={
              showScore
                ? `${venues} venues · share of the week's work signed off · 8 of 10 is good`
                : totals.scored
                  ? `${venues} venues · filed so far · scores post after ${deadlineLabel ?? "the deadline"}`
                  : `${venues} venues · share of the week's work filed · practice, not scored yet`
            }
            className="col-span-12"
          >
            <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)_auto]">
              {/* Where the week landed. */}
              <div>
                <Dial
                  percent={headline}
                  tone={behind ? "var(--warn)" : "var(--ink)"}
                  caption={
                    showScore
                      ? `${totals.itemsApproved} of ${totals.itemsTarget} signed off`
                      : `${totals.itemsDone} of ${totals.itemsTarget} filed`
                  }
                  size={200}
                />
                {/* No last-week figure before the deadline: this week is a
                    day or two in and last week was a finished week, so the
                    comparison reads as a collapse that did not happen. */}
                {deadlinePassed ? (
                  <p className="label mt-1 text-center">
                    {priorHeadline === undefined
                      ? "First week"
                      : `Last week ${priorHeadline}%`}
                  </p>
                ) : null}
              </div>

              {/* The direction of travel, beside the ring. Before the deadline
                  it plots the completed weeks only, so it is a real trend
                  rather than a cliff onto a week nobody has finished. */}
              {showTrend ? (
                <Trend
                  points={trendPoints}
                  labelLeft={formatWeekStart(trendPoints[0].weekStart)}
                  labelRight={deadlinePassed ? "This week" : "Last week"}
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
                {showScore ? (
                  <>
                    {/* The three the weekly report uses, on its bands: eight
                        and up good, six or seven neutral, five and under a
                        fail. This screen had been running its own words and
                        its own cuts for the same call. */}
                    <Stat
                      label="Good"
                      value={totals.good}
                      sub={`${goodRate}% of venues`}
                    />
                    <Stat label="Neutral" value={totals.neutral} />
                    <Stat
                      label="Fail"
                      value={totals.fail}
                      accent={totals.fail > 0}
                    />
                  </>
                ) : totals.scored ? (
                  <p className="text-body text-muted col-span-3 leading-[1.5]">
                    Filing is open. Scores post after{" "}
                    {deadlineLabel ?? "the deadline"}.
                  </p>
                ) : (
                  <p className="text-body text-muted col-span-3 leading-[1.5]">
                    Crews are building and walking this board. Scores start the
                    week it goes live.
                  </p>
                )}

                {/* First and last in only mean something once boards are
                    finishing. Before the deadline they read "nobody yet" and
                    "one board so far", which is filler on a calm filing band. */}
                {deadlinePassed ? (
                  <>
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
                  </>
                ) : null}
                {/* Filing is the input, and it belongs beside the outcome
                    rather than in place of it.
                
                    For a house still in practice the ring is already showing
                    filing, so repeating it here says nothing; what explains
                    the figure is how many venues have written a list at all. */}
                {showScore ? (
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
