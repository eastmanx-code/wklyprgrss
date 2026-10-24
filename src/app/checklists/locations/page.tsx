import Link from "next/link";
import { redirect } from "next/navigation";

import { enrolVenue } from "./actions";

import { Card } from "@/components/Card";
import { Dial } from "@/components/Dial";
import { AllStoresTrend } from "@/components/checklists/AllStoresTrend";
import { NightNav } from "@/components/checklists/Compliance";
import {
  CompanyMissed,
  type CompanyMiss,
} from "@/components/checklists/CompanyMissed";
import { BackLink } from "@/components/ui";
import { T } from "@/components/Lang";
import { previousNight } from "@/lib/close-status";
import { nightCompliance, type VenueCompliance } from "@/lib/compliance";
import {
  currentNight,
  formatNight,
  formatNightEs,
  formatNightSpan,
  isNightOver,
} from "@/lib/night";
import { groupRollupDetailed, nightWindow } from "@/lib/rollup";
import type { MissedRow } from "@/lib/rollup-math";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;


/**
 * Every venue, one night. The admin's whole report, and the door into each
 * building.
 *
 * There is one fact under all of this: a list, on a night, was checked off
 * by somebody and signed off by somebody, or it was not. This screen is
 * those rows summed per venue, with the ones that failed named under each.
 * A venue's night is the same rows for one building; a list's night is one
 * row opened up. Nothing here is computed a second way.
 *
 * It used to be two screens, this one and a "close compliance" page that
 * was this one with a different heading, and every fix had to land twice.
 *
 * A leader never sees this. They have one building and the app knows which.
 */
export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ night?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "admin") redirect("/checklists");

  // The night with a verdict on it, unless one was asked for. Before the
  // roll at 4am that is still last night; after it, the one that just ended.
  const tonight = currentNight();
  const lastClosed = isNightOver(tonight) ? tonight : previousNight(tonight);
  const asked = (await searchParams).night;
  const night = asked && NIGHT.test(asked) ? asked : lastClosed;

  const [{ data: venueRows }, scored] = await Promise.all([
    db()
      .from("venues")
      .select("id, code, name, active, close_active")
      .order("code"),
    nightCompliance(night),
  ]);

  const venues = (venueRows ?? []) as {
    id: string;
    code: string;
    name: string | null;
    active: boolean;
    close_active: boolean;
  }[];

  // Over at 4am, unless a list is still being walked past it. Then the
  // night is still "so far", the same as it was at midnight.
  const over = isNightOver(night) && scored.every((v) => v.going === 0);

  // In the programme, and the ones that could be. Membership is its own flag:
  // `active` governs the weekly walkthrough and a venue can run one without
  // the other.
  const enrolled = venues.filter((v) => v.close_active);
  const candidates = venues.filter((v) => !v.close_active && v.active);

  const scoreOf = new Map<string, VenueCompliance>(
    scored.map((v) => [v.code, v]),
  );

  // One ruler, summed: lists checked off and signed off, over lists on the
  // night. The fails are the rest, and they are named below.
  const ranVenues = scored.filter((v) => v.ran);
  const lists = ranVenues.reduce((n, v) => n + v.total, 0);
  const done = ranVenues.reduce((n, v) => n + v.done, 0);
  const short = ranVenues.reduce((n, v) => n + v.notSigned + v.notDone, 0);
  // The thirty-night standing, every store at once: for the multi-line chart,
  // the ranked list, and what is being missed across the company. One load in
  // the data layer, scored per venue.
  const detailed = (await groupRollupDetailed()) ?? [];
  const chartWindow = nightWindow();
  const storeSeries = detailed.map((d) => ({
    code: d.code,
    points: d.rollup.series.map((s) => ({
      night: s.night,
      percent: s.of === 0 ? 0 : (s.done / s.of) * 100,
    })),
  }));
  // groupRollupDetailed comes back worst first, so the two ends are the lines
  // to draw in weight and name beside the chart.
  const standing = detailed.map((d) => ({
    code: d.code,
    name: d.name,
    done: d.rollup.done,
    of: d.rollup.of,
    pct: d.rollup.of === 0 ? 0 : Math.round((d.rollup.done / d.rollup.of) * 100),
  }));
  const worstStore = standing.length > 1 ? standing[0] : null;
  const bestStore = standing.length > 1 ? standing[standing.length - 1] : null;
  // The night's own aggregate, for the ring on the group chart.
  const nightPct = lists === 0 ? 0 : Math.round((done / lists) * 100);

  // Every enrolled location, worst first, with the ones that have not opened a
  // night yet at the foot. Each carries its 30-night average, its run for the
  // sparkline, and last night, so the row says the standing and the shape
  // without opening the store.
  const standingByCode = new Map(standing.map((s) => [s.code, s]));
  const seriesByCode = new Map(storeSeries.map((s) => [s.code, s.points]));
  const allStores = enrolled
    .map((v) => {
      const s = standingByCode.get(v.code);
      const last = scoreOf.get(v.code);
      return {
        code: v.code,
        id: v.id,
        pct: s ? s.pct : null,
        points: seriesByCode.get(v.code) ?? [],
        last: last && last.ran ? { done: last.done, total: last.total } : null,
      };
    })
    .sort((a, b) => {
      if (a.pct === null && b.pct === null) return a.code.localeCompare(b.code);
      if (a.pct === null) return 1;
      if (b.pct === null) return -1;
      return a.pct - b.pct;
    });

  // What keeps getting missed across the company, the same item at several
  // stores folded into one row. Missed at many stores is a process to fix;
  // missed at one is a store to call.
  const company = companyMissed(detailed);
  const systemic = company.filter((c) => c.stores.length > 1).slice(0, 6);
  // One-store misses belong on that store's own lens, not dumped here. The
  // overview owes a count and a way in, not the list.
  const localCount = company.filter((c) => c.stores.length === 1).length;


  return (
    <main>
      <BackLink href="/home">
        <T en="Home" es="Inicio" />
      </BackLink>

      {/* An active title, the way the board and the walkthroughs read: the
          number the night is about, not the word for it. Before the night is
          over it says "so far", so a low count early in service reads as a
          night still going rather than a night that failed — the same care the
          weekly board takes before its deadline. The eyebrow is the night, and
          "so far" now carries the in-progress mark the eyebrow used to. */}
      <header className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="label">
            <T en={formatNightSpan(night)} es={formatNightEs(night)} />
          </p>
          <h1 className="text-metric mt-2 tracking-normal">
            {lists === 0 ? (
              <T en="Nothing running yet" es="Todavía nada corriendo" />
            ) : over ? (
              <T
                en={`${done} of ${lists} signed off`}
                es={`${done} de ${lists} firmadas`}
              />
            ) : (
              <T
                en={`${done} of ${lists} signed off so far`}
                es={`${done} de ${lists} firmadas hasta ahora`}
              />
            )}
          </h1>
        </div>
        <NightNav night={night} base="/checklists/locations" />
      </header>

      {/* Nightly scores, every store its own line, the best and the worst in
          weight and the rest faint behind them. The night's own ring on the
          left, the two ends named on the right. */}
      {standing.length > 0 ? (
        <div className="mb-6">
          <Card
            title={<T en="Nightly scores" es="Notas por noche" />}
            hint={
              <T
                en={`Last ${chartWindow.length} nights · every store · lists checked off and signed off`}
                es={`Últimas ${chartWindow.length} noches · cada tienda · listas marcadas y firmadas`}
              />
            }
          >
            <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[120px_minmax(0,1fr)_auto]">
              <Dial
                size={120}
                percent={nightPct}
                caption={
                  <T
                    en={`${done} of ${lists} lists · ${over ? "last night" : "tonight so far"}`}
                    es={`${done} de ${lists} listas · ${over ? "anoche" : "esta noche hasta ahora"}`}
                  />
                }
                tone={short > 0 ? "var(--warn)" : "var(--ink)"}
              />

              {storeSeries.length > 0 && chartWindow.length > 1 ? (
                <AllStoresTrend
                  window={chartWindow}
                  stores={storeSeries}
                  bestCode={bestStore?.code ?? null}
                  worstCode={worstStore?.code ?? null}
                  labelLeft={formatNight(chartWindow[0])}
                  labelRight={formatNight(chartWindow[chartWindow.length - 1])}
                />
              ) : (
                <p className="note text-muted self-center leading-relaxed">
                  <T
                    en="Not enough nights yet to draw the run."
                    es="Aún no hay noches suficientes para dibujar la racha."
                  />
                </p>
              )}

              {bestStore && worstStore ? (
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-1">
                  <div>
                    <p className="label">
                      <T en="Best" es="Mejor" />
                    </p>
                    <p className="text-title mt-1 tracking-[0.08em]">
                      {bestStore.code}
                    </p>
                    <p className="label mt-1 tabular-nums">{bestStore.pct}%</p>
                  </div>
                  <div>
                    <p className="label">
                      <T en="Worst" es="Peor" />
                    </p>
                    <p className="text-title text-warn mt-1 tracking-[0.08em]">
                      {worstStore.code}
                    </p>
                    <p className="label mt-1 tabular-nums">{worstStore.pct}%</p>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}

      {/* No per-store fail walls here. The overview never shows a store's
          own failed lists; you tap a store to see them. What this page owes
          is the scan below and what is breaking across the company. */}

      {/* Every store, ranked over the month, worst first. Each taps through to
          that store's own dash. */}
      {allStores.length > 0 ? (
        <div className="mt-6">
          <Card
            title={<T en="Every store" es="Cada tienda" />}
            hint={
              <T
                en="All locations · worst first · 30-night average · tap in"
                es="Todas las ubicaciones · peor primero · promedio de 30 noches · entra"
              />
            }
          >
            <ul className="divide-divider divide-y">
              {allStores.map((s) => {
                // The one accent that is rationed: a store carries the warn
                // dot only when it is below the line, so the eye lands on the
                // few that need a call. The rest are quiet.
                const fail = s.pct !== null && s.pct < 60;
                const neutral = s.pct !== null && s.pct >= 60 && s.pct < 80;
                const dot = fail
                  ? "bg-warn"
                  : neutral
                    ? "bg-warn/50"
                    : s.pct !== null
                      ? "bg-ink/40"
                      : "ring-muted/40 ring-1 ring-inset";
                const body = (
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="flex w-24 shrink-0 items-center gap-2.5">
                      <span
                        className={`size-2 shrink-0 rounded-full ${dot}`}
                        aria-hidden
                      />
                      <span className="text-title tracking-[0.08em]">
                        {s.code}
                      </span>
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-x-5 tabular-nums">
                      <span className="label">
                        <span className="text-muted">
                          <T en="avg " es="prom " />
                        </span>
                        <span className={fail ? "text-warn" : "text-ink"}>
                          {s.pct === null ? "—" : `${s.pct}%`}
                        </span>
                      </span>
                      <span className="label">
                        <span className="text-muted">
                          <T en="last night " es="anoche " />
                        </span>
                        <span className="text-ink">
                          {s.last ? `${s.last.done}/${s.last.total}` : "—"}
                        </span>
                      </span>
                    </span>
                  </span>
                );
                return (
                  <li key={s.code} className="first:pt-0 last:pb-0">
                    <Link
                      href={`/checklists/enter/${s.id}`}
                      className="hover:bg-hover -mx-2 block rounded-[4px] px-2 py-3"
                    >
                      {body}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      ) : null}

      {/* What keeps getting missed across the company. Many stores is a process
          to fix; one store is a store to call. */}
      {systemic.length > 0 || localCount > 0 ? (
        <div className="mt-6">
          <Card
            title={
              <T en="What's getting missed" es="Qué se está faltando" />
            }
            hint={
              <T
                en="Across every store · last 30 nights"
                es="En todas las tiendas · últimas 30 noches"
              />
            }
          >
            {systemic.length > 0 ? (
              <>
                <p className="label">
                  <T
                    en="Across many stores · fix the process"
                    es="En varias tiendas · arregla el proceso"
                  />
                </p>
                <div className="mt-3">
                  <CompanyMissed rows={systemic} />
                </div>
              </>
            ) : null}
            {localCount > 0 ? (
              <p
                className={`note text-muted ${systemic.length > 0 ? "border-divider mt-5 border-t pt-4" : ""}`}
              >
                <T
                  en={`${localCount} more ${localCount === 1 ? "thing is" : "things are"} missed at a single store. Open that store to see its own.`}
                  es={`${localCount} ${localCount === 1 ? "cosa más falla" : "cosas más fallan"} en una sola tienda. Entra a esa tienda para verlas.`}
                />
              </p>
            ) : null}
          </Card>
        </div>
      ) : null}

      {/* Closed, one small button. Open, the same line is the heading with
          its own button to close it, and each venue's Add is a button with
          a boundary of its own. Every action gets a shape and space around
          it; "ADD A LOCATION HIDE" read as one sentence. */}
      {candidates.length > 0 ? (
        <details className="group mt-6">
          <summary className="ring-card-border text-ink inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded px-4 text-label tracking-[0.08em] ring-1 group-open:flex group-open:w-full group-open:justify-between group-open:px-0 group-open:text-title group-open:tracking-normal group-open:ring-0">
            <span>
              <span className="group-open:hidden">+ </span>
              <T en="Add a location" es="Agregar un lugar" />
            </span>
            <span className="ring-card-border hidden min-h-11 items-center rounded px-4 text-label tracking-[0.08em] ring-1 group-open:inline-flex">
              <T en="Hide" es="Ocultar" /> ↑
            </span>
          </summary>
          <div className="panel mt-3">
            <p className="note text-muted leading-relaxed">
              <T
                en="Adding a venue puts it on the checklists and opens it, ready for its first list. It has no bearing on the weekly walkthrough."
                es="Agregar un lugar lo pone en las listas y lo abre, listo para su primera lista. No afecta el recorrido semanal."
              />
            </p>
            <ul className="mt-4 space-y-3">
              {candidates.map((venue) => (
                <li
                  key={venue.id}
                  className="bg-inset flex items-center justify-between gap-4 rounded-[4px] px-4 py-2"
                >
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-3">
                    <span className="text-body w-16 shrink-0 tracking-[0.08em]">
                      {venue.code}
                    </span>
                    {venue.name && venue.name !== venue.code ? (
                      <span className="label">{venue.name}</span>
                    ) : null}
                  </span>
                  <form action={enrolVenue}>
                    <input type="hidden" name="venueId" value={venue.id} />
                    <button
                      type="submit"
                      className="ring-card-border text-ink hover:bg-hover inline-flex min-h-11 items-center rounded px-3 text-label tracking-[0.08em] ring-1"
                    >
                      + <T en="Add" es="Agregar" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </main>
  );
}

/**
 * Fold every store's missed items into one list, the same item at several
 * stores on one row.
 *
 * Grouped on house, role, phase and the item text with case and spacing
 * flattened, so "Clean the soda gun" and "clean the soda gun" are one problem
 * rather than two. The counts sum across the stores that miss it, and the
 * streak is the worst active run among them. Whether it is one store or many
 * is what the caller splits on, and the whole reason to group.
 */
function companyMissed(
  detailed: { code: string; rollup: { missed: MissedRow[] } }[],
): CompanyMiss[] {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const groups = new Map<string, CompanyMiss>();
  for (const d of detailed) {
    for (const m of d.rollup.missed) {
      const key = `${m.house}|${m.role}|${m.phase}|${norm(m.item)}`;
      const held = groups.get(key);
      if (held) {
        held.open += m.open;
        held.of += m.of;
        held.streak = Math.max(held.streak, m.streak);
        if (!held.stores.includes(d.code)) held.stores.push(d.code);
      } else {
        groups.set(key, {
          house: m.house,
          role: m.role,
          phase: m.phase,
          item: m.item,
          itemEs: m.itemEs,
          open: m.open,
          of: m.of,
          streak: m.streak,
          stores: [d.code],
        });
      }
    }
  }
  // Most stores first, then most missed: the widest problem on top.
  return [...groups.values()].sort(
    (a, b) => b.stores.length - a.stores.length || b.open - a.open,
  );
}

