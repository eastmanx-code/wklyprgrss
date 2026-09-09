import Link from "next/link";
import { Fragment } from "react";
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
      <BackLink
        href={
          session.role === "admin"
            ? `/checklists/locations?night=${night}`
            : "/checklists"
        }
      >
        {session.role === "admin" ? "All locations" : "Checklists"}
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
        title="Fail · not signed off"
        rows={pile("unsigned")}
        warn
        code={code}
        night={night}
      />
      <Pile
        title="Fail · not checked off"
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
        title="No fail"
        rows={pile("done")}
        folded
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

      {/* The same rows over thirty nights: what keeps getting left. Reached
          from here, where a manager is already looking at fails, and from
          nowhere the crew opens. */}
      <p className="mt-6">
        <Link
          href={`/checklists/rollup?code=${code}`}
          className="ring-card-border text-ink inline-flex min-h-11 items-center gap-2 rounded px-4 text-label tracking-[0.08em] ring-1"
        >
          What keeps getting missed
          <span className="text-muted">last 30 nights</span>
        </Link>
      </p>
    </main>
  );
}

/**
 * One pile of lists. Empty piles do not appear: "Nobody signed · 0" is a
 * line about nothing, and a good night should read shorter than a bad one.
 *
 * A folded pile shows its heading and count and opens on a tap. The lists
 * with no fail are the who record and belong on the page, but twelve of
 * them under two fails made the page mostly record, and the page is for
 * the fails.
 */
function Pile({
  title,
  rows,
  warn,
  folded,
  code,
  night,
}: {
  title: string;
  rows: ListVerdict[];
  warn?: boolean;
  folded?: boolean;
  code: string;
  night: string;
}) {
  if (rows.length === 0) return null;
  // The two failure piles are solid yellow, the way the old FAIL cards were.
  // Toned down to a thin border they read as one more grey box on a page of
  // grey boxes, and the whole point of the page is that these two are not.
  const shell = warn ? "bg-warn text-on-warn border-warn" : "panel";
  const rule = warn ? "border-on-warn/25" : "border-divider";
  const heading = (
    <span className={`label ${warn ? "text-on-warn" : ""}`}>
      {title} · {rows.length}
    </span>
  );
  const list = (
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
            <Facts list={list} warn={warn} />
          </Link>
        </li>
      ))}
    </ul>
  );
  if (folded) {
    return (
      <details className={`mt-3 rounded-[8px] border px-5 py-4 ${shell}`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
          {heading}
          <span className="label">tap to open</span>
        </summary>
        {list}
      </details>
    );
  }
  return (
    <section className={`mt-3 rounded-[8px] border px-5 py-4 ${shell}`}>
      <p>{heading}</p>
      {list}
    </section>
  );
}

/**
 * One list, as lines.
 *
 * The name heavy and on its own line, then each fact under it with a small
 * label on the left: checked off, signed off, not checked off. It was one
 * sentence with dots in it, and at thirty-four items and two names it ran to
 * two lines in one weight and the eye had nowhere to land. The value that
 * is the fail is heavy too, so the reason reads before the rest does.
 */
function Facts({ list, warn }: { list: ListVerdict; warn?: boolean }) {
  return (
    <div>
      <p className={`text-title font-medium ${warn ? "text-on-warn" : ""}`}>
        {list.name}
      </p>
      {/* One label column width on every card, and baselines that meet.
          Sized to the widest label the page uses, so "checked off" sits in
          the same place whether or not "not checked off" is on the card. */}
      <dl className="mt-2 grid grid-cols-[8.5rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1">
        {list.facts.map((fact) => (
          <Fragment key={fact.label}>
            <dt className={`label ${warn ? "text-on-warn/70" : ""}`}>
              {fact.label}
            </dt>
            <dd
              className={`text-body min-w-0 break-words ${
                fact.warn ? "font-medium" : warn ? "text-on-warn" : "text-muted"
              }`}
            >
              {fact.value}
            </dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}
