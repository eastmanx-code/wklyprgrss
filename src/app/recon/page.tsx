import type { Metadata } from "next";

import { MembersPipeline } from "@/components/MembersPipeline";
import { snapshot } from "@/lib/peoplevine";

export const dynamic = "force-dynamic";

/**
 * The membership board on an open URL, for review.
 *
 * NO KEY AND NO LOGIN. B asked for exactly this, twice, having been told what
 * it means: anyone holding the link sees member names, what they owe and the
 * last four digits of their cards. His call, made with that in front of him.
 * /members is the same board behind the admin PIN for anyone who would rather
 * not pass a link around.
 *
 * TEMPORARY BY INTENT. It exists so the board can be reviewed without issuing
 * logins. Deleting this one file closes it, and nothing else depends on it.
 *
 * NOINDEX IS NOT OPTIONAL HERE. An open URL carrying names and balances gets
 * crawled the first time it is pasted anywhere that leaks a referrer, and
 * after that it is in a search index and out of our hands. The header below is
 * what keeps "unlisted" meaning something.
 */
export const metadata: Metadata = {
  title: "The Reading Club Membership",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ReconPage() {
  const snap = await snapshot();
  return <MembersPipeline snap={snap} />;
}
