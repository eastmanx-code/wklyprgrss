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
 * cleared or wrong, the button does nothing. It grades the dining rooms only
 * and never changes a verdict, so a mistaken tap closes a week that can be
 * reopened, nothing more.
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
