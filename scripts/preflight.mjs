/**
 * Checks that the app can actually reach Supabase before you rely on it.
 *
 *   npm run preflight
 *
 * Verifies the key works, the three tables exist, and the private `photos`
 * bucket is present and NOT public. Prints no secrets.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const results = [];
let failed = false;

function record(ok, label, detail = "") {
  results.push(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed = true;
}

if (!url || !key) {
  console.error("\n  ✗ NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is empty in .env.local\n");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

// Table reachability. A working secret key bypasses RLS, so these must succeed.
for (const table of ["venues", "items", "submissions"]) {
  const { count, error } = await db
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    record(false, `table "${table}"`, error.message);
  } else {
    record(true, `table "${table}"`, `${count} rows`);
  }
}

// Attribution columns (added by supabase/002_attribution.sql).
{
  const { error } = await db
    .from("submissions")
    .select("author, assisted_by")
    .limit(1);
  record(
    !error,
    "submissions.author + assisted_by",
    error ? "missing — run supabase/002_attribution.sql" : "present",
  );
}

// Review columns (added by supabase/003_review.sql).
{
  const { error } = await db
    .from("submissions")
    .select("review, reviewed_at")
    .limit(1);
  record(
    !error,
    "submissions.review + reviewed_at",
    error ? "missing — run supabase/003_review.sql" : "present",
  );
}

// Progress column (added by supabase/004_progress.sql).
{
  const { error } = await db.from("submissions").select("progress").limit(1);
  record(
    !error,
    "submissions.progress",
    error ? "missing — run supabase/004_progress.sql" : "present",
  );
}

// Optional before photo (added by supabase/006_before_photo.sql).
{
  const { error } = await db
    .from("submissions")
    .select("before_photo_url")
    .limit(1);
  record(
    !error,
    "submissions.before_photo_url",
    error ? "missing — run supabase/006_before_photo.sql" : "present",
  );
}

// Storage bucket.
const { data: buckets, error: bucketError } = await db.storage.listBuckets();
if (bucketError) {
  record(false, "storage", bucketError.message);
} else {
  const photos = buckets.find((bucket) => bucket.name === "photos");
  if (!photos) {
    record(
      false,
      'bucket "photos"',
      `not found (found: ${buckets.map((b) => b.name).join(", ") || "none"})`,
    );
  } else if (photos.public) {
    record(false, 'bucket "photos"', "exists but is PUBLIC — it must be private");
  } else {
    record(true, 'bucket "photos"', "private");
  }
}

console.log(`\n${results.join("\n")}\n`);

if (failed) {
  console.error("  Not ready yet. Fix the ✗ items above.\n");
  process.exit(1);
}
console.log("  Everything is connected. Ready to seed.\n");
