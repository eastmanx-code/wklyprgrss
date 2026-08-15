import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CloseBar } from "@/components/close/CloseBar";
import { CloseChecklist } from "@/components/close/CloseChecklist";
import { BackLink } from "@/components/ui";
import { parseSlug, phaseName, type Phase } from "@/lib/checklists";
import type { CloseItem, Shot } from "@/lib/close-checklist";
import { currentNight, formatNight } from "@/lib/night";
import { signedUrls } from "@/lib/photos";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  position: number;
  title: string;
  detail: string[];
  proof: Shot[] | null;
};

/** One checklist, off the clipboard — read from the table, night and all. */
export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await getSession();
  if (!session) redirect("/");

  // A leader's venue comes from their session; an admin gets the one venue
  // with a list so far.
  let venue: string | null = null;
  if (session.role === "leader") venue = session.venueId;
  else {
    const { data } = await db()
      .from("venues")
      .select("id")
      .eq("code", "HAWK")
      .maybeSingle();
    venue = (data as { id: string } | null)?.id ?? null;
  }
  if (!venue) notFound();

  const parsed = parseSlug(slug);
  if (!parsed) notFound();

  // Matched in JS rather than with ilike: the slug is user input and ilike
  // treats % and _ as wildcards, so foh-%-close would match whatever role came
  // back first. A venue has a handful of lists.
  const { data: listRows } = await db()
    .from("close_checklists")
    .select("id, house, role, phase")
    .eq("venue_id", venue)
    .eq("active", true);

  const list =
    (
      (listRows ?? []) as {
        id: string;
        house: string;
        role: string;
        phase: Phase;
      }[]
    ).find(
      (row) =>
        row.house.toLowerCase() === parsed.house.toLowerCase() &&
        row.role.toLowerCase() === parsed.role.toLowerCase() &&
        row.phase.toLowerCase() === parsed.phase.toLowerCase(),
    ) ?? null;
  if (!list) notFound();

  const { data: itemRows } = await db()
    .from("close_items")
    .select("id, position, title, detail, proof")
    .eq("checklist_id", list.id)
    .eq("active", true)
    .order("position");

  const rows = (itemRows ?? []) as Row[];

  const items: CloseItem[] = rows.map((row) => ({
    id: row.id,
    number: row.position,
    title: row.title,
    detail: row.detail ?? [],
    // An empty array is not "proof required of nothing", it is no proof — and
    // it used to arrive here as one, because an empty array is truthy. Every
    // tap on such an item reached for shot zero of nothing and threw, so the
    // card could never be ticked and said nothing about why. Normalised on the
    // way in so rows already saved that way come right without a migration.
    proof: row.proof && row.proof.length > 0 ? row.proof : undefined,
  }));

  // Tonight, if anyone has started it. Read-only here — the actions create it.
  const night = currentNight();
  const { data: nightRow } = await db()
    .from("close_nights")
    .select("id, certified_at, certified_by, history")
    .eq("checklist_id", list.id)
    .eq("night", night)
    .maybeSingle();
  const tonight = nightRow as {
    id: string;
    certified_at: string | null;
    certified_by: string | null;
    history:
      | { certified_by?: string; certified_at?: string; reason?: string }[]
      | null;
  } | null;

  let ticks: { item_id: string; initials: string }[] = [];
  let proof: {
    item_id: string;
    shot_index: number;
    kind: string;
    storage_path: string | null;
    body: string | null;
  }[] = [];

  if (tonight) {
    const [t, p] = await Promise.all([
      db()
        .from("close_ticks")
        .select("item_id, initials")
        .eq("night_id", tonight.id),
      db()
        .from("close_proof")
        .select("item_id, shot_index, kind, storage_path, body")
        .eq("night_id", tonight.id),
    ]);
    ticks = (t.data ?? []) as typeof ticks;
    proof = (p.data ?? []) as typeof proof;
  }

  const urls = await signedUrls(
    proof
      .map((row) => row.storage_path)
      .filter((path): path is string => Boolean(path)),
  );

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <BackLink href="/close">All checklists</BackLink>

      <header className="mt-4 mb-5">
        <p className="label">
          {list.house} · {list.role} · {formatNight(night)}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h1 className="text-metric font-medium">
            {phaseName(list.phase)} checklist
          </h1>
          {/* The venue owns this list, so the way to change it is on it —
              not in an admin screen somebody has to be told about. */}
          <Link href={`/close/${slug}/edit`} className="btn-ghost min-h-11">
            Edit the list
          </Link>
        </div>
      </header>

      {rows.length === 0 ? (
        <section className="panel">
          <p className="note text-muted leading-relaxed">
            This list has no items yet. Nothing can be walked or signed until it
            does — an empty list that could be certified would report a venue as
            covered for doing nothing.
          </p>
          <Link href={`/close/${slug}/edit`} className="btn mt-4 inline-flex">
            Write the list
          </Link>
        </section>
      ) : (
        <CloseChecklist
          slug={slug}
          items={items}
          saved={{
            ticks: Object.fromEntries(
              ticks.map((t) => [t.item_id, t.initials]),
            ),
            proof: Object.fromEntries(
              proof.map((row) => [
                `${row.item_id}:${row.shot_index}`,
                {
                  kind: row.kind,
                  body: row.body,
                  url: row.storage_path
                    ? (urls.get(row.storage_path) ?? null)
                    : null,
                },
              ]),
            ),
            certifiedBy: tonight?.certified_by ?? null,
            certifiedAt: tonight?.certified_at ?? null,
            // Every certification this night has already had. Usually empty; a
            // reopened night carries the signature it was reopened from, and
            // that is the whole reason reopening is an unlock and not a delete.
            history: (tonight?.history ?? []).map((entry) => ({
              certifiedBy: entry.certified_by ?? null,
              certifiedAt: entry.certified_at ?? null,
              reason: entry.reason ?? null,
            })),
          }}
        />
      )}

      <CloseBar back="/close" />
    </main>
  );
}
