"use client";

import { useState, useTransition } from "react";

import { masterGradeAll, type MasterGradeResult } from "@/app/admin/actions";

/**
 * One-tap grade-all, behind the owner's code, on the hidden /admin/master page.
 *
 * Tapping opens a code box rather than firing straight away, so a stray tap
 * grades nothing. On a correct code it closes the finished week for every
 * dining room with the configured name on it, verdicts untouched, then says
 * what it did. A wrong code or an empty gate says so and changes nothing.
 */
export function MasterGrade() {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<MasterGradeResult | null>(null);
  const [pending, start] = useTransition();

  function run() {
    setResult(null);
    start(async () => {
      const r = await masterGradeAll(pin);
      setResult(r);
      if (!r.error) setPin("");
    });
  }

  if (!open) {
    return (
      <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
        Run
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <input
        value={pin}
        onChange={(event) =>
          setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
        }
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        placeholder="Code"
        aria-label="Dev code"
        className="field w-full tracking-[0.3em]"
      />
      <button
        type="button"
        className="btn w-full"
        onClick={run}
        disabled={pending || pin.length !== 6}
      >
        {pending ? "Working…" : "Run"}
      </button>
      {result?.error ? (
        <p role="alert" className="label text-warn leading-relaxed">
          {result.error}
        </p>
      ) : result ? (
        <p className="label text-ink leading-relaxed">
          Done · graded {result.boards} dining rooms. Verdicts untouched.
        </p>
      ) : null}
    </div>
  );
}
