import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/AdminLoginForm";
import { BackLink } from "@/components/ui";
import { APP_NAME } from "@/lib/app";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if ((await getSession())?.role === "admin") redirect("/admin");

  return (
    // Centred like the leader sign-in: a small form stranded at the top of an
    // empty screen reads as unfinished.
    <main className="rise mx-auto flex min-h-[calc(100dvh-9rem)] max-w-md flex-col justify-center">
      <BackLink href="/">Leader sign in</BackLink>

      <header className="mt-4 mb-8 text-center">
        <p className="label">{APP_NAME}</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">Admin</h1>
      </header>

      <AdminLoginForm />
    </main>
  );
}
