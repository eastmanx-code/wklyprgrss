import { CLOSE_CHECKLIST, type CloseItem } from "./close-checklist";

/**
 * The shape of a venue's checklists.
 *
 * One list was never the product. A venue runs many — front of house and
 * heart of house, each role, each of open, mid and close — and the thing a MOD
 * actually does is flip to theirs, the way they would through a clipboard.
 * So the unit is the checklist, and the tree is how you reach it.
 *
 * Still in code rather than in tables. The tree is the part that needs
 * agreeing before it is worth a migration, and a wrong taxonomy is far more
 * expensive to undo in Postgres than here.
 */

export type House = "FOH" | "HOH";
export type Phase = "open" | "mid" | "close";

export const HOUSES: { key: House; name: string }[] = [
  { key: "FOH", name: "Front of house" },
  { key: "HOH", name: "Heart of house" },
];

export const PHASES: { key: Phase; name: string }[] = [
  { key: "open", name: "Open" },
  { key: "mid", name: "Mid" },
  { key: "close", name: "Close" },
];

export type Checklist = {
  slug: string;
  venueCode: string;
  house: House;
  role: string;
  phase: Phase;
  /** Empty until someone builds it — the same "not set up" the weekly board uses. */
  items: CloseItem[];
};

/**
 * Roles are a first guess and the thing most likely to be wrong. They are the
 * one part of this taxonomy that came from nowhere but common restaurant
 * practice, so they are worth checking against how Night Hawk actually splits
 * a shift before any of this becomes a table.
 */
const FOH_ROLES = ["MOD", "Bartender", "Server", "Barback", "Host"];
const HOH_ROLES = ["Kitchen MOD", "Line", "Prep", "Dish"];

function build(): Checklist[] {
  const out: Checklist[] = [];
  for (const { key: house } of HOUSES) {
    for (const role of house === "FOH" ? FOH_ROLES : HOH_ROLES) {
      for (const { key: phase } of PHASES) {
        const slug = `${house}-${role}-${phase}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-");
        out.push({
          slug,
          venueCode: "HAWK",
          house,
          role,
          phase,
          // The one that exists. Everything else is a slot waiting for its list.
          items: house === "FOH" && role === "MOD" && phase === "close"
            ? CLOSE_CHECKLIST
            : [],
        });
      }
    }
  }
  return out;
}

export const CHECKLISTS: Checklist[] = build();

export function checklistBySlug(slug: string): Checklist | undefined {
  return CHECKLISTS.find((list) => list.slug === slug);
}

export function rolesIn(house: House): string[] {
  return [...new Set(CHECKLISTS.filter((c) => c.house === house).map((c) => c.role))];
}

export function forRole(house: House, role: string): Checklist[] {
  const order = PHASES.map((p) => p.key);
  return CHECKLISTS.filter((c) => c.house === house && c.role === role).sort(
    (a, b) => order.indexOf(a.phase) - order.indexOf(b.phase),
  );
}

/** How many of a venue's lists have actually been built. */
export function builtCount(): { built: number; total: number } {
  return {
    built: CHECKLISTS.filter((c) => c.items.length > 0).length,
    total: CHECKLISTS.length,
  };
}

export function phaseName(phase: Phase): string {
  return PHASES.find((p) => p.key === phase)?.name ?? phase;
}
