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

/**
 * How a shift is named in the sentence somebody puts their name to.
 *
 * The attestation used to say "tonight's close" on every list in the app,
 * including a prep open somebody signs at nine in the morning. A signature is
 * the one piece of text here that has to be exactly true: it is what gets read
 * back weeks later when a night is in question, and it named a shift that
 * person did not work.
 *
 * Words rather than clock time. The app files everything against a night, so
 * an open worked at six in the morning belongs to the night before it by the
 * house rule — correct for the record and nonsense to read. This says the
 * shift the person is standing in.
 *
 * `ready` is the claim being made, which is different per phase and not a
 * wording detail: closing hands the building to the opening team, opening
 * hands it to service.
 */
export const SHIFT_WORDS: Record<
  Phase,
  {
    shift: string;
    when: string;
    ready: string;
    shiftEs: string;
    whenEs: string;
    readyEs: string;
  }
> = {
  open: {
    shift: "today's open",
    when: "today",
    ready: "The venue is set and ready for service.",
    shiftEs: "la apertura de hoy",
    whenEs: "hoy",
    readyEs: "El lugar está listo para el servicio.",
  },
  mid: {
    shift: "today's mid shift",
    when: "today",
    ready: "The venue is set and ready for the rest of service.",
    shiftEs: "el medio turno de hoy",
    whenEs: "hoy",
    readyEs: "El lugar está listo para el resto del servicio.",
  },
  close: {
    shift: "tonight's close",
    when: "tonight",
    ready: "The venue is secured and ready for the opening team.",
    shiftEs: "el cierre de esta noche",
    whenEs: "esta noche",
    readyEs: "El lugar está cerrado y listo para el equipo de apertura.",
  },
};

/**
 * The two words on the crew path that are not proper nouns.
 *
 * A role is what a venue called it and stays as written: "Prep" is his job
 * title in English on his schedule too. A phase and a house are the app's own
 * vocabulary, and they are the signposts somebody follows to reach their list,
 * so they are the ones that have to be readable.
 *
 * Cocina rather than a literal reading of heart of house. The kitchen is what
 * the people in it call it.
 */
export const PHASE_ES: Record<Phase, string> = {
  open: "Apertura",
  mid: "Medio turno",
  close: "Cierre",
};

export const HOUSE_ES: Record<House, string> = {
  FOH: "Frente de casa",
  HOH: "Cocina",
};

export const PHASE_ORDER: Phase[] = PHASES.map((p) => p.key);

/**
 * Addresses live in slug.ts, which has no imports so the fixtures can run it.
 * Re-exported here because every caller already reaches for this module and a
 * second import path would be the only thing that changed.
 */
export { matchSlug, roleSlug, slugFor, type Addressable } from "./slug";

/** The one rule about roles: it has to be something, and not an essay. */
export const MAX_ROLE_LENGTH = 40;
