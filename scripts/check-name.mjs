/**
 * Fixture checks for the name box.
 *
 *   npm run check-name
 *
 * The real cases are at the top: the two entries the first night actually
 * produced. Everything under them is the balance this has to hold. A rule that
 * turns away a real person standing in a bar at closing time with no way to
 * finish is far worse than one that lets a determined fake through, so the
 * accept list is longer than the reject list on purpose.
 */
import { nameProblem, looksLikeAName, samePerson } from "../.name-check/name.js";

let pass = 0,
  fail = 0;
const rejects = (v) => {
  const p = nameProblem(v);
  if (p) pass++;
  else {
    fail++;
    console.log(`  FAIL should reject: ${JSON.stringify(v)}`);
  }
};
const accepts = (v) => {
  const p = nameProblem(v);
  if (!p) pass++;
  else {
    fail++;
    console.log(`  FAIL should accept: ${JSON.stringify(v)} (said "${p}")`);
  }
};

// What Hood actually typed on the first night.
rejects("NULL");
rejects("no MOD ON DUTY");

// The rest of the ways people get past a box they do not want to fill in.
["", "   ", "n/a", "N/A", "none", "NONE", "nobody", "unknown", "test",
 "asdf", "qwerty", "xxx", "-", "...", "1234", "12 34", "aaaa", "....",
 "mod", "GM", "manager", "no manager on duty", "staff", "me", "x",
].forEach(rejects);

// Real names, including the awkward ones. Every one of these has to work.
["Jake", "Alexandra", "quentin maldonado", "Raymond Rocamora",
 "Kamilah Lasisi", "Brie Groves", "Jo", "Al", "J.R. Smith", "Jo Jo",
 "O'Brien", "Renée", "José García", "Anne-Marie", "van der Berg",
 "Nguyễn", "D'Angelo", "Mc Donald", "Li Wei", "  Drew  ",
].forEach(accepts);

// The verdict helper agrees with the reason.
if (looksLikeAName("Jake") === true && looksLikeAName("NULL") === false) pass++;
else {
  fail++;
  console.log("  FAIL looksLikeAName disagrees with nameProblem");
}

// ------------------------------------------------- the same person twice
//
// The second signature only means something if somebody else wrote it. Closers
// sign off for one another, so the same name in both boxes is the one case
// worth refusing outright.
const same = (label, a, b, want) => {
  if (samePerson(a, b) === want) { pass++; }
  else { fail++; console.log(`  FAIL ${label}\n    ${JSON.stringify(a)} vs ${JSON.stringify(b)} -> ${!want}`); }
};

same("the same name typed twice", "Ravyn Bowen", "Ravyn Bowen", true);
same("case is noise", "ravyn bowen", "RAVYN BOWEN", true);
same("spacing is noise", "Ravyn  Bowen", " Ravyn Bowen ", true);
same("a trailing stop is noise", "Ravyn Bowen.", "Ravyn Bowen", true);
same("a middle initial is noise either way", "Ravyn J Bowen", "Ravyn J. Bowen", true);

same("two people", "Ravyn Bowen", "Ethan Gathright", false);
same("same surname, different person", "Ravyn Bowen", "Alex Bowen", false);
// Deliberately not caught. Guessing that an initial is the same person would
// block a real second signer with no way round it; the device stamp carries
// that case instead.
same("an abbreviation is left to the device stamp", "R Bowen", "Ravyn Bowen", false);
same("empty is never a match", "", "", false);
same("empty against a name is not a match", "", "Ravyn Bowen", false);

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
