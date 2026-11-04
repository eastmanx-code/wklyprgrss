import { redirect } from "next/navigation";

import { ChTaskRunner } from "@/components/checklists/ChTaskRunner";
import { BackLink } from "@/components/ui";
import { doneTasks, openTasks } from "@/lib/ch-tasks";
import { closeVenueId, closeVenueName } from "@/lib/close-venue";
import { getSession, mayManage } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * CH Tasks, MOD side. The open walk-around tasks for this venue, cleared with a
 * done photo. Managers only — the MOD, not the whole crew on the venue code.
 */
export default async function ChTasksPage() {
  const session = await getSession();
  if (!session) redirect("/");
  // The MOD is the manager on the floor. The venue code everyone holds is not
  // enough to see or clear these.
  if (!mayManage(session)) redirect("/checklists");

  const venue = await closeVenueId(session);
  if (!venue) {
    if (session.role === "admin") redirect("/checklists/locations");
    redirect("/checklists");
  }

  const [name, open, done] = await Promise.all([
    closeVenueName(venue),
    openTasks(venue),
    doneTasks(venue, 10),
  ]);

  return (
    <main className="close-flow mx-auto max-w-2xl pb-6">
      <BackLink href="/checklists">Stats</BackLink>

      <header className="mt-4 mb-5">
        <p className="label">{name ? `${name} · ` : ""}owner walk-around</p>
        <h1 className="mt-2 text-metric font-medium">CH Tasks</h1>
        <p className="label mt-2">
          Each one needs a photo of it done before it clears.
        </p>
      </header>

      <section className="mb-6">
        <ChTaskRunner tasks={open} />
      </section>

      {done.length > 0 ? (
        <section className="panel">
          <h2 className="card-title">Cleared recently</h2>
          <ul className="mt-3 space-y-3">
            {done.map((d) => (
              <li key={d.id} className="flex items-start gap-3">
                {d.donePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.donePhotoUrl}
                    alt=""
                    className="bg-inset h-14 w-14 shrink-0 rounded object-cover"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="text-body break-words">{d.title}</p>
                  <p className="label text-muted mt-1">
                    {d.doneBy ? `${d.doneBy}` : "done"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
