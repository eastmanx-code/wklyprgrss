"use client";

import { useEffect, useState } from "react";

import { ClockAndWeather } from "./DashLive";
import { houseShort, type House } from "@/lib/types";

/**
 * The page's answer, in one line, before any card.
 *
 * The four cards below each hold a fragment of it — how much is done, how long
 * is left, how venues split. Read alone, none of them is the answer; scattered
 * across four boxes, the reader assembles it themselves. This line states it,
 * and the cards become drill-down.
 *
 * Client-side because the deadline half is live. Renders the static half on
 * the server so there is no layout shift.
 */
export function NarrativeStrip({
  deadlineMs,
  deadlineLabel,
  byHouse,
  activeVenues,
}: {
  deadlineMs: number;
  /** When the week is due, spelled out. */
  deadlineLabel: string;
  /** One figure per house. Added together they would describe neither. */
  byHouse: { house: House; itemsDone: number; itemsTarget: number }[];
  activeVenues: number;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(deadlineMs - Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [deadlineMs]);

  let lead: React.ReactNode = <span className="text-muted">—</span>;
  if (remaining !== null) {
    if (remaining <= 0) {
      lead = <span className="text-warn">Past due</span>;
    } else {
      const minutes = Math.floor(remaining / 60_000);
      const days = Math.floor(minutes / 1440);
      const hours = Math.floor((minutes % 1440) / 60);
      lead = (
        <span className="text-ink">
          {days > 0 ? `${days}d ${hours}h left` : `${hours}h left`}
        </span>
      );
    }
  }

  return (
    /* The deadline lives here now rather than in a card of its own. A panel
       holding a countdown and a clock was a hundred and fifty pixels of mostly
       nothing above the only two things on the page anybody reads. */
    <p className="text-body text-muted mb-6 leading-[1.8] tracking-normal tabular-nums">
      {lead}
      <span className="text-muted"> · due {deadlineLabel}</span>
      <span className="text-muted"> · </span>
      {/* Named, not just listed. Two bare fractions side by side — "200/210 ·
          39/160" — do not say which half is which, and the obvious guess is
          that the second is a subset of the first rather than a different
          room measured against a different denominator. */}
      {byHouse.map((h, i) => (
        <span key={h.house}>
          {i > 0 ? <span className="text-muted"> · </span> : null}
          {houseShort(h.house)}{" "}
          <span className="text-ink">
            {h.itemsDone}/{h.itemsTarget}
          </span>
        </span>
      ))}{" "}
      photos
      <span className="text-muted"> · </span>
      <span className="text-ink">{activeVenues}</span> active
      <span className="text-muted"> · </span>
      <ClockAndWeather />
    </p>
  );
}
