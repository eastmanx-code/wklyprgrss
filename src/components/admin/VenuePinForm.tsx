"use client";

import { useActionState, useState } from "react";

import { updateVenuePin, type AdminState } from "@/app/admin/actions";

const initialState: AdminState = { error: null };

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
  // Hidden by default so the PIN isn't sitting on screen over someone's
  // shoulder. Reveal it deliberately when you need to read it out.
  const [revealed, setRevealed] = useState(false);

  return (
    <form action={formAction} className="panel space-y-3">
      <input type="hidden" name="venueId" value={venueId} />
      <label className="label" htmlFor="venue-pin">
        Venue PIN
      </label>
      <div className="flex gap-2">
        <input
          id="venue-pin"
          name="pin"
          type={revealed ? "text" : "password"}
          className="field font-mono tracking-[0.3em]"
          defaultValue={pin}
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="off"
          disabled={pending}
        />
        <button
          type="button"
          className="btn-ghost shrink-0"
          onClick={() => setRevealed((value) => !value)}
          aria-pressed={revealed}
        >
          {revealed ? "Hide" : "Show"}
        </button>
        <button type="submit" className="btn shrink-0" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-fail">
          {state.error}
        </p>
      ) : (
        <p className="label">6 digits · shared with everyone at this venue.</p>
      )}
    </form>
  );
}
