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

/**
 * The item, if this session may work on it and it is still active.
 *
 * A leader may work on their own venue's items; an admin may work on any.
 * Admins were previously refused outright, which made the setup flow on the
 * admin page dead-end at a redirect — and the rule has always been that admin
 * and venue differ only in who can approve.
 *
 * The venue is read from the item itself, never from the request.
 */
async function ownedItem(itemId: string) {
  const session = await getSession();
  if (!session) return null;

  const { data } = await db()
    .from("items")
    .select("id, venue_id, title, position, active")
    .eq("id", itemId)
    .eq("active", true)
    .maybeSingle();

  const item = (data as Item | null) ?? null;
  if (!item) return null;
  if (session.role === "leader" && session.venueId !== item.venue_id) {
    return null;
  }
  return item;
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
  if (author.length > MAX_NAME_LENGTH)
    return { error: "That name is too long." };
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

/**
 * Amends this week's entry in place.
 *
 * Everything here used to be append-only, so fixing a typo meant re-typing the
 * comment, re-picking both photos, and ending up with two entries under the
 * same week — which reads in the history as two separate weeks of work. A
 * leader described exactly that. Correcting a record you just wrote is not a
 * second week of work and should not look like one.
 *
 * Only the newest entry of the current week, and only while it is pending or
 * already approved. Photos are optional: leave them alone and the existing
 * ones stay. An amended entry that had been approved goes back to pending —
 * the admin approved what it said before, not what it says now.
 *
 * A sent-back entry is deliberately not editable. That flow already asks for a
 * fresh photo and comment, and quietly editing the rejected one past a review
 * is not the same thing.
 */
export async function editSubmission(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const submissionId = String(formData.get("submissionId") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const author = String(formData.get("author") ?? "").trim();
  const assistedRaw = String(formData.get("assistedBy") ?? "").trim();
  const assistedBy = assistedRaw || null;
  const progress = String(formData.get("progress") ?? "");
  const photoUrl = String(formData.get("photoPath") ?? "").trim();
  const beforeRaw = String(formData.get("beforePhotoPath") ?? "").trim();
  const dropBefore = String(formData.get("dropBefore") ?? "") === "true";

  if (progress !== "done" && progress !== "another_cycle") {
    return { error: "Say whether this is done or needs another cycle." };
  }
  if (!author) return { error: "Say who wrote this update." };
  if (author.length > MAX_NAME_LENGTH)
    return { error: "That name is too long." };
  if (assistedBy && assistedBy.length > MAX_NAME_LENGTH) {
    return { error: "That assisted-by list is too long." };
  }
  if (!comment) return { error: "A comment is required." };
  if (comment.length > MAX_COMMENT_LENGTH) {
    return { error: "That comment is too long." };
  }

  const { data: row } = await db()
    .from("submissions")
    .select("id, item_id, week_start, photo_url, before_photo_url, review")
    .eq("id", submissionId)
    .maybeSingle();

  const existing = row as {
    id: string;
    item_id: string;
    week_start: string;
    photo_url: string;
    before_photo_url: string | null;
    review: string;
  } | null;
  if (!existing) return { error: "That entry is no longer available." };

  const item = await ownedItem(existing.item_id);
  if (!item) return { error: "That item is no longer available." };

  if (existing.week_start !== currentWeekStart()) {
    return { error: "Only this week's entry can be edited." };
  }
  if (existing.review === "sent_back") {
    return { error: "That entry was sent back. Submit a new one instead." };
  }

  // Newest wins everywhere else in the app; editing an older entry of the same
  // week would change something no screen is showing.
  const { data: newest } = await db()
    .from("submissions")
    .select("id")
    .eq("item_id", item.id)
    .eq("week_start", existing.week_start)
    .order("created_at", { ascending: false })
    .limit(1);
  if ((newest as { id: string }[] | null)?.[0]?.id !== existing.id) {
    return { error: "A newer entry has been added. Edit that one instead." };
  }

  const prefix = `${await venueCode(item.venue_id)}/${item.id}/`;
  if (photoUrl && !photoUrl.startsWith(prefix)) {
    return { error: "Something went wrong. Try again." };
  }
  if (beforeRaw && !beforeRaw.startsWith(prefix)) {
    return { error: "Something went wrong. Try again." };
  }

  const nextBefore = dropBefore ? null : beforeRaw || existing.before_photo_url;

  const { error: updateError } = await db()
    .from("submissions")
    .update({
      comment,
      author,
      assisted_by: assistedBy,
      progress,
      photo_url: photoUrl || existing.photo_url,
      before_photo_url: nextBefore,
      // Back to pending only if it had been approved — the admin signed off on
      // what this said before.
      ...(existing.review === "approved"
        ? { review: "pending", reviewed_at: null }
        : {}),
    })
    .eq("id", existing.id);

  if (updateError) {
    // The new files are already up; drop them rather than leave them orphaned.
    const orphans = [photoUrl, beforeRaw].filter(Boolean) as string[];
    if (orphans.length) {
      await db().storage.from(PHOTO_BUCKET).remove(orphans);
    }
    return { error: "Could not save that. Try again." };
  }

  // Replaced photos are dead the moment the row stops pointing at them.
  const replaced = [
    photoUrl && existing.photo_url !== photoUrl ? existing.photo_url : null,
    existing.before_photo_url && existing.before_photo_url !== nextBefore
      ? existing.before_photo_url
      : null,
  ].filter(Boolean) as string[];
  if (replaced.length) {
    await db().storage.from(PHOTO_BUCKET).remove(replaced);
  }

  revalidatePath("/venue");
  revalidatePath(`/venue/item/${item.id}`);
  return { error: null, ok: true };
}
