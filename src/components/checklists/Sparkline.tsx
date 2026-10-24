/**
 * A store's run as a hairline, no axes and no grid.
 *
 * Thirty nights of its signed-off rate, so the shape reads right next to the
 * number: climbing, flat, or sliding. One line needs no legend; the code and
 * the average beside it say whose it is and how much. The colour is carried by
 * the row (currentColor), warn where the store is failing and muted where it
 * is not, so the line joins the same loud-and-quiet range as everything else.
 */
export function Sparkline({
  points,
  width = 112,
  height = 28,
  className = "shrink-0",
}: {
  points: { percent: number }[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (points.length < 2) {
    return (
      <span
        className="label text-muted inline-block text-center"
        style={{ width }}
        aria-hidden
      >
        —
      </span>
    );
  }
  const pad = 3;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const n = points.length;
  const x = (i: number) => pad + (i / (n - 1)) * w;
  const y = (p: number) => pad + (1 - Math.max(0, Math.min(100, p)) / 100) * h;
  const d = points
    .map(
      (pt, i) =>
        `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(pt.percent).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
