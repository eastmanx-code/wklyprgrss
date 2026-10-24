/**
 * Every store's nightly score, one line each.
 *
 * The group screen used to draw a single aggregate line, which answers "how is
 * the company doing" and hides the thing a group lead actually needs, which is
 * which building is the one dragging. So every store is its own line over the
 * window. The two that matter are drawn in weight, the best and the worst, and
 * the rest fade to faint context behind them so the shape reads without a
 * legend and without turning to spaghetti.
 *
 * Straight segments, a fixed 0 to 100 scale and the 80 target line, the same
 * as the single Trend, so a line here means the same as a line there.
 */
const W = 100;
const H = 100;
const GRIDLINES = [25, 50, 75, 100];

type Store = {
  code: string;
  points: { night: string; percent: number }[];
};

export function AllStoresTrend({
  window,
  stores,
  bestCode,
  worstCode,
  labelLeft,
  labelRight,
}: {
  /** The shared date axis, oldest first. */
  window: string[];
  stores: Store[];
  bestCode: string | null;
  worstCode: string | null;
  labelLeft: string;
  labelRight: string;
}) {
  if (window.length < 2) return null;

  const index = new Map(window.map((n, i) => [n, i]));
  const x = (i: number) => (i / (window.length - 1)) * W;
  const y = (percent: number) => H - Math.min(100, Math.max(0, percent));

  const pathFor = (store: Store): string | null => {
    const seq = store.points
      .map((p) => ({ i: index.get(p.night), percent: p.percent }))
      .filter((o): o is { i: number; percent: number } => o.i !== undefined)
      .sort((a, b) => a.i - b.i);
    if (seq.length < 2) return null;
    return seq
      .map(
        (o, k) => `${k === 0 ? "M" : "L"} ${x(o.i).toFixed(2)} ${y(o.percent).toFixed(2)}`,
      )
      .join(" ");
  };

  const faint = stores.filter(
    (s) => s.code !== bestCode && s.code !== worstCode,
  );
  const best = stores.find((s) => s.code === bestCode) ?? null;
  const worst = stores.find((s) => s.code === worstCode) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-[160px] flex-1 gap-2">
        <div className="bg-inset relative min-h-[160px] flex-1 rounded-[4px]">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            {GRIDLINES.map((g) => (
              <line
                key={g}
                x1="0"
                x2={W}
                y1={y(g)}
                y2={y(g)}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <line
              x1="0"
              x2={W}
              y1={y(80)}
              y2={y(80)}
              stroke="var(--warn)"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.6"
              vectorEffect="non-scaling-stroke"
            />

            {/* Everyone else, behind and faint: context, not clutter. */}
            {faint.map((s) => {
              const d = pathFor(s);
              return d ? (
                <path
                  key={s.code}
                  d={d}
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth="1"
                  opacity="0.14"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null;
            })}

            {/* The worst in warn, the best in ink, both in weight on top. */}
            {worst
              ? (() => {
                  const d = pathFor(worst);
                  return d ? (
                    <path
                      d={d}
                      fill="none"
                      stroke="var(--warn)"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null;
                })()
              : null}
            {best
              ? (() => {
                  const d = pathFor(best);
                  return d ? (
                    <path
                      d={d}
                      fill="none"
                      stroke="var(--ink)"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null;
                })()
              : null}
          </svg>
        </div>

        <div className="relative w-8 shrink-0">
          {GRIDLINES.filter((g) => Math.abs(g - 80) >= 10).map((g) => (
            <span
              key={g}
              className="label absolute right-0 -translate-y-1/2"
              style={{ top: `${y(g)}%` }}
            >
              {g}
            </span>
          ))}
          <span
            className="label text-warn absolute right-0 -translate-y-1/2"
            style={{ top: `${y(80)}%` }}
          >
            80
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-x-4">
        <span className="label shrink-0">{labelLeft}</span>
        <span className="label shrink-0">{labelRight}</span>
      </div>
      <p className="label mt-1">
        <span className="text-ink">bold</span> best · <span className="text-warn">bold</span>{" "}
        worst · faint the rest
      </p>
    </div>
  );
}
