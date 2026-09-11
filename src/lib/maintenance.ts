import "server-only";

import { MAINTENANCE_MESSAGE_MAX } from "./maintenance-limits";
import { db } from "./supabase";

/** The site-wide hold and the words shown while it is on. */
export type Maintenance = { locked: boolean; message: string | null };

/** What the app is when the switch has never been touched, or cannot be read. */
const UNLOCKED: Maintenance = { locked: false, message: null };

// Re-exported so server callers keep importing it from here alongside the
// reader and writer; the client toggle imports it from maintenance-limits.
export { MAINTENANCE_MESSAGE_MAX };

/**
 * Is the site held for maintenance right now, and what should the hold say.
 *
 * Read defensively. A hold screen is a courtesy, not a gate on anything that
 * matters — the ticks save themselves — so a database that is slow, down, or
 * missing this table must never be the reason a crew cannot reach their list.
 * Every failure here reads as unlocked, and the site behaves exactly as it did
 * before the switch existed.
 */
export async function getMaintenance(): Promise<Maintenance> {
  try {
    const { data, error } = await db()
      .from("maintenance_lock")
      .select("locked, message")
      .limit(1)
      .maybeSingle();
    if (error || !data) return UNLOCKED;
    const row = data as { locked: boolean | null; message: string | null };
    return {
      locked: Boolean(row.locked),
      message: row.message?.trim() ? row.message.trim() : null,
    };
  } catch {
    return UNLOCKED;
  }
}

/**
 * Flip the switch. The message is trimmed and capped, and stored as null when
 * blank so the hold falls back to its own words. `by` is whoever pressed it,
 * kept only so the row can say who left the site locked.
 */
export async function setMaintenance(
  locked: boolean,
  message: string,
  by: string,
): Promise<void> {
  const trimmed = message.trim().slice(0, MAINTENANCE_MESSAGE_MAX);
  const { error } = await db()
    .from("maintenance_lock")
    .update({
      locked,
      message: trimmed || null,
      updated_at: new Date().toISOString(),
      updated_by: by || null,
    })
    .eq("id", true);
  if (error) throw new Error(error.message);
}
