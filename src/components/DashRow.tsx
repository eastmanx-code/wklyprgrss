/**
 * One line of the readout: label and number on top, a meter beneath.
 *
 * The meter is a defined track with a rounded fill rather than a block of
 * colour bleeding to the row edges — full-bleed bars read as random rectangles
 * behind the text instead of as a measurement.
 *
 * Rows flex to fill their container, so the stack always ends level with the
 * dial beside it. Rows with nothing to measure (the clock, the weather) pass
 * no fill and get no track.
 *
 * Plain component, no directive: rendered from the server on the static rows
 * and from the client on the live ones.
 */
export function DashRow({
  label,
  value,
  fill,
  tone = "bg-ink",
  emphasis = false,
}: {
  label: string;
  value: React.ReactNode;
  fill?: number;
  tone?: string;
  emphasis?: boolean;
}) {
  const percent =
    fill === undefined ? null : Math.min(100, Math.max(0, fill * 100));

  return (
    <div className="flex flex-1 flex-col justify-center gap-2 px-5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label">{label}</span>
        <span
          className={`shrink-0 font-mono tabular-nums ${
            emphasis ? "text-2xl" : "text-lg"
          }`}
        >
          {value}
        </span>
      </div>

      {percent === null ? null : (
        <div className="bg-ink/10 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={`h-full rounded-full ${tone}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
