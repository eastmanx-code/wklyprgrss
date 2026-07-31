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

        {/* One control, not a field stacked on a button. Naming the item and
            committing it are a single act, so the submit sits inside the
            field's own frame. Still a real input, so tapping it opens the
            keyboard on iOS. */}
        {/* The well's padding comes off the naming field, so it stays modest
            until there's width to spare. The field renders at 16px whatever
            .label asks for — the unlayered rule that stops iOS zooming a
            focused input outranks it — so it needs room for 16px text, not for
            an 11px label. */}
        <div className="dotfield flex aspect-square w-full items-center justify-center rounded-[8px] p-2 sm:p-3">
          {/* Solid pill on the grid, the same treatment as the "photo needed"
              marker — it holds contrast against the ruled ground where a
              bordered surface field washed out. */}
          <label className="pill-field bg-paper flex w-full items-center rounded-full py-1.5 pl-3">
            <input
              name="title"
              className="label text-ink placeholder:text-muted w-full min-w-0 flex-1 border-0 bg-transparent pr-2 outline-none"
              placeholder="Task name"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              maxLength={120}
              disabled={pending}
              aria-label={`Task's name for slot ${index}`}
            />
            <button
              type="submit"
              className="label text-muted hover:text-ink shrink-0 px-2 disabled:opacity-40"
              disabled={pending}
              aria-label={uploadPrefix ? "Add task and take photo" : "Add task"}
            >
              {pending ? "…" : "→"}
            </button>
          </label>
        </div>

        {state.error ? (
          <p role="alert" className="label text-warn mt-2">
            {state.error}
          </p>
        ) : (
          <p className="label mt-3">
            {uploadPrefix
              ? `Slot ${index} · name the task, then take the photo`
              : `Slot ${index}`}
          </p>
        )}
      </form>
    </li>
  );
}
