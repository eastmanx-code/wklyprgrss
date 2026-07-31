"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { addItem, type AdminState } from "@/app/admin/actions";

const initialState: AdminState = { error: null };

/**
 * An empty slot, filled in place.
 *
 * The field is always rendered rather than appearing after a tap. On iOS the
 * keyboard only opens when focus happens inside the gesture that triggered
 * it — focusing a newly-mounted input from an effect leaves the field looking
 * active with no keyboard, which reads as broken. Tapping the field itself is
 * the gesture, so it just works, and it's one tap fewer.
 *
 * With uploadPrefix set, naming an item goes straight to its upload screen:
 * an item with no photo is the failure this setup step exists to avoid.
 */
export function AddItemSlot({
  venueId,
  index,
  uploadPrefix,
}: {
  venueId: string;
  index: number;
  uploadPrefix?: string;
}) {
  const [state, formAction, pending] = useActionState(addItem, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.createdItemId && uploadPrefix) {
      router.push(`${uploadPrefix}${state.createdItemId}`);
    }
  }, [state.createdItemId, uploadPrefix, router]);

  return (
    <li className="panel flex flex-col p-3">
      <form action={formAction} className="flex flex-1 flex-col">
        <input type="hidden" name="venueId" value={venueId} />

        <div className="dotfield flex aspect-square w-full items-center justify-center rounded-[8px] p-3">
          <input
            name="title"
            className="field text-center"
            placeholder="Name this item"
            maxLength={120}
            disabled={pending}
            aria-label={`Item for slot ${index}`}
          />
        </div>

        <button
          type="submit"
          className="btn btn-sm mt-3 w-full"
          disabled={pending}
        >
          {pending ? "Adding…" : uploadPrefix ? "Add + photo" : "Add"}
        </button>

        {state.error ? (
          <p role="alert" className="label text-warn mt-2">
            {state.error}
          </p>
        ) : (
          <p className="label mt-2">Slot {index}</p>
        )}
      </form>
    </li>
  );
}
