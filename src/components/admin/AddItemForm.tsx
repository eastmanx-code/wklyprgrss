"use client";

import { useActionState, useEffect, useRef } from "react";

import { addItem, type AdminState } from "@/app/admin/actions";

const initialState: AdminState = { error: null };

export function AddItemForm({ venueId }: { venueId: string }) {
  const [state, formAction, pending] = useActionState(addItem, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="panel space-y-3">
      <label className="label" htmlFor="new-item">
        Add item
      </label>
      <div className="flex gap-2">
        <input
          id="new-item"
          name="title"
          className="field"
          placeholder="e.g. Walk-in cooler"
          disabled={pending}
        />
        <input type="hidden" name="venueId" value={venueId} />
        <button type="submit" className="btn shrink-0" disabled={pending}>
          Add
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="text-body text-warn">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
