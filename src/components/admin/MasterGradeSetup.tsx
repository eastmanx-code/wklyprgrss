"use client";

import { useActionState } from "react";

import { setMasterGradePin, type AdminState } from "@/app/admin/actions";

/**
 * Set or change the master grade code, on the admin screen only.
 *
 * The code never travels here from the server — the page passes only whether
 * one is set and the name it stamps — so this is write-only. Six digits, the
 * same shape as every other PIN, and the name that goes on every board the one
 * tap closes. The page re-renders from the live row after a save, so the line
 * above the form always tells the truth.
 */
export function MasterGradeSetup({
  set,
  grader,
}: {
  set: boolean;
  grader: string | null;
}) {
  const [state, formAction, pending] = useActionState<AdminState, FormData>(
    setMasterGradePin,
    { error: null },
  );

  return (
    <form action={formAction} className="panel space-y-4 p-5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`size-2.5 rounded-full ${set ? "bg-warn" : "bg-muted/50"}`}
        />
        <p className="label">
          {set ? `Set · stamps ${grader}` : "Not set yet"}
        </p>
      </div>

      <p className="note text-muted leading-relaxed">
        The code that unlocks one-tap grade-all from the corner menu, and the
        name written on every board it closes. Only you have the code; every
        admin sees the button and no one else can run it.
      </p>

      <div className="flex flex-wrap gap-3">
        <label className="block">
          <span className="label text-muted">Code · 6 digits</span>
          <input
            name="pin"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            placeholder="● ● ● ● ● ●"
            className="field mt-1.5 w-36 tracking-[0.3em]"
          />
        </label>
        <label className="block min-w-0 flex-1">
          <span className="label text-muted">Name it stamps</span>
          <input
            name="grader"
            defaultValue={grader ?? ""}
            autoComplete="name"
            placeholder="Who is grading"
            className="field mt-1.5 w-full"
          />
        </label>
      </div>

      {state.error ? (
        <p role="alert" className="label text-warn">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="btn" disabled={pending}>
        {pending ? "Saving…" : set ? "Change code" : "Set code"}
      </button>
    </form>
  );
}
