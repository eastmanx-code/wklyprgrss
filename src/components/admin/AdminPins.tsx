"use client";

import { useActionState, useRef, useState } from "react";

import {
  addAdminPin,
  revokeAdminPin,
  type AdminState,
} from "@/app/admin/actions";

const initialState: AdminState = { error: null };

export type AdminPin = {
  id: string;
  pin: string;
  label: string;
  /** The venue this code is a manager for, or null for a full admin code. */
  venueId: string | null;
};

export type CodeVenue = { id: string; code: string };

/**
 * Admin and manager codes, managed in the app rather than in an environment
 * variable.
 *
 * The master key from the environment is deliberately absent from this list:
 * it can't be revoked here, so there's no sequence of clicks that locks you
 * out of your own tool.
 *
 * The venue picker is what makes a manager code a manager code. Without it the
 * only way to scope one was a hand written update against the table, which is
 * how four bar managers ended up holding every venue in the group: the level
 * existed in nobody's head as a thing you could make.
 */
export function AdminPins({
  pins,
  venues,
}: {
  pins: AdminPin[];
  venues: CodeVenue[];
}) {
  const codeOf = new Map(venues.map((venue) => [venue.id, venue.code]));
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
          {/* Defaults to one venue, not to all of them. The dangerous option
              is the one that should take a deliberate choice, and almost every
              code handed out is a bar manager's. */}
          <select
            name="venueId"
            className="field w-40"
            defaultValue={venues[0]?.id ?? ""}
            disabled={pending}
          >
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.code} · manager
              </option>
            ))}
            <option value="">Every venue · admin</option>
          </select>
          <button type="submit" className="btn shrink-0" disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </button>
        </div>
        {state.error ? (
          <p role="alert" className="label text-warn">
            {state.error}
          </p>
        ) : (
          <p className="label">
            6 digits. A manager code edits and reopens one venue&apos;s lists.
            An admin code is every venue, the grading board and this screen, so
            hand that one out narrowly.
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
              <span className="caps flex-1 text-body font-medium">
                {entry.label}
              </span>
              {/* What the code actually opens, on the row, because a list of
                  six codes that all look alike is a list nobody audits. */}
              <span
                className={`label shrink-0 ${entry.venueId ? "" : "text-warn"}`}
              >
                {entry.venueId
                  ? (codeOf.get(entry.venueId) ?? "one venue")
                  : "Every venue"}
              </span>
              <span className="font-mono text-body tracking-[0.3em] tabular-nums">
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
                <button type="submit" className="btn-ghost text-warn">
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
