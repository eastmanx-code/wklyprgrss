"use client";

import { useActionState, useState } from "react";

import { renameItem, type AdminState } from "@/app/admin/actions";

const initialState: AdminState = { error: null };

export function RenameItemForm({
  itemId,
  venueId,
  title,
}: {
  itemId: string;
  venueId: string;
  title: string;
}) {
  const [state, formAction, pending] = useActionState(renameItem, initialState);
  const [value, setValue] = useState(title);
  const dirty = value.trim() !== title;

  return (
    <form action={formAction} className="flex-1">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="venueId" value={venueId} />
      <div className="flex gap-2">
        <input
          name="title"
          className="field"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={pending}
          aria-label="Item title"
        />
        {dirty ? (
          <button
            type="submit"
            className="btn-ghost shrink-0"
            disabled={pending}
          >
            {pending ? "Saving…" : "Save"}
          </button>
        ) : null}
      </div>
      {state.error ? (
        <p role="alert" className="mt-2 text-body text-fail">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
