"use server";

import { revalidatePath } from "next/cache";

import {
  MAX_ROLE_LENGTH,
  PHASE_ORDER,
  slugFor,
  type House,
  type Phase,
} from "@/lib/checklists";
import type { ProofKind, Reference, Shot } from "@/lib/close-checklist";
import { closeVenueId } from "@/lib/close-venue";
import { PHOTO_BUCKET, db } from "@/lib/supabase";

/**
 * Writing the lists, rather than walking them.
 *
 * A venue owns its checklists. It invents its own roles, writes its own items,
 * and retires them when the job changes — the same rule the weekly items
 * already follow, and the reason there is no admin queue between a GM noticing
 * a wording problem and fixing it.
 *
 * Nothing here deletes. Retiring hides a list or an item from tonight and
 * leaves every night it was ever part of intact, because "we stopped checking
 * the back door in March" is exactly what the report exists to show, and a
 * delete takes that with it.
 */

export type ManageState = { error: string | null; ok?: boolean };

const MAX_TITLE = 200;
const MAX_DETAIL_LINE = 400;
const MAX_DETAIL_LINES = 12;
const MAX_PROMPT = 200;
const MAX_SHOTS = 6;
const MAX_REFERENCES = 4;
const MAX_SECTION = 60;

/**
 * The heading an item sits under, off the form.
 *
 * Blank means no heading, which is the normal case and has to stay cheap to
 * say: a list written in the app has none until somebody decides it needs one.
 */
function readSection(formData: FormData): string | null {
  const raw = String(formData.get("section") ?? "").trim();
  return raw || null;
}

/** The venue this session may write to, or null. */
async function venueId(): Promise<string | null> {
  return closeVenueId();
}

/** A checklist row, if it belongs to this session's venue. */
async function ownedChecklist(checklistId: string) {
  const venue = await venueId();
  if (!venue) return null;
  const { data } = await db()
    .from("close_checklists")
    .select("id, venue_id, house, role, phase")
    .eq("id", checklistId)
    .maybeSingle();
  const row = data as {
    id: string;
    venue_id: string;
    house: House;
    role: string;
    phase: Phase;
  } | null;
  if (!row || row.venue_id !== venue) return null;
  return row;
}

/** An item, and the list it belongs to, if this session may write to it. */
async function ownedItem(itemId: string) {
  const { data } = await db()
    .from("close_items")
    .select("id, checklist_id, position, title, detail, proof")
    .eq("id", itemId)
    .maybeSingle();
  const item = data as {
    id: string;
    checklist_id: string;
    position: number;
    title: string;
    detail: string[];
    proof: Shot[];
  } | null;
  if (!item) return null;
  const list = await ownedChecklist(item.checklist_id);
  return list ? { item, list } : null;
}

function revalidateFor(list: { house: House; role: string; phase: Phase }) {
  const slug = slugFor(list.house, list.role, list.phase);
  revalidatePath("/close");
  revalidatePath(`/close/${slug}`);
  revalidatePath(`/close/${slug}/edit`);
}

/**
 * Reads the proof shots off the form.
 *
 * Each shot is a kind and the thing it has to show. The prompt is not
 * decoration — it is the whole mechanism by which a photo can be judged
 * without anything judging it, so a shot with no prompt is rejected rather
 * than saved empty.
 *
 * An item that asks for nothing stores `[]` — the column is not-null and
 * defaults to it, so that is the schema's own word for "no proof required".
 * The reading side has to say so too: `[]` is truthy, and code that branched
 * on `item.proof` alone read an item asking for nothing as an item asking for
 * a shot that was not there. Normalised where it is read, not here.
 */
function readShots(formData: FormData): Shot[] | string {
  const kinds = formData.getAll("shotKind").map(String);
  const prompts = formData.getAll("shotPrompt").map(String);
  const shots: Shot[] = [];
  for (let i = 0; i < kinds.length; i += 1) {
    const prompt = (prompts[i] ?? "").trim();
    const kind = kinds[i] as ProofKind;
    if (!prompt) continue;
    if (kind !== "photo" && kind !== "video" && kind !== "note") {
      return "That proof type is not one of photo, video or written.";
    }
    if (prompt.length > MAX_PROMPT) return "That prompt is too long.";
    shots.push({ kind, prompt });
  }
  if (shots.length > MAX_SHOTS)
    return "That is more proof than one item needs.";
  return shots;
}

/**
 * The reference slots, read off the same form as everything else.
 *
 * A caption with no photograph is kept, not dropped. That is the placeholder:
 * a manager writes "the well, stocked" tonight and photographs it on Friday,
 * and in between the item can say out loud that the standard exists and the
 * picture does not.
 */
function readReferences(formData: FormData): Reference[] | string {
  const captions = formData.getAll("refCaption").map(String);
  const paths = formData.getAll("refPath").map(String);
  const out: Reference[] = [];
  for (let i = 0; i < captions.length; i += 1) {
    const caption = (captions[i] ?? "").trim();
    if (!caption) continue;
    if (caption.length > MAX_PROMPT) return "That caption is too long.";
    const path = (paths[i] ?? "").trim();
    out.push({ caption, path: path || null });
  }
  if (out.length > MAX_REFERENCES) {
    return "That is more reference shots than one item needs.";
  }
  return out;
}

function readDetail(raw: string): string[] | string {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > MAX_DETAIL_LINES) return "That is too many lines.";
  if (lines.some((line) => line.length > MAX_DETAIL_LINE)) {
    return "One of those lines is too long.";
  }
  return lines;
}

/** Starts a list for a role this venue actually runs. */
export async function createChecklist(
  _prev: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const venue = await venueId();
  if (!venue) return { error: "You are not signed in." };

  const house = String(formData.get("house") ?? "") as House;
  const phase = String(formData.get("phase") ?? "") as Phase;
  const role = String(formData.get("role") ?? "").trim();

  if (house !== "FOH" && house !== "HOH") {
    return { error: "Pick front of house or heart of house." };
  }
  if (!PHASE_ORDER.includes(phase))
    return { error: "Pick open, mid or close." };
  if (!role) return { error: "Name the role this list belongs to." };
  if (role.length > MAX_ROLE_LENGTH)
    return { error: "That role name is too long." };

  // Matched on the address, not on the exact letters.
  //
  // The unique constraint compares role text exactly; slugFor lowercases it
  // and collapses everything that is not a letter or a digit. So "MOD" and
  // "mod" are two rows to the database and one URL to the app, and Night Hawk
  // has both — two lists fighting over the same address, one of which can
  // never be reached. "Bar Back" and "bar-back" do it too.
  //
  // Comparing the way the address is computed is the only rule that cannot
  // drift from it. A venue has a handful of lists, so this is a small read.
  const wanted = slugFor(house, role, phase);
  const { data: siblings } = await db()
    .from("close_checklists")
    .select("id, house, role, phase, active")
    .eq("venue_id", venue);

  const found =
    (
      (siblings ?? []) as {
        id: string;
        house: House;
        role: string;
        phase: Phase;
        active: boolean;
      }[]
    ).find((row) => slugFor(row.house, row.role, row.phase) === wanted) ?? null;
  if (found) {
    if (found.active) return { error: "That list already exists." };
    await db()
      .from("close_checklists")
      .update({ active: true })
      .eq("id", found.id);
    revalidateFor({ house, role, phase });
    return { error: null, ok: true };
  }

  const { error } = await db()
    .from("close_checklists")
    .insert({ venue_id: venue, house, role, phase });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "That list already exists."
          : "Could not create that list. Try again.",
    };
  }

  revalidateFor({ house, role, phase });
  return { error: null, ok: true };
}

/** Hides a list from tonight. Every night it was part of stays intact. */
export async function retireChecklist(
  _prev: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const list = await ownedChecklist(String(formData.get("checklistId") ?? ""));
  if (!list) return { error: "That list is not available." };

  await db()
    .from("close_checklists")
    .update({ active: false })
    .eq("id", list.id);
  revalidateFor(list);
  return { error: null, ok: true };
}

/** Puts a retired list back on the clipboard, history and all. */
export async function restoreChecklist(
  _prev: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const list = await ownedChecklist(String(formData.get("checklistId") ?? ""));
  if (!list) return { error: "That list is not available." };

  await db()
    .from("close_checklists")
    .update({ active: true })
    .eq("id", list.id);
  revalidateFor(list);
  return { error: null, ok: true };
}

export async function addItem(
  _prev: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const list = await ownedChecklist(String(formData.get("checklistId") ?? ""));
  if (!list) return { error: "That list is not available." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the item a name." };
  if (title.length > MAX_TITLE) return { error: "That name is too long." };

  const detail = readDetail(String(formData.get("detail") ?? ""));
  if (typeof detail === "string") return { error: detail };
  const proof = readShots(formData);
  if (typeof proof === "string") return { error: proof };
  const reference = readReferences(formData);
  if (typeof reference === "string") return { error: reference };
  const section = readSection(formData);
  if (section !== null && section.length > MAX_SECTION) {
    return { error: "That heading is too long." };
  }

  // Position from the end of the list, active or not, so a retired item's
  // number is never handed to a new one.
  const { data: last } = await db()
    .from("close_items")
    .select("position")
    .eq("checklist_id", list.id)
    .order("position", { ascending: false })
    .limit(1);
  const position =
    ((last as { position: number }[] | null)?.[0]?.position ?? 0) + 1;

  const { error } = await db().from("close_items").insert({
    checklist_id: list.id,
    position,
    title,
    detail,
    proof,
    reference,
    section,
  });
  if (error) return { error: "Could not add that. Try again." };

  revalidateFor(list);
  return { error: null, ok: true };
}

export async function updateItem(
  _prev: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const owned = await ownedItem(String(formData.get("itemId") ?? ""));
  if (!owned) return { error: "That item is not available." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the item a name." };
  if (title.length > MAX_TITLE) return { error: "That name is too long." };

  const detail = readDetail(String(formData.get("detail") ?? ""));
  if (typeof detail === "string") return { error: detail };
  const proof = readShots(formData);
  if (typeof proof === "string") return { error: proof };
  const reference = readReferences(formData);
  if (typeof reference === "string") return { error: reference };
  const section = readSection(formData);
  if (section !== null && section.length > MAX_SECTION) {
    return { error: "That heading is too long." };
  }

  const { error } = await db()
    .from("close_items")
    .update({ title, detail, proof, reference, section })
    .eq("id", owned.item.id);
  if (error) return { error: "Could not save that. Try again." };

  revalidateFor(owned.list);
  return { error: null, ok: true };
}

/**
 * A signed URL for a manager to put a reference photograph behind.
 *
 * Keyed on the item rather than on a night: this picture is the standard, not
 * evidence of one shift, and it outlives every night it is shown on. Stamped
 * with the clock so replacing one leaves the old file alone rather than
 * fighting a cache — the row points at the new path and nothing points at the
 * old one.
 */
export async function referenceTarget(
  itemId: string,
  slot: number,
): Promise<{ error: string | null; path?: string; signedUrl?: string }> {
  const owned = await ownedItem(itemId);
  if (!owned) return { error: "That item is not available." };
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_REFERENCES) {
    return { error: "That is not a reference slot." };
  }

  // Re-encoded to JPEG in the browser before it gets here, same as the rest.
  const path = `close/ref/${itemId}/${slot}-${Date.now()}.jpg`;
  const { data, error } = await db()
    .storage.from(PHOTO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return { error: "Could not start the upload." };
  return { error: null, path, signedUrl: data.signedUrl };
}

/**
 * Attaches an uploaded reference to a slot, or clears one back to a
 * placeholder when no path is given.
 *
 * Saved on the spot rather than waiting for the form. A photograph parked in a
 * hidden field until somebody remembers to press Save is a photograph that
 * gets lost when they close the tab, and they have already walked to the bar
 * and taken it.
 *
 * The whole list of captions comes up with it, exactly as the manager has it
 * on screen. Writing only the one slot was tidier and wrong: captions can be
 * added and removed before anything is saved, so slot two on the screen is not
 * always slot two on the row, and the photograph would land under somebody
 * else's caption.
 */
export async function setReference(
  _prev: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const owned = await ownedItem(String(formData.get("itemId") ?? ""));
  if (!owned) return { error: "That item is not available." };

  const rows = readReferences(formData);
  if (typeof rows === "string") return { error: rows };

  const slot = Number(formData.get("slot") ?? -1);
  if (!Number.isInteger(slot) || slot < 0 || slot >= rows.length) {
    return { error: "Name the shot before you take it." };
  }

  const path = String(formData.get("path") ?? "").trim();
  if (path && !path.startsWith(`close/ref/${owned.item.id}/`)) {
    return { error: "Something went wrong. Try again." };
  }

  const next = rows.map((ref, i) =>
    i === slot ? { ...ref, path: path || null } : ref,
  );
  const { error } = await db()
    .from("close_items")
    .update({ reference: next })
    .eq("id", owned.item.id);
  if (error) return { error: "Could not save that. Try again." };

  revalidateFor(owned.list);
  return { error: null, ok: true };
}

/**
 * Retires an item. Not a delete: the ticks and photographs from every night it
 * was checked hang off this row, and the report is built out of them.
 */
export async function retireItem(
  _prev: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const owned = await ownedItem(String(formData.get("itemId") ?? ""));
  if (!owned) return { error: "That item is not available." };

  await db()
    .from("close_items")
    .update({ active: false })
    .eq("id", owned.item.id);
  revalidateFor(owned.list);
  return { error: null, ok: true };
}

export async function restoreItem(
  _prev: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const owned = await ownedItem(String(formData.get("itemId") ?? ""));
  if (!owned) return { error: "That item is not available." };

  await db()
    .from("close_items")
    .update({ active: true })
    .eq("id", owned.item.id);
  revalidateFor(owned.list);
  return { error: null, ok: true };
}

/**
 * Swaps an item with its neighbour.
 *
 * Two updates against a unique (checklist_id, position), so the first one has
 * to land somewhere legal: the neighbour is parked on a negative position
 * while the pair change places. Negative numbers never survive the call, and
 * nothing reads position while it is parked because the whole thing is one
 * request.
 */
export async function moveItem(
  _prev: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const owned = await ownedItem(String(formData.get("itemId") ?? ""));
  if (!owned) return { error: "That item is not available." };
  const up = String(formData.get("direction") ?? "") === "up";

  const { data: siblings } = await db()
    .from("close_items")
    .select("id, position")
    .eq("checklist_id", owned.item.checklist_id)
    .eq("active", true)
    .order("position");

  const rows = (siblings ?? []) as { id: string; position: number }[];
  const index = rows.findIndex((row) => row.id === owned.item.id);
  const swapWith = rows[index + (up ? -1 : 1)];
  if (index === -1 || !swapWith) return { error: null, ok: true };

  const mine = rows[index];
  await db().from("close_items").update({ position: -1 }).eq("id", swapWith.id);
  await db()
    .from("close_items")
    .update({ position: swapWith.position })
    .eq("id", mine.id);
  await db()
    .from("close_items")
    .update({ position: mine.position })
    .eq("id", swapWith.id);

  revalidateFor(owned.list);
  return { error: null, ok: true };
}
