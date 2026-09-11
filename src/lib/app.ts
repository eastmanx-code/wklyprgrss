/** The product name, shown in the masthead and the browser title. */
export const APP_NAME = "WEEKLY PROGRESS";

/**
 * Where a sign-in should land, when the link asked for somewhere.
 *
 * A QR code taped up in a prep room carries a destination, so scanning it puts
 * somebody on their checklists rather than on the door and then a home screen
 * they have no use for. It is a string off a URL, so it is checked rather than
 * trusted: a path inside this app, never a host, and never the protocol-relative
 * "//elsewhere" that a browser reads as one.
 */
export function safeNext(next: string | undefined, fallback = "/home"): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  return next;
}

/**
 * Where a session that is not an admin belongs when it reaches an admin screen.
 *
 * Signed out, the door. Signed in as a leader or a manager, home — because
 * sending them to the manager door they have already come through shows them
 * a sign in form for a session they are holding, which reads as being logged
 * out and is not.
 */
export function notAdminGoesTo(signedIn: boolean): string {
  return signedIn ? "/home" : "/admin/login";
}
