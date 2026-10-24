"use client";

import { useSpanish, useT } from "@/components/Lang";
import { PHASE_ES, phaseName } from "@/lib/checklists";
import type { MissedRow } from "@/lib/rollup-math";

/**
 * What keeps getting left open, in the words the crew reads.
 *
 * Two lines a row, nothing else. The top line says who owns it on the left and
 * how often it slipped on the right; the line under it is the thing itself.
 * No bar, no streak, no drift arrow: the count already says how bad, and the
 * extra marks were reading as chaos rather than as help. A person who has
 * never seen this app can read a row out loud and know what to fix and how
 * often it has been missed.
 */
export function MissedList({ rows }: { rows: MissedRow[] }) {
  const spanish = useSpanish();
  const t = useT();
  return (
    <ul>
      {rows.map((row) => {
        const phase = spanish ? PHASE_ES[row.phase] : phaseName(row.phase);
        return (
          <li
            key={`${row.house}-${row.role}-${row.phase}-${row.item}`}
            className="border-divider border-t py-3 first:border-t-0 first:pt-0"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="label text-muted min-w-0">
                {row.role} · {phase}
              </span>
              <span className="label text-warn shrink-0 tabular-nums">
                {t("missed", "faltó")} {row.open} {t("of", "de")} {row.of}
              </span>
            </div>
            <p className="text-body mt-1 break-words">
              {spanish && row.itemEs ? row.itemEs : row.item}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
