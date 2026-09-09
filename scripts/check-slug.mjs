/**
 * Fixture checks for a list's address.
 *
 *   npm run check-slug
 *
 * A slug decides which list a tap reaches. Get it wrong in the forgiving
 * direction and a link goes nowhere; get it wrong in the other and somebody
 * ticks off one bar's close while looking at another's.
 *
 * This existed three times, in three files, each splitting the slug on hyphens
 * and reassembling the role from the middle, each slightly differently. Every
 * one of them was one role name away from being wrong. Now the address is only
 * ever built, never taken apart, and these are the cases that used to be
 * arguable.
 *
 * Every role and room here is real.
 */
import {
  matchSlug,
  roleSlug,
  slugFor,
} from "../.slug-check/slug.js";

let pass = 0,
  fail = 0;
const is = (label, got, want) => {
  const a = JSON.stringify(got),
    b = JSON.stringify(want);
  if (a === b) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL ${label}\n    got  ${a}\n    want ${b}`);
  }
};

// ------------------------------------------------------------ building one

is("a one word role", slugFor("FOH", "Barback", "close"), "foh-barback-close");
is(
  "a role with a space",
  slugFor("FOH", "YB Bartender", "close"),
  "foh-yb-bartender-close",
);
is(
  "a role with three words",
  slugFor("FOH", "Noble bar deep clean", "mid"),
  "foh-noble-bar-deep-clean-mid",
);
is("case does not matter", slugFor("FOH", "BARBACK", "close"), "foh-barback-close");
is(
  "heart of house",
  slugFor("HOH", "Prep", "open"),
  "hoh-prep-open",
);

// The room sits between the role and the phase. Without it the three deep
// cleans are all foh-deep-clean-mid and two of them are unreachable.
is(
  "a room in the middle",
  slugFor("FOH", "Deep clean", "mid", "Noble"),
  "foh-deep-clean-noble-mid",
);
is(
  "no room reads as before",
  slugFor("FOH", "Deep clean", "mid", null),
  "foh-deep-clean-mid",
);
is(
  "an empty room reads as before",
  slugFor("FOH", "Deep clean", "mid", "  "),
  "foh-deep-clean-mid",
);
is(
  "a room with a space",
  slugFor("FOH", "Deep clean", "mid", "Young Blood"),
  "foh-deep-clean-young-blood-mid",
);

// The case the old parser could not survive: punctuation inside a role.
is(
  "punctuation collapses",
  slugFor("FOH", "Bar / Well", "close"),
  "foh-bar-well-close",
);
is(
  "a role with a hyphen",
  slugFor("FOH", "Back-bar", "mid"),
  "foh-back-bar-mid",
);

// ----------------------------------------------------------- a position

is("a position address", roleSlug("YB Bartender"), "yb-bartender");
is("case does not matter", roleSlug("bar deep clean"), "bar-deep-clean");

// ------------------------------------------------------------- resolving

{
  // Hood's real set, plus the three deep cleans as rooms under one position.
  const rows = [
    { id: "a", house: "FOH", role: "Bartender", phase: "close" },
    { id: "b", house: "FOH", role: "YB Bartender", phase: "close" },
    { id: "c", house: "FOH", role: "Noble Bartender", phase: "close" },
    { id: "d", house: "FOH", role: "YB Bartender", phase: "open" },
    { id: "e", house: "HOH", role: "Prep", phase: "open" },
    { id: "f", house: "FOH", role: "Deep clean", phase: "mid", room: "Hood" },
    { id: "g", house: "FOH", role: "Deep clean", phase: "mid", room: "Noble" },
    {
      id: "h",
      house: "FOH",
      role: "Deep clean",
      phase: "mid",
      room: "Youngblood",
    },
  ];
  const id = (slug) => matchSlug(rows, slug)?.id ?? null;

  // The three that all end "...ander-close" and must not be confused.
  is("bartender close", id("foh-bartender-close"), "a");
  is("yb bartender close", id("foh-yb-bartender-close"), "b");
  is("noble bartender close", id("foh-noble-bartender-close"), "c");
  is("the same role, another phase", id("foh-yb-bartender-open"), "d");
  is("the other house", id("hoh-prep-open"), "e");

  // Rooms under one position.
  is("deep clean hood", id("foh-deep-clean-hood-mid"), "f");
  is("deep clean noble", id("foh-deep-clean-noble-mid"), "g");
  is("deep clean youngblood", id("foh-deep-clean-youngblood-mid"), "h");
  // The address a position with rooms does not have.
  is("deep clean with no room", id("foh-deep-clean-mid"), null);

  is("case does not matter", id("FOH-YB-Bartender-Close"), "b");
  is("spacing does not matter", id("  foh-bartender-close  "), "a");

  is("a list that is not there", id("foh-sommelier-close"), null);
  is("a house that is not there", id("xxx-bartender-close"), null);
  is("nonsense", id("nonsense"), null);
  is("empty", id(""), null);

  // The old parser accepted a wildcard shape because it matched on text it
  // had taken apart. Built slugs cannot contain one.
  is("no wildcards", id("foh-%-close"), null);

  // Every row must be reachable by the address the app writes for it.
  const unreachable = rows.filter(
    (row) =>
      matchSlug(rows, slugFor(row.house, row.role, row.phase, row.room))?.id !==
      row.id,
  );
  is("every list is reachable by its own address", unreachable, []);
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
