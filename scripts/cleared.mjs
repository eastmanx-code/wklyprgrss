/**
 * Entries a venue has cleared off its board.
 *
 *   npm run cleared                      list them
 *   npm run cleared -- --restore <id>    put one back
 *   npm run cleared -- --restore-all ISFO   put a whole venue's back
 *
 * Clearing is not a delete. The row is stamped with cleared_at and drops out
 * of the board, the history and every score — which is the whole point, since
 * a first week of testing should not sit in the record forever. But it is
 * still there, and this is how it comes back.
 */
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const restoreId = args[args.indexOf("--restore") + 1];
const restoreAll =
  args.includes("--restore-all") ? args[args.indexOf("--restore-all") + 1] : null;

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: venues } = await db.from("venues").select("id, code");
const { data: items } = await db.from("items").select("id, venue_id, title");
const venueOf = (itemId) => {
  const item = items.find((i) => i.id === itemId);
  return venues.find((v) => v.id === item?.venue_id)?.code ?? "?";
};

if (args.includes("--restore")) {
  if (!restoreId) {
    console.error("\n  Give the entry id to restore.\n");
    process.exit(1);
  }
  const { error } = await db
    .from("submissions")
    .update({ cleared_at: null })
    .eq("id", restoreId);
  console.log(error ? `\n  ${error.message}\n` : `\n  Restored ${restoreId}.\n`);
  process.exit(error ? 1 : 0);
}

if (restoreAll) {
  const venue = venues.find((v) => v.code === restoreAll.toUpperCase());
  if (!venue) {
    console.error(`\n  No venue with code ${restoreAll}.\n`);
    process.exit(1);
  }
  const ids = items.filter((i) => i.venue_id === venue.id).map((i) => i.id);
  const { data, error } = await db
    .from("submissions")
    .update({ cleared_at: null })
    .in("item_id", ids)
    .not("cleared_at", "is", null)
    .select("id");
  console.log(
    error ? `\n  ${error.message}\n` : `\n  Restored ${data.length} to ${venue.code}.\n`,
  );
  process.exit(error ? 1 : 0);
}

const { data: rows } = await db
  .from("submissions")
  .select("id, item_id, week_start, author, comment, review, cleared_at")
  .not("cleared_at", "is", null)
  .order("cleared_at", { ascending: false });

if (!rows?.length) {
  console.log("\n  Nothing cleared.\n");
  process.exit(0);
}

console.log(`\n  ${rows.length} cleared:\n`);
for (const row of rows) {
  const item = items.find((i) => i.id === row.item_id);
  console.log(
    `  ${row.id}  ${venueOf(row.item_id).padEnd(7)} ${row.week_start}  ${row.review.padEnd(9)} ${(item?.title ?? "?").slice(0, 24).padEnd(24)} ${JSON.stringify((row.comment ?? "").slice(0, 40))}`,
  );
}
console.log("\n  npm run cleared -- --restore <id>   puts one back\n");
