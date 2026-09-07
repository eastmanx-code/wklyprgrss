/**
 * The product name. Kept as a constant because `>` is not valid bare text in
 * JSX — inlining it means escaping it everywhere it appears.
 */
export const APP_NAME = "WKLY > PRGRSS";

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
