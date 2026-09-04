/**
 * The shape of a venue's checklists.
 *
 * One list was never the product. A venue runs many — front of house and
 * heart of house, each role, each of open, mid and close — and the thing a MOD
 * actually does is flip to theirs, the way they would through a clipboard.
 * So the unit is the checklist, and the tree is how you reach it.
 *
 * What lives here now is only the vocabulary: the two houses, the three
 * phases, and how a list becomes a URL. The roles used to live here too, as a
 * guess at how a shift splits — MOD, Bartender, Barback — and every venue got
 * the same forty slots whether or not any of them made sense for that venue.
 *
 * They are gone. A venue writes its own roles, because a venue knows how its
 * own shift splits and this file never did. The rows in close_checklists are
 * the truth; this is just the words they are made of.
 */
import { HOUSES as HOUSE_KEYS, houseName, type House } from "./types";

/**
 * The two halves of a building are one idea, not two.
 *
 * They were defined here for the closing checklists and again in types.ts when
 * the walkthrough board was split, which gave the same house two names in one
 * app — a leader saw "Heart of house" on the closing list and "Kitchen" on the
 * board and had no way to know they were the same place. One definition, in
 * the module every other one already depends on.
 */
export type { House };
export { houseName };

export type Phase = "open" | "mid" | "close";

export const HOUSES: { key: House; name: string }[] = HOUSE_KEYS.map((key) => ({
  key,
  name: houseName(key),
}));

export const PHASES: { key: Phase; name: string }[] = [
  { key: "open", name: "Open" },
  { key: "mid", name: "Mid" },
  { key: "close", name: "Close" },
];

export function phaseName(phase: Phase): string {
  return PHASES.find((p) => p.key === phase)?.name ?? phase;
}

export const PHASE_ORDER: Phase[] = PHASES.map((p) => p.key);

/**
 * A list's address. Lower case and hyphenated, so "Kitchen MOD" and
 * "kitchen mod" reach the same place — a leader typing a role twice with
 * different capitals should not end up with two lists.
 */
export function slugFor(house: House, role: string, phase: Phase): string {
  return `${house}-${role}-${phase}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
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
 * Back out of a slug. The role is the middle, which is why it may contain
 * hyphens and the house and phase may not — they come from fixed lists.
 */
export function parseSlug(
  slug: string,
): { house: string; role: string; phase: string } | null {
  const parts = slug.split("-");
  if (parts.length < 3) return null;
  return {
    house: parts[0],
    role: parts.slice(1, -1).join(" "),
    phase: parts[parts.length - 1],
  };
}

/** The one rule about roles: it has to be something, and not an essay. */
export const MAX_ROLE_LENGTH = 40;
