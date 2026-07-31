/**
 * Completion over the last few weeks.
 *
 * Straight segments, not a bezier: eight data points smoothed into a curve
 * implies readings between the weeks that don't exist, and reads as decorative
 * rather than measured.
 *
 * Fixed 0–100 scale so the shape means the same thing every week — an
 * auto-scaled axis would make a bad week look like a good one.
 */
const W = 100;
const H = 100;
const GRIDLINES = [25, 50, 75, 100];

export function Trend({
  points,
  labelLeft,
  labelRight,
}: {
  points: { weekStart: string; percent: number }[];
  labelLeft: string;
  labelRight: string;
}) {
  if (points.length < 2) return null;

  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (percent: number) => H - Math.min(100, Math.max(0, percent));

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(p.percent)}`)
    .join(" ");
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  const latest = points[points.length - 1];

  return (
    <div>
      <div className="flex gap-2">
        <div className="bg-inset relative max-h-[200px] min-h-[160px] flex-1 rounded-[4px]">
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
            <path d={area} fill="var(--ink)" opacity="0.06" />
            <path
              d={line}
              fill="none"
              stroke="var(--ink)"
              strokeWidth="1.5"
              strokeLinecap="butt"
              strokeLinejoin="miter"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Positioned in percentages rather than user units so the dot stays
              round under the stretched viewBox. */}
          <span
            className="bg-ink absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: "100%", top: `${y(latest.percent)}%` }}
            aria-hidden
          />
        </div>

        {/* Axis labels outside the plot: inside, they sit on the data. */}
        <div className="relative w-8 shrink-0">
          {GRIDLINES.map((g) => (
            <span
              key={g}
              className="label absolute right-0 -translate-y-1/2"
              style={{ top: `${y(g)}%` }}
            >
              {g}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex justify-between">
        <span className="label">{labelLeft}</span>
        <span className="label">
          {labelRight} · {latest.percent}%
        </span>
      </div>
    </div>
  );
}
