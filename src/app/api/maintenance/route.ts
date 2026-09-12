import { getMaintenance } from "@/lib/maintenance";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The live maintenance state, for the hold screen to poll.
 *
 *   GET /api/maintenance  ->  { locked, message, admin }
 *
 * Public and unauthenticated on purpose: every device has to be able to ask,
 * including the shared bar login and a phone that is not signed in at all, and
 * the answer — whether the site is briefly down for a deploy — is not a secret.
 *
 * `admin` is the one thing that is about the caller: the person flipping the
 * switch is the one running the deploy and must not be held out of the site
 * they are deploying, so the hold reads this and lets an admin session through.
 * No cookie, or any read that throws, is treated as not-admin, which is the
 * safe side — a crew phone is never mistaken for the admin's.
 */
export async function GET(): Promise<Response> {
  const { locked, message } = await getMaintenance();

  let admin = false;
  try {
    admin = (await getSession())?.role === "admin";
  } catch {
    admin = false;
  }

  return Response.json(
    { locked, message, admin },
    { headers: { "Cache-Control": "no-store" } },
  );
}
