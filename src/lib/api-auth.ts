import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * The read API's front door, shared by every endpoint.
 *
 * One token for the platform rather than one per endpoint. A second secret to
 * rotate, store and hand over buys nothing here — both endpoints expose the
 * same class of thing, read-only figures with no names, photographs or PINs in
 * them — and two tokens is two things to get wrong on the day one of them
 * leaks.
 */

/** Constant-time, and safe when the lengths differ. */
function matches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would turn a
  // wrong-length token into a 500 and leak the right length in the difference.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Null when the caller is allowed through; otherwise the response to return.
 *
 * Fails closed. An unset token means the endpoint is off, not open — checking
 * `given === expected` on two undefineds would have meant the opposite.
 */
export function requireToken(request: Request): Response | null {
  const expected = process.env.SCORES_API_TOKEN;
  if (!expected) {
    return Response.json(
      { error: "Not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!given || !matches(given, expected)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  return null;
}
