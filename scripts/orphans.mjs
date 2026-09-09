/**
 * Photographs in storage that nothing points at.
 *
 *   npm run orphans            list them
 *   npm run orphans -- --sweep delete them
 *
 * A retake leaves the picture it replaced behind. The row moves to the new
 * file and the old one sits in the bucket, unreachable from every screen in
 * the app and paid for every month.
 *
 * The app stops making new ones — recordCapture and setReference each drop
 * what they replace now — but that only helps from here on, and a crash
 * between an upload and the row that names it will always be able to leave
 * one. So this exists, and it is the only thing that deletes a photograph
 * nobody asked to delete. Which is why it lists by default and needs to be
 * told twice to remove anything.
 *
 * Two places hold a path: close_proof.storage_path for the evidence somebody
 * took on a shift, and close_items.reference for the example shots a manager
 * set up. A file named by either is not an orphan. Anything outside close/ is
 * the weekly board's and is not this script's business.
 */
import { createClient } from "@supabase/supabase-js";

const sweep = process.argv.includes("--sweep");

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const BUCKET = "photos";

/** Every object under a prefix, walking the folders storage hands back. */
async function walk(prefix) {
  const found = [];
  const { data, error } = await db.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000 });
  if (error) throw new Error(`${prefix}: ${error.message}`);
  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    // A folder comes back with no id. A file has one.
    if (entry.id) found.push({ path, bytes: entry.metadata?.size ?? 0 });
    else found.push(...(await walk(path)));
  }
  return found;
}

const [{ data: proof }, { data: items }] = await Promise.all([
  db.from("close_proof").select("storage_path"),
  db.from("close_items").select("reference"),
]);

const used = new Set();
for (const row of proof ?? []) if (row.storage_path) used.add(row.storage_path);
for (const row of items ?? []) {
  for (const ref of row.reference ?? []) if (ref?.path) used.add(ref.path);
}

const all = await walk("close");
const orphans = all.filter(
  (file) => !used.has(file.path) && !file.path.endsWith(".emptyFolderPlaceholder"),
);

if (orphans.length === 0) {
  console.log(`\n  ${all.length} files under close/, nothing orphaned.\n`);
  process.exit(0);
}

const mb = (n) => (n / 1024 / 1024).toFixed(2);
const total = orphans.reduce((n, f) => n + f.bytes, 0);
console.log(`\n  ${orphans.length} of ${all.length} files point nowhere · ${mb(total)} MB\n`);
for (const file of orphans) console.log(`  ${String(Math.round(file.bytes / 1024)).padStart(5)} KB  ${file.path}`);

if (!sweep) {
  console.log(`\n  Nothing deleted. Run with --sweep to remove them.\n`);
  process.exit(0);
}

// A hundred at a time. The storage API takes a list and a list of two thousand
// is one request that either works or loses the lot.
let done = 0;
for (let i = 0; i < orphans.length; i += 100) {
  const batch = orphans.slice(i, i + 100).map((f) => f.path);
  const { error } = await db.storage.from(BUCKET).remove(batch);
  if (error) {
    console.error(`\n  Stopped after ${done}: ${error.message}\n`);
    process.exit(1);
  }
  done += batch.length;
}
console.log(`\n  Removed ${done} · ${mb(total)} MB freed.\n`);
