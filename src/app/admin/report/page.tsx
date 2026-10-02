import Link from "next/link";
import { redirect } from "next/navigation";

import { BackLink } from "@/components/ui";
import { ReportCopy } from "@/components/ReportCopy";
import { notAdminGoesTo } from "@/lib/app";
import { weeklyReport } from "@/lib/report";
import { getSession } from "@/lib/session";
import {
  formatWeekStart,
  mostRecentCompletedWeek,
  shiftWeeks,
} from "@/lib/week";

export const dynamic = "force-dynamic";

const WEEK = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The weekly walkthrough card, built straight off the board and ready to paste.
 *
 * Only the grader sees it, because it names every leader and every score. It
 * defaults to the most recent week whose deadline has passed — the newest week
 * there is a verdict for — and steps back a week at a time for a report that
 * was missed or is being re-pulled.
 *
 * It generates the text and stops. Nothing here posts to ClickUp: the card
 * needs the voice sharpened and the call made before it goes up, and that is
 * the user's to do, not the app's.
 */
export default async function WalkthroughReportPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await getSession();
  if (session?.role !== "admin") redirect(notAdminGoesTo(Boolean(session)));

  const { week: asked } = await searchParams;
  const newest = mostRecentCompletedWeek();
  const weekStart = asked && WEEK.test(asked) ? asked : newest;

  const report = await weeklyReport(weekStart);

  const prev = shiftWeeks(weekStart, -1);
  const next = shiftWeeks(weekStart, 1);
  const hasNext = next <= newest;

  return (
    <main>
      <BackLink href="/admin">Dashboard</BackLink>

      <header className="mt-4 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label">Walkthrough report · copy and paste</p>
          <h1 className="text-metric mt-2 tracking-normal">
            Week of {report.weekLabel}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/report?week=${prev}`} className="btn-ghost">
            ← {formatWeekStart(prev)}
          </Link>
          {hasNext ? (
            <Link href={`/admin/report?week=${next}`} className="btn-ghost">
              {formatWeekStart(next)} →
            </Link>
          ) : null}
        </div>
      </header>

      <p className="note text-muted mb-6 leading-relaxed">
        Every number is pulled live from the board, so a board that missed
        Thursday 4pm is already a fail here and never lands in the grade queue.
        The tally, movement and performance lists are final. The opener, best
        and worst, follow ups, boost and shout outs are a draft off the same
        numbers for you to sharpen before posting.
      </p>

      <ReportCopy text={report.text} />
    </main>
  );
}
