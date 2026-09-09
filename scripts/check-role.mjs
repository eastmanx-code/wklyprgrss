/**
 * Fixture checks for who can reach what.
 *
 *   npm run check-role
 *
 * These exist because of what happened the day the third role was added. The
 * app had two — the venue code on the QR by the rack, and the admin code that
 * opens all twenty one venues — and a great deal of code said "leader" where
 * it meant "confined to one venue". Every one of those lines was right until a
 * manager existed and then silently wrong, because a manager is not a leader
 * and the else branch is the admin branch. Five screens and two actions would
 * have handed a bar manager every venue in the group.
 *
 * So the cases below are written the way the mistake was made: for each of the
 * three roles, on their own venue and on somebody else's.
 */
import { mayManage, mayReachVenue, venueOfSession } from "../.role-check/role.js";

let pass = 0, fail = 0;
const is = (label, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; } else { fail++; console.log(`  FAIL ${label}\n    got  ${a}\n    want ${b}`); }
};

const HOOD = "5659342c";
const OTHER = "a1b2c3d4";

const crew = { role: "leader", venueId: HOOD };
const manager = { role: "manager", venueId: HOOD };
const admin = { role: "admin" };

// ------------------------------------------------- which venue, if any

is("a leader is confined to theirs", venueOfSession(crew), HOOD);
is("so is a manager", venueOfSession(manager), HOOD);
// Null means "not confined", not "no venue". Read the other way round it locks
// the admin out of everything instead of letting them into it.
is("an admin is confined to none", venueOfSession(admin), null);
is("nobody signed in", venueOfSession(null), null);

// --------------------------------------------------------- writing a list

is("the crew cannot write a list", mayManage(crew), false);
is("a manager can", mayManage(manager), true);
is("an admin can", mayManage(admin), true);
is("nobody signed in cannot", mayManage(null), false);

// ------------------------------------------------------ reaching a venue
//
// The matrix the bug lived in. Every "somebody else's" row here was true
// before, for the manager, because the code asked whether the session was a
// leader rather than which venue it was confined to.

is("crew, own venue", mayReachVenue(crew, HOOD), true);
is("crew, another venue", mayReachVenue(crew, OTHER), false);
is("manager, own venue", mayReachVenue(manager, HOOD), true);
is("manager, another venue", mayReachVenue(manager, OTHER), false);
is("admin, any venue", mayReachVenue(admin, HOOD), true);
is("admin, another venue", mayReachVenue(admin, OTHER), true);
is("nobody signed in reaches nothing", mayReachVenue(null, HOOD), false);

// An empty venue id is not a venue. It arrives from a URL segment or a form
// field that was not filled in, and matching it against an admin would be one
// thing; matching it against a session would be a hole.
is("an empty venue is not somebody's venue", mayReachVenue(crew, ""), false);
is("nor a manager's", mayReachVenue(manager, ""), false);
// The admin case is deliberately the other way: the callers hand this an id
// they are about to use, and refusing an admin here would only move the check
// somewhere less obvious. Callers still guard against an empty id themselves.
is("an admin is not stopped by an empty id", mayReachVenue(admin, ""), true);

// ------------------------------------------------- the shape of the whole
//
// Stated once as a table, so that adding a fourth role has to come and change
// a line here rather than pass in silence.
{
  const table = [crew, manager, admin].map((who) => [
    who.role,
    venueOfSession(who),
    mayManage(who),
    mayReachVenue(who, HOOD),
    mayReachVenue(who, OTHER),
  ]);
  is("the whole table", table, [
    ["leader",  HOOD, false, true, false],
    ["manager", HOOD, true,  true, false],
    ["admin",   null, true,  true, true ],
  ]);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
