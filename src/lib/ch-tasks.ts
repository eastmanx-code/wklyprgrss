import "server-only";

import { db } from "./supabase";
import { signedUrls } from "./photos";

/**
 * CH Tasks: the owner's walk-around punch list.
 *
 * Separate from the nightly close lists on purpose. A close item is owed every
 * night and signed per night; a CH task is a one-off — the owner sees something
 * on a walk, snaps it, describes it, and it sits on that venue's MOD list until
 * a manager does it and photographs it done. Then it clears off and lives in the
 * done log. No cadence, no nightly cert, no scoring: a standing to-do that
 * closes once.
 */

export type ChTaskOpen = {
  id: string;
  venueId: string;
  title: string;
  /** What the owner saw / wants done. */
  photoUrl: string | null;
  createdAt: string;
};

export type ChTaskDone = {
  id: string;
  venueId: string;
  title: string;
  photoUrl: string | null;
  /** The proof it was handled. */
  donePhotoUrl: string | null;
  doneAt: string;
  doneBy: string | null;
};

type Row = {
  id: string;
  venue_id: string;
  title: string;
  photo_path: string | null;
  created_at: string;
  done_at: string | null;
  done_by: string | null;
  done_photo_path: string | null;
};

/** Open tasks for a venue, oldest first so the longest-waiting is on top. */
export async function openTasks(venueId: string): Promise<ChTaskOpen[]> {
  const { data } = await db()
    .from("ch_tasks")
    .select("id, venue_id, title, photo_path, created_at")
    .eq("venue_id", venueId)
    .eq("active", true)
    .is("done_at", null)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as Row[];
  const urls = await signedUrls(
    rows.map((r) => r.photo_path).filter((p): p is string => Boolean(p)),
  );
  return rows.map((r) => ({
    id: r.id,
    venueId: r.venue_id,
    title: r.title,
    photoUrl: r.photo_path ? (urls.get(r.photo_path) ?? null) : null,
    createdAt: r.created_at,
  }));
}

/** The done log for a venue, newest first. Proof the flagged thing got cleared. */
export async function doneTasks(
  venueId: string,
  limit = 20,
): Promise<ChTaskDone[]> {
  const { data } = await db()
    .from("ch_tasks")
    .select("id, venue_id, title, photo_path, done_at, done_by, done_photo_path")
    .eq("venue_id", venueId)
    .not("done_at", "is", null)
    .order("done_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as Row[];
  const urls = await signedUrls(
    rows
      .flatMap((r) => [r.photo_path, r.done_photo_path])
      .filter((p): p is string => Boolean(p)),
  );
  return rows.map((r) => ({
    id: r.id,
    venueId: r.venue_id,
    title: r.title,
    photoUrl: r.photo_path ? (urls.get(r.photo_path) ?? null) : null,
    donePhotoUrl: r.done_photo_path
      ? (urls.get(r.done_photo_path) ?? null)
      : null,
    doneAt: r.done_at as string,
    doneBy: r.done_by,
  }));
}

/** How many open tasks each venue has, for the owner's overview. */
export async function openCountsByVenue(): Promise<Map<string, number>> {
  const { data } = await db()
    .from("ch_tasks")
    .select("venue_id")
    .eq("active", true)
    .is("done_at", null);
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { venue_id: string }[]) {
    counts.set(row.venue_id, (counts.get(row.venue_id) ?? 0) + 1);
  }
  return counts;
}

/** Open task count for one venue, for the MOD's badge. */
export async function openCount(venueId: string): Promise<number> {
  const { count } = await db()
    .from("ch_tasks")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId)
    .eq("active", true)
    .is("done_at", null);
  return count ?? 0;
}
