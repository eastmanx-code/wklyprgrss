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

/**
 * What the ring's number is made of, as one bar.
 *
 * The ring says a percentage and the trend says which way it is moving; neither
 * says what the gap under it is. A house at 80% signed off is a different week
 * depending on whether the other fifth is filed and waiting on a verdict or was
 * never handed in, and the same three states run under every ring. Same shape
 * and same order as the walkthroughs board, so the two dashboards read alike:
 * the ink is signed off, the dimmed ink is filed but not yet passed, the faint
 * track is never filed. Identity is on the key, never colour alone.
 */
function CompositionStrip({
  signedOff,
  filedNotSigned,
  notFiled,
}: {
  signedOff: number;
  filedNotSigned: number;
  notFiled: number;
}) {
  const total = signedOff + filedNotSigned + notFiled;
  if (total <= 0) return null;
  const segments = [
    { label: "Signed off", value: signedOff, fill: "var(--ink)", opacity: 1 },
    {
      label: "Filed, not signed off",
      value: filedNotSigned,
      fill: "var(--ink)",
      opacity: 0.4,
    },
    { label: "Not filed", value: notFiled, fill: "var(--inset)", opacity: 1 },
  ];
  const share = (v: number) => {
    const p = (v / total) * 100;
    return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
  };
  return (
    <div className="border-divider mt-6 border-t pt-5">
      <div className="bg-paper flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.label}
              className="h-full"
              style={{
                width: `${Math.max((s.value / total) * 100, 2)}%`,
                background: s.fill,
                opacity: s.opacity,
              }}
              title={`${s.label}: ${s.value}`}
            />
          ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ background: s.fill, opacity: s.opacity }}
              aria-hidden
            />
            <span className="label">
              {s.label} <span className="text-ink tabular-nums">{s.value}</span>
              {s.value > 0 ? ` · ${share(s.value)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
        const venues = totals.good + totals.neutral + totals.fail;
        const goodRate = venues ? Math.round((totals.good / venues) * 100) : 0;
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
                ? `${venues} venues · share of the week's work signed off · 8 of 10 is good`
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

            {/* And what the ring's number is made of. Only once a house is
                scored — a practice house has nothing signed off, so the bar
                would be one long track that says less than the words already do. */}
            {totals.scored ? (
              <CompositionStrip
                signedOff={totals.itemsApproved}
                filedNotSigned={Math.max(
                  0,
                  totals.itemsDone - totals.itemsApproved,
                )}
                notFiled={Math.max(0, totals.itemsTarget - totals.itemsDone)}
              />
            ) : null}
          </Card>
        );
      })}
    </>
  );
}
