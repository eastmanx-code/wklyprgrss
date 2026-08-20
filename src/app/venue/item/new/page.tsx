import { notFound, redirect } from "next/navigation";

import { NewItemForm } from "@/components/admin/NewItemForm";
import { BackLink } from "@/components/ui";
import { getSession } from "@/lib/session";
import { getVenue } from "@/lib/status";
import { houseName, type House } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * A static segment, so it wins over `[itemId]` and "new" is never looked up as
 * an item id.
 */
export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string; house?: string; slot?: string }>;
}) {
  const { venue: venueParam, house: houseParam, slot } = await searchParams;
  // Anything but the kitchen is the dining room. The parameter comes off a
  // link, so it is checked rather than trusted — an unrecognised value must
  // not create an item on a third board that nothing displays.
  const house: House = houseParam === "HOH" ? "HOH" : "FOH";

  const session = await getSession();
  if (!session) redirect("/");

  // A leader's venue comes from their session and never from the URL; only an
  // admin, who may work on any venue, is told which one by the link. The
  // action re-checks either way.
  const venueId =
    session.role === "leader" ? session.venueId : (venueParam ?? "");
  if (!venueId) notFound();

  const venue = await getVenue(venueId);
  if (!venue) notFound();

  const backHref =
    session.role === "admin" ? `/admin/venue/${venue.id}` : "/venue";

  return (
    <main className="mx-auto max-w-2xl">
      <BackLink href={backHref}>All items</BackLink>

      <header className="mt-4 mb-6">
        <p className="label">
          {venue.code} · {houseName(house)}
          {slot ? ` · slot ${slot}` : ""}
        </p>
        <h1 className="mt-2 text-metric font-medium">New task</h1>
      </header>

      <NewItemForm venueId={venue.id} house={house} />
    </main>
  );
}
