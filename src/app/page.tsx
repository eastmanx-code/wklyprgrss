import Link from "next/link";
import { redirect } from "next/navigation";

import { LeaderGuide } from "@/components/HowToUse";
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
    <main>
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

      {/* The instructions live on the sign-in screen, not behind it — this is
          where someone is most likely to not know what they're doing. */}
      <section className="mt-10">
        <h2 className="label mb-3">How to use this</h2>
        <LeaderGuide
          target={WEEKLY_ITEM_TARGET}
          deadlineLabel={deadlineLabel}
        />
      </section>
    </main>
  );
}
