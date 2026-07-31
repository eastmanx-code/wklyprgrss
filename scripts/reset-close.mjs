/**
 * Wipes recorded close nights — ticks, proof rows and the photo and video
 * files behind them — so a list can be walked again from empty.
 *
 * The checklists themselves are never touched. This clears what was DONE, not
 * what has to be done.
 *
 *   npm run reset-close                dry run, shows what would go
 *   npm run reset-close -- --yes       actually delete
 *   npm run reset-close -- --night 2026-07-31 --yes
 *
 * A certified night is otherwise a permanent record and the app will not let
 * anyone write to it, which is correct in a venue and useless while testing.
 * This is the way out, and it is a script on a laptop rather than a button in
 * the app on purpose.
 */
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const confirmed = args.includes("--yes");
const nightArg = args.indexOf("--night");
const NIGHT = nightArg >= 0 ? args[nightArg + 1] : null;

if (NIGHT && !/^\d{4}-\d{2}-\d{2}$/.test(NIGHT)) {
  console.error("\n  --night wants a date like 2026-07-31.\n");
  process.exit(1);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

let query = db
  .from("close_nights")
  .select("id, night, certified_at, certified_by")
  .order("night", { ascending: false });
if (NIGHT) query = query.eq("night", NIGHT);

const { data: nights, error } = await query;

if (error) {
  console.error(`\n  Could not read nights: ${error.message}\n`);
  process.exit(1);
}

if (!nights?.length) {
  console.log(`\n  Nothing recorded${NIGHT ? ` for ${NIGHT}` : ""}. Already clear.\n`);
  process.exit(0);
}

const ids = nights.map((n) => n.id);

const [{ data: ticks }, { data: proof }] = await Promise.all([
  db.from("close_ticks").select("id").in("night_id", ids),
  db.from("close_proof").select("id, storage_path").in("night_id", ids),
]);

const files = (proof ?? [])
  .map((row) => row.storage_path)
  .filter(Boolean);

console.log(`\n  ${nights.length} night${nights.length === 1 ? "" : "s"}:`);
for (const night of nights) {
  console.log(
    `    ${night.night}  ${
      night.certified_at ? `certified by ${night.certified_by}` : "open"
    }`,
  );
}
console.log(
  `\n  ${ticks?.length ?? 0} ticks, ${proof?.length ?? 0} proof rows, ${files.length} files.`,
);

if (!confirmed) {
  console.log("\n  Dry run. Re-run with --yes to actually delete.\n");
  process.exit(0);
}

// Files first. A storage object with no row pointing at it is invisible and
// stays on the bill; a row pointing at a missing file is at least legible.
const CHUNK = 100;
for (let i = 0; i < files.length; i += CHUNK) {
  const { error: removeError } = await db.storage
    .from("photos")
    .remove(files.slice(i, i + CHUNK));
  if (removeError) console.error(`  storage delete failed: ${removeError.message}`);
}

// Ticks and proof cascade off the night, so one delete does all three.
const { error: deleteError } = await db.from("close_nights").delete().in("id", ids);
if (deleteError) {
  console.error(`\n  Could not delete nights: ${deleteError.message}\n`);
  process.exit(1);
}

console.log(
  `\n  Cleared ${nights.length} night${nights.length === 1 ? "" : "s"} and ${files.length} files. The checklists are untouched.\n`,
);
