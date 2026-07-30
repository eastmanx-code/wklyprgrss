"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { photoPath } from "@/lib/photos";
import { getSession } from "@/lib/session";
import { PHOTO_BUCKET, db } from "@/lib/supabase";
import type { Item } from "@/lib/types";
import { currentWeekStart } from "@/lib/week";

export type SubmitState = { error: string | null };

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_COMMENT_LENGTH = 2000;
const MAX_NAME_LENGTH = 120;

export async function submitItem(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const session = await getSession();
  if (session?.role !== "leader") {
    return { error: "Your session expired. Sign in again." };
  }

  const itemId = String(formData.get("itemId") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const author = String(formData.get("author") ?? "").trim();
  const assistedRaw = String(formData.get("assistedBy") ?? "").trim();
  const assistedBy = assistedRaw || null;
  const progress = String(formData.get("progress") ?? "");
  const photo = formData.get("photo");

  if (progress !== "done" && progress !== "another_cycle") {
    return { error: "Say whether this is done or needs another cycle." };
  }
  if (!author) return { error: "Say who wrote this update." };
  if (author.length > MAX_NAME_LENGTH) return { error: "That name is too long." };
  if (assistedBy && assistedBy.length > MAX_NAME_LENGTH) {
    return { error: "That assisted-by list is too long." };
  }
  if (!comment) return { error: "A comment is required." };
  if (comment.length > MAX_COMMENT_LENGTH) {
    return { error: "That comment is too long." };
  }
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "A photo is required." };
  }
  if (photo.size > MAX_UPLOAD_BYTES) {
    return { error: "That photo is too large. Try again." };
  }

  // The item must belong to the signed-in venue and still be active.
  const { data: item, error: itemError } = await db()
    .from("items")
    .select("id, venue_id, title, position, active")
    .eq("id", itemId)
    .eq("venue_id", session.venueId)
    .eq("active", true)
    .maybeSingle();

  if (itemError) return { error: "Something went wrong. Try again." };
  if (!item) return { error: "That item is no longer available." };

  const { data: venue } = await db()
    .from("venues")
    .select("code")
    .eq("id", (item as Item).venue_id)
    .maybeSingle();

  // Server time only — the client clock never decides which week this counts for.
  const weekStart = currentWeekStart();
  const path = photoPath(venue?.code ?? "unknown", item.id, weekStart);

  const bytes = Buffer.from(await photo.arrayBuffer());
  const { error: uploadError } = await db()
    .storage.from(PHOTO_BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: false });

  if (uploadError) return { error: "Upload failed. Try again." };

  const { error: insertError } = await db().from("submissions").insert({
    item_id: item.id,
    week_start: weekStart,
    photo_url: path,
    comment,
    author,
    assisted_by: assistedBy,
    progress,
  });

  if (insertError) {
    // Don't leave an orphaned object behind in storage.
    await db().storage.from(PHOTO_BUCKET).remove([path]);
    return { error: "Could not save that. Try again." };
  }

  revalidatePath("/venue");
  revalidatePath(`/venue/item/${item.id}`);
  redirect("/venue");
}
