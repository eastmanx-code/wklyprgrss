import Link from "next/link";
import { redirect } from "next/navigation";

import { MasterGrade } from "@/components/admin/MasterGrade";
import { notAdminGoesTo } from "@/lib/app";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Owner-only, on a page nothing links to.
 *
 * Kept off the menu on purpose: the way in is knowing the path and the code.
 * Admin-guarded like every /admin route, and the code is the real gate —
 * cleared or wrong, the button does nothing.
 *
 * It works the dining room and never the kitchen. Note what a mistaken tap
 * costs now: the grade it writes lifts per venue with Undo, but the card
 * sign-offs it makes first do not come back in one move, so they are the part
 * to be sure about.
 */
export default async function MasterGradePage() {
  const session = await getSession();
  if (session?.role !== "admin") redirect(notAdminGoesTo(Boolean(session)));

  return (
    <main className="mx-auto max-w-md">
      <header className="mb-6">
        <h1 className="text-metric font-medium">Dev</h1>
      </header>

      <MasterGrade />

      <p className="mt-8">
        <Link href="/admin" className="label hover:text-ink">
          ← All venues
        </Link>
      </p>
    </main>
  );
}
