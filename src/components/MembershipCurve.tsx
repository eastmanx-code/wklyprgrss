import type { GrowthPoint } from "@/lib/peoplevine";

/**
 * Today's members by the month they joined, run forward to the current total.
 *
 * WHAT IT IS NOT. This is not headcount over time. PeopleVine stores the day a
 * membership began and nothing for the day it ended, so the 192 people who
 * have left are absent from the line entirely. The curve therefore sits low in
 * the early years and is exact only at the right hand end, where it lands on
 * the real number of members today. Saying that on the chart matters more than
 * the chart: a line read as headcount would make the club look like it has
 * only ever grown.
 *
 * What it does show honestly is WHEN the people who are still here arrived,
 * and that is where the stall shows up as a flat run at the right hand edge.
 *
 * Straight segments, not a bezier, following Trend: a smoothed curve implies
 * readings between the months that do not exist and reads as decoration.
 */
const W = 100;
const H = 100;

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1))
    .toLocaleDateString("en-US", { timeZone: "UTC", month: "short", year: "numeric" })
    .toUpperCase();
}

export function MembershipCurve({
  points,
  flatMonths,
}: {
  points: GrowthPoint[];
  /** How many months at the end added nobody, stated under the chart. */
  flatMonths: number;
}) {
  if (points.length < 2) return null;

  const top = Math.max(...points.map((p) => p.total)) || 1;
  const busiest = Math.max(...points.map((p) => p.joined)) || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (n: number) => H - (n / top) * H;

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(p.total).toFixed(2)}`)
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div>
      <div className="flex gap-3">
        {/* The axis carries the real numbers. A line with no scale gets read
            as whatever shape the reader wants it to be. */}
        <div className="label flex w-10 shrink-0 flex-col justify-between py-[2px] text-right tabular-nums">
          <span>{top}</span>
          <span>{Math.round(top / 2)}</span>
          <span>0</span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-44 w-full"
          role="img"
          aria-label={`Members by join month, ${monthLabel(first.month)} to ${monthLabel(last.month)}, ending at ${last.total}`}
        >
          {[25, 50, 75].map((g) => (
            <line
              key={g}
              x1="0"
              x2={W}
              y1={H - g}
              y2={H - g}
              stroke="currentColor"
              strokeWidth="0.3"
              className="text-muted"
              opacity="0.25"
            />
          ))}
          {/* Joins per month behind the running total, on its own scale, so a
              flat stretch in the curve is visibly a month that added nobody
              rather than just a gentle slope. */}
          {points.map((p, i) => {
            if (!p.joined) return null;
            const h = (p.joined / busiest) * (H * 0.45);
            return (
              <rect
                key={p.month}
                x={x(i) - 0.35}
                y={H - h}
                width="0.7"
                height={h}
                fill="currentColor"
                className="text-muted"
                opacity="0.45"
              />
            );
          })}
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
            className="text-ink"
          />
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-4 pl-[52px]">
        <p className="label">{monthLabel(first.month)}</p>
        <p className="label">
          {monthLabel(last.month)} · {last.total} members
        </p>
      </div>
      <p className="label mt-3 leading-relaxed">
        Today&apos;s members by the month they joined, running total, with the
        bars showing how many joined each month.
        {flatMonths > 0
          ? ` Nobody has joined in the last ${flatMonths} ${flatMonths === 1 ? "month" : "months"}.`
          : ""}{" "}
        PeopleVine does not record when a membership ends, so the {""}
        people who have left are not in this line and the early years read low.
      </p>
    </div>
  );
}
