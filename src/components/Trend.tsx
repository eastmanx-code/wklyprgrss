/**
 * Two measures over the last few weeks: what was handed in, and what was
 * signed off.
 *
 * One line was filing alone, which is the easier of the two and the one that
 * mostly only goes up. Filing climbed 83 → 92 → 95 across three weeks while
 * the share that passed went 67 → 83 → 80, and a chart of filing alone drew
 * that as a straight improvement. The gap between the lines is the week's
 * send-backs, which is the part worth looking at.
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
  target,
  showApproved = true,
}: {
  points: { weekStart: string; percent: number; approvedPercent: number }[];
  labelLeft: string;
  labelRight: string;
  /**
   * The win line, drawn across the plot. A chart with no target says how the
   * number moved but not whether it is where it should be, and the reader
   * supplies their own standard.
   */
  target?: number;
  /** Off for a house that is not being scored yet — it has nothing signed off. */
  showApproved?: boolean;
}) {
  if (points.length < 2) return null;

  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (percent: number) => H - Math.min(100, Math.max(0, percent));

  const path = (pick: (p: (typeof points)[number]) => number) =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(pick(p))}`)
      .join(" ");

  const filedLine = path((p) => p.percent);
  const approvedLine = path((p) => p.approvedPercent);
  // The solid line is whichever measure this house is actually judged on.
  const leadLine = showApproved ? approvedLine : filedLine;
  const latest = points[points.length - 1];
  const lead = showApproved ? latest.approvedPercent : latest.percent;

  return (
    // Fills the height it is given, so it stands beside the ring rather than
    // floating at the top of the row with dead space under it.
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

            {target !== undefined ? (
              <line
                x1="0"
                x2={W}
                y1={y(target)}
                y2={y(target)}
                stroke="var(--warn)"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.6"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}

            <path
              d={`${leadLine} L ${W} ${H} L 0 ${H} Z`}
              fill="var(--ink)"
              opacity="0.06"
            />

            {/* Filing sits behind, dashed and dimmed: it is the input, and the
                space between the two lines is what got sent back. */}
            {showApproved ? (
              <path
                d={filedLine}
                fill="none"
                stroke="var(--ink)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.4"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}

            <path
              d={leadLine}
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
            style={{ left: "100%", top: `${y(lead)}%` }}
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

      {/* Two lines need saying which is which. The target does not — it is
          the only coloured thing on the plot and the card says what it is. */}
      <div className="mt-3 flex items-baseline justify-between gap-x-4">
        <span className="label shrink-0">{labelLeft}</span>
        <span className="label shrink-0">
          {labelRight} · {lead}%
        </span>
      </div>
      {showApproved ? (
        <p className="label mt-1">solid signed off · dashed filed</p>
      ) : null}
    </div>
  );
}
