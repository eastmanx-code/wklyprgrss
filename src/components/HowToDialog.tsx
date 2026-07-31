"use client";

import { useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/lib/app";

/**
 * The instructions as a full-screen dialog on the sign-in screen, with an
 * acknowledgement.
 *
 * Opens on every visit to sign-in rather than once per device. A device
 * acknowledgement was the wrong unit: the PIN is shared, so "this phone has
 * seen it" says nothing about the person holding it, and the rule it states —
 * a new photo and a new comment, nothing carried forward — is the thing most
 * worth repeating weekly.
 *
 * Native <dialog>, so focus trapping and Esc come for free.
 */
export function HowToDialog({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    // Pure DOM sync — no state is set here.
    ref.current?.showModal();
  }, []);

  function acknowledge() {
    setAcknowledged(true);
    ref.current?.close();
  }

  return (
    <>
      <button
        type="button"
        className="label hover:text-ink"
        onClick={() => ref.current?.showModal()}
      >
        {"How to use this"}
      </button>

      <dialog
        ref={ref}
        className="ww-dialog"
        onCancel={(event) => {
          // The first showing has to be acknowledged, not dismissed.
          if (!acknowledged) event.preventDefault();
        }}
      >
        {/* Sized to fit — nothing hidden, no scrolling. The long version
            lives on /help. */}
        <div className="ww-dialog-body">
          <header className="mb-4">
            <p className="label">{APP_NAME} · before you start</p>
            <h2 className="mt-2 text-metric font-medium">How to use this</h2>
          </header>

          {children}

          {/* Name the consequence, so "I understand" refers to something
              specific rather than being a polite dismiss button. */}
          <p className="note mt-5 leading-relaxed">
            Missing a photo or a comment fails that item for the week.
          </p>

          <button
            type="button"
            className="btn mt-4 w-full"
            onClick={acknowledge}
          >
            I understand the weekly rule
          </button>
        </div>
      </dialog>
    </>
  );
}
