"use client";

import { useEffect } from "react";

/**
 * Turn on the offline fallback.
 *
 * The queue already means a tap in a walk-in survives. This is the other half:
 * a phone that slept, or a tab the browser threw away, reopening in a place
 * with no signal. Without it that is the browser's own error page and a shift
 * that stops.
 *
 * Registered late and never awaited. It is worth nothing on the first load of
 * a session and everything on a later one, so it must not compete with the
 * page somebody is trying to read.
 *
 * Not in development, where it would sit between the browser and the dev
 * server's own reloading and make every change look like it had not landed.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
      return;
    const id = window.setTimeout(() => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // A browser with service workers switched off, or a private window.
        // Everything still works; it just works the way it did before.
      });
    }, 2000);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}

/**
 * Drop every cached page on the way out of a session.
 *
 * Four people share two phones behind a bar. The second one to log in must
 * not be able to pull the first one's venue back out of the cache by walking
 * somewhere with no signal.
 */
export function forgetPages(): void {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "forget" });
  } catch {
    // No worker, no controller, nothing cached. Nothing to forget.
  }
}
