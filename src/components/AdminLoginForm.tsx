"use client";

import { useActionState } from "react";

import { adminLogin, type FormState } from "@/app/actions";

const initialState: FormState = { error: null };

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminLogin, initialState);

  return (
    <form action={formAction} className="panel space-y-5">
      <div className="space-y-2">
        <label className="label" htmlFor="pin">
          Admin PIN
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          className="field tracking-[0.4em]"
          placeholder="••••"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-fail">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="btn w-full" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
