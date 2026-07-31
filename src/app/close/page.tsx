import { redirect } from "next/navigation";

import { CloseChecklist } from "@/components/close/CloseChecklist";
import { BackLink } from "@/components/ui";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The nightly close, for review.
 *
 * Behind the same sign-in as everything else, because it is on the live site
 * and a checklist naming a venue's routine is not something to leave open. It
 * saves nothing yet — the point is to put the flow on a real phone in a real
 * venue at a real 2am and find out what breaks.
 */
export default async function ClosePage() {
  if (!(await getSession())) redirect("/");

  return (
    <main className="mx-auto max-w-2xl">
      <BackLink href="/venue">Back</BackLink>

      <header className="mt-4 mb-6">
        <span className="pill pill-pending">Prototype · nothing is saved</span>
        <p className="label mt-3">Night Hawk · MOD close</p>
        <h1 className="mt-2 text-metric font-medium">Close checklist</h1>
      </header>

      <CloseChecklist />

      <p className="label mt-8">
        A review build. Reloading the page clears the night.
      </p>
    </main>
  );
}
