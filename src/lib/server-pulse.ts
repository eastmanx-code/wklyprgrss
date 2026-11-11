/**
 * Whether the server answered the last time this page asked it anything.
 *
 * On 2026-11-10 the server stopped answering for four minutes in the middle of
 * close. Phones were online the whole time, so nothing that watches for "no
 * signal" noticed. Every open list kept asking for a fresh copy every fifteen
 * seconds, each ask hung for half a minute, and when one finally came back as
 * an error Next reloaded the page onto it: the crew lost the list they were
 * halfway through to a timeout screen.
 *
 * The maintenance check already asks the server something small on a timer, so
 * it keeps this up to date for free. Anything about to ask for something big
 * looks here first and waits a beat if the last answer was no answer.
 *
 * Module state, on purpose: one page, one truth, no provider to thread through.
 */
let lastAnsweredAt = 0;
let lastSilentAt = 0;

export function serverAnswered(): void {
  lastAnsweredAt = Date.now();
}

export function serverDidNotAnswer(): void {
  lastSilentAt = Date.now();
}

/** True until a miss is more recent than a reply. Unknown counts as up. */
export function serverLooksUp(): boolean {
  return lastSilentAt <= lastAnsweredAt;
}
