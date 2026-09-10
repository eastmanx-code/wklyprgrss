import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";

import { SUPABASE_SERVICE_ROLE_KEY } from "./env";
import type { Who } from "./role";

// The predicates live in role.ts, which has no imports and is checked against
// fixtures. Re-exported from here because this is where every caller already
// looks for them, and a second import path for the same rule is a second place
// to write the rule out by hand instead.
export { mayGrade, mayManage, mayReachVenue, venueOfSession } from "./role";

const COOKIE_NAME = "ww_session";
/** A day: leaders sign in each shift rather than staying logged in for a month. */
const LEADER_TTL_MS = 24 * 60 * 60 * 1000;
const ADMIN_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Who is holding the phone.
 *
 * A leader is the venue code on the QR by the rack, which everybody who works
 * there has. An admin is every venue and everything in them.
 *
 * A manager is the level that was missing, and its absence had been worked
 * around four times: one venue, like a leader, plus the two things a leader
 * cannot do — edit a list and reopen a signed night. Before this, giving a bar
 * manager those two meant giving them all twenty one venues and the screen
 * that mints admin codes.
 */
export type Session = Who;

type Payload =
  | { r: "l"; v: string; e: number }
  | { r: "m"; v: string; e: number }
  | { r: "a"; e: number; h?: "FOH" | "HOH" };

/**
 * Derived from the service-role key so the app needs no extra secret beyond the
 * env vars in the spec. Rotating that key invalidates every session, which is
 * the behaviour you want anyway.
 */
function signingKey(): Buffer {
  return crypto
    .createHash("sha256")
    .update(`${SUPABASE_SERVICE_ROLE_KEY()}::ww-session-v1`)
    .digest();
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payload: Payload): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const mac = b64url(
    crypto.createHmac("sha256", signingKey()).update(body).digest(),
  );
  return `${body}.${mac}`;
}

function verify(token: string): Payload | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;

  const expected = crypto
    .createHmac("sha256", signingKey())
    .update(body)
    .digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(mac, "base64url");
  } catch {
    return null;
  }
  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Payload;
    if (typeof payload?.e !== "number" || Date.now() > payload.e) return null;
    if (payload.r === "l" && typeof payload.v === "string") return payload;
    if (payload.r === "m" && typeof payload.v === "string") return payload;
    if (payload.r === "a") return payload;
    return null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;
  if (payload.r === "l") return { role: "leader", venueId: payload.v };
  if (payload.r === "m") return { role: "manager", venueId: payload.v };
  return payload.h ? { role: "admin", house: payload.h } : { role: "admin" };
}

async function setSessionCookie(payload: Payload, maxAgeMs: number) {
  (await cookies()).set(COOKIE_NAME, sign(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  });
}

export async function startLeaderSession(venueId: string) {
  await setSessionCookie(
    { r: "l", v: venueId, e: Date.now() + LEADER_TTL_MS },
    LEADER_TTL_MS,
  );
}

/**
 * A manager's shift. The same twelve hours as an admin, because it is the same
 * act — somebody signing in to fix something rather than to walk a list.
 */
export async function startManagerSession(venueId: string) {
  await setSessionCookie(
    { r: "m", v: venueId, e: Date.now() + ADMIN_TTL_MS },
    ADMIN_TTL_MS,
  );
}

export async function startAdminSession(house: "FOH" | "HOH" | null = null) {
  await setSessionCookie(
    house
      ? { r: "a", e: Date.now() + ADMIN_TTL_MS, h: house }
      : { r: "a", e: Date.now() + ADMIN_TTL_MS },
    ADMIN_TTL_MS,
  );
}

export async function endSession() {
  (await cookies()).delete(COOKIE_NAME);
}

/** Constant-time PIN comparison — cheap, and keeps timing out of the picture. */
export function pinMatches(provided: string, actual: string): boolean {
  const a = Buffer.from(provided.trim(), "utf8");
  const b = Buffer.from(actual.trim(), "utf8");
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function requireAdmin(): Promise<void> {
  const session = await getSession();
  if (session?.role !== "admin") throw new Error("Not signed in.");
}
