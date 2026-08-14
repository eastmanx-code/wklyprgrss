"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that admits it has been pressed.
 *
 * The review buttons were plain submits, so a tap did nothing at all until the
 * server came back — the page re-renders and signs every photograph on it, so
 * on a venue with a long history that silence ran to a good fraction of a
 * second. Nothing was broken and it read as broken, which is worse on a screen
 * you are tapping ten times in a row: the reflex is to tap again.
 *
 * `useFormStatus` reads the state of the form this sits inside, so it has to
 * be its own component nested in that form rather than the form itself.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className = "btn-ghost w-full",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
