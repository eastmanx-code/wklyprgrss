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
    <div className="min-w-0">
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

function Rule() {
  return <hr className="border-divider my-5 border-0 border-t" />;
}

/**
 * The company's week: the clock, then one column per house, side by side.
 *
 * Side by side rather than stacked, because the whole point of splitting the
 * board is the comparison — 95% against 24% is the week's headline, and
 * stacked it is two screens apart and nobody reads it as one fact. Everything
 * a house is measured on now sits in that house's column: what was filed, how
 * the venues split, who finished first and last. On a phone the columns fall
 * back to a stack, which is the same information in the only order that fits.
 *
 * Nothing here averages the two together. Front of house at 95% and the
 * kitchen at 24% come out as 65%, which describes neither and buries the half
 * that needs the attention.
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
      {/* One clock for the company, above both columns. Both halves are due at
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
        // Every venue that runs this house, counted once. The five bars with
        // no kitchen are not in the kitchen's denominator.
        const venues = totals.wins + totals.partial + totals.missed;
        const winRate = venues ? Math.round((totals.wins / venues) * 100) : 0;
        const first = totals.finishes[0];
        const last = totals.finishes[totals.finishes.length - 1];

        return (
          <Card
            key={totals.house}
            title={houseName(totals.house)}
            hint={
              totals.scored
                ? `${venues} venues · filed a new photo and comment on all ${WEEKLY_ITEM_TARGET}`
                : `${venues} venues · practice, not scored yet`
            }
            className="col-span-12 sm:col-span-6"
          >
            <Dial
              percent={totals.percent}
              caption={`${totals.itemsDone} of ${totals.itemsTarget}`}
            />
            <p className="label mt-4 text-center">
              {lastWeek ? `Last week: ${lastWeek.percent}%` : "First week"}
            </p>

            <Rule />

            {/* A house still in practice has no verdicts to report. Printed
                anyway, "Missed 11" reads as eleven failures on a board most of
                them have not finished building.
            
                Both branches reserve the same height as the three stats, so
                the rule and the turnaround below it land on the same line in
                both columns. Read side by side, sections that step against
                each other stop looking like the same section. */}
            {totals.scored ? (
              <>
                <p className="label">
                  Signed off · {winRate}% cleared their board
                </p>
                <div className="mt-3 grid min-h-[68px] grid-cols-3 gap-4">
                  <Stat label="Wins" value={totals.wins} />
                  <Stat label="Partial" value={totals.partial} />
                  <Stat
                    label="Missed"
                    value={totals.missed}
                    accent={totals.missed > 0}
                  />
                </div>
              </>
            ) : (
              <>
                <p className="label">Signed off</p>
                <p className="text-body text-muted mt-3 min-h-[68px] leading-[1.5]">
                  Crews are building and walking this board. Wins and misses
                  start the week it goes live.
                </p>
              </>
            )}

            <Rule />

            {/* Always present, with an empty state. Hiding it until someone
                finished made the card look like it had gone missing on a week
                where nobody had. */}
            <p className="label">Turnaround · first and last full board</p>
            {first ? (
              <div className="mt-3 grid grid-cols-2 gap-4">
                <Stat
                  label="First in"
                  value={
                    <>
                      {first.code}
                      <span className="text-muted text-body block">
                        {formatFinish(first.at)}
                      </span>
                    </>
                  }
                />
                {last && last.code !== first.code ? (
                  <Stat
                    label="Last in"
                    value={
                      <>
                        {last.code}
                        <span className="text-muted text-body block">
                          {formatFinish(last.at)}
                        </span>
                      </>
                    }
                  />
                ) : null}
              </div>
            ) : (
              <p className="text-body text-muted mt-3 leading-[1.5]">
                No venue has finished this half yet.
              </p>
            )}
          </Card>
        );
      })}

      {/* The trends on their own row, still one per house and still side by
          side — the same eight weeks on the same fixed scale, so the two lines
          can be read against each other rather than one at a time. */}
      {byHouse.map((totals) => (
        <Fragment key={totals.house}>
          {totals.history.length > 1 ? (
            <Card
              title={`${houseName(totals.house)} · by week`}
              hint="Eight weeks on a fixed scale, so a bad week looks like one"
              className="col-span-12 sm:col-span-6"
            >
              <Trend
                points={totals.history}
                labelLeft={formatWeekStart(totals.history[0].weekStart)}
                labelRight="This week"
              />
            </Card>
          ) : null}
        </Fragment>
      ))}
    </>
  );
}
