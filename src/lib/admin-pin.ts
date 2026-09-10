import "server-only";

import { ADMIN_PINS } from "./env";
import { pinMatches } from "./session";
import { db } from "./supabase";

/**
 * Who a PIN belongs to: an admin, a manager at one venue, or nobody.
 *
 * Two sources. The env key is the master and cannot be removed from the UI.
 * The codes added in the app can name a venue, and a code that names one is a
 * manager's: that venue's lists and reports, nothing else.
 *
 * Every candidate is compared even after a match, so how long the check takes
 * says nothing about which one it was. That is why this is a reduce rather
 * than a find, and why the loop does not stop early even though it could.
 *
 * Shared, because three places ask — the crew door, the manager door, and
 * reopening a night somebody already certified. A second copy of this would be
 * a second place to forget the database codes exist.
 */
export type PinHolder =
  | { kind: "admin"; house: "FOH" | "HOH" | null }
  | { kind: "manager"; venueId: string };

/**
 * The half the master key grades. The env key belongs to the person who
 * walks the dining rooms; the kitchen grader's code is in the table with its
 * own half on it. Overridable, never blank: a master key with no half could
 * grade both, which is the thing the split exists to stop.
 */
const MASTER_HOUSE = (): "FOH" | "HOH" =>
  process.env.ADMIN_PIN_HOUSE === "HOH" ? "HOH" : "FOH";

export async function pinHolder(pin: string): Promise<PinHolder | null> {
  if (!pin.trim()) return null;

  const { data: stored } = await db()
    .from("admin_pins")
    .select("pin, venue_id, house");

  const candidates: {
    pin: string;
    venueId: string | null;
    house: "FOH" | "HOH" | null;
  }[] = [
    ...ADMIN_PINS().map((value) => ({
      pin: value,
      venueId: null,
      house: MASTER_HOUSE(),
    })),
    ...(
      (stored ?? []) as {
        pin: string;
        venue_id: string | null;
        house: string | null;
      }[]
    ).map((row) => ({
      pin: row.pin,
      venueId: row.venue_id,
      house: (row.house === "FOH" || row.house === "HOH" ? row.house : null) as
        | "FOH"
        | "HOH"
        | null,
    })),
  ];

  return candidates.reduce<PinHolder | null>((found, candidate) => {
    const hit = pinMatches(pin, candidate.pin);
    if (found) return found;
    if (!hit) return null;
    return candidate.venueId
      ? { kind: "manager", venueId: candidate.venueId }
      : { kind: "admin", house: candidate.house };
  }, null);
}

/**
 * Does this PIN open the manager door at all?
 *
 * Kept as its own name because that is the question two of the three callers
 * are actually asking, and `pinHolder(pin) !== null` at each of them reads
 * like a null check rather than like a permission.
 */
export async function isAdminPin(pin: string): Promise<boolean> {
  return (await pinHolder(pin)) !== null;
}
