"use client";

import { useSpanish, useT } from "@/components/Lang";
import { PHASE_ES, phaseName } from "@/lib/checklists";
import type { MissedRow } from "@/lib/rollup-math";

/**
 * What keeps getting left open, in the words the crew reads, and who is
 * accountable for it.
 *
 * Three lines a row. The top line names the list on the left and how often it
 * slipped on the right. The line under it is the thing itself. The last line
 * names who signed the list off while this was still open: the only person the
 * data can name, since ticks carry no author, and the one whose name is on it
 * as done. A person who has never seen this app can read a row out loud and
 * know which list, what task, how often, and who to ask.
 */
export function MissedList({ rows }: { rows: MissedRow[] }) {
  const spanish = useSpanish();
  const t = useT();
  return (
    <ul>
      {rows.map((row) => {
        const phase = spanish ? PHASE_ES[row.phase] : phaseName(row.phase);
        // The list, named the way it is run: position, its room where it has
        // one, and the part of the day.
        const list = [row.role, row.room, phase].filter(Boolean).join(" · ");
        const top = row.signedShortBy
          .slice(0, 2)
          .map((s) => `${s.who} (${s.nights})`)
          .join(" · ");
        const more =
          row.signedShortBy.length > 2
            ? ` +${row.signedShortBy.length - 2}`
            : "";
        const unsigned =
          row.unsignedNights > 0
            ? `${row.signedShortBy.length > 0 ? " · " : ""}${row.unsignedNights} ${t("unsigned", "sin firmar")}`
            : "";
        return (
          <li
            key={`${row.house}-${row.role}-${row.room ?? ""}-${row.phase}-${row.item}`}
            className="border-divider border-t py-3 first:border-t-0 first:pt-0"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="label text-muted min-w-0">{list}</span>
              <span className="label text-warn shrink-0 tabular-nums">
                {t("missed", "faltó")} {row.open} {t("of", "de")} {row.of}
              </span>
            </div>
            <p className="text-body mt-1 break-words">
              {spanish && row.itemEs ? row.itemEs : row.item}
            </p>
            {/* Who put their name to it as done while it was still open. */}
            {row.signedShortBy.length > 0 || row.unsignedNights > 0 ? (
              <p className="label text-muted mt-1.5">
                {row.signedShortBy.length > 0 ? (
                  <>
                    {t("signed off short", "firmó incompleta")}:{" "}
                    <span className="text-ink tabular-nums">
                      {top}
                      {more}
                    </span>
                    <span className="tabular-nums">{unsigned}</span>
                  </>
                ) : (
                  <span className="tabular-nums">
                    {t("never signed off", "nunca se firmó")} ({row.unsignedNights})
                  </span>
                )}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
