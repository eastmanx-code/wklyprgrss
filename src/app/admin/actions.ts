"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";
import type { Item } from "@/lib/types";

export type AdminState = { error: string | null };

const OK: AdminState = { error: null };
const MAX_TITLE_LENGTH = 120;

async function isAdmin(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}

function refresh(venueId: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/venue/${venueId}`);
  revalidatePath("/board");
  revalidatePath(`/board/${venueId}`);
  revalidatePath("/venue");
}

async function itemsFor(venueId: string): Promise<Item[]> {
  const { data, error } = await db()
    .from("items")
    .select("id, venue_id, title, position, active")
    .eq("venue_id", venueId)
    .order("position")
    .order("title");
  if (error) throw new Error(error.message);
  return (data ?? []) as Item[];
}

/** Rewrite positions to a clean 1..n so reordering stays predictable. */
async function normalizePositions(items: Item[]) {
  await Promise.all(
    items.map((item, index) =>
      item.position === index + 1
        ? Promise.resolve()
        : db().from("items").update({ position: index + 1 }).eq("id", item.id),
    ),
  );
}

export async function addItem(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  if (!(await isAdmin())) return { error: "Not signed in." };

  const venueId = String(formData.get("venueId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!venueId) return { error: "Missing venue." };
  if (!title) return { error: "Give the item a title." };
  if (title.length > MAX_TITLE_LENGTH) return { error: "That title is too long." };

  const existing = await itemsFor(venueId);
  const { error } = await db()
    .from("items")
    .insert({ venue_id: venueId, title, position: existing.length + 1, active: true });
  if (error) return { error: "Could not add that item." };

  refresh(venueId);
  return OK;
}

export async function renameItem(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  if (!(await isAdmin())) return { error: "Not signed in." };

  const itemId = String(formData.get("itemId") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title can't be empty." };
  if (title.length > MAX_TITLE_LENGTH) return { error: "That title is too long." };

  const { error } = await db().from("items").update({ title }).eq("id", itemId);
  if (error) return { error: "Could not rename that item." };

  refresh(venueId);
  return OK;
}

/** Deactivating hides the item going forward and keeps all of its history. */
export async function setItemActive(formData: FormData) {
  if (!(await isAdmin())) return;

  const itemId = String(formData.get("itemId") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  await db().from("items").update({ active }).eq("id", itemId);
  await normalizePositions(await itemsFor(venueId));
  refresh(venueId);
}

export async function moveItem(formData: FormData) {
  if (!(await isAdmin())) return;

  const itemId = String(formData.get("itemId") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const direction = String(formData.get("direction") ?? "");

  const items = await itemsFor(venueId);
  const index = items.findIndex((item) => item.id === itemId);
  if (index < 0) return;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) return;

  [items[index], items[target]] = [items[target], items[index]];
  await normalizePositions(items);
  refresh(venueId);
}

export async function updateVenuePin(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  if (!(await isAdmin())) return { error: "Not signed in." };

  const venueId = String(formData.get("venueId") ?? "");
  const pin = String(formData.get("pin") ?? "").trim();
  if (!/^\d{4,8}$/.test(pin)) return { error: "PIN must be 4–8 digits." };

  const { error } = await db().from("venues").update({ pin }).eq("id", venueId);
  if (error) return { error: "Could not update that PIN." };

  refresh(venueId);
  return OK;
}
