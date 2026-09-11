/**
 * Loads a venue's close checklists from a file, so onboarding a location is
 * one file and one command rather than an afternoon of hand-typed rows.
 *
 *   npm run load-close-lists -- --file close-lists/STAR.json
 *   npm run load-close-lists -- --file close-lists/STAR.json --replace
 *   npm run load-close-lists -- --file close-lists/STAR.json --sql > star.sql
 *
 * The file is the shape described in .claude/skills/onboard-close-lists.
 * One list per position and phase (or per room, where a position runs one
 * list per room), each with its items in order.
 *
 * Idempotent. A list is matched on venue, house, role, phase and room; an
 * item on its title within the list. Matched items keep their id and their
 * history and take the file's position, section, Spanish, detail and proof.
 * New items are inserted. --replace retires items the file no longer has;
 * it never deletes, so a night signed against an old item still reads.
 *
 * --sql prints the statements instead of running them, for when the key is
 * not on this machine and the SQL is going through another door.
 */
import { readFile } from "node:fs/promises";

const args = process.argv.slice(2);
const fileIndex = args.indexOf("--file");
const replace = args.includes("--replace");
const sqlOnly = args.includes("--sql");

if (fileIndex < 0 || !args[fileIndex + 1]) {
  console.error(
    "\n  Usage: npm run load-close-lists -- --file close-lists/CODE.json [--replace] [--sql]\n",
  );
  process.exit(1);
}

const doc = JSON.parse(await readFile(args[fileIndex + 1], "utf8"));
const code = String(doc.venue ?? "").toUpperCase();
if (!code || !Array.isArray(doc.lists) || doc.lists.length === 0) {
  console.error("\n  The file needs a venue code and at least one list.\n");
  process.exit(1);
}

const HOUSES = new Set(["FOH", "HOH"]);
const PHASES = new Set(["open", "mid", "close"]);
const KINDS = new Set(["photo", "video", "note"]);

/** Refuse a file that would load half and then fail. */
function check() {
  const seen = new Set();
  for (const list of doc.lists) {
    const where = `${list.house} ${list.role}/${list.phase}${list.room ? ` [${list.room}]` : ""}`;
    if (!HOUSES.has(list.house)) throw new Error(`${where}: house must be FOH or HOH`);
    if (!PHASES.has(list.phase)) throw new Error(`${where}: phase must be open, mid or close`);
    if (!list.role?.trim()) throw new Error(`${where}: role is required`);
    const key = `${list.house}|${list.role.trim().toLowerCase()}|${list.phase}|${(list.room ?? "").trim().toLowerCase()}`;
    if (seen.has(key)) throw new Error(`${where}: listed twice`);
    seen.add(key);
    if (!Array.isArray(list.items) || list.items.length === 0)
      throw new Error(`${where}: no items`);
    const titles = new Set();
    list.items.forEach((item, i) => {
      if (!item.title?.trim()) throw new Error(`${where}: item ${i + 1} has no title`);
      const t = item.title.trim().toLowerCase();
      if (titles.has(t)) throw new Error(`${where}: item ${i + 1} repeats a title, and titles are how items are matched`);
      titles.add(t);
      for (const shot of item.proof ?? []) {
        if (!KINDS.has(shot.kind)) throw new Error(`${where}: item ${i + 1} proof kind must be photo, video or note`);
        if (!shot.prompt?.trim() || shot.prompt === "TODO")
          throw new Error(`${where}: item ${i + 1} proof needs a prompt saying what it has to show`);
      }
    });
  }
}
check();

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const qn = (s) => (s === undefined || s === null || s === "" ? "null" : q(s));
const jsonb = (v) => `${q(JSON.stringify(v))}::jsonb`;
const textArray = (arr) =>
  arr && arr.length
    ? `array[${arr.map(q).join(", ")}]::text[]`
    : "'{}'::text[]";

/** The SQL for one list, matching on the same keys the app addresses by. */
function listSql(list) {
  const room = list.room?.trim() || null;
  const match = `venue_id = (select id from venues where code = ${q(code)}) and house = ${q(list.house)} and lower(role) = lower(${q(list.role.trim())}) and phase = ${q(list.phase)} and coalesce(lower(room), '') = ${q((room ?? "").toLowerCase())}`;
  const out = [];
  out.push(
    `insert into close_checklists (venue_id, house, role, role_es, phase, room)
select (select id from venues where code = ${q(code)}), ${q(list.house)}, ${q(list.role.trim())}, ${qn(list.role_es)}, ${q(list.phase)}, ${qn(room)}
where not exists (select 1 from close_checklists where ${match});`,
  );
  out.push(
    `update close_checklists set role_es = ${qn(list.role_es)}, active = true where ${match};`,
  );
  list.items.forEach((item, i) => {
    const title = item.title.trim();
    const cols = {
      position: i + 1,
      section: item.section?.trim() || null,
      title_es: item.title_es?.trim() || null,
    };
    out.push(
      `update close_items set position = ${cols.position}, section = ${qn(cols.section)}, title_es = ${qn(cols.title_es)}, detail = ${textArray(item.detail)}, proof = ${jsonb(item.proof ?? [])}, active = true
where checklist_id = (select id from close_checklists where ${match}) and lower(title) = lower(${q(title)});`,
    );
    out.push(
      `insert into close_items (checklist_id, position, title, title_es, section, detail, proof)
select (select id from close_checklists where ${match}), ${cols.position}, ${q(title)}, ${qn(cols.title_es)}, ${qn(cols.section)}, ${textArray(item.detail)}, ${jsonb(item.proof ?? [])}
where not exists (select 1 from close_items where checklist_id = (select id from close_checklists where ${match}) and lower(title) = lower(${q(title)}));`,
    );
  });
  if (replace) {
    const keep = list.items.map((item) => q(item.title.trim().toLowerCase())).join(", ");
    out.push(
      `update close_items set active = false where checklist_id = (select id from close_checklists where ${match}) and lower(title) not in (${keep});`,
    );
  }
  return out;
}

const statements = doc.lists.flatMap(listSql);

if (sqlOnly) {
  console.log(`-- ${code}: ${doc.lists.length} lists, ${doc.lists.reduce((n, l) => n + l.items.length, 0)} items`);
  console.log("begin;");
  for (const s of statements) console.log(s);
  console.log("commit;");
  process.exit(0);
}

const { createClient } = await import("@supabase/supabase-js");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function fail(where, error) {
  console.error(`\n  ${where}: ${error.message}\n`);
  process.exit(1);
}

const { data: venue, error: venueError } = await db
  .from("venues")
  .select("id")
  .eq("code", code)
  .maybeSingle();
if (venueError) fail("venues", venueError);
if (!venue) {
  console.error(`\n  No venue with code ${code}. Add it to venues first.\n`);
  process.exit(1);
}

for (const list of doc.lists) {
  const room = list.room?.trim() || null;
  const where = `${list.house} ${list.role}/${list.phase}${room ? ` [${room}]` : ""}`;

  // Find or make the list. Matched loosely on case, the way the app's
  // addresses are, so "Line cook" and "line cook" are one list.
  const { data: lists, error: listError } = await db
    .from("close_checklists")
    .select("id, role, room")
    .eq("venue_id", venue.id)
    .eq("house", list.house)
    .eq("phase", list.phase)
    .ilike("role", list.role.trim());
  if (listError) fail(where, listError);
  let found = (lists ?? []).find(
    (row) => (row.room ?? "").trim().toLowerCase() === (room ?? "").toLowerCase(),
  );
  if (found) {
    const { error } = await db
      .from("close_checklists")
      .update({ role_es: list.role_es ?? null, active: true })
      .eq("id", found.id);
    if (error) fail(where, error);
  } else {
    const { data, error } = await db
      .from("close_checklists")
      .insert({
        venue_id: venue.id,
        house: list.house,
        role: list.role.trim(),
        role_es: list.role_es ?? null,
        phase: list.phase,
        room,
      })
      .select("id")
      .single();
    if (error) fail(where, error);
    found = data;
  }

  const { data: existing, error: itemsError } = await db
    .from("close_items")
    .select("id, title")
    .eq("checklist_id", found.id);
  if (itemsError) fail(where, itemsError);
  const byTitle = new Map(
    (existing ?? []).map((row) => [row.title.trim().toLowerCase(), row.id]),
  );

  const kept = new Set();
  for (const [i, item] of list.items.entries()) {
    const title = item.title.trim();
    const fields = {
      position: i + 1,
      section: item.section?.trim() || null,
      title_es: item.title_es?.trim() || null,
      detail: item.detail ?? [],
      proof: item.proof ?? [],
      active: true,
    };
    const id = byTitle.get(title.toLowerCase());
    if (id) {
      kept.add(id);
      const { error } = await db.from("close_items").update(fields).eq("id", id);
      if (error) fail(`${where} item ${i + 1}`, error);
    } else {
      const { data, error } = await db
        .from("close_items")
        .insert({ checklist_id: found.id, title, ...fields })
        .select("id")
        .single();
      if (error) fail(`${where} item ${i + 1}`, error);
      kept.add(data.id);
    }
  }

  if (replace) {
    const retire = (existing ?? []).filter((row) => !kept.has(row.id)).map((row) => row.id);
    if (retire.length) {
      const { error } = await db.from("close_items").update({ active: false }).in("id", retire);
      if (error) fail(`${where} retire`, error);
    }
  }
  console.log(`  ${where}: ${list.items.length} items`);
}

console.log(
  `\n  ${code}: ${doc.lists.length} lists loaded. Switch the location on from Checklists · Locations.\n`,
);
