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
 * The company's week on a 12-column grid: 4/8 then 8/4, so the rows read as a
 * grid rather than as a stack of differently-proportioned slabs.
 *
 * Every card states what it measures. A dashboard of bare numbers gets read as
 * whatever the viewer assumes, and "failing" in particular needs to say what
 * it counts before anyone acts on it.
 */
export function CompanyHero({
  byHouse,
  passing,
  pending,
  failing,
  winRate,
  deadlineLabel,
  deadlineMs,
  finishes,
}: {
  /** One set of totals per house. Never one set covering both. */
  byHouse: HouseTotals[];
  passing: number;
  pending: number;
  failing: number;
  winRate: number;
  deadlineLabel: string;
  deadlineMs: number;
  finishes: { code: string; at: string }[];
}) {
  const first = finishes[0];
  const last = finishes[finishes.length - 1];

  return (
    <>
      {/* A ring and a trend per house, stacked.
      
          One ring covering both is the averaging this whole product was split
          to prevent: front of house at 95% and the kitchen at 24% come out as
          65%, which describes neither and buries the half that needs the
          attention. Two rings is more screen and the right answer. */}
      {byHouse.map((totals) => {
        // Same series the chart plots, so the two cannot disagree.
        const lastWeek =
          totals.history.length > 1
            ? totals.history[totals.history.length - 2]
            : undefined;
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
          </Fragment>
        );
      })}

      <Card
        title="The week"
        hint={`Signed off · ${winRate}% of venues cleared their board`}
        className="col-span-12 sm:col-span-8"
      >
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Wins" value={passing} />
          <Stat label="Partial" value={pending} />
          <Stat label="Missed" value={failing} accent={failing > 0} />
        </div>
      </Card>

      <Card
        title="Deadline"
        hint={deadlineLabel}
        className="col-span-12 sm:col-span-4"
      >
        <p className="text-metric text-ink leading-[1.2] tracking-normal tabular-nums">
          <Countdown deadlineMs={deadlineMs} />
        </p>
        <p className="label mt-6">
          <ClockAndWeather />
        </p>
      </Card>

      {/* Always present, with an empty state. Hiding it until someone finished
          made the card look like it had gone missing on a week where nobody
          had. */}
      <Card
        title="Turnaround"
        hint="Who filed a full board first, and who filed last"
        className="col-span-12"
      >
        {first ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="label">First in</p>
              <p className="text-metric text-ink mt-2 leading-[1.2] tracking-normal tabular-nums">
                {first.code}
                <span className="text-muted"> {formatFinish(first.at)}</span>
              </p>
            </div>
            {last && last.code !== first.code ? (
              <div>
                <p className="label">Last in</p>
                <p className="text-metric text-ink mt-2 leading-[1.2] tracking-normal tabular-nums">
                  {last.code}
                  <span className="text-muted"> {formatFinish(last.at)}</span>
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-body text-muted flex h-10 items-center leading-[1.5]">
            No venue has finished this week yet.
          </p>
        )}
      </Card>
    </>
  );
}
