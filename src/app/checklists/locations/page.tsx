import Link from "next/link";
import { redirect } from "next/navigation";

import { enrolVenue } from "./actions";

import { T } from "@/components/Lang";
import { BackLink } from "@/components/ui";
import { previousNight } from "@/lib/close-status";
import { nightCompliance, type VenueCompliance } from "@/lib/compliance";
import {
  currentNight,
  formatNight,
  formatNightEs,
  isNightOver,
} from "@/lib/night";
import { groupRollupDetailed } from "@/lib/rollup";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * How a store is doing, said three ways so nobody has to be told how to read
 * it: a plain word, a bar, and a number that all agree. Length is how much got
 * done; colour is how worried to be, so a store that is behind reads as a
 * short loud bar and a store that is on track as a long quiet one.
 */
type Standing = "ontrack" | "watch" | "behind" | "none";

function standingOf(pct: number | null): Standing {
  if (pct === null) return "none";
  if (pct < 60) return "behind";
  if (pct < 80) return "watch";
  return "ontrack";
}

/**
 * The CH lens: every store on the checklists, best compliance on top.
 *
 * One ranked table, nothing else. A store a night: lists checked off and
 * signed off over the lists it owed, averaged across the last thirty nights.
 * Best on top so the eye starts where things are fine and slides down to the
 * ones that need a call. Each row taps through to that store's own dash.
 *
 * A leader never sees this. They have one building and the app knows which.
 */
export default async function LocationsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "admin") redirect("/checklists");

  // Last night with a verdict on it. Before the 4am roll that is still the
  // night before; after it, the one that just ended. No night-picker: the
  // question this page answers is "how are my stores doing", not "what about
  // this one past date".
  const tonight = currentNight();
  const night = isNightOver(tonight) ? tonight : previousNight(tonight);

  const [{ data: venueRows }, scored, detailed] = await Promise.all([
    db()
      .from("venues")
      .select("id, code, name, active, close_active")
      .order("code"),
    nightCompliance(night),
    groupRollupDetailed(),
  ]);

  const venues = (venueRows ?? []) as {
    id: string;
    code: string;
    name: string | null;
    active: boolean;
    close_active: boolean;
  }[];

  // On the checklists, and the ones that could be. Enrolment is its own flag:
  // `active` governs the weekly walkthrough and a venue can run one without
  // the other.
  const enrolled = venues.filter((v) => v.close_active);
  const candidates = venues.filter((v) => !v.close_active && v.active);

  const scoreOf = new Map<string, VenueCompliance>(
    scored.map((v) => [v.code, v]),
  );

  // The thirty-night average per store, loaded once in the data layer.
  const pctByCode = new Map<string, number | null>(
    (detailed ?? []).map((d) => [
      d.code,
      d.rollup.of === 0
        ? null
        : Math.round((d.rollup.done / d.rollup.of) * 100),
    ]),
  );

  // Every enrolled store, best first, the not-yet-started ones at the foot.
  // Each row carries its average and last night, so the standing and the
  // shape read without opening the store.
  const rows = enrolled
    .map((v) => {
      const pct = pctByCode.has(v.code) ? (pctByCode.get(v.code) ?? null) : null;
      const last = scoreOf.get(v.code);
      return {
        code: v.code,
        id: v.id,
        pct,
        last: last && last.ran ? { done: last.done, total: last.total } : null,
      };
    })
    .sort((a, b) => {
      if (a.pct === null && b.pct === null) return a.code.localeCompare(b.code);
      if (a.pct === null) return 1;
      if (b.pct === null) return -1;
      return b.pct - a.pct;
    });

  // The company's own last night, as one honest line over the table.
  const ranVenues = scored.filter((v) => v.ran);
  const lists = ranVenues.reduce((n, v) => n + v.total, 0);
  const doneTonight = ranVenues.reduce((n, v) => n + v.done, 0);
  const over = isNightOver(night) && scored.every((v) => v.going === 0);

  return (
    <main className="close-flow mx-auto max-w-2xl pb-6">
      <BackLink href="/home">
        <T en="Home" es="Inicio" />
      </BackLink>

      {/* The company in one line: how many stores, and how last night went
          across all of them. "So far" while a night is still being walked, so
          a low count early reads as a night going rather than a night failed. */}
      <header className="mt-4 mb-6">
        <p className="label">
          <T
            en={`all locations · ${enrolled.length} on checklists · last 30 nights`}
            es={`todas las ubicaciones · ${enrolled.length} en las listas · últimas 30 noches`}
          />
        </p>
        <h1 className="text-metric mt-2 font-medium tabular-nums">
          {lists === 0 ? (
            <T en="No lists last night" es="Sin listas anoche" />
          ) : (
            <>
              {doneTonight}{" "}
              <span className="text-muted text-title">
                <T en="of" es="de" />
              </span>{" "}
              {lists}{" "}
              <span className="text-muted text-title">
                {over ? (
                  <T en="signed off last night" es="firmadas anoche" />
                ) : (
                  <T en="signed off so far" es="firmadas hasta ahora" />
                )}
              </span>
            </>
          )}
        </h1>
      </header>

      {/* The ranked table. Best on top. Every row says its state three ways —
          a plain word, a bar, a number — so anyone can read it. */}
      {rows.length > 0 ? (
        <ul className="divide-divider divide-y">
          {rows.map((s) => {
            const state = standingOf(s.pct);
            const dot =
              state === "behind"
                ? "bg-warn"
                : state === "watch"
                  ? "bg-warn/50"
                  : state === "ontrack"
                    ? "bg-ink/50"
                    : "ring-muted/40 ring-1 ring-inset";
            const barFill =
              state === "behind"
                ? "bg-warn"
                : state === "watch"
                  ? "bg-warn/50"
                  : "bg-ink/50";
            const word = {
              ontrack: <T en="on track" es="al día" />,
              watch: <T en="watch" es="ojo" />,
              behind: <T en="behind" es="atrasada" />,
              none: <T en="not started" es="sin empezar" />,
            }[state];
            return (
              <li key={s.code} className="first:pt-0 last:pb-0">
                <Link
                  href={`/checklists/enter/${s.id}`}
                  className="hover:bg-hover -mx-2 block rounded-[4px] px-2 py-3"
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
                    {/* Who. */}
                    <span className="flex w-20 shrink-0 items-center gap-2.5">
                      <span
                        className={`size-2 shrink-0 rounded-full ${dot}`}
                        aria-hidden
                      />
                      <span className="text-title tracking-[0.08em]">
                        {s.code}
                      </span>
                    </span>

                    {/* The bar: how much got done, coloured by how worried to
                        be. Aligned across rows so the column reads as a ranking
                        on its own. */}
                    <span
                      className="bg-inset h-2 w-28 shrink-0 overflow-hidden rounded-[2px]"
                      aria-hidden
                    >
                      <span
                        className={`block h-full rounded-[2px] ${barFill}`}
                        style={{ width: `${s.pct ?? 0}%` }}
                      />
                    </span>

                    {/* The same thing said in a word and a number. */}
                    <span className="ml-auto flex shrink-0 items-center gap-x-5 tabular-nums">
                      <span
                        className={`label ${state === "behind" ? "text-warn" : state === "none" ? "text-muted" : "text-ink"}`}
                      >
                        {word}
                      </span>
                      <span
                        className={`text-title w-12 text-right ${state === "behind" ? "text-warn" : state === "none" ? "text-muted" : "text-ink"}`}
                      >
                        {s.pct === null ? "—" : `${s.pct}%`}
                      </span>
                      <span className="label w-20 text-right">
                        <span className="text-muted">
                          <T en="last " es="anoche " />
                        </span>
                        <span className="text-ink">
                          {s.last ? `${s.last.done}/${s.last.total}` : "—"}
                        </span>
                      </span>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="note text-muted leading-relaxed">
          <T
            en="No stores on the checklists yet. Add one below to start its report."
            es="Todavía no hay tiendas en las listas. Agrega una abajo para empezar su informe."
          />
        </p>
      )}

      {/* A date under the table, so "last night" has a day on it. */}
      <p className="label text-muted mt-5">
        <T
          en={`last night · ${formatNight(night)}`}
          es={`anoche · ${formatNightEs(night)}`}
        />
      </p>

      {/* Closed, one small button. Open, the line becomes the heading with its
          own Hide, and each venue's Add is a button with space of its own. */}
      {candidates.length > 0 ? (
        <details className="group mt-8">
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
