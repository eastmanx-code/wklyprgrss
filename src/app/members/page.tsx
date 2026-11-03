import { redirect } from "next/navigation";

import { MembersPipeline } from "@/components/MembersPipeline";
import { notAdminGoesTo } from "@/lib/app";
import { snapshot } from "@/lib/peoplevine";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The Reading Club membership board, for whoever is signed in as admin.
 *
 * Deliberately not in the menu. B, 2026-10-31: "On the site is fine but doesnt
 * need to be linked direct" and "I can have just a link I share". The shareable
 * form is /members/<key>, which needs no login. This one is the signed in door.
 */
export default async function MembersPage() {
  // Carry the destination to the door. Nothing links to this page, so landing
  // on the dashboard after signing in leaves no way back to it.
  const session = await getSession();
  if (session?.role !== "admin") {
    const door = notAdminGoesTo(Boolean(session));
    redirect(door === "/admin/login" ? "/admin/login?next=/members" : door);
  }

  const snap = await snapshot();
  return <MembersPipeline snap={snap} />;
}
