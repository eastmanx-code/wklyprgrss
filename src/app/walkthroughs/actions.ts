"use server";

import { revalidatePath } from "next/cache";

import { getSession, mayManage, mayReachVenue } from "@/lib/session";
import { PHOTO_BUCKET, db } from "@/lib/supabase";

/**
 * Closing a walkthrough commitment: a photo, then a name on it.
 *
 * The proof is the check, the same rule the close lists live by. A commitment
 * cannot be signed without a photo behind it, and only an admin can reopen one
 * that was, in case the picture did not show what was asked.
 */

export type SignState = { error: string | null; ok?: boolean };

/** The commitment, its building, and whether this session may touch it. */
async function reach(commitmentId: string): Promise<{
  propertyId: string;
  signed: boolean;
  isAdmin: boolean;
  category: string;
} | null> {
  if (!commitmentId) return null;
  const { data: commit } = await db()
    .from("walk_commitments")
    .select("id, signed_at, owner, walkthrough_id, category")
    .eq("id", commitmentId)
    .maybeSingle();
  const c = commit as {
    signed_at: string | null;
    owner: string;
    walkthrough_id: string;
    category: string;
  } | null;
  if (!c) return null;
  // B's items are not signed off here at all.
  if (c.owner === "B") return null;

  const { data: walk } = await db()
    .from("walkthroughs")
    .select("property_id")
    .eq("id", c.walkthrough_id)
    .maybeSingle();
  const propertyId = (walk as { property_id: string } | null)?.property_id;
  if (!propertyId) return null;

  const { data: prop } = await db()
    .from("walk_properties")
    .select("venue_id")
    .eq("id", propertyId)
    .maybeSingle();
  const venueId = (prop as { venue_id: string | null } | null)?.venue_id ?? null;

  const session = await getSession();
  const isAdmin = session?.role === "admin";
  const allowed =
    isAdmin || (venueId != null && mayReachVenue(session, venueId));
  if (!allowed) return null;

  return {
    propertyId,
    signed: Boolean(c.signed_at),
    isAdmin,
    category: c.category,
  };
}

/**
 * A signed URL to put one photo behind. The bytes are re-encoded to JPEG in the
 * browser first, the same as every other photo in the app.
 */
export async function walkPhotoUploadUrl(
  commitmentId: string,
): Promise<{ error: string | null; path?: string; signedUrl?: string }> {
  const ok = await reach(commitmentId);
  if (!ok) return { error: "That commitment is not yours to sign." };
  if (ok.signed) return { error: "That is already signed." };

  const path = `walk/${commitmentId}/${Date.now()}.jpg`;
  const { data, error } = await db()
    .storage.from(PHOTO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return { error: "Could not start the upload." };
  return { error: null, path, signedUrl: data.signedUrl };
}

/** Records a photo that has landed in storage. */
export async function attachWalkPhoto(
  commitmentId: string,
  path: string,
  uploadedBy: string,
): Promise<{ error: string | null }> {
  const ok = await reach(commitmentId);
  if (!ok) return { error: "That commitment is not yours to sign." };
  if (!path.startsWith(`walk/${commitmentId}/`)) {
    return { error: "Something went wrong. Try again." };
  }
  const { error } = await db().from("walk_photos").insert({
    commitment_id: commitmentId,
    path,
    uploaded_by: uploadedBy.trim().slice(0, 80) || "manager",
  });
  if (error) return { error: "Could not save that photo." };
  revalidatePath(`/walkthroughs/${ok.propertyId}`);
  return { error: null };
}

/**
 * Puts a name to a commitment, once a photo is behind it. The row locks after
 * this; nothing but an admin reopen changes it.
 */
export async function signWalkCommitment(
  _prev: SignState,
  formData: FormData,
): Promise<SignState> {
  const id = String(formData.get("id") ?? "");
  const signedBy = String(formData.get("signedBy") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  const ok = await reach(id);
  if (!ok) return { error: "That commitment is not yours to sign." };
  if (ok.signed) return { error: "That is already signed." };
  if (signedBy.length < 2) return { error: "Put your name to it." };

  const { count } = await db()
    .from("walk_photos")
    .select("id", { count: "exact", head: true })
    .eq("commitment_id", id);
  if (!count || count < 1) {
    return { error: "A photo has to be on it before you can sign." };
  }

  const { error } = await db()
    .from("walk_commitments")
    .update({
      signed_at: new Date().toISOString(),
      signed_by: signedBy.slice(0, 80),
      note: note ? note.slice(0, 1000) : null,
    })
    .eq("id", id)
    .is("signed_at", null);
  if (error) return { error: "Could not save that. Try again." };

  revalidatePath(`/walkthroughs/${ok.propertyId}`);
  revalidatePath("/walkthroughs");
  return { error: null, ok: true };
}

/**
 * Answers an open question and closes it. A question is not signed with a
 * photo, it is answered in words, so this is its version of the sign-off: an
 * answer and a name, no photo. Same venue scope as everything else here, so a
 * building only answers its own questions. The answer lands in the note, the
 * name and time in the same columns a sign-off uses, so an answered question
 * reads back exactly like a closed item.
 */
export async function answerWalkQuestion(
  _prev: SignState,
  formData: FormData,
): Promise<SignState> {
  const id = String(formData.get("id") ?? "");
  const answeredBy = String(formData.get("answeredBy") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();

  const ok = await reach(id);
  if (!ok) return { error: "That question is not yours to answer." };
  if (ok.category !== "open_question") {
    return { error: "That item is not a question." };
  }
  if (ok.signed) return { error: "That question is already answered." };
  if (answer.length < 2) return { error: "Write an answer first." };
  if (answeredBy.length < 2) return { error: "Put your name to it." };

  const { error } = await db()
    .from("walk_commitments")
    .update({
      signed_at: new Date().toISOString(),
      signed_by: answeredBy.slice(0, 80),
      note: answer.slice(0, 1000),
    })
    .eq("id", id)
    .is("signed_at", null);
  if (error) return { error: "Could not save that. Try again." };

  revalidatePath(`/walkthroughs/${ok.propertyId}`);
  revalidatePath("/walkthroughs");
  return { error: null, ok: true };
}

/**
 * Reopens a signed commitment. Admin only, because the whole point is that a
 * manager cannot un-sign their own work; the office reopens it when the photo
 * did not show what was asked. The photos stay, so the record is intact.
 */
export async function reopenWalkCommitment(
  _prev: SignState,
  formData: FormData,
): Promise<SignState> {
  const id = String(formData.get("id") ?? "");

  const session = await getSession();
  if (session?.role !== "admin") return { error: "Admins reopen these." };

  const ok = await reach(id);
  if (!ok) return { error: "That commitment is not available." };

  const { error } = await db()
    .from("walk_commitments")
    .update({
      signed_at: null,
      signed_by: null,
      reopened_at: new Date().toISOString(),
      reopened_by: "admin",
    })
    .eq("id", id);
  if (error) return { error: "Could not reopen that." };

  revalidatePath(`/walkthroughs/${ok.propertyId}`);
  revalidatePath("/walkthroughs");
  return { error: null, ok: true };
}

/** Guard used by the page to decide whether to show the sign controls. */
export async function canSignWalkthroughs(): Promise<boolean> {
  return mayManage(await getSession());
}
