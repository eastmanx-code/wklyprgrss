"use server";

import { redirect } from "next/navigation";

import { setCloseVenue } from "@/lib/close-venue";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Put a venue into the close programme, and go there.
 *
 * Membership of the close is its own flag rather than a venue simply having a
 * list written against it. Somebody has to decide a building is running the
 * nightly close before its first list exists, and until they do the venue is
 * not failing the programme, it is not in it. Reading membership off the
 * presence of a list would have meant a venue joining by accident the moment
 * anybody typed a row into it.
 */
export async function enrolVenue(formData: FormData): Promise<void> {
  const session = await getSession();
  if (session?.role !== "admin") redirect("/");

  const venueId = String(formData.get("venueId") ?? "");
  if (!UUID.test(venueId)) redirect("/close/locations");

  const { error } = await db()
    .from("venues")
    .update({ close_active: true })
    .eq("id", venueId);
  if (error) throw new Error(error.message);

  await setCloseVenue(venueId);
  redirect("/close");
}
