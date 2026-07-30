import { Card } from "./Card";
import { Clock, Countdown, Weather } from "./DashLive";
import { Dial } from "./Dial";
import { Trend } from "./Trend";
import { WEEKLY_ITEM_TARGET } from "@/lib/status";
import { formatFinish, formatWeekStart } from "@/lib/week";

/** Label above, number below — the number is the thing, the label names it. */
function Stat({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <p
        className={`mt-2 font-mono text-3xl leading-none tabular-nums ${tone}`}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * The company's week as a grid of contained metrics, each in the form that
 * suits it: a radial for the one headline proportion, a curve for the trend,
 * plain numerals for counts, a list for the venues.
 *
 * Every card says what it measures. A dashboard of bare numbers gets read as
 * whatever the viewer assumes, and "failing" in particular needs to state what
 * it counts before anyone acts on it.
 */
export function CompanyHero({
  percent,
  itemsDone,
  itemsTarget,
  passing,
  pending,
  failing,
  setup,
  deadlineLabel,
  deadlineMs,
  finishes,
  history,
}: {
  percent: number;
  itemsDone: number;
  itemsTarget: number;
  passing: number;
  pending: number;
  failing: number;
  setup: number;
  deadlineLabel: string;
  deadlineMs: number;
  finishes: { code: string; at: string }[];
  history: { weekStart: string; percent: number }[];
}) {
  const first = finishes[0];
  const last = finishes[finishes.length - 1];

  return (
    <div className="mb-3 grid gap-3 sm:grid-cols-3">
      <Card
        title="Completion"
        hint={`New photo + comment on all ${WEEKLY_ITEM_TARGET}, every week`}
      >
        <div className="flex h-full items-center justify-center">
          <Dial percent={percent} caption={`${itemsDone} of ${itemsTarget}`} />
        </div>
      </Card>

      {history.length > 1 ? (
        <Card
          title="Completion by week"
          hint="Last 8 weeks · fixed 0–100 scale"
          className="sm:col-span-2"
        >
          <div className="flex h-full flex-col justify-end">
            <Trend
              points={history}
              labelLeft={formatWeekStart(history[0].weekStart)}
              labelRight="This week"
            />
          </div>
        </Card>
      ) : null}

      <Card
        title="Where venues stand"
        hint={`Passing has all ${WEEKLY_ITEM_TARGET} · Not set up has no items yet`}
        className="sm:col-span-2"
      >
        <div
          className={`grid gap-6 ${
            setup ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
          }`}
        >
          <Stat label="Passing" value={passing} />
          <Stat label="Pending" value={pending} />
          <Stat
            label="Failing"
            value={failing}
            tone={failing ? "text-fail" : ""}
          />
          {setup ? <Stat label="Not set up" value={setup} /> : null}
        </div>
      </Card>

      <Card title="Deadline" hint={deadlineLabel}>
        <p className="font-mono text-3xl leading-none tabular-nums">
          <Countdown deadlineMs={deadlineMs} />
        </p>
        <p className="label mt-4">
          <Clock />
        </p>
        <p className="label mt-1">
          <Weather />
        </p>
      </Card>

      {/* Hidden until someone has finished — an empty card teaches nothing and
          takes the same room. */}
      {first ? (
        <Card
          title="Turnaround"
          hint={`When the ${WEEKLY_ITEM_TARGET}th photo landed`}
          className="sm:col-span-3"
        >
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="label">First in</p>
              <p className="mt-2 font-mono text-lg">
                {first.code}
                <span className="text-muted"> · {formatFinish(first.at)}</span>
              </p>
            </div>
            {last && last.code !== first.code ? (
              <div>
                <p className="label">Last in</p>
                <p className="mt-2 font-mono text-lg">
                  {last.code}
                  <span className="text-muted"> · {formatFinish(last.at)}</span>
                </p>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
