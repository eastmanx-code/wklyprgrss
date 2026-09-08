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
import { nameProblem, looksLikeAName } from "../.name-check/name.js";

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

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
