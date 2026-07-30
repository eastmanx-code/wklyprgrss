"use client";

import { useEffect, useState } from "react";

import type { WeekStatus } from "@/lib/types";

/**
 * Countdown is display-only. The authoritative PASS/PENDING/FAIL decision is
 * always made on the server from server time; this just tells the crew how long
 * they have left.
 */
function formatRemaining(ms: number): string {
  if (ms <= 0) return "Past due";
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export function WeekProgress({
  done,
  total,
  status,
  deadlineMs,
  deadlineLabel,
  weekLabel,
}: {
  done: number;
  total: number;
  status: WeekStatus;
  deadlineMs: number;
  deadlineLabel: string;
  weekLabel: string;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(deadlineMs - Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [deadlineMs]);

  const complete = total > 0 && done >= total;
  const missed = status === "FAIL";

  const headline = complete
    ? "All clear"
    : missed
      ? "Week missed"
      : `${total - done} left to go`;

  return (
    <section className="panel mb-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label">Week of {weekLabel}</p>
        <p className={`label ${missed ? "text-fail" : ""}`}>
          {/* Render nothing until mounted so server and client markup agree. */}
          {remaining === null ? " " : formatRemaining(remaining)}
        </p>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <h2 className="text-2xl font-medium tracking-tight">{headline}</h2>
        <p className="font-mono text-2xl tabular-nums">
          {done}
          <span className="text-muted">/{total}</span>
        </p>
      </div>

      {/* Pills fill as each item gets its photo + comment. */}
      <div className="mt-4 flex gap-[4px]" aria-hidden>
        {Array.from({ length: Math.max(total, 1) }, (_, i) => (
          <span
            key={i}
            className={`h-[10px] flex-1 rounded-full transition-colors ${
              i < done ? (missed ? "bg-fail" : "bg-ink") : "bg-panel"
            }`}
          />
        ))}
      </div>

      <p className="label mt-3">
        {complete
          ? `Every item has a photo and comment · due ${deadlineLabel}`
          : `Photo + comment on all ${total} · due ${deadlineLabel}`}
      </p>
    </section>
  );
}
