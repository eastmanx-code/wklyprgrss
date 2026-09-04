import "server-only";

import { cookies } from "next/headers";

import { getSession, type Session } from "./session";
import { db } from "./supabase";

/**
 * Which venue an admin is currently working in.
 *
 * A leader has one venue and it is stamped in their session. An admin has
 * none, and used to be pinned to a single code in this file — the venue the
 * lists were first written against while the shape of the thing was being
 * decided. That was right for one pilot and wrong the moment a second venue
 * wrote a list: every checklist screen showed an admin one building's lists
 * with nothing on the page to say which.
 *
 * A cookie rather than a path segment because the alternative was threading a
 * venue through six screens and two action modules, and one of them missing it
 * would have an admin writing items into one venue and reading them back from
 * another. It is set by picking a location and is named on every screen it
 * governs, so the state is visible rather than remembered.
 */
const VENUE_COOKIE = "ww-close-venue";

/** Remember the venue an admin picked. Leaders never reach this. */
export async function setCloseVenue(venueId: string): Promise<void> {
  (await cookies()).set(VENUE_COOKIE, venueId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

/** Forget it, so the next visit asks again. */
export async function clearCloseVenue(): Promise<void> {
  (await cookies()).delete(VENUE_COOKIE);
}

/**
 * The venue this session works on, or null if it has none.
 *
 * Null for an admin who has not picked one yet is the point: it sends them to
 * the list of locations rather than quietly showing somebody else's building.
 */
export async function closeVenueId(
  session?: Session | null,
): Promise<string | null> {
  const active = session === undefined ? await getSession() : session;
  if (!active) return null;
  if (active.role === "leader") return active.venueId;

  const picked = (await cookies()).get(VENUE_COOKIE)?.value;
  if (!picked) return null;

  // Confirmed against the table rather than trusted. The cookie is ours and
  // signed by nothing, and a stale id from a deleted venue would otherwise
  // read as a venue with no lists rather than as a venue that is not there.
  const { data } = await db()
    .from("venues")
    .select("id")
    .eq("id", picked)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * A venue's display name, for a screen that reports on one venue.
 *
 * The rollup had "Night Hawk" typed into its header, which was true of the one
 * venue it was built against and wrong for every other one that would ever
 * open it.
 */
export async function closeVenueName(venueId: string): Promise<string | null> {
  const { data } = await db()
    .from("venues")
    .select("name, code")
    .eq("id", venueId)
    .maybeSingle();
  const row = data as { name: string | null; code: string } | null;
  return row ? (row.name ?? row.code) : null;
}

/**
 * A venue's display name, looked up by its code.
 *
 * The compliance screens carry the code in the URL, because that is what a
 * manager reads on the board and what fits on a bar. The heading wants the
 * name the venue is actually called: the rest of the app has always shown
 * "Night Hawk" over "HOOD" and a report that only ever says HOOD reads like a
 * different product. Falls back to the code, which is what a venue with no
 * name set has always been called anyway.
 */
export async function venueNameOf(code: string): Promise<string> {
  const { data } = await db()
    .from("venues")
    .select("name, code")
    .eq("code", code)
    .maybeSingle();
  const row = data as { name: string | null; code: string } | null;
  if (!row) return code;
  return row.name && row.name !== row.code ? row.name : row.code;
}
