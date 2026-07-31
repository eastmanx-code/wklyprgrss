import "server-only";

import { ADMIN_PINS } from "./env";
import { pinMatches } from "./session";
import { db } from "./supabase";

/**
 * Does this PIN belong to an admin?
 *
 * Two sources: the env key, which is the master and cannot be removed from the
 * UI, and the codes added in the app. Every candidate is compared even after a
 * match, so how long the check takes says nothing about which one it was.
 *
 * Shared, because there are now two places that ask — signing in, and
 * reopening a night somebody already certified. A second copy of this would be
 * a second place to forget the database codes exist.
 */
export async function isAdminPin(pin: string): Promise<boolean> {
  if (!pin.trim()) return false;
  const { data: stored } = await db().from("admin_pins").select("pin");
  const candidates = [
    ...ADMIN_PINS(),
    ...(stored ?? []).map((row) => row.pin as string),
  ];
  return candidates.reduce(
    (found, candidate) => pinMatches(pin, candidate) || found,
    false,
  );
}
