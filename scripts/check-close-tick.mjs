/**
 * Fixture checks for the close checklist's blur-to-complete rule.
 *
 *   npm run check-close-tick
 *
 * This is the rule that stopped a tick from flipping the wrong way when the
 * initials field lost focus: opening the signature box unchecked a signed-off
 * box, and a single tap could cancel itself out. The guarantee under test is
 * that a blur is one-way — it only ever completes a pending tick, and never
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

// -------------------------------------------- the bug: a blur must not untick

// Opening the signature box blurs the initials field of an already-done row.
// This is Drew's exact report. It must not complete (which would toggle it off).
is(
  "a done box does not complete on blur",
  shouldCompleteOnBlur({
    itemId: ITEM,
    pendingId: ITEM,
    done: true,
    hasInitials: true,
    togglingId: null,
  }),
  false,
);
is(
  "a done box stays put even with no pending",
  shouldCompleteOnBlur({
    itemId: ITEM,
    pendingId: null,
    done: true,
    hasInitials: true,
    togglingId: null,
  }),
  false,
);

// ------------------------------------------ the bug: a tap must not double-fire

// Tapping the card blurs the field; the card's own click will toggle, so the
// blur must stand aside or the two cancel out and the box lands unchecked.
is(
  "the card's own tap does not also complete on blur",
  shouldCompleteOnBlur({
    itemId: ITEM,
    pendingId: ITEM,
    done: false,
    hasInitials: true,
    togglingId: ITEM,
  }),
  false,
);
// A tap on a different card must not suppress this row's completion.
is(
  "a tap on another card does not block this one",
  shouldCompleteOnBlur({
    itemId: ITEM,
    pendingId: ITEM,
    done: false,
    hasInitials: true,
    togglingId: "item-2",
  }),
  true,
);

// ------------------------------------------------- the intended path still works

// Tapped first, initialled second, then focus leaves the field for the sign
// sheet or anywhere that is not this card: finish what the tap started.
is(
  "a pending, initialled, not-done row completes on blur",
  shouldCompleteOnBlur({
    itemId: ITEM,
    pendingId: ITEM,
    done: false,
    hasInitials: true,
    togglingId: null,
  }),
  true,
);
is(
  "no initials yet, so nothing to complete",
  shouldCompleteOnBlur({
    itemId: ITEM,
    pendingId: ITEM,
    done: false,
    hasInitials: false,
    togglingId: null,
  }),
  false,
);
is(
  "not pending, so a stray blur does nothing",
  shouldCompleteOnBlur({
    itemId: ITEM,
    pendingId: null,
    done: false,
    hasInitials: true,
    togglingId: null,
  }),
  false,
);
is(
  "pending points at another row, not this one",
  shouldCompleteOnBlur({
    itemId: ITEM,
    pendingId: "item-2",
    done: false,
    hasInitials: true,
    togglingId: null,
  }),
  false,
);

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
