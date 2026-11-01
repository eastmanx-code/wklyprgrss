import type { GrowthPoint } from "@/lib/peoplevine";

/**
 * Today's members by the quarter they joined, run forward to the current total.
 *
 * BUILT TO MATCH THE HOUSE TREND. Inset plot, gridlines, scale down the right,
 * straight segments with a dot on every reading. B pointed at the dashboard's
 * chart and said the angles were missing: sixty monthly points drew a smooth
 * rope with no readings visible on it, which reads as decoration rather than
 * measurement. Quarterly gives about twenty points, so every segment is a real
 * change between two dates you can see.
 *
 * WHAT IT IS NOT. Not headcount over time. PeopleVine stores the day a
 * membership began and nothing for the day it ended, so everyone who has left
 * is absent. It is exact only at the right hand end, where it lands on the
 * real number of members today, and it reads low in the early years. Drawn as
 * headcount it would say the club has only ever grown.
 */
const W = 100;
const H = 100;

function quarterLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `Q${Math.floor((m - 1) / 3) + 1} ${String(y).slice(2)}`;
}

function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1))
    .toLocaleDateString("en-US", { timeZone: "UTC", month: "short", year: "numeric" })
    .toUpperCase();
}

/** The running total at the end of each quarter, plus a zero to start from. */
function toQuarters(points: GrowthPoint[]) {
  const out: { month: string; total: number }[] = [];
  for (const p of points) {
    const m = Number(p.month.split("-")[1]);
    if (m % 3 === 0) out.push({ month: p.month, total: p.total });
  }
  const last = points[points.length - 1];
  if (!out.length || out[out.length - 1].month !== last.month) {
    out.push({ month: last.month, total: last.total });
  }
  return out;
}

export function MembershipCurve({
  points,
  flatMonths,
}: {
  points: GrowthPoint[];
  flatMonths: number;
}) {
  if (points.length < 2) return null;

  const quarters = toQuarters(points);
  if (quarters.length < 2) return null;

  const last = points[points.length - 1];
  const busiest = points.reduce((a, b) => (b.joined > a.joined ? b : a), points[0]);
  const top = Math.max(...quarters.map((p) => p.total)) || 1;

  const series = [{ month: points[0].month, total: 0 }, ...quarters];
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (n: number) => H - (n / top) * H;
  const line = series
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(p.total).toFixed(2)}`)
    .join(" ");

  return (
    <div className="min-w-0">
      <div className="flex gap-3">
        <div className="bg-inset min-w-0 flex-1 p-2">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="h-48 w-full overflow-visible"
            role="img"
            aria-label={`Members by the quarter they joined, ${monthName(points[0].month)} to ${monthName(last.month)}, ending at ${last.total}`}
          >
            {[25, 50, 75].map((g) => (
              <line
                key={g}
                x1="0"
                x2={W}
                y1={H - g}
                y2={H - g}
                stroke="currentColor"
                strokeWidth="0.4"
                className="text-muted"
                opacity="0.3"
              />
            ))}
            <path
              d={line}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              className="text-ink"
            />
            {/* A dot on every reading, as the house trend has. The plot is
                stretched by preserveAspectRatio, so a circle would render as
                an ellipse: these are drawn as squares in the viewBox and set
                upright by the same stretch. Angular suits the page anyway. */}
            {series.slice(1).map((p, i) => {
              const cx = x(i + 1);
              const cy = y(p.total);
              return (
                <rect
                  key={p.month}
                  x={cx - 0.5}
                  y={cy - 1.6}
                  width="1"
                  height="3.2"
                  fill="currentColor"
                  className="text-ink"
                />
              );
            })}
          </svg>
        </div>
        <div className="label flex w-10 shrink-0 flex-col justify-between py-1 tabular-nums">
          <span>{top}</span>
          <span>{Math.round(top / 2)}</span>
          <span>0</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap justify-between gap-x-4 pr-[52px]">
        <p className="label">{quarterLabel(points[0].month)}</p>
        <p className="label">
          {quarterLabel(last.month)} · {last.total} members
        </p>
      </div>
      <p className="label mt-1 leading-relaxed">
        Members today, by the quarter they joined · busiest month{" "}
        {monthName(busiest.month)} with {busiest.joined}
        {flatMonths > 0
          ? ` · nobody in ${flatMonths} ${flatMonths === 1 ? "month" : "months"}`
          : ""}
      </p>
    </div>
  );
}
