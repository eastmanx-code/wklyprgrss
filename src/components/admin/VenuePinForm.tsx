"use client";

import { useActionState } from "react";

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

  return (
    <form action={formAction} className="panel space-y-3">
      <label className="label" htmlFor="venue-pin">
        Venue PIN
      </label>
      <div className="flex gap-2">
        <input
          id="venue-pin"
          name="pin"
          className="field font-mono tracking-[0.3em]"
          defaultValue={pin}
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          disabled={pending}
        />
        <input type="hidden" name="venueId" value={venueId} />
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
