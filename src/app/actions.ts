"use server";

import { redirect } from "next/navigation";

import { isAdminPin } from "@/lib/admin-pin";
import { safeNext } from "@/lib/app";
import {
  endSession,
  pinMatches,
  startAdminSession,
  startLeaderSession,
} from "@/lib/session";
import { getVenue } from "@/lib/status";

export type FormState = { error: string | null };

/** Deliberately identical for unknown venue and wrong PIN. */
const GENERIC_ERROR = "That PIN doesn't match. Try again.";

export async function leaderLogin(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const venueId = String(formData.get("venueId") ?? "");
  const pin = String(formData.get("pin") ?? "");

  if (!venueId) return { error: "Choose a venue first." };
  if (!pin) return { error: GENERIC_ERROR };

  const venue = await getVenue(venueId);
  if (!venue || !pinMatches(pin, venue.pin)) return { error: GENERIC_ERROR };

  await startLeaderSession(venue.id);
  // Where the link asked for, when it asked. A QR in the prep room lands on
  // the checklists rather than on a home screen nobody there has a use for.
  redirect(safeNext(String(formData.get("next") ?? "") || undefined));
}

export async function adminLogin(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const pin = String(formData.get("pin") ?? "");
  if (!(await isAdminPin(pin))) return { error: GENERIC_ERROR };

  await startAdminSession();
  redirect("/home");
}

export async function logout() {
  await endSession();
  redirect("/");
}
