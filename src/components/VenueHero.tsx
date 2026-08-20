import { ClockAndWeather, Countdown } from "./DashLive";
import type { House, WeekStatus } from "@/lib/types";
import { houseName } from "@/lib/types";

export type HouseProgress = {
  house: House;
  done: number;
  /** What this house owes — ten, same as it ever was. */
  total: number;
  /** How many items exist. Fewer than the target means the week can't pass. */
  configured: number;
  redo: number;
  status: WeekStatus;
  /** False while the house is being walked for practice. */
  scored: boolean;
  /** When it starts counting, for the houses that don't yet. */
  scoredFrom: string | null;
};

/**
 * A house's heading: what it owes, what it has, and a countable bar.
 *
 * Ten segments, the same shape as the ten tiles directly below it. Each house
 * gets its own — a single twenty-segment bar would have let a full dining room
 * fill half of it and read as real progress while the kitchen had not been
 * walked at all.
 *
 * It sits on the section rather than in the hero. Stacked in the hero it said
 * "front of house 0/10" four lines above a section heading reading "front of
 * house 0/10", and a leader scrolling past the second one had already read the
 * first. A bar belongs directly above the tiles it is counting.
 */
export function HouseHeading({ progress }: { progress: HouseProgress }) {
  const { done, total, configured, redo, status, scored } = progress;
  const missed = scored && status === "FAIL";
  const complete = done >= total;
  const shortOfItems = configured < total;
  const left = Math.max(0, total - done);

  return (
    <div className="mb-3">
      <p className="card-title mb-1.5">
        {houseName(progress.house)}
        {scored ? "" : " · practice"}
      </p>

      <p className="text-body mb-2 tracking-normal tabular-nums">
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

      <div className="flex gap-[2px]" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-[1px] ${
              i < done ? "bg-ink" : "bg-inset"
            }`}
          />
        ))}
      </div>

      {/* Said plainly, and only while it is true. A list walked for practice
          that quietly turned into a scored one would be the first thing a
          leader distrusted about this. */}
      {!scored && progress.scoredFrom ? (
        <p className="note text-muted mt-2 leading-relaxed">
          Name your ten and walk them once. Nothing here counts towards a score
          until the week of {progress.scoredFrom}.
        </p>
      ) : null}

      {/* Only when it changes what they should do next — and never while the
          house is still practising. "A week can't pass with fewer than 10" is
          not true of a week that is not being scored, and it would have sat
          directly under the line that already says to name the ten. */}
      {scored && (shortOfItems || (missed && !complete)) ? (
        <p className="text-body text-warn mt-2 leading-[1.5] tracking-normal">
          {shortOfItems
            ? `Only ${configured} of ${total} items are set up. A week can't pass with fewer than ${total} — add the rest from any empty slot below.`
            : `Missed: ${left} item${left === 1 ? "" : "s"} had no fresh photo and comment by the deadline.`}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The deadline, and nothing else.
 *
 * A leader opens this page to work: photograph the items and write the notes.
 * The full dashboard belongs on the shared board, which is for looking; here it
 * pushed the actual board — their tiles — below the fold. One clock covers both
 * walks, and each house carries its own numbers on its own section.
 */
export function VenueHero({
  missed,
  deadlineMs,
  deadlineLabel,
}: {
  /** Whether any house that counts has already missed the week. */
  missed: boolean;
  deadlineMs: number;
  deadlineLabel: string;
}) {
  return (
    <div className="mb-8">
      <p className="text-body mb-1 tracking-normal tabular-nums">
        <span className={missed ? "text-warn" : "text-ink"}>
          <Countdown deadlineMs={deadlineMs} />
          {missed ? "" : " left"}
        </span>
      </p>
      <p className="label">
        Due {deadlineLabel} · <ClockAndWeather />
      </p>
    </div>
  );
}
