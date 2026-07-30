"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="pt-16">
      <div className="panel text-center">
        <p className="label">Something went wrong</p>
        <h1 className="mt-3 text-xl font-medium tracking-tight">
          We couldn&apos;t load that
        </h1>
        <p className="mt-3 text-sm text-muted">
          Check your connection and try again. If it keeps happening, tell your
          admin.
        </p>
        <button type="button" onClick={reset} className="btn mt-6">
          Try again
        </button>
      </div>
    </main>
  );
}
