import type { GrowthPoint } from "@/lib/peoplevine";

/**
 * Today's members by the quarter they joined, run forward to the current total.
 *
 * BUILT TO MATCH THE HOUSE TREND, down to the mechanics. The plot is a
 * positioned box with the line in a stretched SVG behind it and the dots as
 * absolutely positioned spans on top. Drawing the dots inside the SVG is what
 * made them lozenges: preserveAspectRatio="none" stretches user units, so a
 * circle comes out an ellipse and a square comes out a rectangle. In percent
 * they stay round, which is the same trick Trend uses.
 *
 * Quarterly, not monthly. Sixty monthly points drew a smooth rope with no
 * readings visible on it, which reads as decoration rather than measurement.
 * Twenty quarters gives a visible change between two dates you can name.
 *
 * WHAT IT IS NOT. Not headcount over time. PeopleVine stores the day a
 * membership began and nothing for the day it ended, so everyone who has left
 * is absent. It is exact only at the right hand end, where it lands on the
 * real number of members today, and it reads low in the early years.
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

/** The running total at the end of each quarter, with the latest month last. */
function toQuarters(points: GrowthPoint[]) {
  const out: { month: string; total: number }[] = [];
  for (const p of points) {
    if (Number(p.month.split("-")[1]) % 3 === 0) {
      out.push({ month: p.month, total: p.total });
    }
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
  // HEADROOM. Scaling to the maximum puts the newest reading on the top edge,
  // where the line has nowhere to go and looks capped rather than current.
  // Round up past it to a clean number instead.
  const peak = Math.max(...quarters.map((p) => p.total)) || 1;
  const step = peak > 2000 ? 500 : peak > 400 ? 100 : peak > 100 ? 50 : 10;
  const top = Math.ceil((peak * 1.12) / step) * step;

  const series = [{ month: points[0].month, total: 0 }, ...quarters];
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (n: number) => H - (n / top) * H;

  const path = series
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(p.total).toFixed(2)}`)
    .join(" ");
  // The same line closed down to the baseline. It reads as a quantity filling
  // up rather than a value wandering, which is what a running total is.
  const area = `${path} L ${W} ${H} L 0 ${H} Z`;

  return (
    <div className="min-w-0">
      <div className="flex gap-3">
        <div className="bg-inset relative min-w-0 flex-1 overflow-hidden">
          <div className="relative h-48 w-full">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              aria-hidden
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
              <path d={area} fill="currentColor" className="text-ink" opacity="0.12" />
              <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                className="text-ink"
              />
            </svg>

            {/* One dot per quarter, positioned in percentages rather than user
                units so they stay round under the stretched viewBox. */}
            {series.slice(1).map((p, i) => (
              <span
                key={p.month}
                className={`bg-ink absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${
                  i === series.length - 2 ? "h-2 w-2" : "h-1.5 w-1.5"
                }`}
                style={{ left: `${x(i + 1)}%`, top: `${y(p.total)}%` }}
                aria-hidden
              />
            ))}
          </div>
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
