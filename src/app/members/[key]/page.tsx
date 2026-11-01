import { notFound } from "next/navigation";

import { MembersPipeline } from "@/components/MembersPipeline";
import { MEMBERS_VIEW_KEY } from "@/lib/env";
import { snapshot } from "@/lib/peoplevine";

export const dynamic = "force-dynamic";

/**
 * The same board behind a shared secret in the URL, so B can hand the link to
 * the onsite team without issuing them a login.
 *
 * WHY A KEY AND NOT AN OPEN PAGE. This page names members and what they owe. An
 * unlisted URL is not protection: anything reachable gets crawled, and a
 * referrer or a pasted link leaks it. The key makes the URL itself the
 * credential, which is the same shape the checklist signup links already use.
 *
 * With MEMBERS_VIEW_KEY unset the route 404s rather than opening, because the
 * failure mode of defaulting open is member balances on the public internet.
 */
export default async function SharedMembersPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const expected = MEMBERS_VIEW_KEY();
  const { key } = await params;
  if (!expected || key !== expected) notFound();

  const snap = await snapshot();
  return <MembersPipeline snap={snap} />;
}
