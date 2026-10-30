import Link from "next/link";
import { redirect } from "next/navigation";

import { MasterGrade } from "@/components/admin/MasterGrade";
import { notAdminGoesTo } from "@/lib/app";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The owner's one-tap grade-all, on a page nothing links to.
 *
 * Kept off the menu on purpose: it is the owner's alone, so the way in is
 * knowing the path and the code. Admin-guarded like every /admin route, and the
 * code is the real gate — cleared or wrong, the button does nothing. It grades
 * the dining rooms only and never changes a verdict, so a mistaken tap closes a
 * week that can be reopened, nothing more.
 */
export default async function MasterGradePage() {
  const session = await getSession();
  if (session?.role !== "admin") redirect(notAdminGoesTo(Boolean(session)));

  return (
    <main className="mx-auto max-w-md">
      <header className="mb-6">
        <p className="label">Owner</p>
        <h1 className="mt-2 text-metric font-medium">Master grade</h1>
        <p className="note text-muted mt-3 leading-relaxed">
          Close every dining room for the finished week in one tap, your name on
          all. Verdicts stay exactly as you set them, and the kitchen is never
          touched.
        </p>
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
