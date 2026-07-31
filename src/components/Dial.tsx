/**
 * The completion ring — the only centred element on the board, per the layout
 * rule that everything else inside a card is left-aligned.
 *
 * 56px hero numeral, no tracking: letter-spacing is reserved for 11px labels,
 * and on large figures it reads as a gap rather than as style.
 */
export function Dial({
  percent,
  caption,
  tone = "var(--ink)",
}: {
  percent: number;
  caption: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div
        className="relative aspect-square w-full max-w-[192px] rounded-full"
        style={{
          background: `conic-gradient(${tone} ${percent}%, var(--divider) 0)`,
        }}
      >
        <div className="bg-surface absolute inset-[16%] flex flex-col items-center justify-center rounded-full">
          <span className="text-hero text-ink leading-[1.2] tracking-normal tabular-nums">
            {percent}%
          </span>
          <span className="label mt-2">{caption}</span>
        </div>
      </div>
    </div>
  );
}
