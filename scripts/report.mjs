/**
 * Writes the durable record: one CSV row per venue per week, with completion
 * and PASS/FAIL. This is what survives after photos are purged, and what
 * streaks are rebuilt from.
 *
 *   npm run report                 last 26 weeks to ./reports/
 *   npm run report -- --weeks 52
 *
 * Run it before a purge if you want a file on disk as well as the rows in
 * Postgres. The rows themselves are never deleted, so this is a convenience
 * export rather than the only copy.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const weeksArg = args.indexOf("--weeks");
const WEEKS = weeksArg >= 0 ? Number(args[weeksArg + 1]) : 26;

const DEADLINE_DAY = Number(process.env.DEADLINE_DAY);
const DEADLINE_HOUR = Number(process.env.DEADLINE_HOUR);
const TARGET = 10;

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const DAY = 86_400_000;
const laParts = (date) => {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .split("-")
    .map(Number);
  return Date.UTC(y, m - 1, d);
};

const currentMonday = (() => {
  const utc = laParts(new Date());
  return utc - ((new Date(utc).getUTCDay() + 6) % 7) * DAY;
})();

const weeks = Array.from({ length: WEEKS }, (_, i) =>
  new Date(currentMonday - i * 7 * DAY).toISOString().slice(0, 10),
).reverse();

const deadlinePassed = (weekStart) => {
  const [y, m, d] = weekStart.split("-").map(Number);
  const offset = (DEADLINE_DAY + 6) % 7;
  const target = new Date(Date.UTC(y, m - 1, d) + offset * DAY);
  // Approximate Pacific offset is fine here; the report is a summary, and
  // borderline hours only matter for the live status the app computes.
  const guess = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
    DEADLINE_HOUR + 8,
  );
  return Date.now() >= guess;
};

const { data: venues } = await db.from("venues").select("id, code").order("code");
const { data: items } = await db
  .from("items")
  .select("id, venue_id, active")
  .eq("active", true);
const { data: subs } = await db
  .from("submissions")
  .select("item_id, week_start, review")
  .gte("week_start", weeks[0])
  .neq("review", "sent_back");

const itemVenue = new Map((items ?? []).map((i) => [i.id, i.venue_id]));
const activeCount = new Map();
for (const item of items ?? []) {
  activeCount.set(item.venue_id, (activeCount.get(item.venue_id) ?? 0) + 1);
}

const done = new Map(); // `${venueId}|${week}` -> Set(itemId)
const firstWeek = new Map(); // venueId -> earliest week seen
for (const s of subs ?? []) {
  const venueId = itemVenue.get(s.item_id);
  if (!venueId) continue;
  const key = `${venueId}|${s.week_start}`;
  if (!done.has(key)) done.set(key, new Set());
  done.get(key).add(s.item_id);

  const seen = firstWeek.get(venueId);
  if (!seen || s.week_start < seen) firstWeek.set(venueId, s.week_start);
}

const rows = [["week_start", "venue", "done", "active", "target", "status"]];
for (const week of weeks) {
  for (const venue of venues ?? []) {
    const active = activeCount.get(venue.id) ?? 0;
    const count = done.get(`${venue.id}|${week}`)?.size ?? 0;
    // Weeks before a venue's first-ever submission are "no data", not
    // failures — same rule the app uses for fail streaks.
    const started = firstWeek.get(venue.id);
    const status =
      active === 0
        ? "NO_ITEMS"
        : !started || week < started
          ? "NO_DATA"
          : count >= active
            ? "PASS"
            : deadlinePassed(week)
              ? "FAIL"
              : "PENDING";
    rows.push([week, venue.code, count, active, TARGET, status]);
  }
}

await mkdir("reports", { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const file = `reports/walkthrough-${stamp}.csv`;
await writeFile(file, rows.map((r) => r.join(",")).join("\n") + "\n", "utf8");

console.log(`\n  Wrote ${rows.length - 1} rows to ${file}`);
console.log(`  ${weeks.length} weeks × ${(venues ?? []).length} venues\n`);
