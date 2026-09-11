import Link from "next/link";
import { redirect } from "next/navigation";

import { LangFromLink } from "@/components/Lang";
import { LeaderLoginForm } from "@/components/LeaderLoginForm";
import { APP_NAME, safeNext } from "@/lib/app";
import { getSession } from "@/lib/session";
import { getVenues } from "@/lib/status";

export const dynamic = "force-dynamic";

/**
 * Sign-in only. The company dashboard belongs on the board, behind a PIN —
 * this page is reachable by anyone with the URL, and how each venue is doing
 * isn't something to publish to the open internet.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string; next?: string; lang?: string }>;
}) {
  const session = await getSession();
  const { venue: wantedCode, next, lang } = await searchParams;
  const landing = safeNext(next);
  // Both roles land on the same door now, which asks which product they are
  // here for rather than assuming. A link that named a destination keeps it,
  // so a scanned code goes where it was pointed on the second morning too.
  if (session) redirect(landing);

  const venues = await getVenues();

  // A printed code belongs to one building, so it names it and the person
  // scanning it only ever types a PIN. Matched on the code rather than the id
  // so the URL is something a human can read and retype.
  const wanted = wantedCode
    ? venues.find((v) => v.code.toLowerCase() === wantedCode.toLowerCase())
    : undefined;

  return (
    <main className="rise mx-auto flex min-h-[calc(100dvh-9rem)] max-w-md flex-col justify-center">
      <header className="mb-8">
        <span className="ch-mark mx-auto h-20" aria-hidden />
        <h1 className="text-metric mt-6 text-center font-medium">{APP_NAME}</h1>
      </header>

      <LangFromLink lang={lang} />

      <LeaderLoginForm
        venues={venues}
        defaultVenueId={wanted?.id ?? ""}
        next={next && landing !== "/home" ? landing : undefined}
        forceEs={lang === "es"}
      />

      <div className="mt-6 flex items-center justify-center gap-4">
        <Link href="/admin/login" className="label hover:text-ink">
          Manager sign in
        </Link>
        <span className="label" aria-hidden>
          ·
        </span>
        {/* A link, not a popup. The instructions used to open over the
            sign in on every visit and had to be acknowledged before the PIN
            box could be reached, which is a gate in front of a barback at
            one in the morning. The help is one tap away for anyone who
            wants it. */}
        <Link href="/help" className="label hover:text-ink">
          How to use this
        </Link>
      </div>
    </main>
  );
}
