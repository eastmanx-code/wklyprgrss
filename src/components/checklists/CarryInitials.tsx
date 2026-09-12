"use client";

import { useActionState } from "react";

import { setCarryInitials, type ManageState } from "@/app/checklists/manage";

const initial: ManageState = { error: null };

/**
 * Whether this list carries initials down, or asks each row for its own.
 *
 * Where the list is written, next to retiring it, because it is the same kind
 * of decision about how the list behaves. Two submits of one form — On and Off
 * — rather than a checkbox, so the button says which state it puts the list in
 * instead of leaving the reader to work out which way the box points.
 *
 * The default is on, and almost every list wants it: one person walks the list
 * and types their initials once. Off is for a list two people work at the same
 * time — a busy-night bar mid check split between bartenders — where carrying
 * the first person's initials down the whole list hides who did what.
 */
export function CarryInitials({
  checklistId,
  current,
}: {
  checklistId: string;
  current: boolean;
}) {
  const [state, action, pending] = useActionState(setCarryInitials, initial);

  return (
    <details className="panel-quiet mb-3">
      <summary className="label cursor-pointer">
        Shared list · initials {current ? "carry down" : "off"}
      </summary>

      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="checklistId" value={checklistId} />
        <p className="note text-muted leading-relaxed">
          Normally a row copies the initials from the row above, so one person
          walking the list types them once. Turn that off for a list two people
          work at the same time — like a bar mid check split between bartenders —
          so each row stays blank and everyone puts their own initials on the
          work they did.
        </p>
        {state.error ? (
          <p role="alert" className="text-body text-warn">
            {state.error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="carry"
            value="true"
            className="btn btn-sm"
            disabled={pending || current}
          >
            {pending ? "Saving…" : "Carry initials down"}
          </button>
          <button
            type="submit"
            name="carry"
            value="false"
            className="btn-ghost btn-sm"
            disabled={pending || !current}
          >
            Each row on its own
          </button>
        </div>
      </form>
    </details>
  );
}
