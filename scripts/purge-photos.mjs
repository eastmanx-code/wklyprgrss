/**
 * Clears photo FILES for weeks older than the retention window. Submission rows
 * are never deleted — comments, authors, dates and review state stay forever,
 * which is what status, streaks and reports are computed from.
 *
 *   npm run purge              dry run, shows what would go
 *   npm run purge -- --yes     actually delete
 *   npm run purge -- --weeks 4 --yes
 *
 * Storage maths: ~270 photos a week at ~300KB is ~81MB a week, so the 1GB free
 * tier holds roughly 12 weeks. An 8-week window sits comfortably inside that
 * and never grows.
 */
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const confirmed = args.includes("--yes");
const weeksArg = args.indexOf("--weeks");
const RETENTION_WEEKS =
  weeksArg >= 0 ? Number(args[weeksArg + 1]) : 8;

if (!Number.isInteger(RETENTION_WEEKS) || RETENTION_WEEKS < 1) {
  console.error("\n  --weeks must be a positive whole number.\n");
  process.exit(1);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// Cut-off = the Monday RETENTION_WEEKS before the current one, Pacific.
const cutoff = (() => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = parts.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const monday = utc - ((new Date(utc).getUTCDay() + 6) % 7) * 86_400_000;
  return new Date(monday - RETENTION_WEEKS * 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
})();

const { data: stale, error } = await db
  .from("submissions")
  .select("id, photo_url, before_photo_url, week_start")
  .lt("week_start", cutoff)
  .is("photo_purged_at", null);

if (error) {
  console.error(`\n  Could not read submissions: ${error.message}\n`);
  process.exit(1);
}

/*
 * Close-checklist proof, on the same clock.
 *
 * This was the quiet leak. The close flow writes to the same bucket under
 * close/, and this script only knew about weekly submissions — so a venue
 * photographing three restrooms and a back door every night was filling the
 * tier with files nothing would ever delete.
 *
 * Counted here, beside the weekly total, rather than after the deletes: the
 * script used to stop the moment there were no stale submissions, which with
 * the close files added would have meant the loudest source of storage was
 * the one thing a dry run never mentioned.
 */
const closeCutoff = new Date(Date.now() - RETENTION_WEEKS * 7 * 86_400_000)
  .toISOString()
  .slice(0, 10);

const closePaths = await (async () => {
  const { data: nights } = await db
    .from("close_nights")
    .select("id")
    .lt("night", closeCutoff);
  const ids = (nights ?? []).map((n) => n.id);
  if (!ids.length) return [];
  const { data: proof } = await db
    .from("close_proof")
    .select("storage_path")
    .in("night_id", ids)
    .not("storage_path", "is", null);
  return (proof ?? []).map((row) => row.storage_path).filter(Boolean);
})();

if (!stale?.length && !closePaths.length) {
  console.log(`\n  Nothing to purge. Nothing older than ${cutoff}.\n`);
  process.exit(0);
}

console.log(`\n  Retention window: ${RETENTION_WEEKS} weeks.`);
if (stale?.length) {
  const bytesEstimate = ((stale.length * 300) / 1024).toFixed(1);
  console.log(
    `  ${stale.length} weekly photos from before ${cutoff} (~${bytesEstimate} MB).`,
  );
}
if (closePaths.length) {
  console.log(
    `  ${closePaths.length} close proof files from nights before ${closeCutoff}.`,
  );
}

if (!confirmed) {
  console.log("\n  Dry run. Re-run with --yes to actually delete.\n");
  process.exit(0);
}

// Storage deletes are chunked; the rows are only marked once the files are gone.
const CHUNK = 100;
let removed = 0;
for (let i = 0; i < (stale?.length ?? 0); i += CHUNK) {
  const batch = stale.slice(i, i + CHUNK);
  const paths = batch.flatMap((s) =>
    s.before_photo_url ? [s.photo_url, s.before_photo_url] : [s.photo_url],
  );
  const { error: removeError } = await db.storage.from("photos").remove(paths);

  if (removeError) {
    console.error(`  storage delete failed: ${removeError.message}`);
    continue;
  }

  const { error: markError } = await db
    .from("submissions")
    .update({ photo_purged_at: new Date().toISOString() })
    .in(
      "id",
      batch.map((s) => s.id),
    );

  if (markError) {
    console.error(`  could not mark purged: ${markError.message}`);
    continue;
  }
  removed += batch.length;
}

// Same rule the weekly photos follow: the files go, the rows stay. Which item
// was proved, by whose initials, on which night is the record; the photograph
// was only ever how it got proved. A row whose file is gone still answers
// everything the rollup asks.
let closeRemoved = 0;
for (let i = 0; i < closePaths.length; i += CHUNK) {
  const batch = closePaths.slice(i, i + CHUNK);
  const { error: closeError } = await db.storage.from("photos").remove(batch);
  if (closeError) {
    console.error(`  close storage delete failed: ${closeError.message}`);
    continue;
  }
  closeRemoved += batch.length;
}

console.log(
  `\n  Purged ${removed} weekly photos and ${closeRemoved} close proof files. All rows kept.\n`,
);
