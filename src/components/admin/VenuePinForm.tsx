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
}: {
  venueId: string;
  pin: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateVenuePin,
    initialState,
  );
  const [revealed, setRevealed] = useState(false);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="venueId" value={venueId} />

      <label className="label w-16 shrink-0" htmlFor="venue-pin">
        Venue PIN
      </label>

      <input
        id="venue-pin"
        name="pin"
        type={revealed ? "text" : "password"}
        className="bg-panel text-ink h-8 w-28 rounded-full px-3 text-center font-mono text-xs tracking-[0.3em] outline-none focus:ring-1 focus:ring-current"
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
        <p role="alert" className="label text-fail w-full">
          {state.error}
        </p>
      ) : (
        <p className="label w-full">6 digits · shared with the whole venue.</p>
      )}
    </form>
  );
}
