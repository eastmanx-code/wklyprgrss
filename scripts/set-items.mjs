/**
 * Applies a standard item list to venues in bulk, so you don't hand-type ten
 * items twenty-seven times.
 *
 *   npm run set-items -- --file items.txt              every venue
 *   npm run set-items -- --file items.txt HOOD LEIL    just these
 *   npm run set-items -- --file items.txt --house HOH  the kitchen board
 *   npm run set-items -- --file items.txt --replace    deactivate anything else
 *
 * items.txt is one title per line. Blank lines and # comments are ignored.
 *
 * Existing items with the same title are left alone (their history is kept and
 * their position updated). --replace deactivates items not in the list; it
 * never deletes, so history always survives.
 *
 * Everything is scoped to one house, front of house unless told otherwise.
 * Positions run 1..n within a house, and --replace only ever touches the house
 * it was pointed at — loading the kitchen's ten without that scope would have
 * retired every dining-room item in the company in one command.
 */
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const fileIndex = args.indexOf("--file");
const houseIndex = args.indexOf("--house");
const replace = args.includes("--replace");
const codes = args
  .filter(
    (a, i) =>
      !a.startsWith("--") && i !== fileIndex + 1 && i !== houseIndex + 1,
  )
  .map((c) => c.toUpperCase());

const house = (args[houseIndex + 1] ?? "FOH").toUpperCase();
if (houseIndex >= 0 && house !== "FOH" && house !== "HOH") {
  console.error("\n  --house must be FOH or HOH.\n");
  process.exit(1);
}

if (fileIndex < 0 || !args[fileIndex + 1]) {
  console.error("\n  Usage: npm run set-items -- --file items.txt [CODE ...]\n");
  process.exit(1);
}

const titles = (await readFile(args[fileIndex + 1], "utf8"))
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

if (titles.length === 0) {
  console.error("\n  That file has no titles in it.\n");
  process.exit(1);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

let query = db.from("venues").select("id, code").order("code");
if (codes.length) query = query.in("code", codes);
const { data: venues, error } = await query;

if (error || !venues?.length) {
  console.error(`\n  No venues matched.${error ? ` ${error.message}` : ""}\n`);
  process.exit(1);
}

console.log(
  `\n  ${titles.length} items → ${venues.length} venues · ${house}\n`,
);

for (const venue of venues) {
  const { data: existing } = await db
    .from("items")
    .select("id, title, active")
    .eq("venue_id", venue.id)
    .eq("house", house);

  const byTitle = new Map(
    (existing ?? []).map((item) => [item.title.toLowerCase(), item]),
  );

  let added = 0;
  let kept = 0;
  for (const [index, title] of titles.entries()) {
    const match = byTitle.get(title.toLowerCase());
    if (match) {
      await db
        .from("items")
        .update({ position: index + 1, active: true, title })
        .eq("id", match.id);
      kept += 1;
    } else {
      await db.from("items").insert({
        venue_id: venue.id,
        title,
        house,
        position: index + 1,
        active: true,
      });
      added += 1;
    }
  }

  let retired = 0;
  if (replace) {
    const wanted = new Set(titles.map((t) => t.toLowerCase()));
    const extra = (existing ?? []).filter(
      (item) => item.active && !wanted.has(item.title.toLowerCase()),
    );
    for (const item of extra) {
      // Deactivate, never delete — the history stays attached.
      await db.from("items").update({ active: false }).eq("id", item.id);
      retired += 1;
    }
  }

  console.log(
    `  ${venue.code.padEnd(6)} +${added} added  ${kept} kept${
      retired ? `  ${retired} deactivated` : ""
    }`,
  );
}

console.log("\n  Done.\n");
