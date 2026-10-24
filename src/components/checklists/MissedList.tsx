"use client";

import { useSpanish, useT } from "@/components/Lang";
import { PHASE_ES, phaseName } from "@/lib/checklists";
import type { MissedRow } from "@/lib/rollup-math";

/**
 * Which way a repeated miss is heading.
 *
 * A thing missed half the month is one conversation if it is easing off and
 * another if it got worse this week. Read off the recent window against the
 * whole one, and only once there are a few recent nights to judge by, so a
 * single night does not swing the word.
 */
function direction(row: MissedRow): "worse" | "holding" | "better" | null {
  if (row.recentOf < 3 || row.of === 0) return null;
  const recent = row.recentOpen / row.recentOf;
  const overall = row.open / row.of;
  if (recent > overall + 0.1) return "worse";
  if (recent < overall - 0.1) return "better";
  return "holding";
}

/**
 * What keeps getting left open, ranked, in the words the crew reads.
 *
 * The hero of the dash. Each row names the position that owns it, the item
 * itself, how often it was missed, whether it is missed right now night after
 * night, and which way it is heading. The bar is the share of owed nights it
 * was still open at signature, so a long bar is bad: the one place in this app
 * where a full bar means worse, which is why it is the only accent here.
 */
export function MissedList({ rows }: { rows: MissedRow[] }) {
  const spanish = useSpanish();
  const t = useT();
  return (
    <ul>
      {rows.map((row) => {
        const pct = Math.round((row.open / row.of) * 100);
        const phase = spanish ? PHASE_ES[row.phase] : phaseName(row.phase);
        const dir = direction(row);
        return (
          <li
            key={`${row.house}-${row.role}-${row.phase}-${row.item}`}
            className="border-divider border-t py-3 first:border-t-0 first:pt-0"
          >
            {/* The position that owns it, so a reader knows who to talk to
                before reading the item. */}
            <p className="label">
              {row.house} · {row.role} · {phase}
            </p>
            <div className="mt-1 flex items-baseline justify-between gap-4">
              <span className="text-body min-w-0 break-words">
                {spanish && row.itemEs ? row.itemEs : row.item}
              </span>
              <span className="label text-warn shrink-0 tabular-nums">
                {t("missed", "faltó")} {row.open} {t("of", "de")} {row.of}{" "}
                {t("nights", "noches")}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <span className="bg-inset h-1.5 min-w-0 flex-1 rounded-[1px]">
                <span
                  className="bg-warn block h-full rounded-[1px]"
                  style={{ width: `${pct}%` }}
                />
              </span>
              {/* What it is doing right now, to the right of the bar: the
                  active run first because it is the loudest, then the drift. */}
              <span className="label shrink-0 tabular-nums">
                {row.streak > 0 ? (
                  <span className="text-warn">
                    {row.streak}{" "}
                    {row.streak === 1
                      ? t("night running", "noche seguida")
                      : t("nights running", "noches seguidas")}
                  </span>
                ) : dir ? (
                  <span className={dir === "worse" ? "text-warn" : "text-muted"}>
                    {dir === "worse"
                      ? t("getting worse", "empeorando")
                      : dir === "better"
                        ? t("getting better", "mejorando")
                        : t("holding", "estable")}
                  </span>
                ) : null}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
