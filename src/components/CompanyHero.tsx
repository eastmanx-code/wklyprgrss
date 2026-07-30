import { ClockRow, CountdownRow, WeatherRow } from "./DashLive";
import { DashRow } from "./DashRow";
import type { WeekStatus } from "@/lib/types";

/**
 * Every venue as one dot, in the order the list below shows them. Twenty-seven
 * numbers is a table; twenty-seven dots is a glance.
 */
function StatusBand({ statuses }: { statuses: WeekStatus[] }) {
  return (
    <div className="panel mb-3 flex flex-wrap gap-1.5 px-5 py-4">
      {statuses.map((status, index) => (
        <span
          key={index}
          className={`h-3 w-3 rounded-full ${
            status === "PASS"
              ? "bg-ink"
              : status === "FAIL"
                ? "bg-fail"
                : "bg-ink/20"
          }`}
          title={status}
        />
      ))}
    </div>
  );
}

/**
 * The company's week at a glance: how much of it is done, how long is left,
 * and the shape of all venues.
 *
 * The dial is the largest thing here — it is the one number anyone opens this
 * page for. Beside it the numbers are a dense readout rather than a grid of
 * tiles: tiles stretched to the dial's height left each one nearly empty, so
 * the rows flex instead and the stack always ends level with the dial.
 */
export function CompanyHero({
  percent,
  itemsDone,
  itemsTarget,
  passing,
  pending,
  failing,
  notStarted,
  statuses,
  deadlineLabel,
  deadlineMs,
}: {
  percent: number;
  itemsDone: number;
  itemsTarget: number;
  passing: number;
  pending: number;
  failing: number;
  notStarted: number;
  statuses: WeekStatus[];
  deadlineLabel: string;
  deadlineMs: number;
}) {
  const total = statuses.length;
  const share = (count: number) => (total ? count / total : 0);

  return (
    <>
      <section className="mb-3 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="panel flex items-center justify-center p-5 sm:p-6">
          {/* Smaller cap on phones: at full width the dial alone filled the
              screen and pushed the venue list two scrolls down. */}
          <div
            className="relative aspect-square w-full max-w-[220px] rounded-full sm:max-w-[400px]"
            style={{
              background: `conic-gradient(var(--ink) ${percent}%, color-mix(in srgb, var(--ink) 12%, var(--panel)) 0)`,
            }}
          >
            <div className="bg-panel absolute inset-[12%] flex flex-col items-center justify-center rounded-full">
              <span className="font-mono text-6xl leading-none tabular-nums">
                {percent}%
              </span>
              <span className="label mt-2">
                {itemsDone} of {itemsTarget} photos
              </span>
            </div>
          </div>
        </div>

        <div className="panel divide-ink/10 flex flex-col divide-y overflow-hidden">
          <CountdownRow deadlineMs={deadlineMs} />
          {/* Not "venues finished" — that is the same number as Passing, and
              two rows saying six is worse than one. This one is the thing
              anyone can act on. */}
          <DashRow
            label="Photos left"
            value={Math.max(0, itemsTarget - itemsDone)}
            fill={itemsTarget ? 1 - itemsDone / itemsTarget : 0}
          />
          <DashRow
            label="Passing"
            value={
              <>
                {passing}
                <span className="text-muted text-base">/{total}</span>
              </>
            }
            fill={share(passing)}
          />
          <DashRow label="Pending" value={pending} fill={share(pending)} />
          <DashRow
            label="Failing"
            value={failing}
            fill={share(failing)}
            tone="bg-fail/25"
          />
          <DashRow
            label="Not started"
            value={notStarted}
            fill={share(notStarted)}
          />
          <ClockRow />
          <WeatherRow />
        </div>
      </section>

      <section className="panel mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-4">
        <p className="label">Everything due</p>
        <p className="font-mono text-lg tabular-nums">{deadlineLabel}</p>
      </section>

      <StatusBand statuses={statuses} />
    </>
  );
}
