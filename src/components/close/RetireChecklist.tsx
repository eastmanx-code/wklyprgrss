"use client";

import { useActionState, useState } from "react";

import {
  restoreChecklist,
  retireChecklist,
  type ManageState,
} from "@/app/close/manage";

const initial: ManageState = { error: null };

/**
 * Retiring a whole list.
 *
 * Two taps, not one. Everything else on this screen is reversible by doing it
 * again; this one takes a list off every clipboard at the venue, so it asks.
 */
export function RetireChecklist({ checklistId }: { checklistId: string }) {
  const [state, action, pending] = useActionState(retireChecklist, initial);
  const [confirming, setConfirming] = useState(false);

  // No redirect on success. Retiring revalidates this page, which remounts
  // this component and takes any "it worked" flag with it — a client-side
  // push was racing its own invalidation and losing. The page renders the
  // retired state honestly instead, with the way back on it, so there is
  // nowhere to send anybody.

  return (
    <section className="panel border-warn/30">
      <p className="label">Retire this list</p>
      <p className="note text-muted mt-2 leading-relaxed">
        Takes it off the clipboard from tonight. Every night it was signed stays
        exactly as it was, and bringing it back restores this list rather than
        starting an empty one.
      </p>

      {state.error ? (
        <p role="alert" className="text-body text-warn mt-3">
          {state.error}
        </p>
      ) : null}

      {confirming ? (
        <form action={action} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="checklistId" value={checklistId} />
          <button type="submit" className="btn btn-sm" disabled={pending}>
            {pending ? "Retiring…" : "Yes, retire it"}
          </button>
          <button
            type="button"
            className="btn-ghost min-h-11"
            onClick={() => setConfirming(false)}
          >
            Keep it
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="btn-ghost min-h-11 mt-3"
          onClick={() => setConfirming(true)}
        >
          Retire this list
        </button>
      )}
    </section>
  );
}

/** The way back. One tap — nothing is lost by having a list again. */
export function RestoreChecklist({ checklistId }: { checklistId: string }) {
  const [state, action, pending] = useActionState(restoreChecklist, initial);

  return (
    <form action={action}>
      <input type="hidden" name="checklistId" value={checklistId} />
      <button type="submit" className="btn btn-sm" disabled={pending}>
        {pending ? "Restoring…" : "Bring this list back"}
      </button>
      {state.error ? (
        <p role="alert" className="text-body text-warn mt-2">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
