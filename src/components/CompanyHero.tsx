import { Fragment } from "react";

import { Card } from "./Card";
import { ClockAndWeather, Countdown } from "./DashLive";
import { Dial } from "./Dial";
import { Trend } from "./Trend";
import { WEEKLY_ITEM_TARGET, type HouseTotals } from "@/lib/status";
import { houseName } from "@/lib/types";
import { formatFinish, formatWeekStart } from "@/lib/week";

/**
 * Secondary metric: 11px label in the one grey, 28px value in white.
 * Left-aligned — only the ring is centred.
 */
function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <p
        className={`text-metric mt-2 leading-[1.2] tracking-normal tabular-nums ${
          accent ? "text-warn" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * The company's week on a 12-column grid: the shared clock, then a block per
 * house — ring, trend, verdicts, turnaround — in 4/8 and 8/4 rows, so each
 * house reads as its own run of the same four questions.
 *
 * Nothing on this page averages the two houses together. Front of house at 95%
 * and the kitchen at 24% come out as 65%, which describes neither and buries
 * the half that needs the attention — the split exists to stop exactly that,
 * and a card that re-blends them downstream puts it straight back.
 *
 * Every card states what it measures. A dashboard of bare numbers gets read as
 * whatever the viewer assumes, and "missed" in particular needs to say what it
 * counts before anyone acts on it.
 */
export function CompanyHero({
  byHouse,
  deadlineLabel,
  deadlineMs,
}: {
  /** One set of totals per house. Never one set covering both. */
  byHouse: HouseTotals[];
  deadlineLabel: string;
  deadlineMs: number;
}) {
  return (
    <>
      {/* One clock for the company, above both houses. Both halves are due at
          the same moment, so a countdown per house would be the same number
          printed twice. */}
      <Card title="Deadline" hint={deadlineLabel} className="col-span-12">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="label">Time left</p>
            <p className="text-metric text-ink mt-2 leading-[1.2] tracking-normal tabular-nums">
              <Countdown deadlineMs={deadlineMs} />
            </p>
          </div>
          <div>
            <p className="label">Right now</p>
            <p className="text-body text-muted mt-2 leading-[1.5]">
              <ClockAndWeather />
            </p>
          </div>
        </div>
      </Card>

      {byHouse.map((totals) => {
        // Same series the chart plots, so the two cannot disagree.
        const lastWeek =
          totals.history.length > 1
            ? totals.history[totals.history.length - 2]
            : undefined;
        // Every venue that runs this house, counted once. The four bars with
        // no kitchen are not in the kitchen's denominator.
        const venues = totals.wins + totals.partial + totals.missed;
        const winRate = venues ? Math.round((totals.wins / venues) * 100) : 0;
        const first = totals.finishes[0];
        const last = totals.finishes[totals.finishes.length - 1];

        return (
          <Fragment key={totals.house}>
            <Card
              title={`${houseName(totals.house)} · filed this week`}
              hint={
                totals.scored
                  ? `A new photo and comment on all ${WEEKLY_ITEM_TARGET}, every week`
                  : `Practice. A new photo and comment on all ${WEEKLY_ITEM_TARGET}, not scored yet`
              }
              className="col-span-12 sm:col-span-4"
            >
              <Dial
                percent={totals.percent}
                caption={`${totals.itemsDone} of ${totals.itemsTarget}`}
              />
              {lastWeek ? (
                <p className="label mt-4 text-center">
                  Last week: {lastWeek.percent}%
                </p>
              ) : null}
            </Card>

            {totals.history.length > 1 ? (
              <Card
                title={`${houseName(totals.house)} · by week`}
                hint="Eight weeks on a fixed scale, so a bad week looks like one"
                className="col-span-12 sm:col-span-8"
              >
                <Trend
                  points={totals.history}
                  labelLeft={formatWeekStart(totals.history[0].weekStart)}
                  labelRight="This week"
                />
              </Card>
            ) : null}

            <Card
              title={`${houseName(totals.house)} · the week`}
              hint={
                totals.scored
                  ? `Signed off · ${winRate}% of the ${venues} venues that run it cleared their board`
                  : "Not scored yet — nothing here counts against anyone"
              }
              className="col-span-12 sm:col-span-8"
            >
              {/* A house still in practice has no verdicts to report. Printed
                  anyway, "Missed 17" reads as seventeen failures on a board
                  half of them have not finished building. */}
              {totals.scored ? (
                <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                  <Stat label="Wins" value={totals.wins} />
                  <Stat label="Partial" value={totals.partial} />
                  <Stat
                    label="Missed"
                    value={totals.missed}
                    accent={totals.missed > 0}
                  />
                </div>
              ) : (
                <p className="text-body text-muted flex h-10 items-center leading-[1.5]">
                  Crews are building and walking this board. Wins and misses
                  start the week it goes live.
                </p>
              )}
            </Card>

            {/* Always present, with an empty state. Hiding it until someone
                finished made the card look like it had gone missing on a week
                where nobody had. */}
            <Card
              title={`${houseName(totals.house)} · turnaround`}
              hint="Who filed a full board first, and who filed last"
              className="col-span-12 sm:col-span-4"
            >
              {first ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <p className="label">First in</p>
                    <p className="text-metric text-ink mt-2 leading-[1.2] tracking-normal tabular-nums">
                      {first.code}
                      <span className="text-muted">
                        {" "}
                        {formatFinish(first.at)}
                      </span>
                    </p>
                  </div>
                  {last && last.code !== first.code ? (
                    <div>
                      <p className="label">Last in</p>
                      <p className="text-metric text-ink mt-2 leading-[1.2] tracking-normal tabular-nums">
                        {last.code}
                        <span className="text-muted">
                          {" "}
                          {formatFinish(last.at)}
                        </span>
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-body text-muted flex h-10 items-center leading-[1.5]">
                  No venue has finished this house yet.
                </p>
              )}
            </Card>
          </Fragment>
        );
      })}
    </>
  );
}
