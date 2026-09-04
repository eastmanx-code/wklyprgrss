import { NextResponse } from "next/server";

import { setCloseVenue } from "@/lib/close-venue";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Postgres rejects a malformed uuid rather than returning no rows. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Enter a venue, then carry on to its lists.
 *
 * A route handler, and it has to be one: this writes a cookie, and Next only
 * permits that from a handler or a server action. It was a page, which meant
 * every attempt to open a venue threw before it rendered anything — the one
 * path every admin takes to reach a checklist. Nothing catches that but using
 * it.
 *
 * Still a plain link rather than a form, so picking a location off the list is
 * one tap and the back button behaves. Nothing is ever rendered from here.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ venueId: string }> },
): Promise<NextResponse> {
  const home = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));

  const session = await getSession();
  if (!session) return home("/");
  // Only an admin picks a venue. A leader's venue is their session, and
  // letting this route write the cookie would let one venue read another's.
  if (session.role !== "admin") return home("/close");

  const { venueId } = await params;
  // Back to the list rather than a dead end: a bad id here means a stale link,
  // and the thing the person wanted is one screen up.
  if (!UUID.test(venueId)) return home("/close/locations");

  const { data } = await db()
    .from("venues")
    .select("id")
    .eq("id", venueId)
    .maybeSingle();
  if (!data) return home("/close/locations");

  await setCloseVenue(venueId);
  return home("/close");
}
