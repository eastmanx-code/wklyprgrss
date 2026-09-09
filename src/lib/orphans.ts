import "server-only";

import { PHOTO_BUCKET, db } from "./supabase";

/**
 * Photographs in storage that nothing points at.
 *
 * A retake used to leave the picture it replaced behind: the row moved to the
 * new file and the old one sat in the bucket, unreachable from every screen in
 * the app and paid for every month. Both writes drop what they replace now,
 * but that only helps from here on, and a crash between an upload and the row
 * that names it will always be able to leave one.
 *
 * This ran as a script against a service key on somebody's laptop first. It
 * lives in the app instead because the key is already here, because the answer
 * should not depend on who has a checkout, and — the real reason — because two
 * copies of "what counts as unreferenced" is how the wrong file gets deleted.
 * There is one.
 *
 * Two places hold a path: close_proof.storage_path for the evidence somebody
 * took on a shift, and close_items.reference for the example shots a manager
 * set up. A file named by either is not an orphan. Anything outside close/ is
 * the weekly board's and none of this touches it.
 */
export type Orphan = { path: string; bytes: number };

/** Supabase's own marker for a folder made in the dashboard. Not a photograph. */
const PLACEHOLDER = ".emptyFolderPlaceholder";

/** Every object under a prefix, walking the folders storage hands back. */
async function walk(prefix: string): Promise<Orphan[]> {
  const found: Orphan[] = [];
  const { data, error } = await db()
    .storage.from(PHOTO_BUCKET)
    .list(prefix, { limit: 1000 });
  if (error) throw new Error(`${prefix}: ${error.message}`);

  for (const entry of (data ?? []) as {
    name: string;
    id: string | null;
    metadata: { size?: number } | null;
  }[]) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    // A folder comes back with no id. A file has one.
    if (entry.id) found.push({ path, bytes: entry.metadata?.size ?? 0 });
    else found.push(...(await walk(path)));
  }
  return found;
}

/** What is up there with nothing pointing at it. */
export async function findOrphans(): Promise<Orphan[]> {
  const [{ data: proof }, { data: items }] = await Promise.all([
    db().from("close_proof").select("storage_path"),
    db().from("close_items").select("reference"),
  ]);

  const used = new Set<string>();
  for (const row of (proof ?? []) as { storage_path: string | null }[]) {
    if (row.storage_path) used.add(row.storage_path);
  }
  for (const row of (items ?? []) as {
    reference: { path: string | null }[] | null;
  }[]) {
    for (const ref of row.reference ?? []) if (ref?.path) used.add(ref.path);
  }

  const all = await walk("close");
  return all.filter(
    (file) => !used.has(file.path) && !file.path.endsWith(PLACEHOLDER),
  );
}

/**
 * Delete them, having listed them first.
 *
 * The list is taken again here rather than trusted from the screen. Between
 * looking and pressing the button somebody can have finished a shift, and a
 * delete that runs on a list the server has not re-checked is a delete that
 * can take tonight's evidence.
 *
 * A hundred at a time, because the storage call takes a list and a list of two
 * thousand is one request that either works or loses the lot.
 */
export async function removeOrphans(): Promise<{
  removed: number;
  bytes: number;
}> {
  const orphans = await findOrphans();
  let removed = 0;
  let bytes = 0;

  for (let i = 0; i < orphans.length; i += 100) {
    const batch = orphans.slice(i, i + 100);
    const { error } = await db()
      .storage.from(PHOTO_BUCKET)
      .remove(batch.map((file) => file.path));
    if (error) break;
    removed += batch.length;
    bytes += batch.reduce((n, file) => n + file.bytes, 0);
  }

  return { removed, bytes };
}
