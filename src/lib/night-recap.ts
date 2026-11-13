/**
 * One venue's night as the morning email, with the missed items named.
 *
 * Import-free on purpose, like the night maths, so scripts/check-recap.mjs can
 * prove it without a database.
 *
 * The email used to say "Manager close: 17 of 19, not signed" and stop. The
 * manager reading it then had to open the app, find the venue, find the night
 * and open the list to learn which two. Most did not, and wrote back to ask.
 * The two titles were on the row the count came from the whole time.
 *
 * Three piles, worst first, the same order the night page uses:
 *
 * - never opened: nobody touched it. Named with its size and nothing else,
 *   because every line on it was missed and a list of all of them is the list.
 * - never signed: worked on, and nobody put a name to it. Each item left is
 *   named, since those are the ones somebody can still go and look at.
 * - signed with items left: a name over open work, with the items and the
 *   reason the signer gave.
 *
 * Titles are the venue's own words, untouched. Plain text, so it pastes into
 * a mail client the same way everywhere.
 */

export type RecapList = {
  /** "Manager close": the list with its phase, and its room where it has one. */
  name: string;
  group: "unsigned" | "gaps" | "done" | "going" | "empty";
  /** Nothing on it was checked off. */
  untouched: boolean;
  ticked: number;
  owed: number;
  /** The initials on the ticks, each once. */
  checkedBy: string[];
  signedBy: string | null;
  /** Every item owed and not checked off, by its whole title. */
  openTitles: string[];
  /** What the signer said about leaving them. */
  openReason: string | null;
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** "Tuesday 11/10", from the night's own date. */
export function recapDay(night: string): string {
  const [y, m, d] = night.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${m}/${d}`;
}

/**
 * A list name typed in capitals, said at speaking volume.
 *
 * Some venues wrote their positions as BAR and MANAGER. In a sentence that
 * reads as shouting about one list. Only a name that is capitals throughout is
 * touched, so "YB Bartender close" keeps its YB.
 */
export function calmName(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, "");
  const phase = name.match(/ (open|mid|close)$/)?.[0] ?? "";
  const body = phase ? name.slice(0, -phase.length) : name;
  const bodyLetters = body.replace(/[^A-Za-z]/g, "");
  if (!letters || bodyLetters !== bodyLetters.toUpperCase()) return name;
  const lower = body.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1) + phase;
}

function initials(list: RecapList): string {
  return list.checkedBy.length > 0
    ? `initials ${list.checkedBy.join(", ")}`
    : "no initials";
}

function missedLines(list: RecapList): string[] {
  return list.openTitles.map((title) => `   - ${title.trim()}`);
}

/**
 * The whole email body for one venue's night.
 *
 * `lists` is every list on the night. Lists with nothing owed are ignored, the
 * same as the score ignores them.
 */
export function nightRecap(night: string, lists: RecapList[]): string {
  const counted = lists.filter((list) => list.group !== "empty");
  const done = counted.filter((list) => list.group === "done");
  const neverOpened = counted.filter(
    (list) => list.group === "unsigned" && list.untouched,
  );
  const neverSigned = counted.filter(
    (list) => list.group === "unsigned" && !list.untouched,
  );
  const gaps = counted.filter((list) => list.group === "gaps");
  const going = counted.filter((list) => list.group === "going");

  const out: string[] = [
    `${recapDay(night)}: ${done.length} of ${counted.length} closed and signed.`,
  ];

  if (neverOpened.length + neverSigned.length + gaps.length === 0) {
    out.push("", going.length > 0 ? "No misses so far." : "No misses.");
  }

  if (neverOpened.length > 0) {
    out.push("", "NEVER OPENED");
    for (const list of neverOpened) {
      out.push(
        `- ${calmName(list.name)}: ${list.owed} ${list.owed === 1 ? "item" : "items"}, none checked off.`,
      );
    }
  }

  if (neverSigned.length > 0) {
    out.push("", "NEVER SIGNED");
    for (const list of neverSigned) {
      const head = `- ${calmName(list.name)}: ${list.ticked} of ${list.owed}, ${initials(list)}.`;
      if (list.openTitles.length === 0) {
        out.push(`${head} Everything checked off, nobody signed.`);
      } else {
        out.push(`${head} Missed:`, ...missedLines(list));
      }
    }
  }

  if (gaps.length > 0) {
    out.push("", "SIGNED WITH ITEMS LEFT");
    for (const list of gaps) {
      const signer = list.signedBy?.trim() || "no name";
      out.push(
        `- ${calmName(list.name)}: ${list.ticked} of ${list.owed}, signed by ${signer}. Missed:`,
        ...missedLines(list),
      );
      if (list.openReason?.trim()) {
        out.push(`   Why: ${list.openReason.trim()}`);
      }
    }
  }

  if (going.length > 0) {
    out.push("", "STILL BEING WORKED");
    for (const list of going) {
      out.push(`- ${calmName(list.name)}: ${list.ticked} of ${list.owed}.`);
    }
  }

  return out.join("\n");
}
