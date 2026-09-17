"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { answerWalkQuestion } from "@/app/walkthroughs/actions";

/**
 * The check-off for an open question. A question is not photographed, it is
 * answered in words, so this is its version of the sign button: write the
 * answer, put a name to it, close it. The row then reads back like any other
 * closed item, the answer in place of the photo.
 */
export function QuestionAnswer({ id }: { id: string }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (answer.trim().length < 2) {
      setError("Write an answer first.");
      return;
    }
    if (name.trim().length < 2) {
      setError("Put your name to it.");
      return;
    }
    setBusy(true);
    setError(null);
    const data = new FormData();
    data.set("id", id);
    data.set("answer", answer.trim());
    data.set("answeredBy", name.trim());
    const r = await answerWalkQuestion({ error: null }, data);
    setBusy(false);
    if (r.error) setError(r.error);
    else router.refresh();
  }

  return (
    <div className="mt-3 space-y-3">
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Your answer"
        rows={2}
        className="field w-full"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="field w-full"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy || answer.trim().length === 0}
        className="btn btn-sm"
      >
        {busy ? "Working…" : "Answer and close"}
      </button>
      {error ? (
        <p role="alert" className="label text-warn">
          {error}
        </p>
      ) : null}
    </div>
  );
}
