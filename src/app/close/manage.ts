"use server";

import { revalidatePath } from "next/cache";

import {
  MAX_ROLE_LENGTH,
  PHASE_ORDER,
  slugFor,
  type House,
  type Phase,
} from "@/lib/checklists";
import type { ProofKind, Shot } from "@/lib/close-checklist";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

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

/** The venue this session may write to, or null. */
async function venueId(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.role === "leader") return session.venueId;
  const { data } = await db()
    .from("venues")
    .select("id")
    .eq("code", "HAWK")
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
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
  if (shots.length > MAX_SHOTS) return "That is more proof than one item needs.";
  return shots;
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
  if (!PHASE_ORDER.includes(phase)) return { error: "Pick open, mid or close." };
  if (!role) return { error: "Name the role this list belongs to." };
  if (role.length > MAX_ROLE_LENGTH) return { error: "That role name is too long." };

  // Reactivating rather than inserting: a venue that retires a list and then
  // wants it back should get its history, not a fresh empty one beside it.
  const { data: existing } = await db()
    .from("close_checklists")
    .select("id, active")
    .eq("venue_id", venue)
    .eq("house", house)
    .eq("role", role)
    .eq("phase", phase)
    .maybeSingle();

  const found = existing as { id: string; active: boolean } | null;
  if (found) {
    if (found.active) return { error: "That list already exists." };
    await db().from("close_checklists").update({ active: true }).eq("id", found.id);
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

  await db().from("close_checklists").update({ active: false }).eq("id", list.id);
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

  await db().from("close_checklists").update({ active: true }).eq("id", list.id);
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

  // Position from the end of the list, active or not, so a retired item's
  // number is never handed to a new one.
  const { data: last } = await db()
    .from("close_items")
    .select("position")
    .eq("checklist_id", list.id)
    .order("position", { ascending: false })
    .limit(1);
  const position = ((last as { position: number }[] | null)?.[0]?.position ?? 0) + 1;

  const { error } = await db()
    .from("close_items")
    .insert({ checklist_id: list.id, position, title, detail, proof });
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

  const { error } = await db()
    .from("close_items")
    .update({ title, detail, proof })
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

  await db().from("close_items").update({ active: false }).eq("id", owned.item.id);
  revalidateFor(owned.list);
  return { error: null, ok: true };
}

export async function restoreItem(
  _prev: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const owned = await ownedItem(String(formData.get("itemId") ?? ""));
  if (!owned) return { error: "That item is not available." };

  await db().from("close_items").update({ active: true }).eq("id", owned.item.id);
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
  await db().from("close_items").update({ position: swapWith.position }).eq("id", mine.id);
  await db().from("close_items").update({ position: mine.position }).eq("id", swapWith.id);

  revalidateFor(owned.list);
  return { error: null, ok: true };
}
