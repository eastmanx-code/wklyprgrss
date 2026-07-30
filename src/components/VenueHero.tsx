import { Clock, Countdown, Weather } from "./DashLive";
import { Dial } from "./Dial";
import type { WeekStatus } from "@/lib/types";

/**
 * The leader's own week: their dial, the clock, and the ten as dots.
 *
 * Company numbers deliberately aren't here — the shared board is for that, and
 * this is the one page that is only about their venue.
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
  const percent = total ? Math.round((done / total) * 100) : 0;
  const missed = status === "FAIL";
  const complete = done >= total;
  const shortOfItems = configured < total;

  return (
    <>
      <section className="mb-8 grid items-center gap-8 sm:grid-cols-[auto_minmax(0,1fr)]">
        <Dial
          percent={percent}
          caption={`${done} of ${total}`}
          tone={missed ? "var(--fail)" : "var(--ink)"}
        />

        <div className="space-y-8">
          <div>
            <p className="font-mono text-4xl leading-none tabular-nums">
              <Countdown deadlineMs={deadlineMs} />
            </p>
            <p className="label mt-2">Time left</p>
          </div>

          {/* One dot per item — the same shape as the ten tiles below. */}
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`h-4 w-4 rounded-full ${
                  i < done ? (missed ? "bg-fail" : "bg-ink") : "bg-ink/15"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Template strings, not JSX text: interpolating mid-sentence swallowed
          the space and shipped "10items are set up". */}
      <p className={`note mb-8 leading-relaxed ${missed ? "text-fail" : ""}`}>
        {shortOfItems
          ? `Only ${configured} of ${total} items are set up. A week can't pass with fewer than ${total} — add the rest from any empty slot below.`
          : missed
            ? `Missed: ${total - done} item${total - done === 1 ? "" : "s"} had no fresh photo and comment by the deadline.`
            : complete
              ? `All ${total} have a fresh photo and comment.`
              : `${total - done} still to go. Every one needs a new photo and a new comment.${redo ? ` ${redo} sent back.` : ""}`}
      </p>

      <p className="label mb-8">
        Due {deadlineLabel} · <Clock /> · <Weather />
      </p>
    </>
  );
}
