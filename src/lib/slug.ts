/**
 * A list's address, and which list an address is asking for.
 *
 * Import-free on purpose, like the night maths, so scripts/check-slug.mjs can
 * prove it with no database and no bundler. House and phase are typed as
 * plain strings here for that reason; every caller passes the narrow types and
 * keeps them.
 *
 * This is the piece that decides which list a tap reaches. It used to exist
 * three times, in three files, each splitting the slug on hyphens and
 * reassembling the role out of the middle, each slightly differently. All
 * three were one role name away from being wrong: a hyphen inside a role, or
 * a room sitting where the phase was expected, and an address quietly resolves
 * to nothing, or worse, to somebody else's list.
 *
 * So an address is only ever built here, never taken apart.
 */

/** The parts of a list that decide its address. */
export type Addressable = {
  house: string;
  role: string;
  phase: string;
  /** Set only where a position runs one list per room rather than per phase. */
  room?: string | null;
};

/**
 * A list's address. Lower case and hyphenated, so "Kitchen MOD" and
 * "kitchen mod" reach the same place — a leader typing a role twice with
 * different capitals should not end up with two lists.
 *
 * The room, where there is one, sits between the role and the phase:
 * foh-deep-clean-noble-mid. A position with rooms has one list per room
 * rather than one per phase, so without it all three deep cleans would be
 * foh-deep-clean-mid and only one of them would ever be reachable.
 */
export function slugFor(
  house: string,
  role: string,
  phase: string,
  room?: string | null,
): string {
  const middle = room?.trim() ? `${role}-${room}` : role;
  return `${house}-${middle}-${phase}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

/**
 * A position's address, for the screen that lists what that position owns.
 *
 * Same shaping as slugFor, so "Bar Deep Clean" and "bar deep clean" are one
 * position rather than two rows a MOD has to guess between.
 */
export function roleSlug(role: string): string {
  return role.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/**
 * Which of a venue's lists a slug is asking for.
 *
 * Comparing built addresses cannot drift, because the same function writes
 * the links. It costs a walk over a handful of rows, and it makes a whole
 * class of near-miss impossible: a slug that is not exactly some list's own
 * address matches nothing at all.
 */
export function matchSlug<T extends Addressable>(
  rows: T[],
  slug: string,
): T | null {
  const wanted = slug.trim().toLowerCase();
  return (
    rows.find(
      (row) => slugFor(row.house, row.role, row.phase, row.room) === wanted,
    ) ?? null
  );
}
