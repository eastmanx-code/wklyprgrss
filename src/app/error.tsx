"use client";

const BUG_EMAIL = "beastman@ch-projects.com";

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
  function reportBug() {
    const lines = [
      "Something went wrong in WKLY > PRGRSS.",
      "",
      `Page: ${window.location.href}`,
      `Reference: ${error.digest ?? "none"}`,
      `When: ${new Date().toString()}`,
      `Device: ${navigator.userAgent}`,
      "",
      "What I was doing:",
      "",
    ];
    const subject = encodeURIComponent("WKLY > PRGRSS bug report");
    const body = encodeURIComponent(lines.join("\n"));
    window.location.href = `mailto:${BUG_EMAIL}?subject=${subject}&body=${body}`;
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
            reporting. No digest means nothing broke — the request never
            landed: the connection dropped, or the app was mid-update when the
            tap went out. Telling someone to report a bug that does not exist
            wastes their time and hides the one instruction that actually
            works, which is to do it again. */}
        <p className="note mx-auto mt-5 max-w-xs leading-relaxed text-muted">
          {error.digest
            ? "Try again. If it keeps happening, send it over and it'll get looked at."
            : "Nothing was saved and nothing is broken — the request didn't reach the server. This is usually a dropped connection or an update landing mid-tap. Try again."}
        </p>

        <div className="mt-8 space-y-3">
          <button type="button" onClick={reset} className="btn w-full">
            Try again
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
