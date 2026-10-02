/**
 * The weekly walkthrough report, turned from board numbers into the exact text
 * that gets pasted into the ClickUp card.
 *
 * Deliberately free of imports and of `server-only`, for the same reason
 * close-tick.ts is: the shape of a report line is a rule, and a rule is worth
 * a test that does not need a database to run. report.ts does the reading and
 * hands this a plain list of board scores; everything about how a line reads
 * lives here.
 *
 * The house report is split, front of house then heart of house, because that
 * is how the card has always read and because the two are graded by different
 * people against separate lists. Nothing here ever sums the two.
 *
 * The format rules are the card's, held in one place so the generator and the
 * person pasting cannot disagree about them:
 *   - section headers are bold, on their own line
 *   - every item line starts with "* " so it renders as a bullet
 *   - ">" is the only delimiter inside a line, never a comma
 *   - codes, names and verdicts are upper case
 * ClickUp comments have no heading block the way a doc does, so a "header" is
 * bold text. A pasted "##" stays literal there, which is the whole reason this
 * writes bold rather than Markdown headings.
 */

export type House = "FOH" | "HOH";
export type Tier = "good" | "neutral" | "fail";

/** One person who filed, and how many of the board's items they filed. */
export type Filer = { name: string; items: number };
/** One person named as a second pair of hands, and on how many items. */
export type Assist = { name: string; items: number };

/**
 * One house's board at one venue for one week, already scored.
 *
 * `missed` is the owner's auto-fail: short of the ten FILED by Thursday 4pm, so
 * the week is a locked fail whatever got signed off. It is carried as its own
 * flag rather than inferred from the tier, because a board that walked all ten
 * and only got five signed off is also a fail and reads completely differently
 * from one that never filed.
 */
export type BoardScore = {
  code: string;
  house: House;
  /** Active items on the board now. Below ten is a board not finished. */
  built: number;
  filed: number;
  approved: number;
  sentBack: number;
  rolling: number;
  missed: boolean;
  tier: Tier;
  /** Who filed, most items first. */
  authors: Filer[];
  /** Second hands, most items first, one row per person. */
  assists: Assist[];
};

export type ReportInput = {
  /** "Sep 28" — the Monday the week opened, for the heading line. */
  weekLabel: string;
  thisWeek: BoardScore[];
  /** The prior full week, for the movement section. */
  lastWeek: BoardScore[];
};

const WORDS = [
  "ZERO",
  "ONE",
  "TWO",
  "THREE",
  "FOUR",
  "FIVE",
  "SIX",
  "SEVEN",
  "EIGHT",
  "NINE",
  "TEN",
  "ELEVEN",
  "TWELVE",
];

/** Small counts read as words the way the card writes them, bigger ones stay digits. */
export function word(n: number): string {
  return n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
}

/** Upper case, and no comma can survive into a line where ">" is the only delimiter. */
function up(name: string): string {
  return name.toUpperCase().replace(/,/g, "").replace(/\s+/g, " ").trim();
}

/** The number the card shows for a board: FAIL when it never made the ten. */
export function boardLabel(b: BoardScore): string {
  return b.missed ? "FAIL" : String(b.approved);
}

/**
 * Where a board sits for a movement comparison. A missed board is below every
 * score, so any real number is an improvement on it and a drop to it is a fall.
 */
export function boardRank(b: BoardScore): number {
  return b.missed ? -1 : b.approved;
}

function isPerfect(b: BoardScore): boolean {
  return !b.missed && b.approved >= 10;
}

/** The lead name on a board, for a shout out. */
function topName(b: BoardScore): string {
  return b.authors[0] ? up(b.authors[0].name) : up(b.code);
}

function describeFilers(b: BoardScore): string {
  const a = b.authors;
  if (a.length === 0) return "NOBODY FILED";
  if (a.length === 1) {
    return b.filed >= 10
      ? `${up(a[0].name)} FILED ALL TEN`
      : `${up(a[0].name)} FILED ${word(b.filed)}`;
  }
  const [x, y] = a;
  if (a.length === 2) {
    return `${up(x.name)} ${word(x.items)} AND ${up(y.name)} ${word(y.items)}`;
  }
  return `${word(a.length)} FILING > ${up(x.name)} ON ${word(x.items)}`;
}

function describeAssists(b: BoardScore): string {
  const s = b.assists;
  if (s.length === 0) return "NO ASSIST NAMED";
  if (s.length === 1) return `ONLY ${up(s[0].name)} NAMED`;
  if (s.length === 2) return `${up(s[0].name)} AND ${up(s[1].name)} BEHIND`;
  return `${up(s[0].name)} AND ${word(s.length - 1)} MORE NAMED`;
}

/** Why a missed board missed, in the card's words. */
function missedReason(b: BoardScore): string {
  if (b.built === 0) return "NO BOARD STANDING AND NOTHING FILED";
  if (b.built < 10) {
    return `BOARD IS ONLY ${word(b.built)} ITEMS AND FILED NOTHING`;
  }
  if (b.filed === 0) return "BOARD BUILT TO TEN AND FILED NOTHING";
  return `${word(b.filed)} FILED NOT TEN`;
}

function goodLine(b: BoardScore): string {
  return `* ${b.code} > ${b.approved} > ${describeFilers(b)} > ${describeAssists(b)}`;
}

function needsLine(b: BoardScore): string {
  if (b.missed) {
    return `* ${b.code} > FAIL > MISSED 4PM > ${missedReason(b)}`;
  }
  // Walked on time, filed the ten, came in under the line on sign-offs.
  return `* ${b.code} > ${b.approved} > ${describeFilers(b)} > WALKED ON TIME AND CAME IN LOW`;
}

type HouseGroups = {
  good: BoardScore[];
  neutral: BoardScore[];
  needs: BoardScore[];
  total: number;
};

function groupHouse(boards: BoardScore[]): HouseGroups {
  const good = boards
    .filter((b) => b.tier === "good")
    .sort((a, b) => b.approved - a.approved || a.code.localeCompare(b.code));
  const neutral = boards
    .filter((b) => b.tier === "neutral")
    .sort((a, b) => b.approved - a.approved || a.code.localeCompare(b.code));
  // Missed boards are the worst outcome, so they lead the list: a board that
  // never filed is worse than one that walked and scored low. Within the
  // missed, the least standing first; within the walked, the lowest first.
  const needs = boards
    .filter((b) => b.tier === "fail")
    .sort((a, b) => {
      if (a.missed !== b.missed) return a.missed ? -1 : 1;
      if (a.missed) {
        return a.built - b.built || a.filed - b.filed || a.code.localeCompare(b.code);
      }
      return a.approved - b.approved || a.code.localeCompare(b.code);
    });
  return { good, neutral, needs, total: boards.length };
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function tallyLines(label: string, g: HouseGroups): string[] {
  return [
    `**${label} > WEEK TALLY**`,
    "",
    `* WINS > ${g.good.length}`,
    `* NEUTRALS > ${g.neutral.length}`,
    `* FAILS > ${g.needs.length}`,
    `* WIN RATE > ${pct(g.good.length, g.total)}%`,
    `* FAIL RATE > ${pct(g.needs.length, g.total)}%`,
  ];
}

function movementLines(
  label: string,
  thisBoards: BoardScore[],
  lastByCode: Map<string, BoardScore>,
): string[] {
  const up2: string[] = [];
  const down: string[] = [];
  const heldTop: string[] = [];
  const held: string[] = [];
  const heldFail: string[] = [];

  for (const b of [...thisBoards].sort((a, c) => a.code.localeCompare(c.code))) {
    const prior = lastByCode.get(b.code);
    if (!prior) continue;
    const now = boardRank(b);
    const then = boardRank(prior);
    if (now > then) {
      up2.push(`${b.code} FROM ${boardLabel(prior)} TO ${boardLabel(b)}`);
    } else if (now < then) {
      down.push(`${b.code} FROM ${boardLabel(prior)} TO ${boardLabel(b)}`);
    } else if (isPerfect(b) && isPerfect(prior)) {
      heldTop.push(b.code);
    } else if (b.missed && prior.missed) {
      heldFail.push(b.code);
    } else {
      held.push(`${b.code} AT ${boardLabel(b)}`);
    }
  }

  const lines = [`**${label} > MOVEMENT VS LAST WEEK**`, ""];
  lines.push(`* UP > ${up2.length ? up2.join(" > ") : "NONE"}`);
  lines.push(`* DOWN > ${down.length ? down.join(" > ") : "NONE"}`);
  lines.push(`* HELD TOP > ${heldTop.length ? heldTop.join(" > ") : "NONE"}`);
  if (held.length) lines.push(`* HELD > ${held.join(" > ")}`);
  if (heldFail.length) lines.push(`* HELD FAIL > ${heldFail.join(" > ")}`);
  return lines;
}

function performanceLines(label: string, g: HouseGroups): string[] {
  const out: string[] = [];
  out.push(`**${label} > GOOD PERFORMANCE**`, "");
  out.push(...(g.good.length ? g.good.map(goodLine) : ["* NONE"]));
  out.push("", `**${label} > NEUTRAL PERFORMANCE**`, "");
  out.push(
    ...(g.neutral.length
      ? g.neutral.map(goodLine)
      : [`* NONE > NOBODY LANDED IN THE SIX OR SEVEN BAND`]),
  );
  out.push("", `**${label} > NEEDS IMPROVEMENT**`, "");
  out.push(
    ...(g.needs.length
      ? g.needs.map(needsLine)
      : ["* NONE > NOBODY FAILED THIS HOUSE"]),
  );
  return out;
}

/** The venue's best and worst board this week, front and heart. */
function bestWorstLines(
  foh: HouseGroups,
  hoh: HouseGroups,
): string[] {
  const best = (g: HouseGroups): BoardScore | null =>
    g.good[0] ??
    g.neutral[0] ??
    null;
  const worst = (g: HouseGroups): BoardScore | null => {
    // Worst is the first of the needs list — missed boards lead it.
    return g.needs[0] ?? null;
  };
  const bestLine = (tag: string, b: BoardScore | null): string | null =>
    b ? `* ${tag} > ${b.code} > ${describeFilers(b)} > ${describeAssists(b)}` : null;
  const worstLine = (tag: string, b: BoardScore | null): string | null =>
    b
      ? `* ${tag} > ${b.code} > ${b.missed ? missedReason(b) : `ONLY ${b.approved} SIGNED OFF`}`
      : null;

  const lines = ["**BEST AND WORST**", ""];
  const rows = [
    bestLine("FOH BEST", best(foh)),
    worstLine("FOH WORST", worst(foh)),
    bestLine("HOH BEST", best(hoh)),
    worstLine("HOH WORST", worst(hoh)),
  ].filter((l): l is string => l !== null);
  if (rows.length === 0) return [];
  return [...lines, ...rows];
}

function followUpLines(boards: BoardScore[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (b: BoardScore, text: string) => {
    const key = `${b.code}|${b.house}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(`* ${b.code} ${b.house} > ${text}`);
  };

  // Non-obvious work only. "File by 4pm" is understood, so a board that simply
  // missed is not restated here — these are the boards that need something
  // built, split or handed to a second person before next week can go right.
  for (const b of boards) {
    if (b.built < 10) {
      push(
        b,
        `${b.built === 0 ? "KITCHEN BOARD IS NOT BUILT" : `BOARD IS ONLY ${word(b.built)} ITEMS`} > DONE WHEN TEN ARE BUILT AND FILED`,
      );
    }
  }
  for (const b of boards) {
    if (b.built >= 10 && b.filed > 0 && b.filed < 10) {
      push(b, `FILED ${word(b.filed)} NOT TEN > DONE WHEN ALL TEN FILE`);
    }
  }
  for (const b of boards) {
    if (!b.missed && b.sentBack >= 5) {
      push(
        b,
        `${word(b.sentBack)} CARDS BOUNCED > SPLIT REPAIRS FROM CLEANING AND SEND ME THE LIST`,
      );
    }
  }
  for (const b of boards) {
    if (
      b.tier === "good" &&
      b.authors.length <= 1 &&
      b.assists.length <= 1
    ) {
      push(b, `ONE NAME ON A CLEAN BOARD > DONE WHEN A SECOND NAME IS ON IT`);
    }
  }

  if (out.length === 0) return [];
  return ["**FOLLOW UP ACTIONS**", "", ...out.slice(0, 6)];
}

function shoutOutLines(
  thisWeek: BoardScore[],
  lastByKey: Map<string, BoardScore>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (line: string, key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push(line);
  };

  // A board that was a fail last week and a win this week is the week's story.
  for (const b of thisWeek) {
    const prior = lastByKey.get(`${b.code}|${b.house}`);
    if (prior?.missed && b.tier === "good") {
      add(
        `* ${topName(b)} (${b.code}) > ${b.house === "HOH" ? "KITCHEN" : "FRONT"} FROM A FAIL TO A ${b.approved}`,
        `comeback-${b.code}-${b.house}`,
      );
    }
  }

  // Both halves of a venue clean in the same week.
  const byVenue = new Map<string, BoardScore[]>();
  for (const b of thisWeek) {
    byVenue.set(b.code, [...(byVenue.get(b.code) ?? []), b]);
  }
  for (const [code, boards] of byVenue) {
    if (boards.length >= 2 && boards.every(isPerfect)) {
      add(`* THE ${code} CREW > CLEAN TEN IN BOTH HOUSES`, `double-${code}`);
    }
  }

  // A clean ten carried by a real crew, the delegation the programme pushes.
  for (const b of thisWeek) {
    if (isPerfect(b) && b.assists.length >= 4) {
      add(
        `* ${topName(b)} (${b.code}) > FILED ALL TEN WITH ${word(b.assists.length)} NAMES BEHIND`,
        `crew-${b.code}-${b.house}`,
      );
    }
  }

  if (out.length === 0) return [];
  return ["**SHOUT OUTS**", "", ...out.slice(0, 5)];
}

function openerLine(foh: HouseGroups, hoh: HouseGroups): string {
  const missed = (g: HouseGroups) => g.needs.filter((b) => b.missed);
  const low = (g: HouseGroups) => g.needs.filter((b) => !b.missed);
  const missedAll = [...missed(foh), ...missed(hoh)];
  const lowAll = [...low(foh), ...low(hoh)];

  const parts: string[] = [];
  parts.push(
    `Front of house landed ${foh.good.length} wins out of ${foh.total} and heart of house ${hoh.good.length} out of ${hoh.total}.`,
  );
  if (missedAll.length > 0) {
    const codes = [...new Set(missedAll.map((b) => b.code))].join(" ");
    parts.push(
      `The worst of it is the ${missedAll.length} boards that never filed by Thursday 4pm, ${codes}. A missed deadline is worse than a low walk. A low walk still got done and gives us something to fix. A board that never files gives us nothing and holds up the whole grade, so those come first.`,
    );
  }
  if (lowAll.length > 0) {
    const codes = [...new Set(lowAll.map((b) => b.code))].join(" ");
    parts.push(`${codes} did walk and came in low, and they get credit for filing.`);
  }
  return parts.join(" ");
}

function commBoostLines(
  foh: HouseGroups,
  hoh: HouseGroups,
  thisWeek: BoardScore[],
  lastByKey: Map<string, BoardScore>,
): string[] {
  const lines: string[] = [];
  const missedCodes = [
    ...new Set(
      [...foh.needs, ...hoh.needs].filter((b) => b.missed).map((b) => b.code),
    ),
  ];
  if (missedCodes.length) {
    lines.push(
      `* THE WORST MISSES ARE BOARDS THAT NEVER FILED BY 4PM > ${missedCodes.join(" ")}`,
    );
    lines.push(
      `* A MISSED DEADLINE BEATS A LOW WALK > A BOARD THAT NEVER FILES LEAVES US BLIND`,
    );
  }
  const comebacks = thisWeek.filter((b) => {
    const prior = lastByKey.get(`${b.code}|${b.house}`);
    return prior?.missed && b.tier === "good";
  });
  if (comebacks.length) {
    lines.push(
      `* A BOARD COMES BACK WHEN SOMEBODY OWNS IT > ${comebacks
        .map((b) => b.code)
        .join(" ")} CAME BACK THIS WEEK`,
    );
  }
  if (foh.needs.length === 0) {
    lines.push(`* FRONT OF HOUSE IS STEADY > ${foh.good.length} WINS AND NO FAILS`);
  }
  if (lines.length === 0) return [];
  return ["**COMMUNICATION BOOST**", "", ...lines.slice(0, 4)];
}

/**
 * The whole card, ready to paste. The mechanical sections are exact; the voice
 * sections (opener, best and worst, follow ups, boost, shout outs) are a draft
 * off the same numbers for the user to sharpen before it goes up.
 */
export function buildReportText(input: ReportInput): string {
  const fohBoards = input.thisWeek.filter((b) => b.house === "FOH");
  const hohBoards = input.thisWeek.filter((b) => b.house === "HOH");
  const foh = groupHouse(fohBoards);
  const hoh = groupHouse(hohBoards);

  const lastByKey = new Map(
    input.lastWeek.map((b) => [`${b.code}|${b.house}`, b]),
  );
  const lastFoh = new Map(
    input.lastWeek.filter((b) => b.house === "FOH").map((b) => [b.code, b]),
  );
  const lastHoh = new Map(
    input.lastWeek.filter((b) => b.house === "HOH").map((b) => [b.code, b]),
  );

  const blocks: string[] = [];
  blocks.push(openerLine(foh, hoh));

  const bw = bestWorstLines(foh, hoh);
  if (bw.length) blocks.push(bw.join("\n"));

  blocks.push(tallyLines("FRONT OF HOUSE", foh).join("\n"));
  blocks.push(movementLines("FRONT OF HOUSE", fohBoards, lastFoh).join("\n"));
  blocks.push(performanceLines("FRONT OF HOUSE", foh).join("\n"));

  blocks.push(tallyLines("HEART OF HOUSE", hoh).join("\n"));
  blocks.push(movementLines("HEART OF HOUSE", hohBoards, lastHoh).join("\n"));
  blocks.push(performanceLines("HEART OF HOUSE", hoh).join("\n"));

  const fu = followUpLines(input.thisWeek);
  if (fu.length) blocks.push(fu.join("\n"));

  const cb = commBoostLines(foh, hoh, input.thisWeek, lastByKey);
  if (cb.length) blocks.push(cb.join("\n"));

  const so = shoutOutLines(input.thisWeek, lastByKey);
  if (so.length) blocks.push(so.join("\n"));

  blocks.push("**EXCLUDED THIS WEEK: NONE**");

  return blocks.join("\n\n");
}
