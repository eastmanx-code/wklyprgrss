import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPins, type CodeVenue } from "@/components/admin/AdminPins";
import { MaintenanceToggle } from "@/components/admin/MaintenanceToggle";
import { OrphanSweep } from "@/components/admin/OrphanSweep";
import { VenuePinForm } from "@/components/admin/VenuePinForm";
import { notAdminGoesTo } from "@/lib/app";
import { getMaintenance } from "@/lib/maintenance";
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
  const session = await getSession();
  if (session?.role !== "admin") redirect(notAdminGoesTo(Boolean(session)));

  const { data: adminPins } = await db()
    .from("admin_pins")
    .select("id, pin, label, venue_id")
    .order("created_at");

  // The only screen that reads venue PINs. getVenues() deliberately never
  // selects them, so this query is deliberate and lives behind the admin
  // guard above.
  const { data: venues } = await db()
    .from("venues")
    .select("id, code, pin")
    .order("code");

  const maintenance = await getMaintenance();

  return (
    <main className="mx-auto max-w-2xl">
      <header className="mb-6">
        <p className="label">Admin</p>
        <h1 className="mt-2 text-metric font-medium">Admin codes</h1>
      </header>

      <AdminPins
        pins={(
          (adminPins ?? []) as {
            id: string;
            pin: string;
            label: string;
            venue_id: string | null;
          }[]
        ).map((row) => ({
          id: row.id,
          pin: row.pin,
          label: row.label,
          venueId: row.venue_id,
        }))}
        venues={((venues ?? []) as CodeVenue[]).map((venue) => ({
          id: venue.id,
          code: venue.code,
        }))}
      />

      <section className="mt-12">
        <h2 className="card-title">Maintenance</h2>
        <p className="label text-muted mt-1.5">
          A hold screen for every crew · use it right before a deploy
        </p>
        <hr className="border-divider my-4 border-0 border-t" />
        <MaintenanceToggle
          current={{ locked: maintenance.locked, message: maintenance.message }}
        />
      </section>

      <section className="mt-12">
        <h2 className="card-title">Venue codes</h2>
        <p className="label text-muted mt-1.5">
          The PIN each venue signs in with · 6 digits
        </p>
        <hr className="border-divider my-4 border-0 border-t" />

        <ul className="space-y-3">
          {((venues ?? []) as { id: string; code: string; pin: string }[]).map(
            (venue) => (
              /* px-5 matches the admin code rows' own padding, so the venue
                 letters sit under their labels and Save sits under Revoke —
                 one column down the page instead of a full-width panel
                 followed by a list hugging the left. Not on a phone, where
                 that padding is width the row's own controls need. */
              <li key={venue.id} className="flex items-center gap-4 sm:px-5">
                <span className="text-body text-ink w-16 shrink-0 tracking-normal">
                  {venue.code}
                </span>
                <span className="min-w-0 flex-1">
                  <VenuePinForm venueId={venue.id} pin={venue.pin} compact />
                </span>
              </li>
            ),
          )}
        </ul>
      </section>

      {/* Housekeeping, on the screen that already holds the things only an
          admin can do, rather than on a dashboard somebody reads every day. */}
      <section className="mt-12">
        <h2 className="card-title">Storage</h2>
        <p className="label text-muted mt-1.5">
          Checklist photos with nothing pointing at them
        </p>
        <hr className="border-divider my-4 border-0 border-t" />
        <OrphanSweep />
      </section>

      <p className="mt-8">
        <Link href="/admin" className="label hover:text-ink">
          ← All venues
        </Link>
      </p>
    </main>
  );
}
