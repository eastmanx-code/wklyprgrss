"use client";

import { useActionState } from "react";

import { enrollManager, type SignupState } from "@/app/checklists/signup/actions";

const initialState: SignupState = { error: null };

export function ManagerSignupForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    enrollManager,
    initialState,
  );

  return (
    <form action={formAction} className="panel space-y-6 p-6">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-3">
        <label className="label" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          name="name"
          autoFocus
          autoComplete="name"
          className="field"
          placeholder="First and last"
        />
      </div>

      <div className="space-y-3">
        <label className="label" htmlFor="pin">
          Choose a 6-digit code
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d{6}"
          maxLength={6}
          className="field tracking-[0.4em]"
          placeholder="••••••"
        />
      </div>

      <div className="space-y-3">
        <label className="label" htmlFor="confirm">
          Type it again
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d{6}"
          maxLength={6}
          className="field tracking-[0.4em]"
          placeholder="••••••"
        />
      </div>

      <div className="space-y-3">
        <label className="label" htmlFor="venuePin">
          Venue PIN
        </label>
        <input
          id="venuePin"
          name="venuePin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d{6}"
          maxLength={6}
          className="field tracking-[0.4em]"
          placeholder="••••••"
        />
        <p className="label text-muted">
          The code your crew signs in with. Ask your GM if you do not have it.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-body text-warn">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="btn mt-2 w-full" disabled={pending}>
        {pending ? "Setting up…" : "Create my code"}
      </button>
    </form>
  );
}
