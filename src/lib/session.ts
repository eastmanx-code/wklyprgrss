import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";

import { SUPABASE_SERVICE_ROLE_KEY } from "./env";

const COOKIE_NAME = "ww_session";
const LEADER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ADMIN_TTL_MS = 12 * 60 * 60 * 1000;

export type Session = { role: "leader"; venueId: string } | { role: "admin" };

type Payload = { r: "l"; v: string; e: number } | { r: "a"; e: number };

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
  return payload.r === "l"
    ? { role: "leader", venueId: payload.v }
    : { role: "admin" };
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

export async function startAdminSession() {
  await setSessionCookie(
    { r: "a", e: Date.now() + ADMIN_TTL_MS },
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

/** Throws unless the caller holds a leader session for this exact venue. */
export async function requireLeader(): Promise<string> {
  const session = await getSession();
  if (session?.role !== "leader") throw new Error("Not signed in.");
  return session.venueId;
}

export async function requireAdmin(): Promise<void> {
  const session = await getSession();
  if (session?.role !== "admin") throw new Error("Not signed in.");
}
