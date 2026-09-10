/**
 * Who is holding the phone, and what that lets them reach.
 *
 * Import-free on purpose, like the night maths and the slugs, so
 * scripts/check-role.mjs can prove it with no database and no bundler.
 *
 * This is here because of what happened the day the third role was added. The
 * app had two — the venue code on the QR by the rack, and the admin code that
 * opens all twenty one venues — and a great deal of code said "leader" where
 * it meant "confined to one venue". Every one of those lines was correct until
 * a third role existed and then silently wrong, because a manager is not a
 * leader and the else branch is the admin branch. Five screens and two actions
 * would have let a bar manager read and write every venue in the group.
 *
 * So the question is asked here, once, in the words that actually matter:
 * which venue is this session confined to, and may it write a list. Not "is it
 * a leader".
 */

/** A session, reduced to what a permission depends on. */
export type Who =
  | { role: "leader"; venueId: string }
  | { role: "manager"; venueId: string }
  /**
   * An admin may be tied to one half. Two people grade, one the dining
   * room and one the kitchen, and each PIN says which; an admin with no
   * half is the master key and grades either.
   */
  | { role: "admin"; house?: "FOH" | "HOH" };

/** May this admin rule on this half? Nobody else rules on anything. */
export function mayGrade(who: Who | null, house: "FOH" | "HOH"): boolean {
  if (!who || who.role !== "admin") return false;
  return !who.house || who.house === house;
}

/**
 * The venue this session is confined to, or null for an admin, who is
 * confined to none.
 *
 * Null means "not confined", not "no venue". Read the other way round it says
 * an admin belongs nowhere, and a guard written on that reading locks the
 * admin out of everything instead of letting them into it.
 */
export function venueOfSession(who: Who | null): string | null {
  return who && who.role !== "admin" ? who.venueId : null;
}

/**
 * May this session write a list, and reopen a night somebody has signed?
 *
 * The two things that separate a manager from the crew. One definition rather
 * than `role === "admin"` written out at each screen and each action, which is
 * how a second role gets added and one button keeps checking for the first.
 */
export function mayManage(who: Who | null): boolean {
  return who?.role === "manager" || who?.role === "admin";
}

/**
 * May this session read and write this venue's things at all?
 *
 * An admin, any venue. Anybody else, their own and no other, whatever they
 * type into the address bar: a URL is not a permission.
 */
export function mayReachVenue(who: Who | null, venueId: string): boolean {
  if (!who) return false;
  if (who.role === "admin") return true;
  return Boolean(venueId) && who.venueId === venueId;
}
