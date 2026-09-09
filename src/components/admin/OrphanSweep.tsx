"use client";

import { useActionState } from "react";

import { sweepOrphans, type OrphanState } from "@/app/admin/actions";

const initialState: OrphanState = { error: null };

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Photographs in storage that nothing points at.
 *
 * A retake used to leave the picture it replaced behind. Both writes drop what
 * they replace now, but a crash between an upload and the row that names it
 * will always be able to leave one, so there has to be a way to look.
 *
 * Count first, delete second, and never in one press. This is the only control
 * in the product that deletes a photograph nobody asked to delete, and the
 * number has to have been read by somebody before it can be aimed at.
 */
export function OrphanSweep() {
  const [state, formAction, pending] = useActionState(
    sweepOrphans,
    initialState,
  );

  return (
    <form action={formAction} className="panel space-y-3 p-5">
      <p className="label">Photos nothing points at</p>

      {state.removed ? (
        <p className="note text-muted">
          Removed {state.removed.count}
          {state.removed.count === 1 ? " file" : " files"} ·{" "}
          {mb(state.removed.bytes)} freed.
        </p>
      ) : state.found ? (
        <p className="note text-muted">
          {state.found.count === 0
            ? "Nothing is orphaned. Every photo in storage is on a list."
            : `${state.found.count} ${
                state.found.count === 1 ? "file" : "files"
              } · ${mb(
                state.found.bytes,
              )}. These are retakes and dead uploads. Nothing on a list points at them.`}
        </p>
      ) : (
        <p className="note text-muted">
          A retake leaves the picture it replaced behind, and so does a crash
          between an upload and the row that names it. This counts them.
        </p>
      )}

      {state.error ? (
        <p role="alert" className="label text-warn">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-ghost" disabled={pending}>
          {pending
            ? "Looking…"
            : state.found || state.removed
              ? "Count again"
              : "Count them"}
        </button>
        {/* Only once there is a number, and only when it is not zero. */}
        {state.found && state.found.count > 0 && !state.removed ? (
          <button
            type="submit"
            name="confirm"
            value="yes"
            className="btn-ghost text-warn"
            disabled={pending}
          >
            Delete {state.found.count}
          </button>
        ) : null}
      </div>
    </form>
  );
}
