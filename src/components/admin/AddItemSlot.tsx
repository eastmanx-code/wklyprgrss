"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { addItem, type AdminState } from "@/app/admin/actions";

const initialState: AdminState = { error: null };

/**
 * An empty slot the admin can fill in place.
 *
 * Setting up a venue used to mean leaving the board for "Manage venue", which
 * is a detour from the one screen that already shows you what's missing. The
 * slot itself is the obvious place to do it.
 */
export function AddItemSlot({
  venueId,
  index,
}: {
  venueId: string;
  index: number;
}) {
  const [state, formAction, pending] = useActionState(addItem, initialState);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus straight into the field so it's type-and-go.
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <li className="panel flex flex-col p-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="dotfield panel-link flex aspect-square w-full items-center justify-center rounded-xl"
          aria-label={`Add item for slot ${index}`}
        >
          <span className="label text-ink bg-paper rounded-full px-3 py-1.5 shadow-[0_0_0_4px_var(--color-paper)]">
            + Add item
          </span>
        </button>
        <p className="label mt-3">Slot {index}</p>
        <p className="note mt-1 text-muted">Empty</p>
      </li>
    );
  }

  return (
    <li className="panel flex flex-col p-3">
      {/* On success the server revalidates, this slot is replaced by the new
          item, and the next empty slot renders fresh — no manual reset. */}
      <form action={formAction}>
        <input type="hidden" name="venueId" value={venueId} />
        <div className="dotfield flex aspect-square w-full items-center justify-center rounded-xl p-3">
          <input
            ref={inputRef}
            name="title"
            className="field text-center"
            placeholder="e.g. Walk-in cooler"
            disabled={pending}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
          />
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            className="btn btn-sm flex-1"
            disabled={pending}
          >
            {pending ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </button>
        </div>

        {state.error ? (
          <p role="alert" className="label mt-2 text-fail">
            {state.error}
          </p>
        ) : null}
      </form>
    </li>
  );
}
