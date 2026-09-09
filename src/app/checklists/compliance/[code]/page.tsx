import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { NightNav } from "@/components/checklists/Compliance";
import { BackLink } from "@/components/ui";
import {
  nightCompliance,
  type ListGroup,
  type ListVerdict,
} from "@/lib/compliance";
import { closeVenueId, venueNameOf } from "@/lib/close-venue";
import { currentNight, formatNightSpan } from "@/lib/night";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One venue's night, list by list, in plain words.
 *
 * It had a score bar, a panel explaining what pace means, a table of failures
 * by position, and a card per list stamped PASS or FAIL — four ways of saying
 * the same night, and a manager reading it at ten in the morning still had to
 * text to ask which two lists were missed. Now it is four piles in the order a
 * person asks about them: what nobody signed, what was signed with things
 * left, what is still going, what is done. Each row is a sentence with names
 * and times in it. No verdicts; verdicts are a thing the app decided, and the
 * report is for what happened.
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

  // Anybody but an admin reads their own venue and no other, whatever they
  // type in the address bar. The group screen filters its list; this one has
  // to enforce it, because a URL is not a permission.
  if (session.role !== "admin") {
    const mine = await closeVenueId(session);
    const { data } = mine
      ? await db().from("venues").select("code").eq("id", mine).maybeSingle()
      : { data: null };
    if ((data as { code: string } | null)?.code !== code) notFound();
  }

  const venue = (await nightCompliance(night)).find((v) => v.code === code);
  if (!venue) notFound();

  const name = await venueNameOf(code);
  const pile = (group: ListGroup) =>
    venue.lists.filter((list) => list.group === group);

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <BackLink href={`/checklists/compliance?night=${night}`}>
        All venues
      </BackLink>

      <header className="mt-4 mb-5">
        <p className="label">
          {formatNightSpan(night)}
          {name === code ? "" : ` · ${code}`}
        </p>
        <h1 className="text-metric mt-2 leading-tight font-medium break-words">
          {name}
        </h1>
        {/* The whole night in one line, and the only numbers on the page
            that are not attached to a list. */}
        <p className="note text-muted mt-2">
          {venue.listsSigned} of {venue.listsTotal} lists signed ·{" "}
          {venue.ticked} of {venue.owed} items done
        </p>
      </header>

      <Pile
        title="Nobody signed"
        rows={pile("unsigned")}
        warn
        code={code}
        night={night}
      />
      <Pile
        title="Signed with things left"
        rows={pile("gaps")}
        warn
        code={code}
        night={night}
      />
      <Pile
        title="Still going"
        rows={pile("going")}
        code={code}
        night={night}
      />
      <Pile
        title="Done and signed"
        rows={pile("done")}
        code={code}
        night={night}
      />
      <Pile
        title="Nothing written on the list yet"
        rows={pile("empty")}
        code={code}
        night={night}
      />

      <NightNav night={night} base={`/checklists/compliance/${code}`} />
    </main>
  );
}

/**
 * One pile of lists. Empty piles do not appear: "Nobody signed · 0" is a
 * line about nothing, and a good night should read shorter than a bad one.
 */
function Pile({
  title,
  rows,
  warn,
  code,
  night,
}: {
  title: string;
  rows: ListVerdict[];
  warn?: boolean;
  code: string;
  night: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section className={`panel mt-3 ${warn ? "border-warn/30" : ""}`}>
      <p className="label">
        {title} · {rows.length}
      </p>
      <ul className="mt-3">
        {rows.map((list) => (
          /* Keyed on the list itself. Role plus phase plus house was unique
             until a position could run three lists that share all three. */
          <li
            key={list.row.checklist_id}
            className="border-divider border-t py-2.5 first:border-t-0 first:pt-0"
          >
            <Link
              href={`/checklists/compliance/${code}/${list.row.checklist_id}?night=${night}`}
              className="block"
            >
              <span className="text-body">{list.reason}</span>
              {/* The pace, where it is worth saying. A number, not a
                  verdict: somebody who worked off paper and entered it after
                  looks the same from here. */}
              {list.flag ? (
                <span className="label text-warn mt-1 block">{list.flag}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
