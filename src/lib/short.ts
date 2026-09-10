import type { VenueCompliance } from "./compliance";

/**
 * How many lists failed, and nothing else.
 *
 * The score on the row is the number; this is the count behind it, and it
 * is the same sentence on the locations screen, the group report and the
 * top of a venue's night, so a row and the page it opens agree. It used to
 * split the fails two ways, "1 not checked off · 2 not signed off", and a
 * reader could not tell whether that was three lists or two. Which kind of
 * fail is what the venue page is for; its piles are titled with it.
 * "No fails" when nothing failed: the report calls out fails, and the
 * absence of one is the whole of what it has to say about a good night.
 */
export function shortOf(venue: VenueCompliance): string {
  const fails = venue.notDone + venue.notSigned;
  // The count that makes the score, first. "8/10" beside "3 fails" did not
  // reconcile at a glance; "12 of 15" beside both does.
  const parts = [
    ...(fails > 0 ? [`${fails} ${fails === 1 ? "fail" : "fails"}`] : []),
    ...(venue.going > 0 ? [`${venue.going} still going`] : []),
  ];
  return parts.length > 0 ? parts.join(" · ") : "no fails";
}

export function shortOfEs(venue: VenueCompliance): string {
  const fails = venue.notDone + venue.notSigned;
  const parts = [
    ...(fails > 0 ? [`${fails} ${fails === 1 ? "falla" : "fallas"}`] : []),
    ...(venue.going > 0 ? [`${venue.going} en curso`] : []),
  ];
  return parts.length > 0 ? parts.join(" · ") : "sin fallas";
}
