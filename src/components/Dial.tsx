/**
 * The completion ring.
 *
 * SVG stroke rather than a conic gradient: a conic has no cap control, and at
 * 1% the wedge clipped by the border-radius rendered as a floating dot. Butt
 * caps keep a 1% arc reading as a tick on the circumference.
 *
 * The only centred element on the board — everything else inside a card is
 * left-aligned.
 */
const R = 42;
const C = 2 * Math.PI * R;

export function Dial({
  percent,
  caption,
  tone = "var(--ink)",
}: {
  percent: number;
  caption: string;
  tone?: string;
}) {
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * C;

  return (
    <div className="flex items-center justify-center">
      <div className="relative aspect-square w-full max-w-[176px]">
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="var(--inset)"
            strokeWidth="10"
          />
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={tone}
            strokeWidth="10"
            strokeLinecap="butt"
            strokeDasharray={`${filled} ${C}`}
            transform="rotate(-90 50 50)"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-hero text-ink leading-[1.2] tracking-normal tabular-nums">
            {percent}%
          </span>
          <span className="label mt-2">{caption}</span>
        </div>
      </div>
    </div>
  );
}
