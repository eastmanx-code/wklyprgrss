"use client";

import { useEffect, useState } from "react";

const BUG_EMAIL = "beastman@ch-projects.com";

const RELOADED_AT = "ww_error_reloaded_at";
const RELOAD_GAP_MS = 60_000;

/**
 * Whether to fetch the page fresh without being asked.
 *
 * Every deploy gives the sign-in form and every other button a new address on
 * the server. A page that was open before the deploy still holds the old one,
 * so its next tap is answered "no such action" and lands here. Rendering the
 * same page again changes nothing: the page is the stale part. That is how
 * somebody sat at the door typing a correct PIN into "try again" all day.
 *
 * So the first time, when the phone has signal, the page is reloaded for
 * them. Once a minute at most, so a fault that survives a reload shows the
 * screen instead of spinning, and never when storage is unreadable, because
 * then there is no way to know a reload already happened.
 */
function shouldReloadItself(): boolean {
  if (typeof window === "undefined") return false;
  if (navigator.onLine === false) return false;
  try {
    const at = Number(window.sessionStorage.getItem(RELOADED_AT));
    return !(at > 0 && Date.now() - at < RELOAD_GAP_MS);
  } catch {
    return false;
  }
}

/**
 * Error screen with a one-tap bug report.
 *
 * The mailto is built in the click handler, not at render, so it can read the
 * current URL without touching `window` during server rendering. The digest is
 * the id Next assigns the error — it's what makes a report traceable, so it's
 * shown on screen as well as put in the mail.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [reloading] = useState(() => !error.digest && shouldReloadItself());

  useEffect(() => {
    if (!reloading) return;
    try {
      window.sessionStorage.setItem(RELOADED_AT, String(Date.now()));
    } catch {
      // Unreachable in practice: the read above already succeeded.
    }
    window.location.reload();
  }, [reloading]);

  function reportBug() {
    const lines = [
      "Something went wrong in WEEKLY PROGRESS.",
      "",
      `Page: ${window.location.href}`,
      `Reference: ${error.digest ?? "none"}`,
      `When: ${new Date().toString()}`,
      `Device: ${navigator.userAgent}`,
      "",
      "What I was doing:",
      "",
    ];
    const subject = encodeURIComponent("WEEKLY PROGRESS bug report");
    const body = encodeURIComponent(lines.join("\n"));
    window.location.href = `mailto:${BUG_EMAIL}?subject=${subject}&body=${body}`;
  }

  if (reloading) {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-md flex-col justify-center">
        <div className="panel p-8 text-center" role="status">
          <p className="label">One moment</p>
          <h1 className="text-metric mt-4 font-medium">
            Getting the latest version
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-md flex-col justify-center">
      <div className="panel p-8 text-center">
        <p className="label">Something went wrong</p>
        <h1 className="mt-4 text-metric font-medium">
          {error.digest ? "We couldn't load that" : "That didn't get through"}
        </h1>
        {/* Two different failures wore one message.
            Next stamps a digest on anything that breaks while the server is
            building the page, so a digest means the app has a fault worth
            reporting. No digest means the request never landed: the
            connection dropped, or the app was updated while this page sat
            open. Rendering again cannot fix either one, so the button loads
            the page fresh. */}
        <p className="note mx-auto mt-5 max-w-xs leading-relaxed text-muted">
          {error.digest
            ? "Try again. If it keeps happening, send it over and it'll get looked at."
            : "Nothing was saved. The app updated while this page was open, or the connection dropped. Reload and do it again."}
        </p>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={error.digest ? reset : () => window.location.reload()}
            className="btn w-full"
          >
            {error.digest ? "Try again" : "Reload"}
          </button>
          {/* Offered where there is something to report. A request that never
              arrived leaves nothing to look at, and a mail saying "reference
              none" is a round trip for both of us. */}
          {error.digest ? (
            <button
              type="button"
              onClick={reportBug}
              className="btn-secondary w-full"
            >
              Email the bug
            </button>
          ) : null}
        </div>

        {error.digest ? (
          <p className="label mt-6">Reference {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
