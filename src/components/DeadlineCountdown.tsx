"use client";

import { useEffect, useState } from "react";

/**
 * Compact time-to-deadline, shown on every screen.
 *
 * Display only — the server decides pass/fail from server time. This just
 * keeps the deadline in front of people wherever they are in the app.
 */
function format(ms: number): string {
  if (ms <= 0) return "Past due";
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function DeadlineCountdown({ deadlineMs }: { deadlineMs: number }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(deadlineMs - Date.now());
    tick();
    // Once inside the last hour, tick every 30s so the minutes stay honest.
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [deadlineMs]);

  // Render nothing until mounted so server and client markup agree.
  if (remaining === null) return null;

  const overdue = remaining <= 0;
  const urgent = !overdue && remaining < 24 * 60 * 60 * 1000;

  return (
    <span
      className={`btn-ghost pointer-events-none tabular-nums shadow-[0_2px_12px_rgba(0,0,0,0.12)] ${
        overdue ? "bg-fail text-white" : urgent ? "bg-ink text-paper" : ""
      }`}
      title="Time left to update every item"
    >
      Deadline: {format(remaining)}
    </span>
  );
}
