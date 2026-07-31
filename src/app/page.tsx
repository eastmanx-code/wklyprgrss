import Link from "next/link";
import { redirect } from "next/navigation";

import { HowToDialog } from "@/components/HowToDialog";
import { HowToSummary } from "@/components/HowToUse";
import { LeaderLoginForm } from "@/components/LeaderLoginForm";
import { APP_NAME } from "@/lib/app";
import { getSession } from "@/lib/session";
import { WEEKLY_ITEM_TARGET, getVenues } from "@/lib/status";
import { currentWeekStart, formatDeadline } from "@/lib/week";

export const dynamic = "force-dynamic";

/**
 * Sign-in only. The company dashboard belongs on the board, behind a PIN —
 * this page is reachable by anyone with the URL, and how each venue is doing
 * isn't something to publish to the open internet.
 */
export default async function HomePage() {
  const session = await getSession();
  if (session?.role === "leader") redirect("/venue");
  if (session?.role === "admin") redirect("/admin");

  const venues = await getVenues();
  const deadlineLabel = formatDeadline(currentWeekStart());

  return (
    <main className="rise mx-auto flex min-h-[calc(100dvh-9rem)] max-w-md flex-col justify-center">
      <header className="mb-8">
        <h1 className="text-center text-metric font-medium">{APP_NAME}</h1>
      </header>

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
