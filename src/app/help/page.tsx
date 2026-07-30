import { redirect } from "next/navigation";

import { AdminGuide, LeaderGuide } from "@/components/HowToUse";
import { BackLink } from "@/components/ui";
import { getSession } from "@/lib/session";
import { WEEKLY_ITEM_TARGET } from "@/lib/status";
import { currentWeekStart, formatDeadline } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const deadlineLabel = formatDeadline(currentWeekStart());
  const isAdmin = session.role === "admin";

  return (
    <main>
      <BackLink href={isAdmin ? "/admin" : "/venue"}>
        {isAdmin ? "All venues" : "My items"}
      </BackLink>

      <header className="mt-4 mb-6">
        <p className="label">Weekly Walkthrough</p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight">
          How to use this
        </h1>
      </header>

      {isAdmin ? (
        <AdminGuide deadlineLabel={deadlineLabel} />
      ) : (
        <LeaderGuide
          target={WEEKLY_ITEM_TARGET}
          deadlineLabel={deadlineLabel}
        />
      )}
    </main>
  );
}
