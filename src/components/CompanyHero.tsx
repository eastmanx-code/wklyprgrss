import type { WeekStatus } from "@/lib/types";

/** Small labelled tile that fills to its own share. */
function Stat({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const percent = total ? (count / total) * 100 : 0;
  return (
    <div className="panel relative overflow-hidden px-5 py-4">
      <div
        className="bg-ink/10 absolute inset-y-0 left-0"
        style={{ width: `${percent}%` }}
        aria-hidden
      />
      <p className="label relative">{label}</p>
      <p className="relative mt-1 font-mono text-2xl tabular-nums">{count}</p>
    </div>
  );
}

/**
 * The company's week at a glance: a dial that fills, the deadline, and the
 * shape of all venues. Lives on the board — the place people go to see how
 * everyone is doing — rather than on the sign-in screen.
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
}: {
  percent: number;
  itemsDone: number;
  itemsTarget: number;
  passing: number;
  pending: number;
  failing: number;
  statuses: WeekStatus[];
  deadlineLabel: string;
}) {
  const total = statuses.length;

  return (
    <>
      <section className="mb-3 flex max-h-[184px] gap-3">
        <div
          // Capped: 38% of a 1152px container is a 440px circle, and the
          // pills stretch to match it.
          className="relative aspect-square w-[38%] max-w-[184px] shrink-0 rounded-full"
          style={{
            background: `conic-gradient(var(--ink) ${percent}%, var(--panel) 0)`,
          }}
        >
          <div className="bg-surface absolute inset-[11%] flex flex-col items-center justify-center rounded-full">
            <span className="font-mono text-4xl leading-none tabular-nums">
              {percent}%
            </span>
            <span className="label mt-1">
              {itemsDone}/{itemsTarget}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="panel relative flex flex-1 flex-col justify-center overflow-hidden rounded-full px-6 py-3">
            <div
              className="bg-ink/10 absolute inset-y-0 left-0"
              style={{ width: `${total ? (passing / total) * 100 : 0}%` }}
              aria-hidden
            />
            <p className="label relative">Venues finished</p>
            <p className="relative mt-1 font-mono text-xl tabular-nums">
              {passing}
              <span className="text-muted">/{total}</span>
            </p>
          </div>
          <div className="panel flex flex-1 flex-col justify-center rounded-full px-6 py-3">
            <p className="label">Due</p>
            <p className="mt-1 font-mono text-xs leading-snug">
              {deadlineLabel}
            </p>
          </div>
        </div>
      </section>

      <section className="mb-3 grid grid-cols-3 gap-3">
        <Stat label="Passing" count={passing} total={total} />
        <Stat label="Pending" count={pending} total={total} />
        <Stat label="Failing" count={failing} total={total} />
      </section>
    </>
  );
}
