import Link from "next/link";
import { redirect } from "next/navigation";

import { HowToDialog } from "@/components/HowToDialog";
import { HowToSummary } from "@/components/HowToUse";
import { LeaderLoginForm } from "@/components/LeaderLoginForm";
import { APP_NAME } from "@/lib/app";
import { getSession } from "@/lib/session";
import { WEEKLY_ITEM_TARGET, getDashboard } from "@/lib/status";
import { formatDeadline, formatWeekStart } from "@/lib/week";

export const dynamic = "force-dynamic";

/** Small labelled tile, like the readouts under a weather hero. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="label">{label}</p>
      <p className="mt-2 font-mono text-2xl tabular-nums">{value}</p>
    </div>
  );
}

export default async function HomePage() {
  const session = await getSession();
  if (session?.role === "leader") redirect("/venue");
  if (session?.role === "admin") redirect("/admin");

  const { weekStart, rows, itemsDone, itemsTarget } = await getDashboard();
  const deadlineLabel = formatDeadline(weekStart);
  const passing = rows.filter((row) => row.status === "PASS").length;
  const failing = rows.filter((row) => row.status === "FAIL").length;
  const pending = rows.length - passing - failing;
  const percent = itemsTarget ? Math.round((itemsDone / itemsTarget) * 100) : 0;

  // Venue codes are absent from the readout on purpose: this page is open to
  // anyone with the URL, so it shows the company's shape without naming who is
  // behind. The dropdown lists codes because you need yours to sign in.
  const venues = rows.map(({ venue }) => venue);

  return (
    <main className="rise mx-auto flex min-h-[calc(100dvh-9rem)] max-w-xl flex-col justify-center">
      <header className="mb-5 flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-medium tracking-tight">{APP_NAME}</h1>
        <p className="label">Week of {formatWeekStart(weekStart)}</p>
      </header>

      {/* Hero: the one number that matters, with the context beside it. */}
      <section className="mb-3 flex gap-3">
        <div className="bg-ink text-paper flex aspect-square w-[44%] shrink-0 flex-col items-center justify-center rounded-full">
          <span className="font-mono text-5xl leading-none tabular-nums">
            {percent}%
          </span>
          <span className="label mt-2 opacity-70">
            {itemsDone}/{itemsTarget} photos
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="panel flex-1 rounded-full px-5 py-4">
            <p className="label">Venues finished</p>
            <p className="mt-1 font-mono text-xl tabular-nums">
              {passing}
              <span className="text-muted">/{rows.length}</span>
            </p>
          </div>
          <div className="panel flex-1 rounded-full px-5 py-4">
            <p className="label">Due</p>
            <p className="mt-1 font-mono text-xs leading-snug">
              {deadlineLabel}
            </p>
          </div>
        </div>
      </section>

      {/* One segment per venue, unlabelled. */}
      <section className="panel mb-3 p-4">
        <p className="label mb-3">All {rows.length} venues</p>
        <div className="flex gap-[3px]" aria-hidden>
          {rows.map((row) => (
            <span
              key={row.venue.id}
              className={`h-[10px] flex-1 rounded-full ${
                row.status === "PASS"
                  ? "bg-ink"
                  : row.status === "FAIL"
                    ? "bg-fail"
                    : "bg-panel"
              }`}
            />
          ))}
        </div>
      </section>

      <section className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Passing" value={String(passing)} />
        <Stat label="Pending" value={String(pending)} />
        <Stat label="Failing" value={String(failing)} />
      </section>

      <LeaderLoginForm venues={venues} />

      <div className="mt-6 flex items-center justify-center gap-4">
        <Link href="/admin/login" className="label hover:text-ink">
          Admin sign in
        </Link>
        <span className="label" aria-hidden>
          ·
        </span>
        <HowToDialog>
          <HowToSummary
            target={WEEKLY_ITEM_TARGET}
            deadlineLabel={deadlineLabel}
          />
        </HowToDialog>
      </div>
    </main>
  );
}
