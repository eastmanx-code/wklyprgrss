"use client";

import { useActionState } from "react";

import { leaderLogin, type FormState } from "@/app/actions";
import { useSpanish } from "@/components/Lang";

const initialState: FormState = { error: null };

/** Said in Spanish, keyed by which refusal the server returned. */
const ERROR_ES: Record<string, string> = {
  pin: "Ese PIN no es correcto. Inténtalo otra vez.",
  venue: "Primero escoge tu lugar.",
};

export function LeaderLoginForm({
  venues,
  defaultVenueId = "",
  next,
  forceEs = false,
}: {
  venues: { id: string; code: string; name: string }[];
  /** Chosen by the link, for a QR taped to a wall in one building. */
  defaultVenueId?: string;
  /** Where that link wanted to go. Checked on the server before it is used. */
  next?: string;
  /**
   * The link itself said Spanish, so this renders Spanish on the server too.
   *
   * Without it the door paints in English and flips a moment later, on the one
   * screen where the person has just scanned a code printed in Spanish. A flash
   * of the wrong language is small everywhere else and not here: this is the
   * first thing the app ever shows him.
   */
  forceEs?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    leaderLogin,
    initialState,
  );
  // An <option> takes text, not markup, so this one is read as a value.
  const spanish = useSpanish() || forceEs;
  const t = (en: string, es: string) => (spanish ? es : en);
  const selectPrompt = t("Select your venue", "Escoge tu lugar");

  return (
    <form action={formAction} className="panel space-y-6 p-6">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="space-y-3">
        <label className="label" htmlFor="venueId">
          {t("Venue", "Lugar")}
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
          {spanish && state.code ? ERROR_ES[state.code] : state.error}
        </p>
      ) : null}

      <button type="submit" className="btn mt-2 w-full" disabled={pending}>
        {pending ? t("Checking…", "Revisando…") : t("Continue", "Entrar")}
      </button>
    </form>
  );
}
