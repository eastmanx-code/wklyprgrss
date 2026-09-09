import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/AdminLoginForm";
import { APP_NAME } from "@/lib/app";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  // Whoever is already through this door goes where their code takes them. It
  // used to only send admins on, so a manager who came back to this screen was
  // shown a sign in form for the session they were holding, which reads as
  // having been logged out.
  const session = await getSession();
  if (session?.role === "admin") redirect("/admin");
  if (session?.role === "manager") redirect("/home");

  return (
    // Centred like the leader sign-in: a small form stranded at the top of an
    // empty screen reads as unfinished.
    <main className="rise mx-auto flex min-h-[calc(100dvh-9rem)] max-w-md flex-col justify-center">
      <header className="mb-8 text-center">
        <span className="ch-mark mx-auto mb-6 h-20" aria-hidden />
        <p className="label">{APP_NAME}</p>
        {/* Both codes come through here and only one of them is an admin's.
            A manager reading "Admin" over the box has to decide whether their
            PIN is the sort meant, which is a decision the app can make. */}
        <h1 className="mt-2 text-metric font-medium">Manager</h1>
      </header>

      <AdminLoginForm />

      {/* Below the card, centred — above the title it hangs off to one side
          and breaks the column everything else lines up on. */}
      <p className="mt-6 text-center">
        <Link href="/" className="label hover:text-ink">
          ← Crew sign in
        </Link>
      </p>
    </main>
  );
}
