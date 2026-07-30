"use server";

import { revalidatePath } from "next/cache";

import { photoPath } from "@/lib/photos";
import { getSession } from "@/lib/session";
import { PHOTO_BUCKET, db } from "@/lib/supabase";
import type { Item } from "@/lib/types";
import { currentWeekStart } from "@/lib/week";

export type SubmitState = { error: string | null; ok?: boolean };

export type UploadTarget = { path: string; signedUrl: string; token: string };

export type UploadTargets = {
  error: string | null;
  after?: UploadTarget;
  before?: UploadTarget;
};

const MAX_COMMENT_LENGTH = 2000;
const MAX_NAME_LENGTH = 120;

/** The item, if it belongs to the signed-in venue and is still active. */
async function ownedItem(itemId: string) {
  const session = await getSession();
  if (session?.role !== "leader") return null;

  const { data } = await db()
    .from("items")
    .select("id, venue_id, title, position, active")
    .eq("id", itemId)
    .eq("venue_id", session.venueId)
    .eq("active", true)
    .maybeSingle();

  return (data as Item | null) ?? null;
}

async function venueCode(venueId: string): Promise<string> {
  const { data } = await db()
    .from("venues")
    .select("code")
    .eq("id", venueId)
    .maybeSingle();
  return (data as { code: string } | null)?.code ?? "unknown";
}

/**
 * Hands the browser short-lived, path-scoped upload URLs so the photo goes
 * straight to storage.
 *
 * Photos used to travel through the server action as form data, which meant a
 * multi-hundred-KB body crossing the serverless boundary on every submit — the
 * thing most likely to fail on a phone, and the hardest to diagnose when it
 * did. The browser now PUTs the file to Supabase directly and the action only
 * ever carries text.
 *
 * The paths are generated here, not accepted from the client, so a signed URL
 * can only ever write to this item's folder.
 */
export async function createUploadTargets(
  itemId: string,
  includeBefore: boolean,
): Promise<UploadTargets> {
  const item = await ownedItem(itemId);
  if (!item) return { error: "That item is no longer available." };

  const code = await venueCode(item.venue_id);
  const weekStart = currentWeekStart();

  async function sign(suffix: string): Promise<UploadTarget | null> {
    const path = photoPath(code, item!.id, suffix);
    const { data, error } = await db()
      .storage.from(PHOTO_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) return null;
    return { path, signedUrl: data.signedUrl, token: data.token };
  }

  const after = await sign(weekStart);
  if (!after) return { error: "Couldn't start the upload. Try again." };

  if (!includeBefore) return { error: null, after };

  const before = await sign(`${weekStart}-before`);
  if (!before) return { error: "Couldn't start the upload. Try again." };

  return { error: null, after, before };
}

/**
 * Records the submission. Text only — the photos are already in storage by the
 * time this runs, and the paths are re-derived against this item so a tampered
 * path can't point somewhere else.
 */
export async function submitItem(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const itemId = String(formData.get("itemId") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const author = String(formData.get("author") ?? "").trim();
  const assistedRaw = String(formData.get("assistedBy") ?? "").trim();
  const assistedBy = assistedRaw || null;
  const progress = String(formData.get("progress") ?? "");
  const photoUrl = String(formData.get("photoPath") ?? "");
  const beforeRaw = String(formData.get("beforePhotoPath") ?? "").trim();

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
  if (!photoUrl) return { error: "A photo is required." };

  const item = await ownedItem(itemId);
  if (!item) return { error: "That item is no longer available." };

  // A path is only accepted if it sits inside this item's own folder.
  const prefix = `${await venueCode(item.venue_id)}/${item.id}/`;
  if (!photoUrl.startsWith(prefix)) {
    return { error: "Something went wrong. Try again." };
  }
  const beforePhotoUrl = beforeRaw || null;
  if (beforePhotoUrl && !beforePhotoUrl.startsWith(prefix)) {
    return { error: "Something went wrong. Try again." };
  }

  // Server time only — the client clock never decides which week this counts for.
  const weekStart = currentWeekStart();

  const { error: insertError } = await db().from("submissions").insert({
    item_id: item.id,
    week_start: weekStart,
    photo_url: photoUrl,
    before_photo_url: beforePhotoUrl,
    comment,
    author,
    assisted_by: assistedBy,
    progress,
  });

  if (insertError) {
    // Don't leave orphaned objects behind in storage.
    await db()
      .storage.from(PHOTO_BUCKET)
      .remove(beforePhotoUrl ? [photoUrl, beforePhotoUrl] : [photoUrl]);
    return { error: "Could not save that. Try again." };
  }

  revalidatePath("/venue");
  revalidatePath(`/venue/item/${item.id}`);
  // Navigation happens on the client: redirect() throwing out of an action
  // dispatched from useActionState is exactly the kind of failure that shows a
  // blank error screen with nothing to diagnose.
  return { error: null, ok: true };
}
