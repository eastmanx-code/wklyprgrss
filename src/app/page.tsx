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
function Stat({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const percent = total ? (count / total) * 100 : 0;
  return (
    <div className="panel relative overflow-hidden px-5 py-4">
      {/* The tile fills to its own share, so an empty stat reads as empty. */}
      <div
        className="bg-ink/10 absolute inset-y-0 left-0"
        style={{ width: `${percent}%` }}
        aria-hidden
      />
      <p className="label relative">{label}</p>
      <p className="relative mt-1 font-mono text-2xl tabular-nums">{count}</p>
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
        {/* A dial that fills as the week does, rather than a solid disc with
            the number floating in it. */}
        <div
          className="relative aspect-square w-[38%] shrink-0 rounded-full"
          style={{
            background: `conic-gradient(var(--ink) ${percent}%, var(--panel) 0)`,
          }}
        >
          <div className="bg-surface absolute inset-[11%] flex flex-col items-center justify-center rounded-full">
            <span className="font-mono text-4xl leading-none tabular-nums">
              {percent}%
            </span>
            <span className="label mt-1">
              {itemsDone}/{itemsTarget}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="panel relative flex flex-1 flex-col justify-center overflow-hidden rounded-full px-6 py-3">
            <div
              className="bg-ink/10 absolute inset-y-0 left-0"
              style={{
                width: `${rows.length ? (passing / rows.length) * 100 : 0}%`,
              }}
              aria-hidden
            />
            <p className="label relative">Venues finished</p>
            <p className="relative mt-1 font-mono text-xl tabular-nums">
              {passing}
              <span className="text-muted">/{rows.length}</span>
            </p>
          </div>
          <div className="panel flex flex-1 flex-col justify-center rounded-full px-6 py-3">
            <p className="label">Due</p>
            <p className="mt-1 font-mono text-xs leading-snug">
              {deadlineLabel}
            </p>
          </div>
        </div>
      </section>

      {/* One segment per venue, unlabelled. */}
      <section className="panel mb-3 px-5 py-4">
        <p className="label mb-2">All {rows.length} venues</p>
        <div className="flex gap-[3px]" aria-hidden>
          {rows.map((row) => (
            <span
              key={row.venue.id}
              className={`h-[7px] flex-1 rounded-full ${
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
        <Stat label="Passing" count={passing} total={rows.length} />
        <Stat label="Pending" count={pending} total={rows.length} />
        <Stat label="Failing" count={failing} total={rows.length} />
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
