"use server";

import { revalidatePath } from "next/cache";

import { isAdminPin } from "@/lib/admin-pin";
import { closeVenueId } from "@/lib/close-venue";
import { currentNight } from "@/lib/night";
import { PHOTO_BUCKET, db } from "@/lib/supabase";

export type CloseState = { error: string | null };

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** The venue this session may work on. */
async function venueId(): Promise<string | null> {
  return closeVenueId();
}

/** The checklist row, if this session may see it. */
async function checklistFor(slug: string) {
  const venue = await venueId();
  if (!venue) return null;
  const [house, ...rest] = slug.split("-");
  const phase = rest[rest.length - 1];
  const role = rest.slice(0, -1).join(" ");
  // Matched in JS rather than with ilike: the slug is user input and ilike
  // treats % and _ as wildcards, so foh-%-close would match whatever role
  // came back first. The set is a handful of rows per venue.
  const { data } = await db()
    .from("close_checklists")
    .select("id, house, role, phase")
    .eq("venue_id", venue)
    .eq("active", true);

  const rows = (data ?? []) as {
    id: string;
    house: string;
    role: string;
    phase: string;
  }[];
  const match = rows.find(
    (row) =>
      row.house.toLowerCase() === house.toLowerCase() &&
      row.role.toLowerCase() === role.toLowerCase() &&
      row.phase.toLowerCase() === phase.toLowerCase(),
  );
  return match ? { id: match.id } : null;
}

/**
 * Tonight's row for a checklist, created on first touch.
 *
 * Created eagerly rather than on certify, because the whole point is that a
 * second person can pick the list up mid-shift — which needs somewhere for the
 * first person's work to already be.
 */
async function nightId(checklistId: string): Promise<string | null> {
  const night = currentNight();

  // Upsert rather than check-then-insert. Two people ticking in the same
  // second both saw no row and both inserted; the second lost the unique
  // constraint and was told the night could not be opened — in precisely the
  // concurrent case this whole feature exists for.
  const { data } = await db()
    .from("close_nights")
    .upsert(
      { checklist_id: checklistId, night },
      { onConflict: "checklist_id,night", ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (data) return (data as { id: string }).id;

  // Upsert can still lose a race against a concurrent insert; read it back.
  const { data: existing } = await db()
    .from("close_nights")
    .select("id")
    .eq("checklist_id", checklistId)
    .eq("night", night)
    .maybeSingle();
  return (existing as { id: string } | null)?.id ?? null;
}

/** A certified night is a record. Nothing may be written to it. */
async function isLocked(id: string): Promise<boolean> {
  const { data } = await db()
    .from("close_nights")
    .select("certified_at")
    .eq("id", id)
    .maybeSingle();
  return Boolean(
    (data as { certified_at: string | null } | null)?.certified_at,
  );
}

export async function tickItem(
  _prev: CloseState,
  formData: FormData,
): Promise<CloseState> {
  const slug = String(formData.get("slug") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const initials = String(formData.get("initials") ?? "")
    .trim()
    .toUpperCase();
  const on = String(formData.get("on") ?? "") === "true";
  /**
   * When the device says this happened, which is not when it arrived.
   *
   * Recorded, never trusted and never used to decide anything: a phone clock
   * is wrong as often as it is right and can be set by hand. `created_at` is
   * the server's own stamp and stays the one the reports count on. Holding
   * both is what lets a night show a tick that claims eleven forty and landed
   * at quarter past two, which on a record whose whole value is being true is
   * the interesting case rather than a rounding error.
   */
  const clientAt = String(formData.get("clientAt") ?? "");
  const stamped =
    clientAt && !Number.isNaN(Date.parse(clientAt))
      ? new Date(clientAt).toISOString()
      : null;

  if (!initials) return { error: "Initial it first." };

  const list = await checklistFor(slug);
  if (!list) return { error: "That checklist is not available." };
  const night = await nightId(list.id);
  if (!night) return { error: "Could not open tonight." };
  if (await isLocked(night)) return { error: "Tonight is already certified." };

  if (on) {
    const { error } = await db()
      .from("close_ticks")
      .upsert(
        { night_id: night, item_id: itemId, initials, client_at: stamped },
        { onConflict: "night_id,item_id" },
      );
    if (error) return { error: "Could not save that." };

    // Proof can now be collected before the row is signed for — you take the
    // photograph and then put your name to it, rather than the other way
    // round. The tick is where the name arrives, so any shot still unsigned
    // gets it here. Shots already carrying initials keep them: on an item two
    // people worked, the one who took the photograph is the one who took it.
    await db()
      .from("close_proof")
      .update({ initials })
      .eq("night_id", night)
      .eq("item_id", itemId)
      .is("initials", null);
  } else {
    await db()
      .from("close_ticks")
      .delete()
      .eq("night_id", night)
      .eq("item_id", itemId);
    await db()
      .from("close_proof")
      .delete()
      .eq("night_id", night)
      .eq("item_id", itemId);
  }

  revalidatePath(`/close/${slug}`);
  return { error: null };
}

/** A written note is proof: same table, words instead of a file. */
export async function saveNote(
  _prev: CloseState,
  formData: FormData,
): Promise<CloseState> {
  const slug = String(formData.get("slug") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const shotIndex = Number(formData.get("shotIndex") ?? 0);
  const initials = String(formData.get("initials") ?? "")
    .trim()
    .toUpperCase();
  const body = String(formData.get("body") ?? "").trim();

  // No initials required to write the note. Evidence can land before the
  // signature; the tick is what has to be signed, and it backfills this row.

  const list = await checklistFor(slug);
  if (!list) return { error: "That checklist is not available." };
  const night = await nightId(list.id);
  if (!night) return { error: "Could not open tonight." };
  if (await isLocked(night)) return { error: "Tonight is already certified." };

  if (!body) {
    await db()
      .from("close_proof")
      .delete()
      .eq("night_id", night)
      .eq("item_id", itemId)
      .eq("shot_index", shotIndex);
  } else {
    await db()
      .from("close_proof")
      .upsert(
        {
          night_id: night,
          item_id: itemId,
          shot_index: shotIndex,
          kind: "note",
          body,
          // Null, not "", so the tick's backfill can find it.
          initials: initials || null,
        },
        { onConflict: "night_id,item_id,shot_index" },
      );
  }

  revalidatePath(`/close/${slug}`);
  return { error: null };
}

/**
 * A short-lived, path-scoped upload URL, so the file goes straight to storage
 * and the action only ever carries text — the same shape the weekly photos
 * use. The path is generated here, never accepted from the browser.
 */
export async function captureTarget(
  slug: string,
  itemId: string,
  shotIndex: number,
  kind: "photo" | "video",
  /** The real extension, for video — an iPhone records .mov, not .mp4. */
  extension = "",
): Promise<{ error: string | null; path?: string; signedUrl?: string }> {
  const list = await checklistFor(slug);
  if (!list) return { error: "That checklist is not available." };
  const night = await nightId(list.id);
  if (!night) return { error: "Could not open tonight." };
  if (await isLocked(night)) return { error: "Tonight is already certified." };

  // Photos are re-encoded to JPEG in the browser before they get here, so
  // that extension is always true. Video is uploaded as shot.
  const safe = extension
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 5)
    .toLowerCase();
  const ext = kind === "photo" ? "jpg" : safe || "mov";
  const path = `close/${night}/${itemId}/${shotIndex}-${Date.now()}.${ext}`;
  const { data, error } = await db()
    .storage.from(PHOTO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return { error: "Could not start the upload." };
  return { error: null, path, signedUrl: data.signedUrl };
}

/** Records a capture once the file itself is already in storage. */
export async function recordCapture(
  _prev: CloseState,
  formData: FormData,
): Promise<CloseState> {
  const slug = String(formData.get("slug") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const shotIndex = Number(formData.get("shotIndex") ?? 0);
  const kind = String(formData.get("kind") ?? "photo");
  const path = String(formData.get("path") ?? "");
  const initials = String(formData.get("initials") ?? "")
    .trim()
    .toUpperCase();

  // No initials required. Evidence can land before the signature — the tick
  // is what has to be signed, and it backfills these rows when it happens.
  if (kind !== "photo" && kind !== "video") return { error: "Bad capture." };

  const list = await checklistFor(slug);
  if (!list) return { error: "That checklist is not available." };
  const night = await nightId(list.id);
  if (!night) return { error: "Could not open tonight." };
  if (await isLocked(night)) return { error: "Tonight is already certified." };
  if (!path.startsWith(`close/${night}/${itemId}/`)) {
    return { error: "Something went wrong. Try again." };
  }

  await db()
    .from("close_proof")
    .upsert(
      {
        night_id: night,
        item_id: itemId,
        shot_index: shotIndex,
        kind,
        storage_path: path,
        // Null, not "", so the tick's backfill can find it.
        initials: initials || null,
      },
      { onConflict: "night_id,item_id,shot_index" },
    );

  revalidatePath(`/close/${slug}`);
  return { error: null };
}

/** Signing closes the night out. After this it is a record, not a document. */
/**
 * The list as it stands, frozen for the signature.
 *
 * A certified night stops depending on the live tables and becomes a document:
 * these lines, this wording, this proof asked for, ticked by these people. The
 * report recomputed an old night against today's list, so rewriting a line
 * quietly re-measured every night already recorded, and retiring one erased
 * the fact that the job had ever been owed.
 *
 * Editing tonight's list stays free. It simply no longer reaches backwards.
 */
async function listAtSigning(checklistId: string, nightRow: string) {
  const { data: items } = await db()
    .from("close_items")
    .select("id, position, title, detail, proof")
    .eq("checklist_id", checklistId)
    .eq("active", true)
    .order("position");

  const { data: ticks } = await db()
    .from("close_ticks")
    .select("item_id, initials, created_at")
    .eq("night_id", nightRow);

  const tick = new Map(
    (
      (ticks ?? []) as {
        item_id: string;
        initials: string;
        created_at: string;
      }[]
    ).map((t) => [t.item_id, t]),
  );

  return (
    (items ?? []) as {
      id: string;
      position: number;
      title: string;
      detail: string[];
      proof: unknown;
    }[]
  ).map((item) => {
    const t = tick.get(item.id);
    return {
      item_id: item.id,
      position: item.position,
      title: item.title,
      detail: item.detail,
      proof: item.proof,
      ticked: Boolean(t),
      initials: t?.initials ?? null,
      ticked_at: t?.created_at ?? null,
    };
  });
}

export async function certifyNight(
  _prev: CloseState,
  formData: FormData,
): Promise<CloseState> {
  const slug = String(formData.get("slug") ?? "");
  const who = String(formData.get("certifiedBy") ?? "").trim();
  const attestation = String(formData.get("attestation") ?? "").trim();
  const signature = String(formData.get("signature") ?? "");
  const openAtSigning = String(formData.get("openAtSigning") ?? "[]");

  if (!who) return { error: "Say who is certifying." };
  if (!signature) return { error: "A signature is required." };

  const list = await checklistFor(slug);
  if (!list) return { error: "That checklist is not available." };
  const night = await nightId(list.id);
  if (!night) return { error: "Could not open tonight." };
  if (await isLocked(night)) return { error: "Tonight is already certified." };

  const frozen = await listAtSigning(list.id, night);

  const { error } = await db()
    .from("close_nights")
    .update({
      certified_at: new Date().toISOString(),
      certified_by: who,
      // Written once, never updated. See supabase/014_close_signed_list.sql.
      list_at_signing: frozen,
      // Verbatim: if the wording ever changes, the record still shows what
      // this person put their name to.
      attestation,
      signature,
      open_at_signing: safeJson(openAtSigning),
    })
    .eq("id", night);

  if (error) return { error: "Could not certify that. Try again." };

  revalidatePath(`/close/${slug}`);
  return { error: null };
}

/**
 * Unlocks a certified night, on a manager's PIN.
 *
 * Someone signs at 1am, then finds the back door was never actually checked.
 * Without this the only honest options are to leave the record wrong or to
 * call whoever has database access, and the first one is what actually
 * happens.
 *
 * The signature is not discarded. It moves into history, so the record shows
 * that Brian certified at 1:04, a manager reopened it, and it was certified
 * again — which is more useful than either version alone, and is the reason
 * this is an unlock rather than a delete.
 *
 * Admin PINs for now. A manager who is not an admin cannot do this yet, and
 * that is the next question to answer rather than something to guess at.
 */
export async function reopenNight(
  _prev: CloseState,
  formData: FormData,
): Promise<CloseState> {
  const slug = String(formData.get("slug") ?? "");
  const pin = String(formData.get("pin") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!(await isAdminPin(pin))) {
    return { error: "That PIN doesn't match. Try again." };
  }

  const list = await checklistFor(slug);
  if (!list) return { error: "That checklist is not available." };

  const { data } = await db()
    .from("close_nights")
    .select(
      "id, certified_at, certified_by, attestation, signature, open_at_signing, history",
    )
    .eq("checklist_id", list.id)
    .eq("night", currentNight())
    .maybeSingle();

  const row = data as {
    id: string;
    certified_at: string | null;
    certified_by: string | null;
    attestation: string | null;
    signature: string | null;
    open_at_signing: unknown;
    history: unknown[] | null;
  } | null;

  if (!row) return { error: "Nothing has been recorded tonight." };
  if (!row.certified_at) return { error: "Tonight is not locked." };

  const { error } = await db()
    .from("close_nights")
    .update({
      history: [
        ...(row.history ?? []),
        {
          certified_at: row.certified_at,
          certified_by: row.certified_by,
          attestation: row.attestation,
          signature: row.signature,
          open_at_signing: row.open_at_signing,
          reopened_at: new Date().toISOString(),
          reason: reason || null,
        },
      ],
      certified_at: null,
      certified_by: null,
      attestation: null,
      signature: null,
      open_at_signing: null,
    })
    .eq("id", row.id)
    // Only unlock the night we just read. Two managers on the same PIN would
    // otherwise write history twice and the second would archive an empty
    // signature over the first.
    .not("certified_at", "is", null);

  if (error) return { error: "Could not reopen that. Try again." };

  revalidatePath(`/close/${slug}`);
  return { error: null };
}
