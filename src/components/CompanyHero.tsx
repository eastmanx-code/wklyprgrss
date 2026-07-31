import { Card } from "./Card";
import { Clock, Countdown, Weather } from "./DashLive";
import { Dial } from "./Dial";
import { Trend } from "./Trend";
import { WEEKLY_ITEM_TARGET } from "@/lib/status";
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
          accent ? "text-fail" : "text-ink"
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
    <div className="mb-12 grid grid-cols-12 gap-4">
      <Card
        title="Completion"
        hint={`New photo + comment on all ${WEEKLY_ITEM_TARGET}, every week`}
        className="col-span-12 sm:col-span-4"
      >
        <Dial percent={percent} caption={`${itemsDone} of ${itemsTarget}`} />
      </Card>

      {history.length > 1 ? (
        <Card
          title="Completion by week"
          hint="Last 8 weeks · fixed 0–100 scale"
          className="col-span-12 sm:col-span-8"
        >
          <Trend
            points={history}
            labelLeft={formatWeekStart(history[0].weekStart)}
            labelRight="This week"
          />
        </Card>
      ) : null}

      <Card
        title="Where venues stand"
        hint={`Passing has all ${WEEKLY_ITEM_TARGET} · not set up has no items yet`}
        className="col-span-12 sm:col-span-8"
      >
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Passing" value={passing} />
          <Stat label="Pending" value={pending} />
          <Stat label="Failing" value={failing} accent={failing > 0} />
          <Stat label="Not set up" value={setup} />
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
          <Clock />
        </p>
        <p className="label mt-2">
          <Weather />
        </p>
      </Card>

      {/* Hidden until someone has finished: an empty card teaches nothing and
          takes the same room. */}
      {first ? (
        <Card
          title="Turnaround"
          hint={`When the ${WEEKLY_ITEM_TARGET}th photo landed`}
          className="col-span-12"
        >
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
        </Card>
      ) : null}
    </div>
  );
}
