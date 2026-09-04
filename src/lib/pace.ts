/**
 * Whether a list was walked or swiped.
 *
 * Every other figure in the close reports answers "did it get done". None of
 * them can tell a room that was checked from a screen that was thumbed
 * through at the bar, and a tick is worth exactly nothing if the second one
 * passes for the first. This is the only measure in the app that reads *how*
 * the ticks arrived rather than how many.
 *
 * Two things are worth knowing and one of them is worth arguing about.
 *
 * The pace is the honest signal. Thirty items ticked three seconds apart is
 * not a person walking a building; there is no route through a venue that
 * fast. It survives the obvious dodge too, because it is computed on the
 * clock that *claims* the work, so queueing the whole list offline and
 * letting it drain later does not hide it.
 *
 * The lag is the softer one, and it got softer the day the offline queue
 * shipped. A tick that claims eleven forty and arrives at quarter past two
 * used to mean somebody was backfilling. It now also means somebody walked a
 * cellar with no signal, which is the behaviour the queue exists to support.
 * The two are indistinguishable by arrival time alone, so the lag is reported
 * as a fact and never as an accusation. What separates them is the pace: an
 * honest offline walk has its claims spread across the shift even though they
 * all landed at once.
 *
 * Nothing here changes a verdict. `compliance.ts` holds the line that every
 * figure it reports is arithmetic on rows that already exist, and a pace is
 * an inference, not arithmetic. There are real reasons a list ticks fast: a
 * cook who walked with paper and entered it after, a manager catching up a
 * section they watched somebody do. Flipping those to Fail automatically
 * would put the report in an argument it cannot win, on the week it most
 * needs to be believed. So it is shown, loudly, next to who signed it, and a
 * person decides.
 *
 * Free of `server-only` and of any import that reaches a database, so the
 * numbers can be tested on their own.
 */

/** One tick, on both clocks. `claimedAt` is null for ticks predating it. */
export type Tick = {
  /** The server's own stamp, set when the write landed. */
  at: string;
  /** What the device said the time was. Untrusted, which is the point. */
  claimedAt: string | null;
};

export type Pace = {
  /** How many ticks the reading is built on. */
  ticks: number;
  /** First tick to last, in seconds, on whichever clock was used. */
  spanSeconds: number;
  /** The average gap between consecutive ticks. Zero below the minimum. */
  secondsPerItem: number;
  /** Whether the claimed pace is too fast to have been a walk. */
  burst: boolean;
  /** Whether the reading used the device clock or fell back to the server's. */
  clock: "claimed" | "arrived";
  /** The longest gap between a tick's claim and its arrival, in minutes. */
  lagMinutes: number;
  /** That gap is worth a line. Normal for a list walked without signal. */
  late: boolean;
  /** A device clock claiming a time outside the night it was filed under. */
  impossible: boolean;
  /** The burst, in one line, or null when there is nothing to say. */
  note: string | null;
};

/**
 * Below this, a fast list is just a short list.
 *
 * Four items ticked in twenty seconds is a bartender at one station, which is
 * how the work is actually done. The pattern only means anything across a
 * list long enough that finishing it requires moving.
 */
export const BURST_MIN_TICKS = 5;

/**
 * The pace at which a walk stops being credible, in seconds per item.
 *
 * Deliberately generous. Ten seconds an item is already faster than reading
 * the line and looking at the thing it names, and the point is a threshold
 * nobody can argue their way past rather than one that catches the most.
 */
export const BURST_SECONDS_PER_ITEM = 10;

/** A gap between claim and arrival big enough to explain on the screen. */
export const LATE_MINUTES = 45;

const EMPTY: Pace = {
  ticks: 0,
  spanSeconds: 0,
  secondsPerItem: 0,
  burst: false,
  clock: "arrived",
  lagMinutes: 0,
  late: false,
  impossible: false,
  note: null,
};

const parse = (iso: string | null): number | null => {
  if (!iso) return null;
  const n = Date.parse(iso);
  return Number.isNaN(n) ? null : n;
};

/**
 * How one list's night was worked.
 *
 * `window` is the night's own bounds, used only to catch a device clock
 * claiming a time the night never contained. Omit it and that check is
 * skipped rather than guessed at.
 */
export function paceOf(
  ticks: Tick[],
  window?: { start: Date; end: Date },
): Pace {
  if (ticks.length === 0) return EMPTY;

  const arrived = ticks
    .map((t) => parse(t.at))
    .filter((n): n is number => n !== null);
  if (arrived.length === 0) return EMPTY;

  const claims = ticks.map((t) => parse(t.claimedAt));
  // Every tick or none. Half a list stamped by a phone and half by the server
  // is two clocks in one span, and the difference between them is hours, not
  // rounding — a mixed reading would invent a burst or bury one. Older ticks
  // predate the column, so a list can legitimately have none.
  const everyClaim = claims.every((n): n is number => n !== null);
  const clock: Pace["clock"] = everyClaim ? "claimed" : "arrived";
  const line = (everyClaim ? (claims as number[]) : arrived)
    .slice()
    .sort((a, b) => a - b);

  const spanSeconds = Math.round((line[line.length - 1] - line[0]) / 1000);
  const gaps = line.length - 1;
  const secondsPerItem = gaps === 0 ? 0 : spanSeconds / gaps;
  const burst =
    line.length >= BURST_MIN_TICKS && secondsPerItem < BURST_SECONDS_PER_ITEM;

  // The worst offender, not the average. One tick claiming to be three hours
  // older than its arrival is the interesting row; averaging it against
  // twenty that landed instantly is how it disappears.
  let lagMs = 0;
  for (let i = 0; i < ticks.length; i += 1) {
    const claim = claims[i];
    const landed = parse(ticks[i].at);
    if (claim === null || landed === null) continue;
    lagMs = Math.max(lagMs, landed - claim);
  }

  const impossible =
    window === undefined
      ? false
      : claims.some(
          (n) =>
            n !== null &&
            (n < window.start.getTime() || n > window.end.getTime()),
        );

  const lagMinutes = Math.round(lagMs / 60_000);

  return {
    ticks: line.length,
    spanSeconds,
    secondsPerItem: Math.round(secondsPerItem * 10) / 10,
    burst,
    clock,
    lagMinutes,
    late: lagMinutes >= LATE_MINUTES,
    impossible,
    note: burst
      ? `${line.length} ticks ${describeGap(secondsPerItem)} apart, ${describeSpan(spanSeconds)} end to end`
      : null,
  };
}

function describeGap(seconds: number): string {
  if (seconds < 1) return "under a second";
  const rounded = Math.round(seconds * 10) / 10;
  return `${rounded} ${rounded === 1 ? "second" : "seconds"}`;
}

/** A span in the largest unit that still says something true about it. */
export function describeSpan(seconds: number): string {
  if (seconds < 60) return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.round(minutes / 30) / 2;
  return `${hours} hours`;
}

/** The lag, said the way somebody would say it out loud. */
export function describeLag(minutes: number): string {
  if (minutes < 90) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.round(minutes / 30) / 2;
  return `${hours} hours`;
}
