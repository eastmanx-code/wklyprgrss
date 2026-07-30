/**
 * The completion dial — the one number anyone opens the app for, so it is
 * deliberately the largest thing on whatever page it sits on.
 *
 * Smaller cap on phones: at full width it filled the screen on its own and
 * pushed everything else two scrolls down.
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
    <div className="panel flex items-center justify-center p-5 sm:p-6">
      <div
        className="relative aspect-square w-full max-w-[220px] rounded-full sm:max-w-[400px]"
        style={{
          background: `conic-gradient(${tone} ${percent}%, color-mix(in srgb, var(--ink) 12%, var(--panel)) 0)`,
        }}
      >
        <div className="bg-panel absolute inset-[12%] flex flex-col items-center justify-center rounded-full">
          <span className="font-mono text-6xl leading-none tabular-nums">
            {percent}%
          </span>
          <span className="label mt-2 px-4 text-center">{caption}</span>
        </div>
      </div>
    </div>
  );
}
