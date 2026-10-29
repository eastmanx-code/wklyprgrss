import Link from "next/link";
import { redirect } from "next/navigation";

import { MissedList } from "@/components/checklists/MissedList";
import { Sparkline } from "@/components/checklists/Sparkline";
import { T } from "@/components/Lang";
import { PHASE_ES, phaseName } from "@/lib/checklists";
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
        <div className="mt-4">{DoButton}</div>
        <section className="panel mt-4">
          <p className="label">{name}</p>
          <h1 className="text-metric mt-2 font-medium">
            <T en="Nothing recorded yet" es="Todavía nada registrado" />
          </h1>
          <p className="note text-muted mt-3 leading-relaxed">
            <T
              en="The report starts the night somebody signs a list."
              es="El informe empieza la noche que alguien firma una lista."
            />
          </p>
        </section>
      </main>
    );
  }

  const { nights, series, latest, missed, done, of } = report;
  const pct = rateOf(done, of);
  const fail = pct < 60;
  const neutral = pct >= 60 && pct < 80;
  const trend = series.map((s) => ({ percent: rateOf(s.done, s.of) }));

  // A real repeat offender, not everything missed twice. Over thirty nights
  // almost every item slips at least twice, so "missed >= 2" floods the list
  // and buries the chronic ones under one bad night listed item by item. The
  // bar is both: missed at least three times AND on at least a quarter of the
  // nights it was owed, so a thing owed thirty nights and missed four (one bad
  // stretch) drops out while a thing missed eight of thirty, or every night it
  // was owed, stays. Ranked by how often it slips, worst rate first.
  const tooNew = nights < 5;
  const MIN_MISSES = 3;
  const MIN_RATE = 0.25;
  const repeated = tooNew
    ? []
    : missed
        .filter((m) => m.of > 0 && m.open >= MIN_MISSES && m.open / m.of >= MIN_RATE)
        .sort((a, b) => b.open / b.of - a.open / a.of || b.open - a.open);
  // Last night, split by how bad the miss was: never opened, where nobody even
  // started the list, and signed a box short, where someone worked it and left
  // a box open. The two are not the same failure and should not read the same.
  const neverOpened = latest?.notSigned ?? [];
  const boxShort = latest?.notDone ?? [];
  const latestShort = neverOpened.length + boxShort.length;

  return (
    <main className="close-flow mx-auto max-w-2xl pb-6">
      <BackLink href={backHref}>{backLabel}</BackLink>

      {/* The one job first. Whoever opens this is here to do their list or to
          see who didn't; the way in sits at the top either way. */}
      <div className="mt-4">{DoButton}</div>

      {/* The standing: the number a leader opens with, the count under it, and
          the month as one line. */}
      <section className="panel mt-4">
        <p className="label">
          {name ? `${name} · ` : ""}
          <T
            en={`last 30 nights · ${nights} recorded`}
            es={`últimas 30 noches · ${nights} registradas`}
          />
        </p>
        <h1
          className={`mt-2 text-[44px] font-bold leading-none tabular-nums ${fail ? "text-warn" : ""}`}
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
      </section>

      {/* Last night, ranked by how bad the miss was. Never opened — nobody did
          it — rides the warn accent up top; signed a box short sits under a
          rule, dimmer and named, because those lists got done. Two counts
          first, so the shape of the night reads before the detail. */}
      {latest ? (
        <section className="panel mt-4">
          {latestShort === 0 ? (
            <p className="note text-muted">
              <T
                en={`No fails last night · ${formatNight(latest.night)}`}
                es={`Sin fallas anoche · ${formatNight(latest.night)}`}
              />
            </p>
          ) : (
            <>
              <p className="label">
                <T
                  en={`last night · ${formatNight(latest.night)}`}
                  es={`anoche · ${formatNight(latest.night)}`}
                />
              </p>

              <div className="mt-4 flex gap-2.5">
                <div className="border-warn/50 bg-warn/5 min-w-0 flex-1 rounded-[6px] border p-4">
                  <div className="text-warn text-[44px] font-bold leading-none tabular-nums">
                    {neverOpened.length}
                  </div>
                  <p className="label text-muted mt-2">
                    <T en="never opened" es="nunca se abrió" />
                  </p>
                </div>
                <div className="border-divider min-w-0 flex-1 rounded-[6px] border p-4">
                  <div className="text-[44px] font-bold leading-none tabular-nums">
                    {boxShort.length}
                  </div>
                  <p className="label text-muted mt-2">
                    <T en="signed a box short" es="firmada incompleta" />
                  </p>
                </div>
              </div>

              {neverOpened.length > 0 ? (
                <div className="mt-6">
                  <p className="card-title text-warn">
                    <T en="never opened" es="nunca se abrió" />
                    <span className="text-muted">
                      {" · "}
                      <T en="nobody did these" es="nadie las hizo" />
                    </span>
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {neverOpened.map((l, i) => {
                      const ph = l.phase as "open" | "mid" | "close";
                      return (
                        <li
                          key={`u-${l.role}-${l.room ?? ""}-${l.phase}-${i}`}
                          className="label border-warn/50 text-ink border-l-2 pl-3 leading-relaxed"
                        >
                          <T
                            en={[l.role, l.room, phaseName(ph)]
                              .filter(Boolean)
                              .join(" · ")}
                            es={[l.role, l.room, PHASE_ES[ph]]
                              .filter(Boolean)
                              .join(" · ")}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {boxShort.length > 0 ? (
                <div className="border-divider mt-6 border-t pt-5">
                  <p className="text-ink/70 text-body tracking-[0.08em]">
                    <T en="signed a box short" es="firmada incompleta" />
                    <span className="text-muted">
                      {" · "}
                      <T en="done, left a box open" es="hecha, quedó una casilla" />
                    </span>
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {boxShort.map((l, i) => {
                      const ph = l.phase as "open" | "mid" | "close";
                      return (
                        <li
                          key={`s-${l.role}-${l.room ?? ""}-${l.phase}-${i}`}
                          className="label text-muted flex flex-wrap items-baseline gap-x-2 pl-3 leading-relaxed"
                        >
                          <span>
                            <T
                              en={[l.role, l.room, phaseName(ph)]
                                .filter(Boolean)
                                .join(" · ")}
                              es={[l.role, l.room, PHASE_ES[ph]]
                                .filter(Boolean)
                                .join(" · ")}
                            />
                          </span>
                          {l.by ? (
                            <span>
                              <T en="by" es="por" />{" "}
                              <span className="text-ink/70">{l.by}</span>
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {/* What keeps getting missed: the chronic ones, worst rate first, in the
          words the crew reads. Capped, with the rest as a count. On its own
          panel. */}
      <section className="panel mt-4">
        <p className="card-title">
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
                    en={`+ ${repeated.length - 6} more that keep slipping`}
                    es={`+ ${repeated.length - 6} más que se siguen faltando`}
                  />
                </p>
              ) : null}
            </>
          ) : (
            <p className="note text-muted">
              <T
                en={`Nothing keeps slipping over the last ${nights} nights. The odd miss, but no pattern.`}
                es={`Nada se sigue faltando en las últimas ${nights} noches. Alguna falla suelta, pero sin patrón.`}
              />
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
