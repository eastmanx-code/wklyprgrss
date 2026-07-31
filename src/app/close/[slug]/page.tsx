import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { logout } from "@/app/actions";
import { CloseChecklist } from "@/components/close/CloseChecklist";
import { BackLink } from "@/components/ui";
import { phaseName, type Phase } from "@/lib/checklists";
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

  const [house, ...rest] = slug.split("-");
  const phase = rest[rest.length - 1];
  const role = rest.slice(0, -1).join(" ");

  const { data: listRow } = await db()
    .from("close_checklists")
    .select("id, house, role, phase")
    .eq("venue_id", venue)
    .ilike("house", house)
    .ilike("role", role)
    .eq("phase", phase)
    .maybeSingle();

  const list = listRow as {
    id: string;
    house: string;
    role: string;
    phase: Phase;
  } | null;
  if (!list) notFound();

  const { data: itemRows } = await db()
    .from("close_items")
    .select("id, position, title, detail, proof")
    .eq("checklist_id", list.id)
    .eq("active", true)
    .order("position");

  const rows = (itemRows ?? []) as Row[];
  if (rows.length === 0) notFound();

  const items: CloseItem[] = rows.map((row) => ({
    id: row.id,
    number: row.position,
    title: row.title,
    detail: row.detail ?? [],
    proof: row.proof ?? undefined,
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
    history: { certified_by?: string; certified_at?: string; reason?: string }[] | null;
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
      db().from("close_ticks").select("item_id, initials").eq("night_id", tonight.id),
      db()
        .from("close_proof")
        .select("item_id, shot_index, kind, storage_path, body")
        .eq("night_id", tonight.id),
    ]);
    ticks = (t.data ?? []) as typeof ticks;
    proof = (p.data ?? []) as typeof proof;
  }

  const urls = await signedUrls(
    proof.map((row) => row.storage_path).filter((path): path is string => Boolean(path)),
  );

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <BackLink href="/close">All checklists</BackLink>

      <header className="mt-4 mb-5">
        <p className="label">
          {list.house} · {list.role} · {formatNight(night)}
        </p>
        <h1 className="mt-2 text-metric font-medium">
          {phaseName(list.phase)} checklist
        </h1>
      </header>

      <CloseChecklist
        slug={slug}
        items={items}
        saved={{
          ticks: Object.fromEntries(ticks.map((t) => [t.item_id, t.initials])),
          proof: Object.fromEntries(
            proof.map((row) => [
              `${row.item_id}:${row.shot_index}`,
              {
                kind: row.kind,
                body: row.body,
                url: row.storage_path ? (urls.get(row.storage_path) ?? null) : null,
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

      <nav className="border-card-border bg-surface/90 fixed right-4 bottom-4 left-4 z-50 flex h-14 items-center justify-end gap-2 rounded-[8px] border px-2 backdrop-blur-md sm:left-auto sm:gap-3 sm:px-3">
        <Link href="/close" className="btn-ghost">
          Back
        </Link>
        <form action={logout}>
          <button type="submit" className="btn-ghost">
            Out
          </button>
        </form>
      </nav>
    </main>
  );
}
