"use server";

import { redirect } from "next/navigation";

import { pinMatches, startManagerSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export type SignupState = { error: string | null };

const NAME_MAX = 120;

// A public door with no login behind it. The rest of the app throttles
// nothing, so this one does: too many wrong venue PINs against one venue in a
// short window and its link goes quiet. A six-digit PIN is a small space, and
// this endpoint is the only place a signed-out person can try it.
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const FAIL_LIMIT = 5;

// Deliberately identical whether the token is unknown, enrolment is closed, or
// the venue PIN is wrong. A stranger with a stale link learns nothing about
// which of the three it was.
const GENERIC = "That did not work. Check the venue PIN with your GM.";

/**
 * Enrol a manager at a venue from its signup link.
 *
 * The token in the link says which venue. The venue PIN says the person belongs
 * to it. Together they stand in for the admin who used to type the code by hand:
 * the person names themselves and picks their own six digits, and a row lands
 * in admin_pins exactly as the admin screen would have made it.
 */
export async function enrollManager(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const token = String(formData.get("token") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "").trim();
  const venuePin = String(formData.get("venuePin") ?? "").trim();

  if (!token) return { error: GENERIC };
  if (!name)
    return { error: "Put your name in, so the GM knows the code is yours." };
  if (name.length > NAME_MAX) return { error: "That name is too long." };
  if (!/^\d{6}$/.test(pin)) return { error: "Your code must be 6 digits." };
  if (pin !== confirm) return { error: "The two codes do not match." };

  const { data } = await db()
    .from("venues")
    .select("id, pin, signup_open")
    .eq("signup_token", token)
    .maybeSingle();
  const venue = data as {
    id: string;
    pin: string;
    signup_open: boolean;
  } | null;
  if (!venue || !venue.signup_open) return { error: GENERIC };

  // Throttle on this venue's recent failures, read before the PIN is checked so
  // a venue under a guessing run stops answering rather than keeps scoring.
  const since = new Date(Date.now() - FAIL_WINDOW_MS).toISOString();
  const { count: fails } = await db()
    .from("signup_attempts")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venue.id)
    .eq("ok", false)
    .gte("created_at", since);
  if ((fails ?? 0) >= FAIL_LIMIT) {
    return {
      error: "Too many tries. Give it a few minutes, then ask your GM.",
    };
  }

  if (!pinMatches(venuePin, venue.pin)) {
    await db().from("signup_attempts").insert({ venue_id: venue.id, ok: false });
    return { error: GENERIC };
  }

  const { error } = await db()
    .from("admin_pins")
    .insert({ pin, label: name, venue_id: venue.id });
  if (error) {
    // Codes are unique across the whole company, so a clash is a UX bump rather
    // than a wrong PIN. It is not counted against the throttle.
    if (error.code === "23505")
      return { error: "That code is taken. Pick a different six digits." };
    return { error: "Could not set that up. Try again." };
  }

  await db().from("signup_attempts").insert({ venue_id: venue.id, ok: true });
  await startManagerSession(venue.id);
  redirect("/home");
}
