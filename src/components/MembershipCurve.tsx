import type { GrowthPoint } from "@/lib/peoplevine";

/**
 * Today's members by the month they joined, run forward to the current total.
 *
 * Built to sit beside the ring in the same band as the dashboard's house
 * trend: inset plot, straight segments, scale down the right hand side, and
 * what the line is in words underneath.
 *
 * WHAT IT IS NOT. Not headcount over time. PeopleVine stores the day a
 * membership began and nothing for the day it ended, so everyone who has left
 * is absent. It is exact only at the right hand end, where it lands on the
 * real number of members today, and it reads low in the early years. Drawn as
 * headcount it would say the club has only ever grown.
 *
 * ONE LINE, ONE SCALE. The first version drew per-month joins as bars behind
 * the running total. Two series on one plot with two scales is two charts
 * overlaid, and the launch month made it worse: about 250 of today's members
 * joined in October 2021, so that bar set the scale and every month since was
 * a sliver. The launch is a sentence, not a bar.
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
  /** How many months at the end added nobody. */
  flatMonths: number;
}) {
  if (points.length < 2) return null;

  const top = Math.max(...points.map((p) => p.total)) || 1;
  const last = points[points.length - 1];
  const busiest = points.reduce((a, b) => (b.joined > a.joined ? b : a), points[0]);

  // Starts at zero the month before the first join, so the line rises out of
  // the axis instead of beginning in mid air at the launch cohort's height.
  const series = [{ month: points[0].month, total: 0 }, ...points];
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (n: number) => H - (n / top) * H;
  const line = series
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(p.total).toFixed(2)}`)
    .join(" ");

  const half = Math.round(top / 2);

  return (
    <div className="min-w-0">
      <div className="flex gap-3">
        <div className="bg-inset min-w-0 flex-1 rounded-[4px] p-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="h-44 w-full"
            role="img"
            aria-label={`Members by join month, ${monthLabel(points[0].month)} to ${monthLabel(last.month)}, ending at ${last.total}`}
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
          </svg>
        </div>
        {/* Scale on the right, as the house trend has it. */}
        <div className="label flex w-10 shrink-0 flex-col justify-between py-1 tabular-nums">
          <span>{top}</span>
          <span>{half}</span>
          <span>0</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap justify-between gap-x-4 pr-[52px]">
        <p className="label">{monthLabel(points[0].month)}</p>
        <p className="label">
          {monthLabel(last.month)} · {last.total} members
        </p>
      </div>
      <p className="label mt-1 leading-relaxed">
        Members today, by the month they joined · busiest {monthLabel(busiest.month)}{" "}
        with {busiest.joined}
        {flatMonths > 0
          ? ` · nobody in ${flatMonths} ${flatMonths === 1 ? "month" : "months"}`
          : ""}
      </p>
    </div>
  );
}
