"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { addItem, type AdminState } from "@/app/admin/actions";

const initialState: AdminState = { error: null };

/**
 * Naming a task, on a page of its own.
 *
 * This used to be a pill wedged inside the empty slot's photo well, where the
 * field was about eighty pixels wide — narrow enough that a name ran out of
 * room part-way through the placeholder, and the commit arrow sat close enough
 * to the text to read as being typed over. A task name is the one piece of
 * writing in this app that everyone else has to read every week, so it gets
 * room to be written.
 *
 * Naming still leads straight to the camera: an item with no photo is the
 * failure this setup step exists to avoid.
 */
export function NewItemForm({ venueId }: { venueId: string }) {
  const [state, formAction, pending] = useActionState(addItem, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.createdItemId) {
      router.push(`/venue/item/${state.createdItemId}`);
    }
  }, [state.createdItemId, router]);

  return (
    <form action={formAction} className="panel space-y-4">
      <input type="hidden" name="venueId" value={venueId} />

      <div className="space-y-2">
        <label className="label" htmlFor="title">
          What is this task? (required)
        </label>
        <input
          id="title"
          name="title"
          className="field"
          placeholder="Walk-in refrigeration"
          /* Off across the board: a task name is not a person, an address or
             anything else the browser keeps a list of, and offering to fill
             one in put a stranger's name on a venue's board. */
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={120}
          disabled={pending}
          autoFocus
        />
        <p className="label">
          What someone should be looking at in the photo. Short is better —
          every venue reads this every week.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-body text-warn">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="btn w-full" disabled={pending}>
        {pending ? "Adding…" : "Next · take the photo"}
      </button>
    </form>
  );
}
