import type { VenueCompliance } from "./compliance";

/**
 * What was short, in lists, and nothing else.
 *
 * The score on the row is the number; this is the reason for it, and it is
 * the same sentence on the locations screen, the group report and the top of
 * a venue's night, so a row and the page it opens agree. "No fails" when
 * nothing was short: the report calls out fails, and the absence of one is
 * the whole of what it has to say about a good night.
 */
export function shortOf(venue: VenueCompliance): string {
  const parts = [
    ...(venue.notDone > 0 ? [`${venue.notDone} not checked off`] : []),
    ...(venue.notSigned > 0 ? [`${venue.notSigned} not signed off`] : []),
    ...(venue.going > 0 ? [`${venue.going} still going`] : []),
  ];
  return parts.length > 0 ? parts.join(" · ") : "no fails";
}

export function shortOfEs(venue: VenueCompliance): string {
  const parts = [
    ...(venue.notDone > 0 ? [`${venue.notDone} sin marcar`] : []),
    ...(venue.notSigned > 0 ? [`${venue.notSigned} sin firmar`] : []),
    ...(venue.going > 0 ? [`${venue.going} en curso`] : []),
  ];
  return parts.length > 0 ? parts.join(" · ") : "sin fallas";
}
