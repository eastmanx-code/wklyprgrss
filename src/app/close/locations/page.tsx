import Link from "next/link";
import { redirect } from "next/navigation";

import { CloseBar } from "@/components/close/CloseBar";
import { BackLink } from "@/components/ui";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Which building, before which position.
 *
 * An admin has no venue of their own, so every checklist screen used to show
 * them one venue picked in code. This is the step that was missing: locations,
 * then the positions in that location, then the list. A leader never sees it,
 * because a leader has exactly one answer to the question.
 *
 * Venues with lists lead. Twenty-one codes in one column, twenty of them dead,
 * is a page you have to read rather than scan.
 */
export default async function LocationsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  // A leader has one venue and it is already theirs. Sending them here would
  // be a list of one, or worse, a list of everybody else's.
  if (session.role !== "admin") redirect("/close");

  const [{ data: venueRows }, { data: listRows }] = await Promise.all([
    db().from("venues").select("id, code, name").order("code"),
    db().from("close_checklists").select("venue_id").eq("active", true),
  ]);

  const venues = (venueRows ?? []) as {
    id: string;
    code: string;
    name: string | null;
  }[];

  const counts = new Map<string, number>();
  for (const row of (listRows ?? []) as { venue_id: string }[]) {
    counts.set(row.venue_id, (counts.get(row.venue_id) ?? 0) + 1);
  }

  const withLists = venues.filter((v) => (counts.get(v.id) ?? 0) > 0);
  const without = venues.filter((v) => (counts.get(v.id) ?? 0) === 0);

  const nameOf = (v: { code: string; name: string | null }) =>
    v.name && v.name !== v.code ? v.name : v.code;

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <BackLink href="/home">Home</BackLink>

      <header className="mt-4 mb-5">
        <p className="label">Checklists</p>
        <h1 className="text-metric mt-2 font-medium">Pick a location</h1>
      </header>

      {withLists.length === 0 ? (
        <section className="panel">
          <h2 className="card-title">Nothing written yet</h2>
          <p className="note text-muted mt-2 leading-relaxed">
            No venue has a checklist on it. Pick one below and start the first
            list.
          </p>
        </section>
      ) : (
        <section>
          <h2 className="card-title">Running lists</h2>
          <ul className="mt-3 space-y-2">
            {withLists.map((venue) => (
              <li key={venue.id}>
                <VenueLink
                  id={venue.id}
                  name={nameOf(venue)}
                  code={venue.code}
                  lists={counts.get(venue.id) ?? 0}
                  lit
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Still listed, still openable. A venue with no lists is where somebody
          goes to write the first one, so hiding it would hide the only way to
          start. Quiet, because it is not where the work is. */}
      {without.length > 0 ? (
        <section className="mt-6">
          <h2 className="card-title">No lists yet</h2>
          <ul className="mt-3 space-y-2">
            {without.map((venue) => (
              <li key={venue.id}>
                <VenueLink
                  id={venue.id}
                  name={nameOf(venue)}
                  code={venue.code}
                  lists={0}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <CloseBar back="/home" />
    </main>
  );
}

function VenueLink({
  id,
  name,
  code,
  lists,
  lit = false,
}: {
  id: string;
  name: string;
  code: string;
  lists: number;
  lit?: boolean;
}) {
  return (
    <Link
      href={`/close/enter/${id}`}
      className={`flex min-h-14 flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[4px] px-4 py-3 ${
        lit
          ? "bg-warn text-on-warn hover:bg-warn/90"
          : "bg-inset hover:ring-muted/30 hover:ring-1 hover:ring-inset"
      }`}
    >
      <span className="text-body tracking-[0.06em]">{name}</span>
      {name === code ? null : (
        <span
          className={`text-label tracking-[0.08em] ${
            lit ? "text-on-warn" : "text-muted"
          }`}
        >
          {code}
        </span>
      )}
      <span
        className={`ml-auto text-label tracking-[0.08em] ${
          lit ? "text-on-warn" : "text-muted"
        }`}
      >
        {lists === 0
          ? "Start one"
          : `${lists} ${lists === 1 ? "list" : "lists"}`}
      </span>
    </Link>
  );
}
