"use client";

import { useEffect, useState } from "react";

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
  itemsDone,
  itemsTarget,
  activeVenues,
  notSetUp,
}: {
  deadlineMs: number;
  itemsDone: number;
  itemsTarget: number;
  activeVenues: number;
  notSetUp: number;
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
    <p className="text-body text-muted mb-8 tracking-normal tabular-nums">
      {lead}
      <span className="text-muted"> · </span>
      <span className="text-ink">
        {itemsDone}/{itemsTarget}
      </span>{" "}
      photos
      <span className="text-muted"> · </span>
      <span className="text-ink">{activeVenues}</span> active
      <span className="text-muted"> · </span>
      <span className="text-ink">{notSetUp}</span> not set up
    </p>
  );
}
