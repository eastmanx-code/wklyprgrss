import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CloseBar } from "@/components/close/CloseBar";
import {
  houseName,
  phaseName,
  PHASE_ORDER,
  roleSlug,
  slugFor,
  type House,
  type Phase,
} from "@/lib/checklists";
import { closeVenueId } from "@/lib/close-venue";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";
import { BackLink } from "@/components/ui";

export const dynamic = "force-dynamic";

type Row = { id: string; house: House; role: string; phase: Phase };

/**
 * One position, and the lists it owns.
 *
 * The middle step of three. Everything used to sit on one screen — both
 * houses, every role, and every phase under each of them — so a bartender
 * looking for their close list read past the whole building to find it. You
 * pick the position you are working, then the list.
 */
export default async function PositionPage({
  params,
}: {
  params: Promise<{ house: string; role: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const { house: houseParam, role: roleParam } = await params;
  const house = houseParam.toUpperCase() === "HOH" ? "HOH" : "FOH";

  const venue = await closeVenueId(session);
  if (!venue) notFound();

  const { data } = await db()
    .from("close_checklists")
    .select("id, house, role, phase")
    .eq("venue_id", venue)
    .eq("house", house)
    .eq("active", true);

  // Matched on the slug rather than the raw text, so a role written two ways
  // reaches one page instead of splitting into two half-empty ones.
  const lists = ((data ?? []) as Row[]).filter(
    (row) => roleSlug(row.role) === roleParam.toLowerCase(),
  );
  if (lists.length === 0) notFound();

  const role = lists[0].role;

  // Which of these has anything in it. Not shown as a number — the count is
  // not how anybody picks a list — but a named list with nothing behind it
  // reads as covered, which is the one thing worse than no list at all.
  const { data: itemRows } = await db()
    .from("close_items")
    .select("checklist_id")
    .in(
      "checklist_id",
      lists.map((l) => l.id),
    )
    .eq("active", true);

  const built = new Set(
    ((itemRows ?? []) as { checklist_id: string }[]).map(
      (row) => row.checklist_id,
    ),
  );

  const ordered = [...lists].sort(
    (a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase),
  );

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <BackLink href="/close">All positions</BackLink>

      <header className="mt-4 mb-5">
        <p className="label">{houseName(house)}</p>
        <h1 className="mt-2 text-metric font-medium">{role}</h1>
      </header>

      <ul className="mb-5 space-y-2">
        {ordered.map((list) => (
          <li key={list.id}>
            <Link
              href={`/close/${slugFor(list.house, list.role, list.phase)}`}
              className={`flex min-h-14 items-center justify-between gap-3 rounded px-4 ${
                built.has(list.id)
                  ? "bg-warn text-on-warn"
                  : "text-muted ring-card-border ring-1 ring-inset"
              }`}
            >
              <span className="text-body tracking-[0.08em]">
                {phaseName(list.phase)}
              </span>
              {built.has(list.id) ? null : (
                <span className="label">Nothing on it yet</span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <CloseBar back="/close" />
    </main>
  );
}
