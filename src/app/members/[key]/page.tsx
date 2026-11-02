import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MembersPipeline } from "@/components/MembersPipeline";
import { MEMBERS_VIEW_KEY } from "@/lib/env";
import { snapshot } from "@/lib/peoplevine";

export const dynamic = "force-dynamic";

/**
 * NOINDEX IS NOT OPTIONAL ON THIS ROUTE. An open URL carrying member names and
 * balances gets crawled the first time it is pasted anywhere that leaks a
 * referrer, and after that it is in a search index and out of our hands.
 */
export const metadata: Metadata = {
  title: "The Reading Club Membership",
  robots: { index: false, follow: false, nocache: true },
};

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
