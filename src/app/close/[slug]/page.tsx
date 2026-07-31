import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { logout } from "@/app/actions";
import { CloseChecklist } from "@/components/close/CloseChecklist";
import { BackLink } from "@/components/ui";
import { checklistBySlug, phaseName } from "@/lib/checklists";
import { currentNight, formatNight } from "@/lib/night";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** One checklist, off the clipboard. */
export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await getSession();
  if (!session) redirect("/");

  const list = checklistBySlug(slug);
  if (!list || list.items.length === 0) notFound();

  const night = currentNight();

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <BackLink href="/close">All checklists</BackLink>

      <header className="mt-4 mb-5">
        <span className="pill pill-pending">Prototype · nothing is saved</span>
        {/* A signed record has to say which list, whose, and which night. */}
        <p className="label mt-3">
          {list.house} · {list.role} · {formatNight(night)}
        </p>
        <h1 className="mt-2 text-metric font-medium">
          {phaseName(list.phase)} checklist
        </h1>
      </header>

      <CloseChecklist items={list.items} />

      <p className="label mt-6">
        A review build. Reloading the page clears the night.
      </p>

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
