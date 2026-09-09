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
import { shortOf } from "@/lib/short";
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
        {/* Yellow the moment anything is short, so the line reads as a
            verdict before the piles do. */}
        <p
          className={`note mt-2 ${
            venue.notSigned + venue.notDone > 0 ? "text-warn" : "text-muted"
          }`}
        >
          <span className="text-title tabular-nums">{venue.score}/10</span>
          {" · "}
          {shortOf(venue)}
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
        title="Not done"
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

      <div className="mt-3">
        <NightNav night={night} base={`/checklists/compliance/${code}`} />
      </div>
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
  // The two failure piles are solid yellow, the way the old FAIL cards were.
  // Toned down to a thin border they read as one more grey box on a page of
  // grey boxes, and the whole point of the page is that these two are not.
  const shell = warn ? "bg-warn text-on-warn border-warn" : "panel";
  const rule = warn ? "border-on-warn/25" : "border-divider";
  return (
    <section className={`mt-3 rounded-[8px] border px-5 py-4 ${shell}`}>
      <p className={`label ${warn ? "text-on-warn" : ""}`}>
        {title} · {rows.length}
      </p>
      <ul className="mt-3">
        {rows.map((list) => (
          /* Keyed on the list itself. Role plus phase plus house was unique
             until a position could run three lists that share all three. */
          <li
            key={list.row.checklist_id}
            className={`${rule} border-t py-2.5 first:border-t-0 first:pt-0`}
          >
            <Link
              href={`/checklists/compliance/${code}/${list.row.checklist_id}?night=${night}`}
              className="block"
            >
              <Sentence text={list.reason} warn={warn} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One row, with weight where the eye should land.
 *
 * The list's name is the handle and the last clause is the point — "nobody
 * signed", "not done: the carts" — so both are bold. What sits between them is
 * the count and the signature, and on a quiet row those go muted so the name
 * stands off the page. On a yellow row everything is dark and the bold alone
 * carries it.
 */
function Sentence({ text, warn }: { text: string; warn?: boolean }) {
  const parts = text.split(" · ");
  if (parts.length < 2) return <span className="text-body">{text}</span>;
  const head = parts[0];
  const tail = parts[parts.length - 1];
  const middle = parts.slice(1, -1);
  return (
    <span className="text-body">
      <span className="font-medium">{head}</span>
      {middle.length > 0 ? (
        <span className={warn ? "" : "text-muted"}>
          {" "}
          · {middle.join(" · ")}
        </span>
      ) : null}
      <span className={warn ? "" : "text-muted"}> · </span>
      <span className={warn ? "font-medium" : "text-muted"}>{tail}</span>
    </span>
  );
}
