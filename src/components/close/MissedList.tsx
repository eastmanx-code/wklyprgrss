import type { MissedRow } from "@/lib/rollup-math";

/**
 * What keeps getting left open, ranked.
 *
 * The bar is the whole point of the row: "9 of 30" is a number you have to
 * think about, and a bar nine-thirtieths full is a thing you see. The share is
 * of nights the item was still open at signature, so a long bar is bad — the
 * one place in this app where filled means worse, which is why it is the only
 * accent on the panel.
 */
export function MissedList({ rows }: { rows: MissedRow[] }) {
  return (
    <ul>
      {rows.map((row) => {
        const pct = Math.round((row.open / row.of) * 100);
        return (
          <li
            key={`${row.role}-${row.item}`}
            className="border-divider border-t py-3 first:border-t-0 first:pt-0"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-body min-w-0 break-words">{row.item}</span>
              <span className="label text-warn shrink-0 tabular-nums">
                {row.open} of {row.of}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <span className="bg-inset h-1.5 min-w-0 flex-1 rounded-[1px]">
                <span
                  className="bg-warn block h-full rounded-[1px]"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="label shrink-0">
                {row.house} · {row.role} · {row.phase}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
