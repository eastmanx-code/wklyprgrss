/**
 * Loads demo items, photos and submissions into ONE venue so you can see a
 * populated board.
 *
 *   npm run demo -- HOOD          seed the HOOD venue
 *   npm run demo -- HOOD --clear  remove everything demo added to HOOD
 *
 * Photos come from a local folder of JPEGs passed via DEMO_PHOTO_DIR.
 * This writes real rows to your real database — use `--clear` to undo it.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const code = (process.argv[2] ?? "").toUpperCase();
const clearing = process.argv.includes("--clear");
const photoDir = process.env.DEMO_PHOTO_DIR;

if (!code) {
  console.error("\n  Usage: npm run demo -- HOOD [--clear]\n");
  process.exit(1);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: venue, error: venueError } = await db
  .from("venues")
  .select("id, code")
  .eq("code", code)
  .maybeSingle();

if (venueError || !venue) {
  console.error(`\n  Venue ${code} not found.\n`);
  process.exit(1);
}

// --- Clear ------------------------------------------------------------------
if (clearing) {
  const { data: items } = await db
    .from("items")
    .select("id")
    .eq("venue_id", venue.id);
  const itemIds = (items ?? []).map((item) => item.id);

  if (itemIds.length) {
    const { data: subs } = await db
      .from("submissions")
      .select("photo_url")
      .in("item_id", itemIds);
    const paths = (subs ?? []).map((s) => s.photo_url).filter(Boolean);
    if (paths.length) await db.storage.from("photos").remove(paths);
    await db.from("submissions").delete().in("item_id", itemIds);
    await db.from("items").delete().eq("venue_id", venue.id);
  }
  console.log(`\n  Cleared ${itemIds.length} items and their history from ${code}.\n`);
  process.exit(0);
}

// --- Seed -------------------------------------------------------------------
const TITLES = [
  "Walk-in cooler",
  "Back bar",
  "Dry storage",
  "Guest restroom",
  "Patio furniture",
  "Entry and signage",
  "Service station",
  "Ice wells",
  "Staff lockers",
  "Dish pit",
];

const NOTES = [
  ["Shelves pulled and wiped down, gaskets cleaned.", "Maria", "Dev"],
  ["Restocked and faced. Two bottles pulled for the well.", "Dev", null],
  ["Rotated stock, everything labelled and dated.", "Maria", null],
  ["Deep cleaned, replaced the soap dispenser.", "Sam", "Maria"],
  ["Cushions washed, one table leg still wobbles.", "Dev", null],
  ["Windows done, sandwich board repainted.", "Sam", null],
  ["Reorganised, new caddy for the linens.", "Maria", "Sam"],
];

const weekStart = (() => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, d] = parts.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const dow = new Date(utc).getUTCDay();
  return new Date(utc - ((dow + 6) % 7) * 86_400_000)
    .toISOString()
    .slice(0, 10);
})();

let photos = [];
if (photoDir) {
  const files = (await readdir(photoDir)).filter((f) => f.endsWith(".jpg"));
  photos = files.map((f) => path.join(photoDir, f));
}
if (photos.length === 0) {
  console.error("\n  No JPEGs found. Set DEMO_PHOTO_DIR to a folder of .jpg files.\n");
  process.exit(1);
}

const { data: created, error: itemError } = await db
  .from("items")
  .insert(
    TITLES.map((title, index) => ({
      venue_id: venue.id,
      title,
      position: index + 1,
      active: true,
    })),
  )
  .select("id, title, position");

if (itemError) {
  console.error(`\n  Could not create items: ${itemError.message}\n`);
  process.exit(1);
}

created.sort((a, b) => a.position - b.position);

let uploaded = 0;
for (let i = 0; i < NOTES.length; i += 1) {
  const item = created[i];
  const [comment, author, assisted] = NOTES[i];
  const file = photos[i % photos.length];
  const bytes = await readFile(file);
  const objectPath = `${venue.code}/${item.id}/${weekStart}-demo${i}.jpg`;

  const { error: uploadError } = await db.storage
    .from("photos")
    .upload(objectPath, bytes, { contentType: "image/jpeg", upsert: true });
  if (uploadError) {
    console.error(`  upload failed for ${item.title}: ${uploadError.message}`);
    continue;
  }

  const { error: insertError } = await db.from("submissions").insert({
    item_id: item.id,
    week_start: weekStart,
    photo_url: objectPath,
    comment,
    author,
    assisted_by: assisted,
  });
  if (insertError) {
    console.error(`  insert failed for ${item.title}: ${insertError.message}`);
    continue;
  }
  uploaded += 1;
}

console.log(
  `\n  ${code}: ${TITLES.length} items created, ${uploaded} done for week of ${weekStart}.`,
);
console.log(`  ${TITLES.length - uploaded} still pending — the meter will show partial.`);
console.log(`\n  Undo with: npm run demo -- ${code} --clear\n`);
