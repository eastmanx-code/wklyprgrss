import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CloseBar } from "@/components/close/CloseBar";
import { NightNav, ScoreBar, VerdictRow } from "@/components/close/Compliance";
import { BackLink } from "@/components/ui";
import { phaseName } from "@/lib/checklists";
import { failuresByRole, nightCompliance } from "@/lib/compliance";
import { closeVenueId, venueNameOf } from "@/lib/close-venue";
import { currentNight, formatNight } from "@/lib/night";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One venue's night, list by list.
 *
 * The score on the screen before says something is wrong. This says which
 * list, which position owns it, and why — because "3 of 10" sends a manager
 * hunting and "prep close, never opened, line cook" does not.
 */
export default async function VenueCompliancePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ night?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const code = (await params).code.toUpperCase();
  const asked = (await searchParams).night;
  const night = asked && NIGHT.test(asked) ? asked : currentNight();

  // A leader can read their own venue and no other, whatever they type in the
  // address bar. The group screen filters its list; this one has to enforce
  // it, because a URL is not a permission.
  if (session.role === "leader") {
    const mine = await closeVenueId(session);
    const { data } = mine
      ? await db().from("venues").select("code").eq("id", mine).maybeSingle()
      : { data: null };
    if ((data as { code: string } | null)?.code !== code) notFound();
  }

  const venue = (await nightCompliance(night)).find((v) => v.code === code);
  if (!venue) notFound();

  const byRole = failuresByRole(venue.lists);
  const name = await venueNameOf(code);

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <BackLink href={`/close/compliance?night=${night}`}>All venues</BackLink>

      {/* The name over the code. The code is what the URL and the board
          carry; the heading is where somebody checks they are looking at the
          right building, and "HOOD" is not what anybody calls it. */}
      <header className="mt-4 mb-5">
        <p className="label">
          {formatNight(night)}
          {name === code ? "" : ` · ${code}`}
        </p>
        {/* Wraps rather than truncates. A venue whose name runs past the
            phone is a venue whose report says "Youngblood Bar and Kit",
            and the heading is the one line on the page whose whole job is
            saying which building this is. */}
        <h1 className="text-metric mt-2 leading-tight font-medium break-words">
          {name}
        </h1>
      </header>

      <ScoreBar
        score={venue.score}
        code={code}
        tier={venue.tier}
        note={`${venue.ticked} of ${venue.owed} items · ${venue.listsSigned} of ${venue.listsTotal} lists signed`}
      />

      {/* Three fails at one venue read as a bad night. Three fails that are
          all the same position read as one conversation with one person, and
          that is invisible until something groups on it. */}
      {byRole.length > 0 ? (
        <section className="panel border-warn/30 mt-3">
          <h2 className="card-title">Where the failures sit</h2>
          <ul className="mt-3 space-y-2">
            {byRole.map((row) => (
              <li
                key={row.role}
                className="border-divider flex items-baseline justify-between gap-4 border-t pt-2 first:border-t-0 first:pt-0"
              >
                <span className="text-body">{row.role}</span>
                <span className="label tabular-nums">
                  {row.failed} of {row.of} failed
                </span>
              </li>
            ))}
          </ul>
          {byRole.length === 1 && byRole[0].failed > 1 ? (
            <p className="note text-muted mt-3 leading-relaxed">
              Every failure tonight belongs to one position. That is a
              conversation with one person, not a venue problem.
            </p>
          ) : null}
        </section>
      ) : null}

      <ul className="mt-3 space-y-2">
        {venue.lists.map((list) => (
          <li key={list.row.role + list.row.phase + list.row.house}>
            <Link
              href={`/close/compliance/${code}/${list.row.checklist_id}?night=${night}`}
              className="block"
            >
              <VerdictRow
                name={`${phaseName(list.row.phase)} · ${list.row.house}`}
                state={list.state}
                reason={list.reason}
              />
            </Link>
          </li>
        ))}
      </ul>

      <NightNav night={night} base={`/close/compliance/${code}`} />

      <CloseBar back={`/close/compliance?night=${night}`} />
    </main>
  );
}
