import "server-only";

import { getSession, type Session } from "./session";
import { db } from "./supabase";

/**
 * The venue the close checklists are being built on.
 *
 * A leader always works on their own venue. An admin has no venue of their
 * own, so they get this one — the one the lists are being written against
 * while the shape of the thing is still being decided.
 *
 * It lived as `.eq("code", "HAWK")` in six files: both page loaders, the edit
 * screen, the rollup, and the two action modules. Moving the pilot meant
 * finding all six, and missing one would have left an admin writing items into
 * one venue and reading them back from another with nothing to say so. One
 * constant, one lookup, one place to change it.
 */
export const CLOSE_PILOT_VENUE = "HOOD";

/** The venue this session works on, or null if it has none. */
export async function closeVenueId(
  session?: Session | null,
): Promise<string | null> {
  const active = session === undefined ? await getSession() : session;
  if (!active) return null;
  if (active.role === "leader") return active.venueId;

  const { data } = await db()
    .from("venues")
    .select("id")
    .eq("code", CLOSE_PILOT_VENUE)
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
