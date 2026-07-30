import { ClockRow, CountdownRow, WeatherRow } from "./DashLive";
import { DashRow } from "./DashRow";
import { Dial } from "./Dial";
import type { WeekStatus } from "@/lib/types";

/**
 * The leader's own week, in the same shape as the company dashboard — the dial
 * is their venue rather than all twenty-seven.
 *
 * The company numbers deliberately aren't here: a leader has the shared board
 * for that, and this page is the one place that is only about their ten.
 */
export function VenueHero({
  done,
  total,
  configured,
  redo,
  rolling,
  status,
  deadlineMs,
  deadlineLabel,
}: {
  done: number;
  total: number;
  /** How many items exist. Fewer than the target means the week can't pass. */
  configured: number;
  redo: number;
  rolling: number;
  status: WeekStatus;
  deadlineMs: number;
  deadlineLabel: string;
}) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  const missed = status === "FAIL";
  const complete = done >= total;
  const shortOfItems = configured < total;

  return (
    <>
      <section className="mb-3 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Dial
          percent={percent}
          caption={`${done} of ${total} done`}
          tone={missed ? "var(--fail)" : "var(--ink)"}
        />

        <div className="panel divide-ink/10 flex flex-col divide-y overflow-hidden">
          <CountdownRow deadlineMs={deadlineMs} />
          <DashRow
            label="Left to go"
            value={Math.max(0, total - done)}
            fill={total ? 1 - done / total : 0}
            tone={missed ? "bg-fail" : "bg-ink"}
          />
          <DashRow
            label="Done"
            value={
              <>
                {done}
                <span className="text-muted text-base">/{total}</span>
              </>
            }
            fill={total ? done / total : 0}
          />
          <DashRow
            label="Redo"
            value={redo}
            fill={total ? redo / total : 0}
            tone="bg-fail"
          />
          <DashRow
            label="Rolling"
            value={rolling}
            fill={total ? rolling / total : 0}
          />
          <DashRow
            label="Items set up"
            value={
              <>
                {configured}
                <span className="text-muted text-base">/{total}</span>
              </>
            }
            fill={total ? configured / total : 0}
          />
          <ClockRow />
          <WeatherRow />
        </div>
      </section>

      <section className="panel mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-4">
        <p className="label">Everything due</p>
        <p className="font-mono text-lg tabular-nums">{deadlineLabel}</p>
      </section>

      {/* Spell out the gate rather than leaving people to infer it from a
          meter that would otherwise look reachable. */}
      {/* Template strings, not JSX text: interpolating mid-sentence swallowed
          the space and shipped "10items are set up". */}
      {shortOfItems ? (
        <p className={`note mb-5 leading-relaxed ${missed ? "text-fail" : ""}`}>
          {`Only ${configured} of ${total} items are set up. A week can't pass with fewer than ${total} — add the rest from any empty slot below.`}
        </p>
      ) : !complete ? (
        <p className={`note mb-5 leading-relaxed ${missed ? "text-fail" : ""}`}>
          {missed
            ? `Missed: ${total - done} item${total - done === 1 ? "" : "s"} had no fresh photo and comment by the deadline.`
            : `${total - done} still to go. Every one needs a new photo and a new comment.`}
        </p>
      ) : (
        <p className="note mb-5">
          {`All ${total} have a fresh photo and comment.`}
        </p>
      )}
    </>
  );
}
