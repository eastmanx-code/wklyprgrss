import "server-only";

import { kindOf, newestFor } from "./adopt-names";
import type { Shot } from "./close-checklist";
import { PHOTO_BUCKET, db } from "./supabase";

/**
 * Bytes landing is the event. The record is bookkeeping that catches up.
 *
 * A capture is two round trips: the photograph goes to storage under a signed
 * URL, then a second call writes the row that makes it real. Everything the
 * app shows reads the row, so a photograph whose second call never ran is on
 * the server and invisible. The item still reads as owing a photograph, the
 * list still cannot be signed, and the person who took it watched a thumbnail
 * appear and has every reason to believe they are done.
 *
 * That window is not small. Between the bytes landing and the list being
 * signed, a phone dies, somebody clocks out, a tab gets closed, a house phone
 * is handed to the next shift, a walk-in swallows the signal for the rest of
 * the night, or a different person signs on a different phone entirely. The
 * queue holds the unfinished write, but the queue lives on one device, and the
 * device is exactly the thing that stops being available.
 *
 * So the storage path carries everything needed to rebuild the row:
 * close/<night>/<item>/<shot>-<stamp>.<ext>. If the bytes are there, the
 * photograph happened, and no later failure should be able to un-happen it.
 * This looks only where a row is missing, which on a normal night is nowhere
 * at all.
 *
 * Not a substitute for the queue retrying. The queue gets it there in seconds
 * when the phone is still in someone's hand; this catches the nights where it
 * never will.
 */

type ItemNeed = { id: string; proof?: Shot[] | null };
type Had = { item_id: string; shot_index: number };

/**
 * Write rows for captures that reached storage and never got one.
 *
 * Returns how many it took in, so the caller knows to read the proof back.
 * Never throws: a list that will not load is worse than a photograph that
 * stays missing for one more page view, and every failure here is one the
 * next load tries again.
 */
export async function adoptCaptures(
  nightId: string,
  items: ItemNeed[],
  had: Had[],
): Promise<number> {
  const have = new Set(had.map((row) => `${row.item_id}:${row.shot_index}`));

  // Only the slots that want a picture and do not have one. On a night where
  // everything worked this is empty and the function costs one Set.
  const wanted: { itemId: string; shotIndex: number }[] = [];
  for (const item of items) {
    (item.proof ?? []).forEach((shot, shotIndex) => {
      if (shot.kind === "note") return;
      if (have.has(`${item.id}:${shotIndex}`)) return;
      wanted.push({ itemId: item.id, shotIndex });
    });
  }
  if (wanted.length === 0) return 0;

  // One listing per item, not per slot: two shots on one item share a folder.
  const folders = [...new Set(wanted.map((slot) => slot.itemId))];
  const filesByItem = new Map<string, string[]>();
  for (const itemId of folders) {
    try {
      const { data } = await db()
        .storage.from(PHOTO_BUCKET)
        .list(`close/${nightId}/${itemId}`, { limit: 100 });
      filesByItem.set(itemId, (data ?? []).map((row) => row.name));
    } catch {
      // A folder that will not list is a folder with nothing to adopt as far
      // as this page is concerned. Next load asks again.
    }
  }

  const rows: {
    night_id: string;
    item_id: string;
    shot_index: number;
    kind: string;
    storage_path: string;
    initials: string | null;
  }[] = [];

  for (const slot of wanted) {
    const names = filesByItem.get(slot.itemId) ?? [];
    const best = newestFor(names, slot.shotIndex);
    if (!best) continue;
    rows.push({
      night_id: nightId,
      item_id: slot.itemId,
      shot_index: slot.shotIndex,
      kind: kindOf(best) as string,
      storage_path: `close/${nightId}/${slot.itemId}/${best}`,
      // Nobody's initials. The call that carried them is the call that never
      // ran, and guessing from whoever ticked the item would put a name on a
      // record that nobody typed. A blank here is true.
      initials: null,
    });
  }

  if (rows.length === 0) return 0;

  try {
    const { error } = await db()
      .from("close_proof")
      .upsert(rows, { onConflict: "night_id,item_id,shot_index" });
    if (error) return 0;
  } catch {
    return 0;
  }
  return rows.length;
}

/**
 * The sweep, at the one moment it decides something.
 *
 * Deliberately not on the list screen. That screen refreshes every fifteen
 * seconds on every phone that has it open, and hanging a storage round trip
 * off it would cost a call four times a minute per person all shift to answer
 * a question whose answer is almost always no. Signing is where a missing row
 * stops being untidy and starts being wrong: the snapshot is frozen there and
 * the record is what everything afterwards reads.
 *
 * The cost of putting it here rather than on the screen is that an adopted
 * photograph shows up on other people's phones when somebody signs, not the
 * moment the bytes land. Worth naming, because it is a real gap and not an
 * oversight.
 */
export async function sweepCaptures(
  checklistId: string,
  nightId: string,
): Promise<number> {
  const [{ data: itemRows }, { data: proofRows }] = await Promise.all([
    db()
      .from("close_items")
      .select("id, proof")
      .eq("checklist_id", checklistId)
      .eq("active", true),
    db()
      .from("close_proof")
      .select("item_id, shot_index")
      .eq("night_id", nightId),
  ]);
  return adoptCaptures(
    nightId,
    (itemRows ?? []) as ItemNeed[],
    (proofRows ?? []) as Had[],
  );
}
