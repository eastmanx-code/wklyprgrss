"use client";

import { useActionState } from "react";

import {
  setMaintenanceLock,
  type MaintenanceState,
} from "@/app/admin/actions";
import { MAINTENANCE_MESSAGE_MAX } from "@/lib/maintenance-limits";

/**
 * The switch, on the one screen only an admin reaches.
 *
 * Two submits of one form, not a checkbox: turning the hold on and taking it
 * off are the two things you do here, and a button that says which one it is
 * beats a toggle whose state you have to read first. The message is optional —
 * blank leaves the hold its own words — and it rides whichever button is
 * pressed, so on can carry a fresh note and off clears the screen in one tap.
 *
 * Seeded from the live row so it opens telling the truth, and it re-renders
 * from what the action actually wrote, never from the button that was pressed,
 * so a save that failed does not leave the screen claiming a hold that is not
 * up.
 */
export function MaintenanceToggle({
  current,
}: {
  current: { locked: boolean; message: string | null };
}) {
  const [state, formAction, pending] = useActionState<
    MaintenanceState,
    FormData
  >(setMaintenanceLock, { error: null, ...current });

  const locked = state.locked ?? current.locked;
  const message = state.message ?? current.message ?? "";

  return (
    <form action={formAction} className="panel space-y-4 p-5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`size-2.5 rounded-full ${
            locked ? "bg-warn" : "bg-muted/50"
          }`}
        />
        <p className="label">
          {locked ? "Hold is ON · crews see the wait screen" : "Hold is off"}
        </p>
      </div>

      <p className="note text-muted leading-relaxed">
        Turn this on right before a deploy. Every open phone drops a
        &ldquo;back in a moment&rdquo; screen over its list and lifts it on its
        own when you turn the hold off. Nothing is lost — the ticks save
        themselves — and you stay let through while it is on.
      </p>

      <label className="block">
        <span className="label text-muted">Message · optional</span>
        <textarea
          name="message"
          rows={2}
          maxLength={MAINTENANCE_MESSAGE_MAX}
          defaultValue={message}
          placeholder="What the wait is for. Blank uses the default."
          className="field mt-1.5 w-full"
        />
      </label>

      {state.error ? (
        <p role="alert" className="label text-warn">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="on"
          value="yes"
          className="btn"
          disabled={pending || locked}
        >
          {pending ? "Saving…" : "Turn hold on"}
        </button>
        <button
          type="submit"
          name="on"
          value="no"
          className="btn-ghost"
          disabled={pending || !locked}
        >
          Turn hold off
        </button>
      </div>
    </form>
  );
}
