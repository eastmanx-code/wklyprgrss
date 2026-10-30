"use client";

import { useState, useTransition } from "react";

import { masterGradeAll, type MasterGradeResult } from "@/app/admin/actions";

/**
 * The one-tap grade-all, behind the owner's code, in the corner menu.
 *
 * Every admin sees the button; only the master code runs it. Tapping opens a
 * code box rather than firing straight away, so a stray tap grades nothing. On
 * a correct code it approves everything filed and closes the finished week for
 * every venue with the configured name on it, then says what it did. A wrong
 * code or an empty gate says so and changes nothing.
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
        Master grade
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
        aria-label="Master grade code"
        className="field w-full tracking-[0.3em]"
      />
      <button
        type="button"
        className="btn w-full"
        onClick={run}
        disabled={pending || pin.length !== 6}
      >
        {pending ? "Grading…" : "Grade all · stamp me"}
      </button>
      {result?.error ? (
        <p role="alert" className="label text-warn leading-relaxed">
          {result.error}
        </p>
      ) : result ? (
        <p className="label text-ink leading-relaxed">
          Done · approved {result.approved}, graded {result.boards} boards.
        </p>
      ) : null}
    </div>
  );
}
