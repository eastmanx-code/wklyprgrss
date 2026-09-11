"use client";

import { useEffect, useRef, useState } from "react";

import { useT } from "@/components/Lang";

type State = { locked: boolean; message: string | null; admin: boolean };

const CLEAR: State = { locked: false, message: null, admin: false };

/** Idle poll cadence, and the quicker one while a hold is up so it lifts fast. */
const POLL_OPEN_MS = 15_000;
const POLL_HELD_MS = 5_000;

/**
 * The site-wide maintenance hold, watched from every open device.
 *
 * A deploy restarts the server under whoever is on the floor. This is the
 * courtesy that turns a screen quietly going stale into an honest "back in a
 * moment": the admin flips the switch before the deploy, every phone polls it
 * and drops a full-screen hold over the list, and the hold lifts on its own the
 * instant the switch goes back off. Nothing is saved by it and nothing is
 * blocked by it — the ticks already save themselves — it only keeps a person in
 * a walk-in from mistaking a restart for a broken app and sending a 911 text.
 *
 * Two things make it safe. It never navigates: the hold lies over the list, so
 * when it clears the crew are exactly where they were. And a poll that fails is
 * not an answer — while the server is mid-restart the fetch simply fails, the
 * last known state stands, and the hold clears only on the first real reply
 * that says it is off. So the hold stays up through the very restart it is
 * covering, which is the whole point.
 *
 * The admin running the deploy is let straight through — they get a thin banner
 * instead of the stop, because holding them out of the site they are deploying
 * would be the one place this switch could do harm.
 */
export function MaintenanceGate() {
  const t = useT();
  const [state, setState] = useState<State>(CLEAR);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // The poll loop is scheduled once and must see the current lock state without
  // re-subscribing, so it reads it from here rather than from a stale closure.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;

    async function poll() {
      try {
        const res = await fetch("/api/maintenance", { cache: "no-store" });
        if (!res.ok) return; // Keep the last known state; try again next tick.
        const next = (await res.json()) as State;
        if (alive) setState(next);
      } catch {
        // Network down or server mid-restart. Hold whatever we last knew.
      } finally {
        if (alive) {
          // A backgrounded tab checks lazily; a foreground one that is holding
          // a crew rechecks quickly so the hold lifts the moment it can.
          const delay = document.hidden
            ? POLL_OPEN_MS
            : stateRef.current.locked
              ? POLL_HELD_MS
              : POLL_OPEN_MS;
          timer = window.setTimeout(poll, delay);
        }
      }
    }

    // A phone coming back to the foreground checks at once rather than waiting
    // out the interval it slept through.
    function onWake() {
      if (!document.hidden) void poll();
    }

    void poll();
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
    // Mount once; the loop reschedules itself and reads live state through the
    // ref above.
  }, []);

  // Only crews are stopped. showModal/close are idempotent-guarded because
  // calling either in the wrong state throws.
  const held = state.locked && !state.admin;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (held && !dialog.open) dialog.showModal();
    else if (!held && dialog.open) dialog.close();
  }, [held]);

  return (
    <>
      {/* The admin's own view of the switch they threw: enough to remember it
          is on, never enough to be in their way. */}
      {state.locked && state.admin ? (
        <div
          role="status"
          className="bg-warn text-on-warn fixed inset-x-0 top-0 z-50 px-4 py-2 text-center text-label font-medium tracking-[0.08em]"
        >
          Maintenance hold is ON · crews are seeing the wait screen
        </div>
      ) : null}

      {/* Full-screen stop for the crew. A dialog, so it traps focus and the
          back key cannot slip behind it, and it never navigates — the list is
          still underneath when the hold lifts. There is deliberately no way to
          dismiss it: the way out is the hold coming off. */}
      <dialog
        ref={dialogRef}
        className="ww-dialog"
        aria-labelledby="ww-maint-title"
        onCancel={(event) => event.preventDefault()}
      >
        <div className="ww-dialog-body text-center">
          <p className="label text-warn">{t("Hold on", "Un momento")}</p>
          <h1
            id="ww-maint-title"
            className="text-metric mt-3 leading-tight font-medium"
          >
            {t("Back in a moment", "Volvemos enseguida")}
          </h1>
          <p className="note text-muted mx-auto mt-4 max-w-sm leading-relaxed">
            {state.message ??
              t(
                "We're updating the app. Your work is saved — stay on this screen and it will pick up right where you left off.",
                "Estamos actualizando la app. Tu trabajo está guardado — quédate en esta pantalla y seguirá justo donde lo dejaste.",
              )}
          </p>
          <p className="label text-muted mt-8">
            {t("Nothing was lost", "No se perdió nada")}
          </p>
        </div>
      </dialog>
    </>
  );
}
