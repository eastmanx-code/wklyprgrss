import Link from "next/link";

import { ManagerSignupForm } from "@/components/checklists/ManagerSignupForm";
import { APP_NAME } from "@/lib/app";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * The venue's own signup door.
 *
 * Public on purpose: a manager reaches it from a link the GM sent, before the
 * app knows anything about them. It shows the venue by name only when signup is
 * open, so a stale or wrong link reveals nothing and reads the same as a closed
 * one. The venue PIN on the form is what proves the person belongs here.
 */
export default async function ManagerSignupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const { data } = await db()
    .from("venues")
    .select("name, signup_open")
    .eq("signup_token", token)
    .maybeSingle();
  const venue = data as { name: string; signup_open: boolean } | null;
  const open = Boolean(venue && venue.signup_open);

  return (
    <main className="rise mx-auto flex min-h-[calc(100dvh-9rem)] max-w-md flex-col justify-center">
      <header className="mb-8 text-center">
        <span className="ch-mark mx-auto mb-6 h-20" aria-hidden />
        <p className="label">{APP_NAME}</p>
        {open && venue ? (
          <>
            <h1 className="mt-2 text-metric font-medium">Join {venue.name}</h1>
            <p className="label text-muted mt-1.5">Set your own manager code</p>
          </>
        ) : (
          <h1 className="mt-2 text-metric font-medium">Manager signup</h1>
        )}
      </header>

      {open ? (
        <ManagerSignupForm token={token} />
      ) : (
        <div className="panel p-6 text-center">
          <p className="text-body">
            This signup link is not active. Ask your GM for the current one.
          </p>
        </div>
      )}

      <p className="mt-6 text-center">
        <Link href="/" className="label hover:text-ink">
          ← Crew sign in
        </Link>
      </p>
    </main>
  );
}
