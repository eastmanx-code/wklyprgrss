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
 * The rule here makes the blur one-way: it may only ever COMPLETE a row, and
 * only when the blur is not the card's own tap. Completion runs toggle()
 * solely on an item that is not yet done, so losing focus can never undo a
 * check. A box comes off only when a person taps it off.
 *
 * A row completes on its initials, in either order: tap the box and then
 * initial it, or initial it and leave the field. The proof it asks for has to
 * be in first, and the initials have to be typed on that row.
 */
export function shouldCompleteOnBlur(args: {
  /** The row whose initials field just blurred. */
  itemId: string;
  /** Whether this row is already ticked. */
  done: boolean;
  /** Whether initials were typed on this row itself. */
  hasInitials: boolean;
  /** Whether every photo, video and note the row asks for is already in. */
  proofIn: boolean;
  /** The row whose checkbox is being tapped right now, if any. */
  togglingId: string | null;
}): boolean {
  const { itemId, done, hasInitials, proofIn, togglingId } = args;
  // The card itself was tapped: its own click will toggle, so completing here
  // too would fire twice and cancel out, leaving the box unchecked.
  if (togglingId === itemId) return false;
  // A blur must never undo a check. Opening the sign sheet blurs this field,
  // and a box already ticked has to stay ticked when it does.
  if (done) return false;
  // Initials are the signature on the row. Once they are on it and nothing
  // else is owed, the row is done, whether the box was tapped first or not.
  // It used to wait for a tap on the box as well, so somebody who initialled
  // every line and then went back to check them did the list twice.
  return hasInitials && proofIn;
}
