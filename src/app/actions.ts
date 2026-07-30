"use server";

import { redirect } from "next/navigation";

import { ADMIN_PIN } from "@/lib/env";
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
  redirect("/venue");
}

export async function adminLogin(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const pin = String(formData.get("pin") ?? "");
  if (!pin || !pinMatches(pin, ADMIN_PIN())) return { error: GENERIC_ERROR };

  await startAdminSession();
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/");
}
