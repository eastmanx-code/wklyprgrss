import { Card } from "./Card";
import { ClockAndWeather, Countdown } from "./DashLive";
import { Dial } from "./Dial";
import type { WeekStatus } from "@/lib/types";

/**
 * The leader's own week, on the same grid and scales as the company board —
 * their dial rather than all twenty-seven, and their ten as dots.
 *
 * Company numbers deliberately aren't here: the shared board is for that, and
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
      <Card
        title="Your week"
        hint={`New photo + comment on all ${total}`}
        className="col-span-12 sm:col-span-4"
      >
        <Dial
          percent={percent}
          caption={`${done} of ${total}`}
          tone="var(--ink)"
        />
      </Card>

      <Card
        title="Items"
        hint="One dot per item · filled when done this week"
        className="col-span-12 sm:col-span-8"
      >
        <div className="flex flex-1 flex-wrap content-center gap-2">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`h-8 w-8 rounded-full ${
                i < done ? "bg-ink" : "bg-inset"
              }`}
            />
          ))}
        </div>
      </Card>

      <Card
        title="Deadline"
        hint={deadlineLabel}
        className="col-span-12 sm:col-span-4"
      >
        <p className="text-metric text-ink leading-[1.2] tracking-normal tabular-nums">
          <Countdown deadlineMs={deadlineMs} />
        </p>
        <p className="label mt-6">
          <ClockAndWeather />
        </p>
      </Card>

      <Card
        title="Where you stand"
        hint={`${total} needed every week`}
        className="col-span-12 sm:col-span-8"
      >
        {/* Template strings, not JSX text: interpolating mid-sentence swallowed
            the space and shipped "10items are set up". */}
        <p
          className={`text-body leading-[1.5] ${missed ? "text-warn" : "text-ink"}`}
        >
          {shortOfItems
            ? `Only ${configured} of ${total} items are set up. A week can't pass with fewer than ${total} — add the rest from any empty slot below.`
            : missed
              ? `Missed: ${total - done} item${total - done === 1 ? "" : "s"} had no fresh photo and comment by the deadline.`
              : complete
                ? `All ${total} have a fresh photo and comment.`
                : `${total - done} still to go. Every one needs a new photo and a new comment.${redo ? ` ${redo} sent back.` : ""}`}
        </p>
      </Card>
    </>
  );
}
