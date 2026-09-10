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
  label,
  tone = "var(--ink)",
  size = 176,
}: {
  percent: number;
  caption: React.ReactNode;
  /**
   * What to print inside the ring, when it is not the percentage. The
   * checklists score out of ten everywhere else, and a ring that says 73%
   * beside a row that says 7/10 is one number in two units.
   */
  label?: string;
  tone?: string;
  /**
   * How wide the ring is allowed to get. It shrinks to fit a narrower column
   * either way; this is what stops it filling a whole card when the card is
   * the width of the page.
   */
  size?: number;
}) {
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * C;

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative aspect-square w-full"
        style={{ maxWidth: `${size}px` }}
      >
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

        {/* The percentage alone inside the ring, and as big as the ring
            allows. It had the caption under it in here, and the space inside a
            circle is a circle: "200 OF 210" is wider than the chord it was
            sitting on, so the stroke cut through both ends of it. Widening the
            ring only moves where it clips. */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Sized to what is printed. "8/10" is a character wider than
              "80%" and at the same size it touched the stroke. */}
          <span
            className="text-ink leading-none tracking-normal tabular-nums"
            style={{
              fontSize: `${Math.round(size * ((label ?? `${percent}%`).length > 3 ? 0.22 : 0.3))}px`,
            }}
          >
            {label ?? `${percent}%`}
          </span>
        </div>
      </div>

      {/* Out here, where it has the full width of the column and can say what
          the percentage is a percentage of. */}
      <p className="label mt-3 text-center">{caption}</p>
    </div>
  );
}
