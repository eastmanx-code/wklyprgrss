import { redirect } from "next/navigation";

import { closeVenueId } from "@/lib/close-venue";
import { currentNight } from "@/lib/night";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Gone, and pointing where it went.
 *
 * This was the group's night report: every venue, worst first, with the
 * failed lists under each. It was also the locations screen with a
 * different heading, and every fix had to land on both. The locations
 * screen is the report now. A leader or a manager, who only ever saw their
 * own venue here, goes to that venue's night.
 */
export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ night?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const asked = (await searchParams).night;
  const night = asked && NIGHT.test(asked) ? asked : currentNight();

  if (session.role === "admin")
    redirect(`/checklists/locations?night=${night}`);

  const mine = await closeVenueId(session);
  const { data } = mine
    ? await db().from("venues").select("code").eq("id", mine).maybeSingle()
    : { data: null };
  const code = (data as { code: string } | null)?.code;
  redirect(
    code ? `/checklists/compliance/${code}?night=${night}` : "/checklists",
  );
}
