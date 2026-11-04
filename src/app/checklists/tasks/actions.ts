"use server";

import { revalidatePath } from "next/cache";

import { getSession, mayManage, mayReachVenue } from "@/lib/session";
import { PHOTO_BUCKET, db } from "@/lib/supabase";

/**
 * The MOD side: taking a CH task done.
 *
 * Managers only — the MOD is the manager on the floor, not the whole crew who
 * hold the venue code. A done photo is required, because the task was flagged
 * off a photo and "done" means somebody can see it was. Completing it clears it
 * off the open list and into the done log.
 */

export type DoneState = { error: string | null; ok?: boolean };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TaskRow = {
  id: string;
  venue_id: string;
  done_at: string | null;
  active: boolean;
};

/** The task, only if this manager may reach its venue and it is still open. */
async function reachableOpenTask(taskId: string): Promise<TaskRow | null> {
  const session = await getSession();
  if (!mayManage(session)) return null;
  const { data } = await db()
    .from("ch_tasks")
    .select("id, venue_id, done_at, active")
    .eq("id", taskId)
    .maybeSingle();
  const row = data as TaskRow | null;
  if (!row || !row.active || row.done_at) return null;
  if (!mayReachVenue(session, row.venue_id)) return null;
  return row;
}

/** A place to put the done photo. */
export async function doneUploadTarget(
  taskId: string,
): Promise<{ error: string | null; path?: string; signedUrl?: string }> {
  if (!UUID.test(taskId)) return { error: "Something went wrong." };
  const row = await reachableOpenTask(taskId);
  if (!row) return { error: "That task is not available." };
  const path = `ch-tasks/done/${taskId}-${Date.now()}.jpg`;
  const { data, error } = await db()
    .storage.from(PHOTO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return { error: "Could not start the upload." };
  return { error: null, path, signedUrl: data.signedUrl };
}

/** Mark it done: initials, a done photo, and off the list it comes. */
export async function completeChTask(
  _prev: DoneState,
  formData: FormData,
): Promise<DoneState> {
  const taskId = String(formData.get("taskId") ?? "");
  if (!UUID.test(taskId)) return { error: "Something went wrong." };
  const row = await reachableOpenTask(taskId);
  if (!row) return { error: "That task is not available." };

  const initials = String(formData.get("initials") ?? "").trim();
  const donePhotoPath = String(formData.get("donePhotoPath") ?? "").trim();
  if (!initials) return { error: "Put your initials." };
  if (initials.length > 12) return { error: "Initials only." };
  if (!donePhotoPath || !donePhotoPath.startsWith(`ch-tasks/done/${taskId}-`)) {
    return { error: "Take the done photo first." };
  }

  // Guarded on done_at being null so two managers tapping done at once cannot
  // both win — the second writes nothing.
  const { error } = await db()
    .from("ch_tasks")
    .update({
      done_at: new Date().toISOString(),
      done_by: initials,
      done_photo_path: donePhotoPath,
    })
    .eq("id", taskId)
    .is("done_at", null);
  if (error) return { error: "Could not save that. Try again." };

  revalidatePath("/checklists/tasks");
  revalidatePath("/admin/tasks");
  return { error: null, ok: true };
}
