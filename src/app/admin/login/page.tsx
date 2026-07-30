import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/AdminLoginForm";
import { BackLink } from "@/components/ui";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if ((await getSession())?.role === "admin") redirect("/admin");

  return (
    <main className="mx-auto max-w-md">
      <BackLink href="/">Leader sign in</BackLink>

      <header className="mt-4 mb-8">
        <p className="label">Weekly Walkthrough</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">Admin</h1>
      </header>

      <AdminLoginForm />
    </main>
  );
}
