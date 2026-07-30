"use client";

import { useActionState, useRef, useState } from "react";

import {
  addAdminPin,
  revokeAdminPin,
  type AdminState,
} from "@/app/admin/actions";

const initialState: AdminState = { error: null };

export type AdminPin = { id: string; pin: string; label: string };

/**
 * Admin codes, managed in the app rather than in an environment variable.
 *
 * The master key from the environment is deliberately absent from this list:
 * it can't be revoked here, so there's no sequence of clicks that locks you
 * out of your own tool.
 */
export function AdminPins({ pins }: { pins: AdminPin[] }) {
  const [state, formAction, pending] = useActionState(
    addAdminPin,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [revealed, setRevealed] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <form ref={formRef} action={formAction} className="panel space-y-3 p-5">
        <p className="label">Add a code</p>
        <div className="flex flex-wrap gap-2">
          <input
            name="label"
            className="field flex-1"
            placeholder="What it's for, e.g. Testing"
            disabled={pending}
          />
          <input
            name="pin"
            className="field w-32 text-center font-mono tracking-[0.3em]"
            placeholder="000000"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="off"
            disabled={pending}
          />
          <button type="submit" className="btn shrink-0" disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </button>
        </div>
        {state.error ? (
          <p role="alert" className="label text-fail">
            {state.error}
          </p>
        ) : (
          <p className="label">
            6 digits. Anyone with it gets full admin, so hand it out narrowly.
          </p>
        )}
      </form>

      {pins.length > 0 ? (
        <ul className="space-y-2">
          {pins.map((entry) => (
            <li
              key={entry.id}
              className="panel flex flex-wrap items-center gap-3 px-5 py-3"
            >
              <span className="caps flex-1 text-sm font-medium">
                {entry.label}
              </span>
              <span className="font-mono text-sm tracking-[0.3em] tabular-nums">
                {revealed === entry.id ? entry.pin : "••••••"}
              </span>
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  setRevealed((current) =>
                    current === entry.id ? null : entry.id,
                  )
                }
              >
                {revealed === entry.id ? "Hide" : "Show"}
              </button>
              <form action={revokeAdminPin}>
                <input type="hidden" name="id" value={entry.id} />
                <button type="submit" className="btn-ghost text-fail">
                  Revoke
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="label">
          No extra codes. Your master code from the environment always works.
        </p>
      )}
    </div>
  );
}
