"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const ACK_KEY = "ww_howto_ack";

/** Never changes mid-session, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => {};

function readAck(): string {
  try {
    return localStorage.getItem(ACK_KEY) === "1" ? "1" : "0";
  } catch {
    return "0";
  }
}

/** Treated as acknowledged on the server, so nothing flashes before hydration. */
const ackOnServer = () => "1";

/**
 * The instructions as a dialog on the sign-in screen, with an acknowledgement.
 *
 * Opens by itself the first time on a device, then stays out of the way and is
 * reopened from the button. Native <dialog>, so focus trapping and Esc come
 * for free.
 *
 * The acknowledgement is per-device, not per-person — there are no accounts,
 * and a shared venue PIN cannot tell two people apart. Read it as "this phone
 * has seen the instructions", not as a signature.
 */
export function HowToDialog({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const stored = useSyncExternalStore(subscribeToNothing, readAck, ackOnServer);
  const [clicked, setClicked] = useState(false);
  const acknowledged = clicked || stored === "1";

  useEffect(() => {
    // Pure DOM sync — no state is set here.
    if (!acknowledged) ref.current?.showModal();
  }, [acknowledged]);

  function acknowledge() {
    try {
      localStorage.setItem(ACK_KEY, "1");
    } catch {
      // Private browsing — it just asks again next time.
    }
    setClicked(true);
    ref.current?.close();
  }

  return (
    <>
      <button
        type="button"
        className="btn-ghost w-full"
        onClick={() => ref.current?.showModal()}
      >
        {acknowledged ? "How to use this" : "Read this first"}
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
            <p className="label">Before you start</p>
            <h2 className="mt-2 text-xl font-medium tracking-tight">
              How to use this
            </h2>
          </header>

          {children}

          <button
            type="button"
            className="btn mt-6 w-full"
            onClick={acknowledge}
          >
            I understand
          </button>
        </div>
      </dialog>
    </>
  );
}
