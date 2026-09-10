"use client";

import { useEffect, useRef, useState } from "react";

import { T } from "@/components/Lang";
import { APP_NAME } from "@/lib/app";

/**
 * The instructions as a full-screen dialog on the sign-in screen, with an
 * acknowledgement.
 *
 * Two products share the sign-in, so the dialog covers both and the button is
 * a plain "got it". "I understand the weekly rule" was the wrong sentence to
 * put in front of a barback signing in for a close.
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
        <T en="How to use this" es="Cómo usar esto" />
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
            <h2 className="mt-2 text-metric font-medium">
              <T en="How to use this" es="Cómo usar esto" />
            </h2>
          </header>

          {children}

          <button
            type="button"
            className="btn mt-6 w-full"
            onClick={acknowledge}
          >
            <T en="Got it" es="Entendido" />
          </button>
        </div>
      </dialog>
    </>
  );
}
