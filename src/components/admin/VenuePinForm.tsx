"use client";

import { useActionState, useState } from "react";

import { updateVenuePin, type AdminState } from "@/app/admin/actions";

const initialState: AdminState = { error: null };

/**
 * Compact by design. This gets touched once when a venue is set up and almost
 * never again, so it sits as a single pill row rather than a full panel with a
 * form-sized field. Masked until Show is pressed.
 */
export function VenuePinForm({
  venueId,
  pin,
  compact = false,
}: {
  venueId: string;
  pin: string;
  /**
   * Drops the per-row label and hint. On a single venue's page they belong;
   * in a list of twenty-seven they repeat "VENUE PIN" and "6 digits, shared
   * with the whole venue" twenty-seven times, which is most of what makes
   * that list feel cramped. The section states it once instead.
   */
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateVenuePin,
    initialState,
  );
  const [revealed, setRevealed] = useState(false);

  return (
    <form
      action={formAction}
      /* Compact rows sit in a list twenty-seven long. Left-packed, the pills
         ended a third of the way across and the whole section hung off the
         left of a column whose panels and rule run full width. Pushed to the
         far edge they line up with the admin code row directly above.

         From sm up only: a phone has just enough width for the pill, Show and
         Save on one line, and reserving any of it for alignment wraps Save
         onto a line of its own. */
      className={`flex flex-wrap items-center gap-2 ${
        compact ? "sm:justify-end" : ""
      }`}
    >
      <input type="hidden" name="venueId" value={venueId} />

      {compact ? null : (
        <label className="label w-16 shrink-0" htmlFor={`venue-pin-${venueId}`}>
          Venue PIN
        </label>
      )}

      <input
        id={`venue-pin-${venueId}`}
        name="pin"
        type={revealed ? "text" : "password"}
        className="bg-panel text-ink h-8 w-28 rounded-full px-3 text-center font-mono text-body tracking-[0.3em] outline-none focus:ring-1 focus:ring-current"
        defaultValue={pin}
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        autoComplete="off"
        disabled={pending}
      />

      <button
        type="button"
        className="btn-ghost"
        onClick={() => setRevealed((value) => !value)}
        aria-pressed={revealed}
      >
        {revealed ? "Hide" : "Show"}
      </button>

      <button type="submit" className="btn btn-sm" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>

      {state.error ? (
        <p role="alert" className="label text-warn w-full">
          {state.error}
        </p>
      ) : compact ? null : (
        <p className="label w-full">6 digits · shared with the whole venue.</p>
      )}
    </form>
  );
}
