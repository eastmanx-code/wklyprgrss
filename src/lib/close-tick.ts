/**
 * The one decision behind a tick that completes when its initials field loses
 * focus — pulled out of the close checklist so it can be tested on its own.
 *
 * A row is ticked in two beats: tap the card, then put initials in. The second
 * beat lands when the initials field blurs, and the handler there used to call
 * toggle() with no guard. That made a blur able to flip a box the wrong way:
 *
 *  - toggle() on an item that is already done unticks it, so opening the sign
 *    sheet — which moves focus off the field — unchecked a finished box and
 *    deleted its tick. ("First checkbox unchecks when the signature box is
 *    opened.")
 *  - a plain tap blurs the field (toggle on) and then the card's own click
 *    runs (toggle off), so a single tap could land on unchecked.
 *
 * The rule here makes the blur one-way: it may only ever COMPLETE a pending
 * tick, and only when the blur is not the card's own tap. Completion runs
 * toggle() solely on an item that is not yet done, so losing focus can never
 * undo a check. A box comes off only when a person taps it off.
 */
export function shouldCompleteOnBlur(args: {
  /** The row whose initials field just blurred. */
  itemId: string;
  /** The item waiting on its initials before its tap completes, if any. */
  pendingId: string | null;
  /** Whether this row is already ticked. */
  done: boolean;
  /** Whether the row now has non-empty initials. */
  hasInitials: boolean;
  /** The row whose checkbox is being tapped right now, if any. */
  togglingId: string | null;
}): boolean {
  const { itemId, pendingId, done, hasInitials, togglingId } = args;
  // The card itself was tapped: its own click will toggle, so completing here
  // too would fire twice and cancel out, leaving the box unchecked.
  if (togglingId === itemId) return false;
  // A blur must never undo a check. Opening the sign sheet blurs this field,
  // and a box already ticked has to stay ticked when it does.
  if (done) return false;
  // Otherwise finish what the tap started: the row is pending and now signed.
  return pendingId === itemId && hasInitials;
}
