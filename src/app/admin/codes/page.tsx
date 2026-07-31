import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPins, type AdminPin } from "@/components/admin/AdminPins";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Its own page rather than a section of the dashboard.
 *
 * Inline it was either buried under twenty-seven venue rows or wedged between
 * the setup list and the jump bar, where it read as one more row of venue
 * codes. A rarely-used thing with a link to it beats a common thing squeezed
 * into a page that isn't about it.
 */
export default async function AdminCodesPage() {
  if ((await getSession())?.role !== "admin") redirect("/admin/login");

  const { data: adminPins } = await db()
    .from("admin_pins")
    .select("id, pin, label")
    .order("created_at");

  return (
    <main className="mx-auto max-w-2xl">
      <header className="mb-6">
        <p className="label">Admin</p>
        <h1 className="mt-2 text-metric font-medium">Admin codes</h1>
      </header>

      <AdminPins pins={(adminPins ?? []) as AdminPin[]} />

      <p className="mt-8">
        <Link href="/admin" className="label hover:text-ink">
          ← All venues
        </Link>
      </p>
    </main>
  );
}
