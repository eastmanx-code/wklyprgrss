"use client";

import { useActionState } from "react";

import { setRoleSpanish, type ManageState } from "@/app/checklists/manage";
import type { House } from "@/lib/checklists";

const initial: ManageState = { error: null };

/**
 * The position's name in Spanish, set where the list is written.
 *
 * Next to the items rather than on a settings screen, because it is the same
 * job: somebody sitting down to say what this list means. It writes against
 * the position, so the bartender's open list and close list cannot end up
 * disagreeing about what the bartender is called.
 *
 * Explained in both languages. The person filling this in reads English and
 * the person it is for does not, and they are rarely at the phone together.
 */
export function RoleSpanish({
  house,
  role,
  current,
}: {
  house: House;
  role: string;
  current: string | null;
}) {
  const [state, action, pending] = useActionState(setRoleSpanish, initial);

  return (
    <details className="panel-quiet mb-3">
      <summary className="label cursor-pointer">
        {role} in Spanish · {role} en español
      </summary>

      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="house" value={house} />
        <input type="hidden" name="role" value={role} />
        <input
          name="roleEs"
          className="field"
          defaultValue={current ?? ""}
          maxLength={40}
          placeholder={role}
          autoComplete="off"
        />
        <p className="note text-muted leading-relaxed">
          What this position is called in Spanish, shown to anyone reading the
          app in Spanish. Leave it blank and the English is used. Reports are
          unaffected.
        </p>
        {state.error ? (
          <p role="alert" className="text-body text-warn">
            {state.error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-sm" disabled={pending}>
          {pending ? "Saving…" : state.ok ? "Saved" : "Save"}
        </button>
      </form>
    </details>
  );
}
