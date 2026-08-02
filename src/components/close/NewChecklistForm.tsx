"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createChecklist, type ManageState } from "@/app/close/manage";
import { HOUSES, PHASES, slugFor, type House, type Phase } from "@/lib/checklists";

const initial: ManageState = { error: null };

/**
 * Starting a list.
 *
 * Behind a disclosure, because on most visits somebody is here to walk a
 * checklist, not to write one. The role is a text field rather than a menu:
 * the menu was the old design, it was full of roles invented in code, and a
 * venue that calls the job something else had nowhere to say so.
 */
export function NewChecklistForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createChecklist, initial);
  const [house, setHouse] = useState<House>("FOH");
  const [phase, setPhase] = useState<Phase>("close");
  const [role, setRole] = useState("");

  useEffect(() => {
    // Straight into the new list — an empty one is no use until it has items,
    // and the next thing anybody wants is to start typing them.
    if (state.ok && role.trim()) {
      router.push(`/close/${slugFor(house, role.trim(), phase)}/edit`);
    }
  }, [state.ok, router, house, role, phase]);

  return (
    <details className="panel">
      <summary className="card-title cursor-pointer">Start a list</summary>

      <form action={action} className="mt-4 space-y-4">
        <div className="space-y-2">
          <span className="label">House</span>
          <div className="flex flex-wrap gap-2">
            {HOUSES.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setHouse(option.key)}
                aria-pressed={house === option.key}
                className={house === option.key ? "btn btn-sm" : "btn-ghost min-h-11"}
              >
                {option.name}
              </button>
            ))}
          </div>
          <input type="hidden" name="house" value={house} />
        </div>

        <div className="space-y-2">
          <label className="label" htmlFor="role">
            Role
          </label>
          <input
            id="role"
            name="role"
            className="field"
            placeholder="MOD, Barback, Dish — whatever you call it"
            maxLength={40}
            autoComplete="off"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          />
          <p className="label">
            Your words, not ours. Two lists for the same role and phase are the
            same list.
          </p>
        </div>

        <div className="space-y-2">
          <span className="label">Phase</span>
          <div className="flex flex-wrap gap-2">
            {PHASES.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setPhase(option.key)}
                aria-pressed={phase === option.key}
                className={phase === option.key ? "btn btn-sm" : "btn-ghost min-h-11"}
              >
                {option.name}
              </button>
            ))}
          </div>
          <input type="hidden" name="phase" value={phase} />
        </div>

        {state.error ? (
          <p role="alert" className="text-body text-warn">
            {state.error}
          </p>
        ) : null}

        <button type="submit" className="btn w-full" disabled={pending}>
          {pending ? "Creating…" : "Create the list"}
        </button>
      </form>
    </details>
  );
}
