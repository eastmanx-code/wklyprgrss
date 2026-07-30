/**
 * The completion dial. The one number anyone opens the app for, so it stays
 * the largest thing on the page — but bare, with no tile around it: the panel
 * it used to sit in added a box the design doesn't need.
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
    <div
      className="relative mx-auto aspect-square w-[190px] shrink-0 rounded-full sm:mx-0 sm:w-[240px]"
      style={{
        background: `conic-gradient(${tone} ${percent}%, color-mix(in srgb, var(--ink) 10%, var(--paper)) 0)`,
      }}
    >
      <div className="bg-paper absolute inset-[13%] flex flex-col items-center justify-center rounded-full">
        <span className="font-mono text-5xl leading-none tabular-nums">
          {percent}%
        </span>
        <span className="label mt-2">{caption}</span>
      </div>
    </div>
  );
}
