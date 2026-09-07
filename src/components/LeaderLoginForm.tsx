"use client";

import { useActionState } from "react";

import { leaderLogin, type FormState } from "@/app/actions";
import { T, useT } from "@/components/Lang";

const initialState: FormState = { error: null };

export function LeaderLoginForm({
  venues,
  defaultVenueId = "",
  next,
}: {
  venues: { id: string; code: string; name: string }[];
  /** Chosen by the link, for a QR taped to a wall in one building. */
  defaultVenueId?: string;
  /** Where that link wanted to go. Checked on the server before it is used. */
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(
    leaderLogin,
    initialState,
  );
  // An <option> takes text, not markup, so this one is read as a value.
  const t = useT();
  const selectPrompt = t("Select your venue", "Escoge tu lugar");

  return (
    <form action={formAction} className="panel space-y-6 p-6">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="space-y-3">
        <label className="label" htmlFor="venueId">
          <T en="Venue" es="Lugar" />
        </label>
        <span className="select-wrap">
          <select
            id="venueId"
            name="venueId"
            className="field"
            defaultValue={defaultVenueId}
          >
            <option value="" disabled>
              {selectPrompt}
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
        </span>
      </div>

      <div className="space-y-3">
        <label className="label" htmlFor="pin">
          PIN
        </label>
        <input
          id="pin"
          name="pin"
          autoFocus
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          className="field tracking-[0.4em]"
          placeholder="••••••"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-body text-warn">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="btn mt-2 w-full" disabled={pending}>
        {pending ? (
          <T en="Checking…" es="Revisando…" />
        ) : (
          <T en="Continue" es="Entrar" />
        )}
      </button>
    </form>
  );
}
