/**
 * Fixture checks for the pace reading.
 *
 *   npm run check-pace
 *
 * This is the one measure in the app that accuses somebody of something, so
 * the line it draws has to be drawn on purpose. Every case here is a shape a
 * real night can take, worked out by hand: the swipe, the honest walk, the
 * honest walk with no signal, the short list that only looks fast, and the
 * phone whose clock has been set by hand.
 *
 * The case that matters most is the third. Since the offline queue shipped, an
 * honest walk in a cellar arrives in one burst, and if the reading used
 * arrival times it would call that cheating. It uses the claimed clock instead,
 * and this file is what holds that decision in place.
 */
import { paceOf } from "../.pace-check/pace.js";

let pass = 0,
  fail = 0;
const is = (label, got, want) => {
  const a = JSON.stringify(got),
    b = JSON.stringify(want);
  if (a === b) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL ${label}\n    got  ${a}\n    want ${b}`);
  }
};

const at = (iso) => new Date(iso).getTime();
/** n ticks starting at `from`, `gap` seconds apart, on both clocks. */
const walk = (from, gap, n, lagMinutes = 0) =>
  Array.from({ length: n }, (_, i) => {
    const claimed = at(from) + i * gap * 1000;
    return {
      at: new Date(claimed + lagMinutes * 60_000).toISOString(),
      claimedAt: new Date(claimed).toISOString(),
    };
  });

// The night of 3 August: 4am on the 3rd to 4am on the 4th, Pacific.
const WINDOW = {
  start: new Date("2026-08-03T11:00:00Z"),
  end: new Date("2026-08-04T11:00:00Z"),
};

// A swipe: twenty items, three seconds apart, sixty seconds end to end.
{
  const p = paceOf(walk("2026-08-04T05:00:00Z", 3, 20), WINDOW);
  is("swipe · burst", p.burst, true);
  is("swipe · pace", p.secondsPerItem, 3);
  is("swipe · span", p.spanSeconds, 57);
  is(
    "swipe · note",
    p.note,
    "20 ticks 3 seconds apart, 57 seconds end to end",
  );
}

// An honest walk: twenty items over forty minutes.
{
  const p = paceOf(walk("2026-08-04T05:00:00Z", 120, 20), WINDOW);
  is("walk · not a burst", p.burst, false);
  is("walk · pace", p.secondsPerItem, 120);
  is("walk · nothing to say", p.note, null);
}

// The case the whole design turns on. Walked honestly over forty minutes with
// no signal, drained two hours later, so every tick ARRIVED in one clump.
// Read on arrival this is a swipe; read on the claimed clock it is a walk.
{
  const ticks = walk("2026-08-04T05:00:00Z", 120, 20, 120).map((t, i, all) => ({
    ...t,
    // The drain sends them one after another, seconds apart.
    at: new Date(at(all[all.length - 1].claimedAt) + 120 * 60_000 + i * 400).toISOString(),
  }));
  const p = paceOf(ticks, WINDOW);
  is("offline walk · not accused", p.burst, false);
  is("offline walk · read on the phone's clock", p.clock, "claimed");
  is("offline walk · lag noticed", p.late, true);
  is("offline walk · lag", p.lagMinutes, 158);
}

// A swipe done offline is still a swipe: the claims are bunched too.
{
  const p = paceOf(walk("2026-08-04T05:00:00Z", 3, 20, 180), WINDOW);
  is("offline swipe · still caught", p.burst, true);
  is("offline swipe · lag noticed", p.late, true);
}

// Four items at one station in twenty seconds. Fast, but that is a short
// list, not a lie. Below the minimum it is not judged at all.
{
  const p = paceOf(walk("2026-08-04T05:00:00Z", 5, 4), WINDOW);
  is("short list · not a burst", p.burst, false);
  is("short list · counted", p.ticks, 4);
}

// Five is the minimum, and five at five seconds is over the line.
{
  const p = paceOf(walk("2026-08-04T05:00:00Z", 5, 5), WINDOW);
  is("minimum · burst", p.burst, true);
}

// Exactly ten seconds an item is the threshold and is NOT a burst. The line
// is "faster than ten", so a venue arguing the edge case wins it.
{
  const p = paceOf(walk("2026-08-04T05:00:00Z", 10, 10), WINDOW);
  is("threshold · not a burst", p.burst, false);
}

// Older ticks predate the device clock. Mixing the two would put hours of
// drift inside one span, so a list missing any claim is read on arrival only.
{
  const ticks = walk("2026-08-04T05:00:00Z", 120, 6);
  ticks[2].claimedAt = null;
  const p = paceOf(ticks, WINDOW);
  is("mixed clocks · falls back", p.clock, "arrived");
  is("mixed clocks · no invented lag", p.lagMinutes, 0);
}

// A phone claiming a time this night never contained: set by hand, or simply
// wrong. Either way the times on the page are not the device's.
{
  const ticks = walk("2026-08-04T05:00:00Z", 120, 6);
  ticks[0].claimedAt = "2026-07-30T05:00:00Z";
  const p = paceOf(ticks, WINDOW);
  is("bad clock · flagged", p.impossible, true);
}

// A night nobody opened has no pace, and must not read as an instant one.
{
  const p = paceOf([], WINDOW);
  is("empty · no burst", p.burst, false);
  is("empty · no ticks", p.ticks, 0);
}

// One tick has no gap to measure. A span of zero is not a burst.
{
  const p = paceOf(walk("2026-08-04T05:00:00Z", 0, 1), WINDOW);
  is("single tick · not a burst", p.burst, false);
  is("single tick · no pace", p.secondsPerItem, 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
