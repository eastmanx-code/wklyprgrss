/**
 * Is this a person's name, or is it something typed to get past the box?
 *
 * The first night produced "NULL" and "no MOD ON DUTY" in a field whose whole
 * job is to say who stood behind the shift. Neither is a bug: the app applies
 * no transform and stores what was typed, and every other name came through
 * exactly as entered. Somebody typed them.
 *
 * The second one is worth reading twice. "no MOD ON DUTY" is not somebody
 * messing about, it is somebody reporting the truth in the only field they
 * had. That is the argument for a second signature rather than a stricter box:
 * a missing countersign says the same thing, in a place the report can count.
 *
 * This is the cheap half. It will not stop anybody determined, and it is not
 * meant to: a person alone at three in the morning who wants past this will
 * type a real name. It stops the careless half, which is most of it.
 *
 * Deliberately free of imports so it runs on both sides and can be tested on
 * its own. It is also deliberately shy: a rule that rejects a real name is far
 * worse than one that lets a fake through, because the person it turns away is
 * standing in a bar at closing time with no way to finish.
 */

/** Words that are the absence of a name rather than a name. */
const NOT_A_NAME = new Set([
  "null",
  "nul",
  "nil",
  "none",
  "no one",
  "noone",
  "nobody",
  "n/a",
  "na",
  "nan",
  "undefined",
  "unknown",
  "anonymous",
  "anon",
  "test",
  "testing",
  "asdf",
  "asdfasdf",
  "qwerty",
  "abc",
  "abcd",
  "xxx",
  "xx",
  "name",
  "your name",
  "first last",
  "me",
  "self",
  "staff",
  "employee",
  "manager",
  "mod",
  "gm",
  "manager on duty",
  "mod on duty",
  "no mod",
  "no mod on duty",
  "no manager",
  "no manager on duty",
  "-",
  "--",
  "---",
  ".",
  "..",
  "n",
  "x",
]);

export const MIN_NAME_LENGTH = 2;

/**
 * Why a name was refused, or null when it is fine.
 *
 * A reason rather than a boolean, because the person reading it is holding a
 * phone at the end of a shift and "invalid" tells them nothing about what to
 * do next.
 */
export function nameProblem(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Put your name in.";

  const flat = value.toLowerCase().replace(/\s+/g, " ");
  if (NOT_A_NAME.has(flat)) return "That is not a name. Use yours.";

  // Strip anything that is not a letter to judge length, so "J.R." and "Jo Jo"
  // are names and "..." and "123" are not.
  const letters = value.replace(/[^\p{L}]/gu, "");
  if (letters.length < MIN_NAME_LENGTH) return "Use your name, not initials.";

  // One character repeated. "aaaa", "xxxx", "....".
  if (new Set(value.replace(/\s/g, "")).size === 1)
    return "That is not a name. Use yours.";

  // All digits, with or without spaces.
  if (/^[\d\s]+$/.test(value)) return "That is not a name. Use yours.";

  return null;
}

/** Convenience for the places that only need the verdict. */
export function looksLikeAName(raw: string): boolean {
  return nameProblem(raw) === null;
}

/**
 * Are these two boxes the same person?
 *
 * The second signature only means something if somebody else wrote it. Drew's
 * rule for closers is that they sign off for one another, so the one thing
 * worth refusing outright is the same name typed twice: the person who did the
 * work checking their own work is the situation the second signature exists to
 * make visible.
 *
 * Compared loosely on purpose. Case and spacing are noise, and so is a
 * trailing full stop. Anything cleverer than that starts guessing: "R. Bowen"
 * and "Ravyn Bowen" are probably one person and possibly two, and a rule that
 * guesses wrong blocks a real second signer at three in the morning with no
 * way round it. That case is left to the device stamp, which records that both
 * signatures came off one phone and lets the report say so rather than
 * pretending to know.
 */
export function samePerson(a: string, b: string): boolean {
  const flat = (raw: string) =>
    raw
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const left = flat(a);
  const right = flat(b);
  return left.length > 0 && left === right;
}
