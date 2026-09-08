/**
 * Fixture checks for the night boundary and the carry.
 *
 *   npm run check-night
 *
 * Time logic is the kind that works every day and is wrong for three hours a
 * morning, which is exactly the window nobody is watching. Every case here is
 * a real moment: the crew still closing at ten past four, the prep cook
 * arriving at five, the MOD who signs and then spots a mistake, the clock
 * changes, and a phone whose stamp is in the future.
 *
 * Pacific offsets are written out rather than computed, so a wrong answer
 * shows up as a wrong answer rather than as the same bug on both sides.
 */
import {
  CARRY_MINUTES,
  carriesForward,
  currentNight,
  inCarryWindow,
  nightEndsAt,
} from "../.night-check/night.js";

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

const utc = (iso) => new Date(iso);
/** Minutes before `now`, as a stamp. */
const ago = (now, minutes) =>
  new Date(now.getTime() - minutes * 60_000).toISOString();

// ---------------------------------------------------------------- the night

// Pacific is UTC-7 in September. 11:00Z is 4:00am, the changeover itself.
is("3:59am belongs to the night before", currentNight(utc("2026-09-08T10:59:00Z")), "2026-09-07");
is("4:00am starts the new night", currentNight(utc("2026-09-08T11:00:00Z")), "2026-09-08");
is("midnight is still the night before", currentNight(utc("2026-09-08T07:30:00Z")), "2026-09-07");
is("evening is its own night", currentNight(utc("2026-09-08T04:00:00Z")), "2026-09-07");
is("a night ends at 4am the next day", nightEndsAt("2026-09-07").toISOString(), "2026-09-08T11:00:00.000Z");

// Winter, UTC-8. The same wall clock, a different offset.
is("winter · 3:59am", currentNight(utc("2026-01-15T11:59:00Z")), "2026-01-14");
is("winter · 4:00am", currentNight(utc("2026-01-15T12:00:00Z")), "2026-01-15");
is("winter · a night ends at 4am", nightEndsAt("2026-01-14").toISOString(), "2026-01-15T12:00:00.000Z");

// --------------------------------------------------------------- the window

is("3:59am is not in the window", inCarryWindow(utc("2026-09-08T10:59:00Z")), false);
is("4:01am is", inCarryWindow(utc("2026-09-08T11:01:00Z")), true);
is("6:59am is", inCarryWindow(utc("2026-09-08T13:59:00Z")), true);
is("7:00am is not", inCarryWindow(utc("2026-09-08T14:00:00Z")), false);
is("nine at night is not", inCarryWindow(utc("2026-09-09T04:00:00Z")), false);

// ---------------------------------------------------------------- the carry

{
  // The case this exists for: a close still being walked at ten past four.
  const now = utc("2026-09-08T11:10:00Z");
  is("still ticking · carries", carriesForward(ago(now, 7), now), true);
}
{
  // The prep cook at five in the morning. Yesterday's prep list is unsigned
  // and was last touched a day ago, so he gets today, which is his own shift.
  const now = utc("2026-09-08T12:00:00Z");
  is("a day-old list · does not carry", carriesForward(ago(now, 60 * 20), now), false);
}
{
  // Signed at 3:55, mistake spotted at 4:05. The night just signed has to
  // still be the one a reopen reaches.
  const now = utc("2026-09-08T11:05:00Z");
  is("signed ten minutes ago · carries", carriesForward(ago(now, 10), now), true);
}
{
  const now = utc("2026-09-08T11:10:00Z");
  is("exactly at the limit · carries", carriesForward(ago(now, CARRY_MINUTES), now), true);
  is("a minute past it · does not", carriesForward(ago(now, CARRY_MINUTES + 1), now), false);
}
{
  // Outside the window nothing carries, however fresh. This is what stops a
  // night reopened at nine in the evening from swallowing tonight's work.
  const now = utc("2026-09-09T04:00:00Z");
  is("fresh but at nine at night · does not carry", carriesForward(ago(now, 5), now), false);
}
{
  const now = utc("2026-09-08T11:10:00Z");
  is("a night nobody touched · does not carry", carriesForward(null, now), false);
  is("an unreadable stamp · does not carry", carriesForward("not a date", now), false);
  // A stamp in the future is a wrong clock, not activity.
  is("a stamp from the future · does not carry", carriesForward(ago(now, -30), now), false);
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
