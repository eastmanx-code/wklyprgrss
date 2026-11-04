"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/session";
import { PHOTO_BUCKET, db } from "@/lib/supabase";

/**
 * Posting a CH task, and cancelling one. Owner only for now — the person who
 * walks every venue. A select group can be let in later by widening the gate
 * here; nothing else has to change.
 */

export type PostState = { error: string | null; ok?: boolean };

const MAX_TITLE = 200;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function isOwner(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}

/**
 * A place to put the photo, minted before the row exists.
 *
 * The task id is made on the client so the picture and the row share it, the
 * same shape the reference shots upload in: straight to storage, then the row
 * points at it, so the action that writes the row only ever carries text.
 */
export async function askUploadTarget(
  taskId: string,
): Promise<{ error: string | null; path?: string; signedUrl?: string }> {
  if (!(await isOwner())) return { error: "Owner only." };
  if (!UUID.test(taskId)) return { error: "Something went wrong. Try again." };
  const path = `ch-tasks/ask/${taskId}-${Date.now()}.jpg`;
  const { data, error } = await db()
    .storage.from(PHOTO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return { error: "Could not start the upload." };
  return { error: null, path, signedUrl: data.signedUrl };
}

/** Drop a task onto a venue's MOD list. Photo and a line, both required. */
export async function postChTask(
  _prev: PostState,
  formData: FormData,
): Promise<PostState> {
  if (!(await isOwner())) return { error: "Owner only." };

  const taskId = String(formData.get("taskId") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const photoPath = String(formData.get("photoPath") ?? "").trim();

  if (!UUID.test(taskId)) return { error: "Something went wrong. Try again." };
  if (!UUID.test(venueId)) return { error: "Pick a location." };
  if (!title) return { error: "Say what needs doing." };
  if (title.length > MAX_TITLE) return { error: "That is too long." };
  // The photo is the task. A path that is not the one we minted for this id is
  // not trusted.
  if (!photoPath || !photoPath.startsWith(`ch-tasks/ask/${taskId}-`)) {
    return { error: "Add a photo first." };
  }

  const { data: venue } = await db()
    .from("venues")
    .select("id")
    .eq("id", venueId)
    .maybeSingle();
  if (!venue) return { error: "That location is not available." };

  const { error } = await db().from("ch_tasks").insert({
    id: taskId,
    venue_id: venueId,
    title,
    photo_path: photoPath,
    created_by: "owner",
  });
  if (error) return { error: "Could not post that. Try again." };

  revalidatePath("/admin/tasks");
  revalidatePath("/checklists/tasks");
  return { error: null, ok: true };
}

/** Pull a task back before anyone does it. Not a delete, just stood down. */
export async function cancelChTask(
  _prev: PostState,
  formData: FormData,
): Promise<PostState> {
  if (!(await isOwner())) return { error: "Owner only." };
  const id = String(formData.get("taskId") ?? "");
  if (!UUID.test(id)) return { error: "Something went wrong." };
  await db()
    .from("ch_tasks")
    .update({ active: false })
    .eq("id", id)
    .is("done_at", null);
  revalidatePath("/admin/tasks");
  return { error: null, ok: true };
}
