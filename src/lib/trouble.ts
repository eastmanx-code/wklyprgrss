/**
 * Why a capture did not make it.
 *
 * Three photographs failed on the first live night and the app could say
 * nothing at all about why. Working it out meant reading a crew member's text
 * message and guessing at a mechanism; I guessed twice and was wrong twice.
 * The evidence narrowed it to "it died on the phone" and stopped there,
 * because the phone is where the only witness was and nobody wrote anything
 * down.
 *
 * So the phone writes it down. One row per refusal, naming a step and a
 * device, never a person. It is not analytics and it is nobody's performance
 * record — the report screens do not read it and cannot.
 *
 * The awkward part is that the failure worth reporting most is the one where
 * there is no signal, and a report needs signal. So a report is queued in
 * localStorage first and sent after, and whatever will not send waits for the
 * next time something does. Small JSON, never bytes: the photograph itself
 * lives in IndexedDB and this only describes it.
 */

/** Which step gave up. */
export type Step =
  | "read"
  | "store"
  | "send"
  | "record"
  /** The queue described bytes that were no longer there. */
  | "vanished";

export type Trouble = {
  step: Step;
  /** The browser's own words, kept raw. A tidied message has had the useful part taken out. */
  detail?: string | null;
  slug?: string | null;
  itemId?: string | null;
  shotIndex?: number | null;
  bytes?: number | null;
  /** Whether the capture still went through another way. Caught is not lost. */
  recovered?: boolean;
  clientAt?: string;
  userAgent?: string;
};

const KEY = "ww-trouble";
/**
 * A phone that has been failing all night has told us what we needed after the
 * first few. The cap is there so a broken device cannot fill its own storage
 * with the story of being broken.
 */
const MAX = 40;

/** Whatever the browser threw, as a string, without trusting it to have a message. */
export function words(problem: unknown): string {
  if (problem instanceof Error) {
    return problem.name === "Error"
      ? problem.message
      : `${problem.name}: ${problem.message}`;
  }
  if (typeof problem === "string") return problem;
  try {
    // Returns undefined for undefined and for a function, which would put a
    // hole where the reason should be. Circular objects throw.
    return JSON.stringify(problem) ?? String(problem);
  } catch {
    return String(problem);
  }
}

function held(): Trouble[] {
  try {
    const raw = localStorage.getItem(KEY);
    const all: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(all) ? (all as Trouble[]) : [];
  } catch {
    // A private window, a browser with storage off, or a value somebody else
    // wrote. None of them is a reason to interrupt a shift.
    return [];
  }
}

function keep(rows: Trouble[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows.slice(-MAX)));
  } catch {
    // Nowhere to put it. The report is the least important thing on this
    // phone and it is not worth one line of the person's attention.
  }
}

/**
 * Note a refusal and try to send it.
 *
 * Never throws and never awaits anything the caller needs. Every call site is
 * in the middle of handling a failure that matters more than this one.
 */
export function noteTrouble(
  trouble: Trouble,
  send: (rows: Trouble[]) => Promise<unknown>,
): void {
  const row: Trouble = {
    recovered: false,
    ...trouble,
    clientAt: new Date().toISOString(),
    userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent,
  };
  keep([...held(), row]);
  void flushTrouble(send);
}

/**
 * Send whatever is waiting.
 *
 * All or nothing per attempt. Partial success would need per-row bookkeeping
 * to avoid sending the same refusal twice, and a duplicate row in a table
 * nobody scores is cheaper than the bookkeeping.
 */
export async function flushTrouble(
  send: (rows: Trouble[]) => Promise<unknown>,
): Promise<void> {
  const rows = held();
  if (rows.length === 0) return;
  try {
    await send(rows);
    // Only what was sent. Anything noted while this was in flight stays.
    const now = held();
    keep(now.slice(rows.length));
  } catch {
    // No signal, or the server said no. It waits.
  }
}
