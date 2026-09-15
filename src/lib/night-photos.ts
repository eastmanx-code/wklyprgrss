import "server-only";

import { db } from "./supabase";

/**
 * Every photograph a venue's crew took on one night, gathered in one place.
 *
 * The per-list review shows the proof behind each item, which is right when you
 * are reading one list. It is wrong when the question is the simpler one a GM
 * actually asks in the morning: let me see last night's photos. That meant
 * opening every list in turn. This is the one pull that answers it, each shot
 * carrying the task it stands for so the picture is not a picture of nothing.
 */
export type NightPhoto = {
  path: string;
  kind: "photo" | "video";
  /** The item the shot was taken for. */
  itemTitle: string;
  /** The list it came off, so the caption reads like a place, not an id. */
  role: string;
  room: string | null;
  phase: "open" | "mid" | "close";
  initials: string | null;
  at: string | null;
};

export async function nightPhotos(
  code: string,
  night: string,
): Promise<NightPhoto[]> {
  const { data: venueRow } = await db()
    .from("venues")
    .select("id")
    .ilike("code", code)
    .maybeSingle();
  const venueId = (venueRow as { id: string } | null)?.id;
  if (!venueId) return [];

  const { data: listRows } = await db()
    .from("close_checklists")
    .select("id, role, room, phase")
    .eq("venue_id", venueId)
    .eq("active", true);
  const lists = new Map(
    ((listRows ?? []) as {
      id: string;
      role: string;
      room: string | null;
      phase: "open" | "mid" | "close";
    }[]).map((l) => [l.id, l]),
  );
  if (lists.size === 0) return [];

  const { data: nightRows } = await db()
    .from("close_nights")
    .select("id, checklist_id")
    .eq("night", night)
    .in("checklist_id", [...lists.keys()]);
  const nightToList = new Map(
    ((nightRows ?? []) as { id: string; checklist_id: string }[]).map((n) => [
      n.id,
      n.checklist_id,
    ]),
  );
  if (nightToList.size === 0) return [];

  const { data: proofRows } = await db()
    .from("close_proof")
    .select("night_id, item_id, kind, storage_path, initials, created_at")
    .in("night_id", [...nightToList.keys()])
    .not("storage_path", "is", null)
    .order("created_at");
  const proof = (proofRows ?? []) as {
    night_id: string;
    item_id: string;
    kind: "photo" | "video" | "note";
    storage_path: string | null;
    initials: string | null;
    created_at: string;
  }[];
  if (proof.length === 0) return [];

  const itemIds = [...new Set(proof.map((p) => p.item_id))];
  const { data: itemRows } = await db()
    .from("close_items")
    .select("id, title")
    .in("id", itemIds);
  const titleOf = new Map(
    ((itemRows ?? []) as { id: string; title: string }[]).map((i) => [
      i.id,
      i.title,
    ]),
  );

  const shots: NightPhoto[] = [];
  for (const row of proof) {
    if (row.kind === "note" || !row.storage_path) continue;
    const list = lists.get(nightToList.get(row.night_id) ?? "");
    if (!list) continue;
    shots.push({
      path: row.storage_path,
      kind: row.kind,
      itemTitle: titleOf.get(row.item_id) ?? "",
      role: list.role,
      room: list.room,
      phase: list.phase,
      initials: row.initials?.trim() || null,
      at: row.created_at,
    });
  }
  return shots;
}
