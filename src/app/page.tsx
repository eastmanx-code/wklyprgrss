import Link from "next/link";
import { redirect } from "next/navigation";

import { HowToDialog } from "@/components/HowToDialog";
import { APP_NAME } from "@/lib/app";
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
    <main className="rise mx-auto flex min-h-[calc(100dvh-9rem)] max-w-md flex-col justify-center">
      <header className="mb-8">
        <h1 className="text-center text-3xl font-medium tracking-tight">
          {APP_NAME}
        </h1>
      </header>

      <LeaderLoginForm venues={options} />

      {/* One quiet row of secondary actions, so neither competes with
          Continue. The dialog still opens itself on a first visit. */}
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
