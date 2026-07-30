/**
 * One line of the readout: label left, number right, with the bar behind it
 * filled to that number's share of the whole.
 *
 * Rows flex to fill their container, so the stack always ends level with the
 * dial beside it — no tile is ever left mostly empty, whatever the height.
 *
 * Plain component, no directive: rendered from the server on the static rows
 * and from the client on the live ones.
 */
export function DashRow({
  label,
  value,
  fill = 0,
  tone = "bg-ink/10",
  emphasis = false,
}: {
  label: string;
  value: React.ReactNode;
  fill?: number;
  tone?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="relative flex flex-1 items-center justify-between gap-3 overflow-hidden px-5 py-3">
      <div
        className={`absolute inset-y-0 left-0 ${tone}`}
        style={{ width: `${Math.min(100, Math.max(0, fill * 100))}%` }}
        aria-hidden
      />
      <span className="label relative">{label}</span>
      <span
        className={`relative shrink-0 font-mono tabular-nums ${
          emphasis ? "text-2xl" : "text-lg"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
