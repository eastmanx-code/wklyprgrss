"use client";

import { useSpanish } from "@/components/Lang";
import { PHASE_ES, phaseName } from "@/lib/checklists";

/**
 * One missed thing, the same item folded across every store that misses it.
 *
 * `stores` is the whole point: one store on the row is a phone call, several is
 * a process. The counts are summed across those stores over the window.
 */
export type CompanyMiss = {
  house: "FOH" | "HOH";
  role: string;
  phase: "open" | "mid" | "close";
  item: string;
  itemEs: string | null;
  open: number;
  of: number;
  /** The longest active run at any one of the stores. */
  streak: number;
  stores: string[];
};

export function CompanyMissed({ rows }: { rows: CompanyMiss[] }) {
  const spanish = useSpanish();
  return (
    <ul>
      {rows.map((r) => {
        const phase = spanish ? PHASE_ES[r.phase] : phaseName(r.phase);
        return (
          <li
            key={`${r.house}-${r.role}-${r.phase}-${r.item}`}
            className="border-divider border-t py-3 first:border-t-0 first:pt-0"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="label">
                {r.house} · {r.role} · {phase}
              </span>
              <span className="label text-warn shrink-0 tabular-nums">
                {spanish ? "faltó" : "missed"} {r.open} {spanish ? "de" : "of"}{" "}
                {r.of}
              </span>
            </div>
            <p className="text-body mt-1 break-words">
              {spanish && r.itemEs ? r.itemEs : r.item}
            </p>
            <p className="label mt-1">
              {r.stores.join(" · ")}
              {r.streak > 0
                ? ` · ${spanish ? `hasta ${r.streak} seguidas` : `up to ${r.streak} running`}`
                : ""}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
