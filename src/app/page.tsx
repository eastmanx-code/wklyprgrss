import Link from "next/link";
import { redirect } from "next/navigation";

import { HowToDialog } from "@/components/HowToDialog";
import { HowToSummary } from "@/components/HowToUse";
import { LeaderLoginForm } from "@/components/LeaderLoginForm";
import { getSession } from "@/lib/session";
import { WEEKLY_ITEM_TARGET, getVenues } from "@/lib/status";
import { currentWeekStart, formatDeadline } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (session?.role === "leader") redirect("/venue");
  if (session?.role === "admin") redirect("/admin");

  // getVenues never selects the PIN column, so there is nothing to strip.
  const options = await getVenues();
  const deadlineLabel = formatDeadline(currentWeekStart());

  return (
    // Reading width: mono runs wide, and a 1100px line of instructions is
    // unreadable. Boards get the full container; prose does not.
    // Centred vertically: on a laptop the form otherwise sits at the top with
    // a screen of dead space under it.
    <main className="rise mx-auto flex min-h-[calc(100dvh-9rem)] max-w-2xl flex-col justify-center">
      <header className="mb-8">
        <p className="label">Weekly Walkthrough</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">
          Our weekly progress
        </h1>
        <p className="note mt-3 text-muted">
          Photo and comment on all {WEEKLY_ITEM_TARGET} items, every week, by{" "}
          {deadlineLabel}.
        </p>
      </header>

      <LeaderLoginForm venues={options} />

      <p className="mt-8 mb-3 text-center">
        <Link href="/admin/login" className="label hover:text-ink">
          Admin sign in
        </Link>
      </p>

      {/* Instructions as an acknowledged dialog: it opens itself the first
          time on a device, so nobody starts uploading without seeing the rule,
          and stays one tap away afterwards. */}
      <div className="mt-4">
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
