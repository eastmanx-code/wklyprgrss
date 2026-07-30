/**
 * Seeds the 27 venues with random 4-digit PINs.
 *
 *   npm run seed
 *
 * PINs are printed once, here, and never shown in full again outside the admin
 * screens. Copy them somewhere before you close the terminal.
 *
 * Safe to re-run: venues that already exist are left untouched.
 */
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const CODES = [
  "BORN", "ISFO", "LAFA", "MORN", "STOC", "STAR", "FLSE", "FSON", "CRFT",
  "LEIL", "HOOD", "NOBL", "POLT", "PTLV", "UBLI", "UBNP", "BDPB", "LOUS",
  "WLVS", "YNBL", "JNTS", "GUTT", "GTTR", "QUIX", "BABY", "FLLN", "HAWK",
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Put them in .env.local — npm run seed reads that file.",
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

const randomPin = () => String(randomInt(0, 10_000)).padStart(4, "0");

const { data: existing, error: readError } = await db
  .from("venues")
  .select("code");

if (readError) {
  console.error("Could not read venues:", readError.message);
  process.exit(1);
}

const known = new Set((existing ?? []).map((venue) => venue.code));
const toInsert = CODES.filter((code) => !known.has(code)).map((code) => ({
  code,
  name: code,
  pin: randomPin(),
}));

if (toInsert.length === 0) {
  console.log(`All ${CODES.length} venues already exist. Nothing to do.`);
  console.log("Change a PIN from the admin venue screen.");
  process.exit(0);
}

const { error: insertError } = await db.from("venues").insert(toInsert);

if (insertError) {
  console.error("Seed failed:", insertError.message);
  process.exit(1);
}

console.log(`\nSeeded ${toInsert.length} venues.\n`);
console.log("  CODE    PIN");
console.log("  ----    ----");
for (const venue of toInsert) {
  console.log(`  ${venue.code.padEnd(6)}  ${venue.pin}`);
}
console.log("\nThese are shown once. Save them now.\n");

if (known.size > 0) {
  console.log(`(${known.size} venues already existed and were left alone.)\n`);
}
