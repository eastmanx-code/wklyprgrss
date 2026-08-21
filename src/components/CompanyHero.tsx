import { Card } from "./Card";
import { Dial } from "./Dial";
import { Trend } from "./Trend";
import { WEEKLY_ITEM_TARGET, type HouseTotals } from "@/lib/status";
import { houseName, houseShort } from "@/lib/types";
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

        return (
          <Card
            key={totals.house}
            title={houseShort(totals.house)}
            hint={`${houseName(totals.house)} · ${venues} venues · ${
              totals.scored
                ? `a new photo and comment on all ${WEEKLY_ITEM_TARGET}, every week`
                : "practice, not scored yet"
            }`}
            className="col-span-12"
          >
            <div className="grid gap-6 lg:grid-cols-[132px_1fr_auto]">
              {/* Where the week landed. */}
              <div>
                <Dial
                  percent={totals.percent}
                  caption={`${totals.itemsDone} of ${totals.itemsTarget}`}
                  size={132}
                />
                <p className="label mt-2 text-center">
                  {lastWeek ? `Last week ${lastWeek.percent}%` : "First week"}
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
                    <Stat
                      label="Partial"
                      value={totals.partial}
                      sub="some signed off"
                    />
                    <Stat
                      label="Missed"
                      value={totals.missed}
                      sub="none signed off"
                      accent={totals.missed > 0}
                    />
                  </>
                ) : (
                  <p className="text-body text-muted col-span-3 leading-[1.5]">
                    Crews are building and walking this board. Wins and misses
                    start the week it goes live.
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
                {/* Filing and passing are different facts, and the ring only
                    ever showed the first. A week where everything was filed
                    and a third of it was sent back read as a 95% week. */}
                <Stat
                  label="Signed off"
                  value={totals.scored ? totals.itemsApproved : "—"}
                  sub={
                    totals.scored
                      ? `of ${totals.itemsDone} filed`
                      : "not scored yet"
                  }
                />
              </div>
            </div>
          </Card>
        );
      })}
    </>
  );
}
