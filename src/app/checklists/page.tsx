import Link from "next/link";
import { redirect } from "next/navigation";

import { MissedList } from "@/components/checklists/MissedList";
import { T } from "@/components/Lang";
import { BackLink } from "@/components/ui";
import { formatNight } from "@/lib/night";
import { venueRollup } from "@/lib/rollup";
import {
  closeVenueCode,
  closeVenueId,
  closeVenueName,
} from "@/lib/close-venue";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Two buckets, no legend, the same rule the whole report uses: quiet grey for
 * a night every list was done and signed, yellow for a night something was
 * not.
 */
const NIGHT_STATE: Record<string, string> = {
  c: "bg-ink/20",
  m: "bg-warn",
};

function rateOf(done: number, of: number): number {
  return of === 0 ? 0 : Math.round((done / of) * 100);
}

/** A bar with the share on the end, coloured by the same bands the tiers use. */
function Bar({ done, of }: { done: number; of: number }) {
  const pct = rateOf(done, of);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <span className="bg-inset h-1.5 min-w-0 flex-1 rounded-[1px]">
        <span
          className={`block h-full rounded-[1px] ${
            pct < 60 ? "bg-warn" : pct < 80 ? "bg-warn/40" : "bg-ink/30"
          }`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="label w-10 shrink-0 text-right tabular-nums">{pct}%</span>
    </span>
  );
}

/**
 * The store lens: one venue's compliance, stats first.
 *
 * This is where a shift lands. Not the clipboard — the report on it: how the
 * month is going, and above all what keeps getting missed, which is the whole
 * reason the lists exist. Doing tonight's work is one clear tap away rather
 * than the first thing in your face, because the question a leader opens this
 * with is "are we ok", and the answer is on the page before anything is
 * tapped. Crew, leaders and a store's own manager all see the same thing, so
 * anyone can see when it is slipping.
 */
export default async function ChecklistsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  // A store-scoped session carries its venue. An admin with no building picked
  // belongs on the all-locations lens, not here.
  const venue = await closeVenueId(session);
  if (!venue) {
    if (session.role === "admin") redirect("/checklists/locations");
    redirect("/");
  }

  const [name, code, report] = await Promise.all([
    closeVenueName(venue),
    closeVenueCode(venue),
    venueRollup(venue),
  ]);

  const DoButton = (
    <Link
      href="/checklists/do"
      className="bg-warn text-on-warn hover:bg-warn/90 flex min-h-14 items-center justify-between gap-3 rounded-[6px] px-5 py-4 text-title tracking-[0.02em]"
    >
      <T en="Do the checklists" es="Hacer las listas" />
      <span aria-hidden>→</span>
    </Link>
  );

  // Nothing signed off yet. One honest line and the way in to start, rather
  // than a page of confident zeroes.
  if (!report) {
    return (
      <main className="close-flow mx-auto max-w-2xl pb-4">
        <BackLink href={session.role === "admin" ? "/checklists/locations" : "/home"}>
          {session.role === "admin" ? (
            <T en="All locations" es="Todas las ubicaciones" />
          ) : (
            <T en="Home" es="Inicio" />
          )}
        </BackLink>
        <header className="mt-4 mb-5">
          <p className="label">{name ?? code}</p>
          <h1 className="mt-2 text-metric font-medium">
            <T en="What's getting missed" es="Qué se está faltando" />
          </h1>
        </header>
        <div className="mb-5">{DoButton}</div>
        <section className="panel-quiet">
          <p className="note text-muted leading-relaxed">
            <T
              en="Nothing signed off yet. The report starts the night somebody signs a list and builds from there: what got left open, by position and by night."
              es="Todavía nada firmado. El informe empieza la noche que alguien firma una lista y crece desde ahí: qué quedó abierto, por puesto y por noche."
            />
          </p>
        </section>
      </main>
    );
  }

  const { nights, strip, latest, missed, byRole, certifiers } = report;

  // Repeated first: a thing missed more than once, or more than a quarter of
  // the nights it was owed. A single stray miss is not the conversation.
  const isRepeated = (open: number, of: number) =>
    open > 1 || (of > 0 && open / of >= 0.25);
  const repeated = missed.filter((m) => isRepeated(m.open, m.of));
  // New this week: missed recently, but not yet a standing problem. Caught
  // before it becomes one.
  const newlyMissed = missed.filter(
    (m) => !isRepeated(m.open, m.of) && m.recentOpen > 0,
  );
  const latestShort = latest
    ? latest.notSigned.length + latest.notDone.length
    : 0;

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <BackLink href={session.role === "admin" ? "/checklists/locations" : "/home"}>
        {session.role === "admin" ? (
          <T en="All locations" es="Todas las ubicaciones" />
        ) : (
          <T en="Home" es="Inicio" />
        )}
      </BackLink>

      <header className="mt-4 mb-5">
        <p className="label">
          {name ? `${name} · ` : ""}
          <T
            en={`last 30 nights · ${nights} recorded`}
            es={`últimas 30 noches · ${nights} registradas`}
          />
        </p>
        <h1 className="mt-2 text-metric font-medium">
          <T en="What's getting missed" es="Qué se está faltando" />
        </h1>
      </header>

      {/* The way to the work, up top and unmissable, and the night's photos
          beside it: the proof is a first-class thing a leader opens, not a
          link buried at the bottom of a list. */}
      <div className="mb-5 flex flex-col gap-3">
        {DoButton}
        {code && latest ? (
          <Link
            href={`/checklists/compliance/${code}/photos?night=${latest.night}`}
            className="ring-card-border text-ink hover:bg-hover flex min-h-12 items-center justify-between gap-3 rounded-[6px] px-5 text-label tracking-[0.08em] ring-1"
          >
            <T
              en="See the night's photos"
              es="Ver las fotos de la noche"
            />
            <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>

      {/* Standing: the month in one line and one strip, with last night's
          verdict under it. */}
      <section className="panel mb-4">
        <div className="flex items-baseline justify-between gap-4">
          <p className="label">
            <T
              en="Lists checked off and signed off"
              es="Listas marcadas y firmadas"
            />
          </p>
          <p className="text-title tabular-nums tracking-[0.08em]">
            {report.done} <T en="of" es="de" /> {report.of} ·{" "}
            {rateOf(report.done, report.of)}%
          </p>
        </div>
        <div className="mt-2.5 grid max-w-[22rem] grid-cols-10 gap-1" aria-hidden>
          {strip.split("").map((c, i) => (
            <span
              key={i}
              className={`aspect-square rounded-[2px] ${NIGHT_STATE[c] ?? "bg-inset"}`}
            />
          ))}
        </div>
        {latest && latestShort > 0 ? (
          <p className="note text-warn mt-3">
            <T
              en={`${formatNight(latest.night)} · ${latestShort} ${latestShort === 1 ? "list" : "lists"} short`}
              es={`${formatNight(latest.night)} · ${latestShort} ${latestShort === 1 ? "lista" : "listas"} corta`}
            />
            {code ? (
              <>
                {" · "}
                <Link
                  href={`/checklists/compliance/${code}?night=${latest.night}`}
                  className="hover:text-ink underline"
                >
                  <T en="what and who" es="qué y quién" />
                </Link>
              </>
            ) : null}
          </p>
        ) : latest ? (
          <p className="note text-muted mt-3">
            <T
              en={`No fails ${formatNight(latest.night)}.`}
              es={`Sin fallas ${formatNight(latest.night)}.`}
            />
          </p>
        ) : null}
      </section>

      <div className="space-y-4">
        {/* The hero. What keeps getting left open, worst first, in the words
            the crew reads, with the active run and the drift on each. */}
        <section className="panel border-warn/30">
          <p className="label">
            <T en="What keeps getting missed" es="Lo que se sigue faltando" />
          </p>
          <div className="mt-3">
            {repeated.length > 0 ? (
              <MissedList rows={repeated.slice(0, 12)} />
            ) : (
              <p className="note text-muted">
                <T
                  en={`Nothing missed more than once in the last ${nights} nights.`}
                  es={`Nada faltó más de una vez en las últimas ${nights} noches.`}
                />
              </p>
            )}
          </div>
          {newlyMissed.length > 0 ? (
            <div className="border-divider mt-4 border-t pt-3">
              <p className="label">
                <T en="New this week" es="Nuevo esta semana" />
              </p>
              <ul className="mt-2 space-y-1">
                {newlyMissed.slice(0, 6).map((m) => (
                  <li
                    key={`${m.role}-${m.phase}-${m.item}`}
                    className="text-body leading-relaxed"
                  >
                    <span className="label text-muted">
                      {m.house} · {m.role}
                    </span>{" "}
                    {m.item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {/* Which positions carry it. */}
        <section className="panel">
          <p className="label">
            <T en="Each position" es="Cada puesto" />
          </p>
          <ul className="mt-3 space-y-3">
            {byRole.map((row) => (
              <li key={row.role} className="flex items-center gap-3">
                <span className="label w-24 shrink-0">{row.role}</span>
                <Bar done={row.done} of={row.of} />
              </li>
            ))}
          </ul>
        </section>

        {/* Who is putting their name to it. */}
        <section className="panel">
          <p className="label">
            <T en="Who signs" es="Quién firma" />
          </p>
          <ul className="mt-3">
            {certifiers.length === 0 ? (
              <li className="note text-muted">
                <T
                  en="Nobody has signed a list yet."
                  es="Nadie ha firmado una lista todavía."
                />
              </li>
            ) : null}
            {certifiers.map((row) => (
              <li
                key={row.who}
                className="border-divider flex items-baseline justify-between gap-4 border-t py-2.5 first:border-t-0"
              >
                <span className="text-body">{row.who}</span>
                <span className="label tabular-nums">
                  {row.nights} {row.nights === 1 ? "list" : "lists"}
                </span>
              </li>
            ))}
          </ul>
          {certifiers.length === 1 && nights > 1 ? (
            <p className="note text-muted mt-3">
              <T
                en="One name on everything. A second signature is the check that a list was actually walked, not just closed."
                es="Un solo nombre en todo. Una segunda firma confirma que la lista se recorrió de verdad, no solo que se cerró."
              />
            </p>
          ) : null}
        </section>
      </div>

      {/* The way to the work again, at the foot, for a reader who scrolled the
          report and now wants to go do it. */}
      <div className="mt-6">{DoButton}</div>
    </main>
  );
}
