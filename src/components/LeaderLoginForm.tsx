"use client";

import { useActionState } from "react";

import { leaderLogin, type FormState } from "@/app/actions";

const initialState: FormState = { error: null };

export function LeaderLoginForm({
  venues,
}: {
  venues: { id: string; code: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    leaderLogin,
    initialState,
  );

  return (
    <form action={formAction} className="panel space-y-6 p-6">
      <div className="space-y-3">
        <label className="label" htmlFor="venueId">
          Venue
        </label>
        <select id="venueId" name="venueId" className="field" defaultValue="">
          <option value="" disabled>
            Select your venue
          </option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.code}
              {venue.name && venue.name !== venue.code
                ? ` — ${venue.name}`
                : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <label className="label" htmlFor="pin">
          PIN
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          className="field tracking-[0.4em]"
          placeholder="••••••"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-fail">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="btn mt-2 w-full" disabled={pending}>
        {pending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
