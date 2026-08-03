/**
 * Creates an isolated venue to test against, so nothing exercised in
 * development touches one of the real twenty-six.
 *
 *   npm run test-venue          create it, or print it if it exists
 *   npm run test-venue -- --clear   delete its submissions, keep the venue
 *   npm run test-venue -- --show    put it back in the login picker
 *   npm run test-venue -- --hide    take it out again
 *
 * Code ZZTEST so it sorts to the bottom of the venue picker and is obvious in
 * any list. It is a normal venue row in every other respect — the point is to
 * exercise the same code paths the real ones use, not a special case the app
 * knows about.
 *
 * It ships inactive, because "obvious in any list" still meant every leader in
 * the company saw it on the login screen. --show is how a test session gets it
 * back; hide it again when you are done.
 */
import { createClient } from "@supabase/supabase-js";

const CODE = "ZZTEST";
const PIN = "424242";
const clearOnly = process.argv.includes("--clear");
const show = process.argv.includes("--show");
const hide = process.argv.includes("--hide");

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: existing } = await db
  .from("venues")
  .select("id")
  .eq("code", CODE)
  .maybeSingle();

let venueId = existing?.id;

if (!venueId) {
  if (clearOnly) {
    console.log(`\n  No ${CODE} venue to clear.\n`);
    process.exit(0);
  }
  const { data, error } = await db
    .from("venues")
    .insert({ code: CODE, name: "Test venue", pin: PIN, active: false })
    .select("id")
    .single();
  if (error) {
    console.error(`\n  Could not create it: ${error.message}\n`);
    process.exit(1);
  }
  venueId = data.id;
}

if (show || hide) {
  await db.from("venues").update({ active: show }).eq("id", venueId);
  console.log(
    `\n  ${CODE} is ${show ? "in" : "out of"} the login picker.${
      show ? "  Hide it again with --hide when you are done." : ""
    }\n`,
  );
  if (!clearOnly) process.exit(0);
}

const { data: itemRows } = await db
  .from("items")
  .select("id, title, position")
  .eq("venue_id", venueId)
  .order("position");

let items = itemRows ?? [];

if (items.length === 0 && !clearOnly) {
  await db.from("items").insert([
    { venue_id: venueId, title: "Patio planters", position: 1 },
    { venue_id: venueId, title: "Back bar shelving", position: 2 },
  ]);
  const { data } = await db
    .from("items")
    .select("id, title, position")
    .eq("venue_id", venueId)
    .order("position");
  items = data ?? [];
}

if (clearOnly) {
  // Submissions only. The venue and its items stay, so a test run does not
  // have to rebuild the world every time.
  const { error } = await db
    .from("submissions")
    .delete()
    .in(
      "item_id",
      items.map((i) => i.id),
    );
  if (error) {
    console.error(`\n  Could not clear: ${error.message}\n`);
    process.exit(1);
  }
  console.log(`\n  Cleared every submission on ${CODE}.\n`);
  process.exit(0);
}

console.log(`\n  ${CODE} · PIN ${PIN}`);
for (const item of items) {
  console.log(`    ${item.position}. ${item.title}  ${item.id}`);
}
console.log("");
