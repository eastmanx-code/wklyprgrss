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
  const session = await getSession();
  if (session?.role !== "admin") redirect(notAdminGoesTo(Boolean(session)));

  const snap = await snapshot();
  return <MembersPipeline snap={snap} />;
}
