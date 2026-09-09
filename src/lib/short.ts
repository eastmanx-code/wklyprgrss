import type { VenueCompliance } from "./compliance";

/**
 * What was short, in lists, and nothing else.
 *
 * The score on the row is the number; this is the reason for it, and it is
 * the same sentence on the locations screen, the group report and the top of
 * a venue's night, so a row and the page it opens agree. "Every list done and
 * signed" when nothing was short, because an empty note reads as a row that
 * has not loaded.
 */
export function shortOf(venue: VenueCompliance): string {
  const parts = [
    ...(venue.notSigned > 0 ? [`${venue.notSigned} not signed`] : []),
    ...(venue.notDone > 0 ? [`${venue.notDone} not done`] : []),
    ...(venue.going > 0 ? [`${venue.going} still going`] : []),
  ];
  return parts.length > 0 ? parts.join(" · ") : "every list done and signed";
}

export function shortOfEs(venue: VenueCompliance): string {
  const parts = [
    ...(venue.notSigned > 0 ? [`${venue.notSigned} sin firmar`] : []),
    ...(venue.notDone > 0 ? [`${venue.notDone} sin terminar`] : []),
    ...(venue.going > 0 ? [`${venue.going} en curso`] : []),
  ];
  return parts.length > 0
    ? parts.join(" · ")
    : "todas las listas hechas y firmadas";
}
