import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * The thirty-night report moved onto the store dash at /checklists, which is
 * now what a shift lands on. This route stays so the old links keep working
 * and sends the reader to the one place the report lives.
 *
 * An admin arrives carrying a venue code: enter that building (which sets the
 * working venue) and the dash shows it. Anybody else has one venue already, so
 * the dash is theirs.
 */
export default async function RollupRedirect({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  if (session.role !== "admin") redirect("/checklists");

  const code = (await searchParams).code?.toUpperCase();
  if (!code) redirect("/checklists/locations");

  const { data } = await db()
    .from("venues")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  const id = (data as { id: string } | null)?.id;
  if (!id) redirect("/checklists/locations");

  // Enter sets the working venue in a cookie, then lands on the store dash.
  redirect(`/checklists/enter/${id}`);
}
