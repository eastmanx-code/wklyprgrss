import { notFound, redirect } from "next/navigation";

import { setCloseVenue } from "@/lib/close-venue";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Postgres rejects a malformed uuid rather than returning no rows. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Enter a venue, then carry on to its positions.
 *
 * A route rather than a form, so picking a location off the list is one tap
 * and the back button behaves. It writes the cookie the rest of the checklist
 * screens read and immediately hands over to the clipboard, so nothing is ever
 * rendered from this path.
 */
export default async function EnterVenuePage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");
  // Only an admin picks a venue. A leader's venue is their session, and
  // letting this route write the cookie would let one venue read another's.
  if (session.role !== "admin") redirect("/close");

  const { venueId } = await params;
  if (!UUID.test(venueId)) notFound();

  const { data } = await db()
    .from("venues")
    .select("id")
    .eq("id", venueId)
    .maybeSingle();
  if (!data) notFound();

  await setCloseVenue(venueId);
  redirect("/close");
}
