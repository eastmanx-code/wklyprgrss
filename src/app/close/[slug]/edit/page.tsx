import { notFound, redirect } from "next/navigation";

import { CloseBar } from "@/components/close/CloseBar";
import {
  AddItemForm,
  ItemRow,
  type EditableItem,
} from "@/components/close/ItemEditor";
import {
  RestoreChecklist,
  RetireChecklist,
} from "@/components/close/RetireChecklist";
import { BackLink } from "@/components/ui";
import {
  parseSlug,
  phaseName,
  slugFor,
  type House,
  type Phase,
} from "@/lib/checklists";
import type { Reference, Shot } from "@/lib/close-checklist";
import { signedUrls } from "@/lib/photos";
import { closeVenueId } from "@/lib/close-venue";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Writing a checklist, rather than walking one.
 *
 * Same screen for a leader and an admin. A venue owns its lists — it invents
 * the role, writes the items, and retires them when the job changes — so
 * there is no queue between noticing that a line is wrong and fixing it.
 */
export default async function EditChecklistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await getSession();
  if (!session) redirect("/");

  const venue = await closeVenueId(session);
  if (!venue) notFound();

  const parsed = parseSlug(slug);
  if (!parsed) notFound();

  // Matched in JS: the slug is user input and ilike treats % and _ as
  // wildcards, so foh-%-close would match whatever came back first.
  // Retired lists included. Retiring one from this very page used to make the
  // page 404 out from under the person who just did it — the row went
  // inactive, the query stopped finding it, and a not-found screen arrived
  // before the redirect did.
  const { data: rows } = await db()
    .from("close_checklists")
    .select("id, house, role, phase, active")
    .eq("venue_id", venue);

  const list = (
    (rows ?? []) as {
      id: string;
      house: House;
      role: string;
      phase: Phase;
      active: boolean;
    }[]
  ).find(
    (row) =>
      row.house.toLowerCase() === parsed.house.toLowerCase() &&
      row.role.toLowerCase() === parsed.role.toLowerCase() &&
      row.phase.toLowerCase() === parsed.phase.toLowerCase(),
  );
  if (!list) notFound();

  const { data: itemRows } = await db()
    .from("close_items")
    .select("id, position, title, detail, proof, reference, section, active")
    .eq("checklist_id", list.id)
    .order("position");

  const itemsRaw = (itemRows ?? []) as {
    id: string;
    position: number;
    title: string;
    detail: string[] | null;
    proof: Shot[] | null;
    reference: Reference[] | null;
    section: string | null;
    active: boolean;
  }[];

  // The bucket is private, so a thumbnail needs a signed URL. One round trip
  // for the whole page rather than one per photograph.
  const urls = await signedUrls(
    itemsRaw.flatMap((row) =>
      (row.reference ?? [])
        .map((ref) => ref.path)
        .filter((path): path is string => Boolean(path)),
    ),
  );

  const items = itemsRaw.map<EditableItem>((row) => ({
    id: row.id,
    position: row.position,
    section: row.section,
    title: row.title,
    detail: row.detail ?? [],
    proof: row.proof ?? [],
    reference: row.reference ?? [],
    referenceUrls: (row.reference ?? []).map((ref) =>
      ref.path ? (urls.get(ref.path) ?? null) : null,
    ),
    active: row.active,
  }));

  const live = items.filter((item) => item.active);
  const retired = items.filter((item) => !item.active);

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <BackLink href={`/close/${slugFor(list.house, list.role, list.phase)}`}>
        Back to the list
      </BackLink>

      <header className="mt-4 mb-5">
        <p className="label">
          {list.house} · {list.role}
        </p>
        <h1 className="mt-2 text-metric font-medium">
          Edit {phaseName(list.phase)}
        </h1>
        <p className="label mt-2">
          {live.length} {live.length === 1 ? "item" : "items"}
          {retired.length > 0 ? ` · ${retired.length} retired` : ""}
        </p>
      </header>

      {list.active ? null : (
        <section className="panel border-warn/30 mb-3">
          <p className="label text-warn">Retired</p>
          <p className="note text-muted mt-2 leading-relaxed">
            Off the clipboard. Every night it was signed is untouched, and
            bringing it back restores this list rather than starting an empty
            one beside it.
          </p>
          <div className="mt-3">
            <RestoreChecklist checklistId={list.id} />
          </div>
        </section>
      )}

      {live.length === 0 ? (
        <section className="panel mb-3">
          <p className="note text-muted leading-relaxed">
            Nothing on this list yet. Add the items in the order somebody
            actually walks them — the order is the route.
          </p>
        </section>
      ) : (
        <ul className="mb-3 space-y-3">
          {live.map((item, index) => (
            <ItemRow
              key={item.id}
              item={item}
              isFirst={index === 0}
              isLast={index === live.length - 1}
            />
          ))}
        </ul>
      )}

      <div className="mb-5">
        <AddItemForm checklistId={list.id} />
      </div>

      {retired.length > 0 ? (
        <details className="panel mb-5">
          <summary className="card-title cursor-pointer">
            Retired · {retired.length}
          </summary>
          <p className="label mt-2">
            Off tonight&apos;s list, still in every night they were part of.
          </p>
          <ul className="mt-3 space-y-3">
            {retired.map((item) => (
              <ItemRow key={item.id} item={item} isFirst isLast />
            ))}
          </ul>
        </details>
      ) : null}

      {list.active ? <RetireChecklist checklistId={list.id} /> : null}

      <CloseBar back={`/close/${slugFor(list.house, list.role, list.phase)}`} />
    </main>
  );
}
