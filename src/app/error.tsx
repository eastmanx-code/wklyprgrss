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
      "Something went wrong in WKY >> PRGRSS.",
      "",
      `Page: ${window.location.href}`,
      `Reference: ${error.digest ?? "none"}`,
      `When: ${new Date().toString()}`,
      `Device: ${navigator.userAgent}`,
      "",
      "What I was doing:",
      "",
    ];
    const subject = encodeURIComponent("WKY >> PRGRSS bug report");
    const body = encodeURIComponent(lines.join("\n"));
    window.location.href = `mailto:${BUG_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-md flex-col justify-center">
      <div className="panel p-8 text-center">
        <p className="label">Something went wrong</p>
        <h1 className="mt-4 text-xl font-medium tracking-tight">
          We couldn&apos;t load that
        </h1>
        <p className="note mx-auto mt-5 max-w-xs leading-relaxed text-muted">
          Try again. If it keeps happening, send it over and it&apos;ll get
          looked at.
        </p>

        <div className="mt-8 space-y-3">
          <button type="button" onClick={reset} className="btn w-full">
            Try again
          </button>
          <button
            type="button"
            onClick={reportBug}
            className="btn-ghost w-full"
          >
            Email the bug
          </button>
        </div>

        {error.digest ? (
          <p className="label mt-6">Reference {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
