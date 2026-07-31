import Link from "next/link";
import { redirect } from "next/navigation";

import { logout } from "@/app/actions";
import { MissedList } from "@/components/close/MissedList";
import { BackLink } from "@/components/ui";
import { getSession } from "@/lib/session";
import {
  SAMPLE_BY_ROLE,
  SAMPLE_CERTIFIERS,
  SAMPLE_MISSED,
  SAMPLE_NIGHTS,
  SAMPLE_STRIP,
  SAMPLE_VENUES,
} from "@/lib/rollup-sample";

export const dynamic = "force-dynamic";

/**
 * A severity ramp, not a good/bad flag.
 *
 * The grid read backwards: a complete night was a solid white block and a
 * night nobody certified was a small yellow one, so twenty-four blocks
 * shouting "fine" drowned the six that were the point of the page. Quiet grey
 * for the nights that went well, and one hue rising through it for the two
 * that didn't — soft where a night was signed with gaps, full where nobody
 * signed at all.
 */
const NIGHT_STATE: Record<string, string> = {
  c: "bg-ink/20",
  g: "bg-warn/40",
  m: "bg-warn",
};

function Bar({ done, of }: { done: number; of: number }) {
  const pct = Math.round((done / of) * 100);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <span className="bg-inset h-1.5 min-w-0 flex-1 rounded-[1px]">
        <span
          className={`block h-full rounded-[1px] ${
            pct < 75 ? "bg-warn" : pct < 90 ? "bg-warn/40" : "bg-ink/30"
          }`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="label tabular-nums shrink-0">{pct}%</span>
    </span>
  );
}

/**
 * The report the whole thing is for: not whether tonight is done, but what
 * keeps not getting done.
 *
 * Built against sample figures so the shape can be shown and argued with
 * before anything is stored. Every number is invented and the page says so at
 * the top — the one thing worse than no report is a fabricated one that reads
 * as real.
 */
export default async function RollupPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <BackLink href="/close">All checklists</BackLink>

      <header className="mt-4 mb-5">
        <span className="pill pill-warn">Sample figures · nothing recorded yet</span>
        <p className="label mt-3">Night Hawk · last {SAMPLE_NIGHTS} nights</p>
        <h1 className="mt-2 text-metric font-medium">What&apos;s getting missed</h1>
      </header>

      {/* Pinned. Every figure below it is a way of asking the same question,
          and the answer is easier to hold onto when the month is still on
          screen while you read them — the two yellow squares are what the rest
          of the page is explaining. Laid out tight and full-bleed, because a
          header that costs half a phone screen is not a header. */}
      <section className="border-card-border bg-paper sticky top-0 z-30 -mx-4 mb-4 border-b px-4 py-3">
        <div className="flex items-baseline justify-between gap-4">
          <p className="label">Nights certified</p>
          <p className="text-title tabular-nums tracking-[0.08em]">
            24 of {SAMPLE_NIGHTS}
          </p>
        </div>
        <div className="mt-2.5 grid max-w-[22rem] grid-cols-10 gap-1" aria-hidden>
          {SAMPLE_STRIP.split("").map((code, index) => (
            <span
              key={index}
              className={`aspect-square rounded-[2px] ${NIGHT_STATE[code] ?? "bg-inset"}`}
            />
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
          <span className="label flex items-center gap-2">
            <span className="bg-ink/20 size-3 rounded-[2px]" />
            All complete
          </span>
          <span className="label flex items-center gap-2">
            <span className="bg-warn/40 size-3 rounded-[2px]" />
            Signed with gaps
          </span>
          <span className="label flex items-center gap-2">
            <span className="bg-warn size-3 rounded-[2px]" />
            Never certified
          </span>
        </div>
      </section>

      <div className="space-y-4">
        {/* The point of the whole exercise. */}
        <section className="panel border-warn/30">
          <p className="label">What keeps getting left open</p>
          <div className="mt-3">
            <MissedList rows={SAMPLE_MISSED} />
          </div>
          <p className="label mt-3">
            Ranked by how often the item was still open at signature.
          </p>
        </section>

        <section className="panel">
          <p className="label">By role · items completed</p>
          <ul className="mt-3 space-y-3">
            {SAMPLE_BY_ROLE.map((row) => (
              <li key={row.role} className="flex items-center gap-3">
                <span className="label w-24 shrink-0">{row.role}</span>
                <Bar done={row.done} of={row.of} />
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <p className="label">Certified by</p>
          <ul className="mt-3">
            {SAMPLE_CERTIFIERS.map((row) => (
              <li
                key={row.who}
                className="border-divider flex items-baseline justify-between gap-4 border-t py-2.5 first:border-t-0"
              >
                <span className="text-body">{row.who}</span>
                <span className="label tabular-nums">{row.nights} nights</span>
              </li>
            ))}
          </ul>
        </section>

        {/* One level up: the same question asked of the whole group. */}
        <section className="panel">
          <p className="label">Across the group</p>
          <p className="note text-muted mt-2">
            The same report, asked of 26 venues rather than one.
          </p>
          <ul className="mt-3 space-y-3">
            {SAMPLE_VENUES.map((row) => (
              <li key={row.code} className="flex items-center gap-3">
                <span className="label w-16 shrink-0">{row.code}</span>
                <Bar done={row.done} of={row.of} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="label mt-6">
        Every figure on this page is invented, to show the shape of the report.
        It becomes real the night the first checklist is stored.
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
