/**
 * Fixture checks for the close checklist's blur-to-complete rule.
 *
 *   npm run check-close-tick
 *
 * This is the rule that stopped a tick from flipping the wrong way when the
 * initials field lost focus: opening the signature box unchecked a signed-off
 * box, and a single tap could cancel itself out. The guarantee under test is
 * that a blur is one-way: it only ever completes a row, and never
 * undoes a done one.
 */
import { shouldCompleteOnBlur } from "../.close-tick-check/close-tick.js";

let pass = 0,
  fail = 0;
const is = (label, got, want) => {
  if (got === want) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL ${label}\n    got  ${got}\n    want ${want}`);
  }
};

const ITEM = "item-1";
const base = {
  itemId: ITEM,
  done: false,
  hasInitials: true,
  proofIn: true,
  togglingId: null,
};

// -------------------------------------------- the bug: a blur must not untick

// Opening the signature box blurs the initials field of an already-done row.
// This is Drew's exact report. It must not complete (which would toggle it off).
is(
  "a done box does not complete on blur",
  shouldCompleteOnBlur({ ...base, done: true }),
  false,
);

// ------------------------------------------ the bug: a tap must not double-fire

// Tapping the card blurs the field; the card's own click will toggle, so the
// blur must stand aside or the two cancel out and the box lands unchecked.
is(
  "the card's own tap does not also complete on blur",
  shouldCompleteOnBlur({ ...base, togglingId: ITEM }),
  false,
);
// A tap on a different card must not suppress this row's completion.
is(
  "a tap on another card does not block this one",
  shouldCompleteOnBlur({ ...base, togglingId: "item-2" }),
  true,
);

// --------------------------------------------- a row completes on its initials

// Either order: box then initials, or initials and leave the field. Somebody
// who initialled every line and then went back to check each box was doing
// the list twice.
is(
  "initialled, nothing else owed, not done: completes on blur",
  shouldCompleteOnBlur(base),
  true,
);
is(
  "no initials yet, so nothing to complete",
  shouldCompleteOnBlur({ ...base, hasInitials: false }),
  false,
);
// Proof comes before the check. Initials alone do not tick a row that still
// owes a photo, a video or a written note.
is(
  "initialled but still owing proof does not complete",
  shouldCompleteOnBlur({ ...base, proofIn: false }),
  false,
);
is(
  "owing proof and initials does not complete",
  shouldCompleteOnBlur({ ...base, proofIn: false, hasInitials: false }),
  false,
);

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
