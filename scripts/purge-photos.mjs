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
  .select("id, photo_url, week_start")
  .lt("week_start", cutoff)
  .is("photo_purged_at", null);

if (error) {
  console.error(`\n  Could not read submissions: ${error.message}\n`);
  process.exit(1);
}

if (!stale?.length) {
  console.log(
    `\n  Nothing to purge. No un-purged photos from before ${cutoff}.\n`,
  );
  process.exit(0);
}

const bytesEstimate = ((stale.length * 300) / 1024).toFixed(1);
console.log(
  `\n  ${stale.length} photos from weeks before ${cutoff} (~${bytesEstimate} MB).`,
);
console.log(`  Retention window: ${RETENTION_WEEKS} weeks.`);

if (!confirmed) {
  console.log("\n  Dry run. Re-run with --yes to actually delete.\n");
  process.exit(0);
}

// Storage deletes are chunked; the rows are only marked once the files are gone.
const CHUNK = 100;
let removed = 0;
for (let i = 0; i < stale.length; i += CHUNK) {
  const batch = stale.slice(i, i + CHUNK);
  const { error: removeError } = await db.storage
    .from("photos")
    .remove(batch.map((s) => s.photo_url));

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

console.log(`\n  Purged ${removed} photos. All ${stale.length} rows kept.\n`);
