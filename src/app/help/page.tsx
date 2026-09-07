import { T } from "@/components/Lang";
import { CloseGuide, LeaderGuide } from "@/components/HowToUse";
import { BackLink } from "@/components/ui";
import { APP_NAME } from "@/lib/app";
import { getSession } from "@/lib/session";
import { WEEKLY_ITEM_TARGET, scoredHouses } from "@/lib/status";
import { currentWeekStart, formatDeadline } from "@/lib/week";

export const dynamic = "force-dynamic";

/**
 * Both products, in the order the reader came for.
 *
 * "How to" sits in the corner menu on every screen, and there are two things a
 * person could be holding when they tap it. Until now it answered for the
 * weekly board whichever they were in, so a bartender halfway through a close
 * got a page about photographing ten items by Wednesday. That is worse than an
 * empty page: the first thing it teaches is that the help is for somebody else.
 *
 * Both guides are on the one page rather than two, so the menu link never has
 * to be right about which you want, and the one you did not come for is still
 * a scroll away rather than a thing to go and find.
 */
export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ for?: string }>;
}) {
  const session = await getSession();
  const asked = (await searchParams).for;
  // "close" still works: it is in links printed before this was renamed.
  const listsFirst = asked === "checklists" || asked === "close";

  const deadlineLabel = formatDeadline(currentWeekStart());
  // One guide each, for the people doing the work. There is a single admin and
  // he doesn't need a manual — but he does need to see what staff are told.

  const weekly = (
    <section id="weekly">
      <h2 className="label mb-3">Weekly progress</h2>
      <LeaderGuide
        target={WEEKLY_ITEM_TARGET}
        houses={scoredHouses(currentWeekStart()).length}
        deadlineLabel={deadlineLabel}
      />
    </section>
  );

  const close = (
    <section id="close">
      <h2 className="label mb-3">
        <T en="Checklists" es="Listas" />
      </h2>
      <CloseGuide />
    </section>
  );

  return (
    <main className="rise mx-auto max-w-2xl">
      {/* Named for where it goes. Both roles land on the same door now, so
          "All venues" on a link to it was describing the old destination. */}
      <BackLink href={session ? "/home" : "/"}>
        {session ? <T en="Home" es="Inicio" /> : "Sign in"}
      </BackLink>

      <header className="mt-4 mb-6">
        <p className="label">{APP_NAME}</p>
        <h1 className="mt-2 text-metric font-medium">
          <T en="How to use this" es="Cómo usar esto" />
        </h1>
      </header>

      <div className="space-y-8">
        {listsFirst ? (
          <>
            {close}
            {weekly}
          </>
        ) : (
          <>
            {weekly}
            {close}
          </>
        )}
      </div>
    </main>
  );
}
