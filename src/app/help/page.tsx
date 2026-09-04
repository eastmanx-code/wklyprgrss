import { LeaderGuide } from "@/components/HowToUse";
import { BackLink } from "@/components/ui";
import { APP_NAME } from "@/lib/app";
import { getSession } from "@/lib/session";
import { WEEKLY_ITEM_TARGET, scoredHouses } from "@/lib/status";
import { currentWeekStart, formatDeadline } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const session = await getSession();

  const deadlineLabel = formatDeadline(currentWeekStart());
  // One guide, for the people doing the uploading. There is a single admin and
  // he doesn't need a manual — but he does need to see what staff are told.

  return (
    <main className="rise mx-auto max-w-2xl">
      {/* Named for where it goes. Both roles land on the same door now, so
          "All venues" on a link to it was describing the old destination. */}
      <BackLink href={session ? "/home" : "/"}>
        {session ? "Home" : "Sign in"}
      </BackLink>

      <header className="mt-4 mb-6">
        <p className="label">{APP_NAME}</p>
        <h1 className="mt-2 text-metric font-medium">How to use this</h1>
      </header>

      <LeaderGuide
        target={WEEKLY_ITEM_TARGET}
        houses={scoredHouses(currentWeekStart()).length}
        deadlineLabel={deadlineLabel}
      />
    </main>
  );
}
