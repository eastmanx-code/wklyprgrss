import Link from "next/link";
import { redirect } from "next/navigation";

import { MissedList } from "@/components/checklists/MissedList";
import { Sparkline } from "@/components/checklists/Sparkline";
import { T } from "@/components/Lang";
import { BackLink } from "@/components/ui";
import { formatNight } from "@/lib/night";
import { venueRollup } from "@/lib/rollup";
import { closeVenueId, closeVenueName } from "@/lib/close-venue";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function rateOf(done: number, of: number): number {
  return of === 0 ? 0 : Math.round((done / of) * 100);
}

/**
 * The store lens: one venue's compliance, kept to three things.
 *
 * How the month is going, the way in to do tonight's work, and what keeps
 * getting missed. Nothing else. The page a leader opens to answer "are we ok"
 * answers it in the first line, without scrolling past four other panels.
 * Crew, leaders and the store's own manager all see the same thing.
 */
export default async function ChecklistsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const venue = await closeVenueId(session);
  if (!venue) {
    if (session.role === "admin") redirect("/checklists/locations");
    redirect("/");
  }

  const [name, report] = await Promise.all([
    closeVenueName(venue),
    venueRollup(venue),
  ]);

  const backHref = session.role === "admin" ? "/checklists/locations" : "/home";
  const backLabel =
    session.role === "admin" ? (
      <T en="All locations" es="Todas las ubicaciones" />
    ) : (
      <T en="Home" es="Inicio" />
    );

  const DoButton = (
    <Link
      href="/checklists/do"
      className="bg-warn text-on-warn hover:bg-warn/90 flex min-h-14 items-center justify-between gap-3 rounded-[6px] px-5 py-4 text-title tracking-[0.02em]"
    >
      <T en="Do the checklists" es="Hacer las listas" />
      <span aria-hidden>→</span>
    </Link>
  );

  // Nothing signed off yet. One honest line and the way in, not a page of
  // confident zeroes.
  if (!report) {
    return (
      <main className="close-flow mx-auto max-w-2xl pb-6">
        <BackLink href={backHref}>{backLabel}</BackLink>
        <header className="mt-4 mb-5">
          <p className="label">{name}</p>
          <h1 className="text-metric mt-2 font-medium">
            <T en="Nothing recorded yet" es="Todavía nada registrado" />
          </h1>
        </header>
        <div className="mb-5">{DoButton}</div>
        <p className="note text-muted leading-relaxed">
          <T
            en="The report starts the night somebody signs a list."
            es="El informe empieza la noche que alguien firma una lista."
          />
        </p>
      </main>
    );
  }

  const { nights, series, latest, missed, done, of } = report;
  const pct = rateOf(done, of);
  const fail = pct < 60;
  const neutral = pct >= 60 && pct < 80;
  const trend = series.map((s) => ({ percent: rateOf(s.done, s.of) }));

  const tooNew = nights < 5;
  const repeated = tooNew ? [] : missed.filter((m) => m.open >= 2);
  const latestShort = latest
    ? latest.notSigned.length + latest.notDone.length
    : 0;

  return (
    <main className="close-flow mx-auto max-w-2xl pb-6">
      <BackLink href={backHref}>{backLabel}</BackLink>

      {/* The month, as one number and one line. The question a leader opens
          with is "are we ok", and the answer is the first thing on the page. */}
      <header className="mt-4">
        <p className="label">
          {name ? `${name} · ` : ""}
          <T
            en={`last 30 nights · ${nights} recorded`}
            es={`últimas 30 noches · ${nights} registradas`}
          />
        </p>
        <h1
          className={`text-metric mt-2 font-medium tabular-nums ${fail ? "text-warn" : ""}`}
        >
          {pct}%{" "}
          <span className="text-muted text-title">
            <T en="signed off" es="firmadas" />
          </span>
        </h1>
        <p className="label mt-1 tabular-nums">
          {done} <T en="of" es="de" /> {of}{" "}
          <T
            en="lists checked off and signed off"
            es="listas marcadas y firmadas"
          />
        </p>
      </header>

      {/* The run as one line, no axes: the shape of the month next to the
          number, climbing, flat, or sliding. Warn when the store is failing. */}
      {trend.length >= 2 ? (
        <div
          className={`mt-4 ${fail ? "text-warn" : neutral ? "text-warn/60" : "text-ink/70"}`}
        >
          <Sparkline
            points={trend}
            width={640}
            height={56}
            className="h-14 w-full"
          />
        </div>
      ) : null}

      {latest ? (
        <p
          className={`note mt-3 ${latestShort > 0 ? "text-warn" : "text-muted"}`}
        >
          <T
            en={
              latestShort > 0
                ? `${latestShort} ${latestShort === 1 ? "list" : "lists"} short last night · ${formatNight(latest.night)}`
                : `no fails last night · ${formatNight(latest.night)}`
            }
            es={
              latestShort > 0
                ? `${latestShort} ${latestShort === 1 ? "lista" : "listas"} corta anoche · ${formatNight(latest.night)}`
                : `sin fallas anoche · ${formatNight(latest.night)}`
            }
          />
        </p>
      ) : null}

      <div className="mt-6">{DoButton}</div>

      {/* What keeps getting missed: the few that happened on two or more
          nights, worst first, in the words the crew reads. Capped, with the
          rest as a count. */}
      <section className="mt-8">
        <p className="label">
          <T en="What keeps getting missed" es="Lo que se sigue faltando" />
        </p>
        <div className="mt-3">
          {tooNew ? (
            <p className="note text-muted">
              <T
                en={`Only ${nights} ${nights === 1 ? "night" : "nights"} recorded. Too new to call a pattern yet.`}
                es={`Apenas ${nights} ${nights === 1 ? "noche" : "noches"} registradas. Muy pronto para ver un patrón.`}
              />
            </p>
          ) : repeated.length > 0 ? (
            <>
              <MissedList rows={repeated.slice(0, 6)} />
              {repeated.length > 6 ? (
                <p className="label text-muted mt-4">
                  <T
                    en={`+ ${repeated.length - 6} more missed on two or more nights`}
                    es={`+ ${repeated.length - 6} más que faltaron en dos o más noches`}
                  />
                </p>
              ) : null}
            </>
          ) : (
            <p className="note text-muted">
              <T
                en={`Nothing missed more than once in the last ${nights} nights.`}
                es={`Nada faltó más de una vez en las últimas ${nights} noches.`}
              />
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
