import Link from "next/link";
import { redirect } from "next/navigation";

import { LeaderLoginForm } from "@/components/LeaderLoginForm";
import { getSession } from "@/lib/session";
import { getVenues } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (session?.role === "leader") redirect("/venue");
  if (session?.role === "admin") redirect("/admin");

  // getVenues never selects the PIN column, so there is nothing to strip.
  const options = await getVenues();

  return (
    <main>
      <header className="mb-8">
        <p className="label">Weekly Walkthrough</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">
          Our weekly progress
        </h1>
      </header>

      <LeaderLoginForm venues={options} />

      <p className="mt-8 text-center">
        <Link href="/admin/login" className="label hover:text-ink">
          Admin sign in
        </Link>
      </p>
    </main>
  );
}
