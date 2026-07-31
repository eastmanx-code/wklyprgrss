import { ClockAndWeather, Countdown } from "./DashLive";
import type { WeekStatus } from "@/lib/types";

/**
 * The leader's week in three lines, not four cards.
 *
 * A leader opens this page to work: photograph the items and write the notes.
 * The full dashboard belongs on the shared board, which is for looking; here
 * it pushed the actual board — their ten tiles — below the fold. Status,
 * deadline and a countable bar fit in the space of one card, and the tiles
 * start immediately after.
 */
export function VenueHero({
  done,
  total,
  configured,
  redo,
  status,
  deadlineMs,
  deadlineLabel,
}: {
  done: number;
  total: number;
  /** How many items exist. Fewer than the target means the week can't pass. */
  configured: number;
  redo: number;
  status: WeekStatus;
  deadlineMs: number;
  deadlineLabel: string;
}) {
  const missed = status === "FAIL";
  const complete = done >= total;
  const shortOfItems = configured < total;
  const left = Math.max(0, total - done);

  return (
    <div className="mb-8">
      <p className="text-body mb-4 tracking-normal tabular-nums">
        <span className={missed ? "text-warn" : "text-ink"}>
          <Countdown deadlineMs={deadlineMs} />
          {missed ? "" : " left"}
        </span>
        <span className="text-muted"> · </span>
        <span className="text-ink">
          {done}/{total}
        </span>
        <span className="text-muted"> done</span>
        {left > 0 ? (
          <>
            <span className="text-muted"> · </span>
            <span className="text-ink">{left}</span>
            <span className="text-muted"> to go</span>
          </>
        ) : null}
        {redo > 0 ? (
          <>
            <span className="text-muted"> · </span>
            <span className="text-warn">{redo} sent back</span>
          </>
        ) : null}
      </p>

      {/* Ten segments, countable at a glance and the same shape as the ten
          tiles below. */}
      <div className="mb-4 flex gap-[2px]" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-[1px] ${
              i < done ? "bg-ink" : "bg-inset"
            }`}
          />
        ))}
      </div>

      <p className="label">
        Due {deadlineLabel} · <ClockAndWeather />
      </p>

      {/* Only when it changes what they should do next. */}
      {shortOfItems || (missed && !complete) ? (
        <p className="text-body text-warn mt-4 leading-[1.5] tracking-normal">
          {shortOfItems
            ? `Only ${configured} of ${total} items are set up. A week can't pass with fewer than ${total} — add the rest from any empty slot below.`
            : `Missed: ${left} item${left === 1 ? "" : "s"} had no fresh photo and comment by the deadline.`}
        </p>
      ) : null}
    </div>
  );
}
