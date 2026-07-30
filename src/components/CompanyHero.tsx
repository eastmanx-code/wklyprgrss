import { Clock, Countdown, Weather } from "./DashLive";
import { Dial } from "./Dial";
import { formatFinish } from "@/lib/week";
import type { WeekStatus } from "@/lib/types";

/** A number that carries itself, with the label kept quiet underneath it. */
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
      <p className={`font-mono text-4xl leading-none tabular-nums ${tone}`}>
        {value}
      </p>
      <p className="label mt-2">{label}</p>
    </div>
  );
}

/**
 * The company's week: one dial, a few numbers, and every venue as a dot.
 *
 * Kept to those three things on purpose. An earlier pass had a half-dial, four
 * small rings and a stack of bars all on one screen, which turned a glanceable
 * page into an instrument cluster.
 */
export function CompanyHero({
  percent,
  itemsDone,
  itemsTarget,
  passing,
  pending,
  failing,
  statuses,
  deadlineLabel,
  deadlineMs,
  finishes,
}: {
  percent: number;
  itemsDone: number;
  itemsTarget: number;
  passing: number;
  pending: number;
  failing: number;
  statuses: WeekStatus[];
  deadlineLabel: string;
  deadlineMs: number;
  finishes: { code: string; at: string }[];
}) {
  const first = finishes[0];
  const last = finishes[finishes.length - 1];

  return (
    <>
      <section className="mb-8 grid items-center gap-8 sm:grid-cols-[auto_minmax(0,1fr)]">
        <Dial percent={percent} caption={`${itemsDone} of ${itemsTarget}`} />

        <div className="space-y-8">
          <Stat
            label="Time left"
            value={<Countdown deadlineMs={deadlineMs} />}
          />
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Passing" value={passing} />
            <Stat label="Pending" value={pending} />
            <Stat
              label="Failing"
              value={failing}
              tone={failing ? "text-fail" : ""}
            />
          </div>
        </div>
      </section>

      <div className="mb-8 flex flex-wrap gap-1.5">
        {statuses.map((status, index) => (
          <span
            key={index}
            className={`h-3 w-3 rounded-full ${
              status === "PASS"
                ? "bg-ink"
                : status === "FAIL"
                  ? "bg-fail"
                  : "bg-ink/15"
            }`}
            title={status}
          />
        ))}
      </div>

      {/* Who got it in early and who cut it fine — the part people actually
          compete over. Only shown once someone has finished. */}
      {first ? (
        <dl className="mb-8 grid grid-cols-2 gap-6">
          <div>
            <dt className="label">First in</dt>
            <dd className="mt-2 font-mono text-lg">
              {first.code}
              <span className="text-muted"> · {formatFinish(first.at)}</span>
            </dd>
          </div>
          {last && last.code !== first.code ? (
            <div>
              <dt className="label">Last in</dt>
              <dd className="mt-2 font-mono text-lg">
                {last.code}
                <span className="text-muted"> · {formatFinish(last.at)}</span>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <p className="label mb-8">
        Due {deadlineLabel} · <Clock /> · <Weather />
      </p>
    </>
  );
}
