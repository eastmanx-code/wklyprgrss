/**
 * Completion over the last few weeks, as a filled area.
 *
 * The one metric the board was missing: a number on its own says where you
 * are, not whether it is getting better. Plain SVG on a 0–100 scale so the
 * shape means the same thing every week — an auto-scaled axis would make a bad
 * week look like a good one.
 */
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

  const W = 100;
  // Tall relative to the width so a 30-point swing actually looks like one;
  // at a shallower box the whole quarter read as a flat line.
  const H = 42;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (percent: number) => H - (Math.min(100, percent) / 100) * H;

  // Smoothed with a midpoint curve rather than straight segments: weekly
  // completion is a trend, and the kinks of a polyline imply precision between
  // readings that isn't there.
  const line = points
    .map((p, i, all) => {
      const px = x(i);
      const py = y(p.percent);
      if (i === 0) return `M ${px.toFixed(2)} ${py.toFixed(2)}`;
      const prevX = x(i - 1);
      const prevY = y(all[i - 1].percent);
      const midX = (prevX + px) / 2;
      return `C ${midX.toFixed(2)} ${prevY.toFixed(2)}, ${midX.toFixed(2)} ${py.toFixed(2)}, ${px.toFixed(2)} ${py.toFixed(2)}`;
    })
    .join(" ");
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  const latest = points[points.length - 1];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-28 w-full"
        aria-hidden
      >
        <path d={area} fill="var(--ink)" opacity="0.08" />
        <path
          d={line}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={x(points.length - 1)}
          cy={y(latest.percent)}
          r="2"
          fill="var(--ink)"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mt-2 flex justify-between">
        <span className="label">{labelLeft}</span>
        <span className="label">{labelRight}</span>
      </div>
    </div>
  );
}
