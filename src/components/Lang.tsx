"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Which language a person reads the app in, kept on their own device.
 *
 * This started inside the checklist as a switch over item titles, which was
 * the wrong size for the problem. A person who does not read English cannot
 * reach a control buried three screens into an English app: the door, the
 * position picker and the list header all stood between him and the button
 * that would have translated them. The switch has to be on the screen he lands
 * on, and the path from there has to be readable once he taps it.
 *
 * The label is the trick. "Español" is the one word on the screen he can
 * always read, whatever else it says, so the control identifies itself.
 *
 * Device rather than venue or account. One venue runs on a shared login and
 * the pad at the bar is used by people who read English, so a venue-wide
 * setting would translate the wrong phones. Whoever preps opens their own
 * phone once and never touches it again.
 */
const LANG_KEY = "ww-close-lang";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function readLang(): boolean {
  try {
    return window.localStorage.getItem(LANG_KEY) === "es";
  } catch {
    return false;
  }
}

function writeLang(es: boolean) {
  try {
    window.localStorage.setItem(LANG_KEY, es ? "es" : "en");
  } catch {
    // A phone with storage blocked still gets the switch for this page view.
  }
  for (const cb of listeners) cb();
}

/**
 * Read through useSyncExternalStore because the device is the source of truth
 * and the server has no opinion. The server snapshot is English, so the first
 * paint matches what was sent and the switch is not a flash of the wrong
 * language on every navigation.
 */
export function useSpanish(): boolean {
  return useSyncExternalStore(subscribe, readLang, () => false);
}

/**
 * One string, said twice, at the place it is used.
 *
 * Both languages live at the call site rather than behind a key in a
 * dictionary file. A key is a promise that somebody will keep two files in
 * step, and the way that promise breaks is a screen that half translates. Here
 * you cannot change the English without the Spanish in front of you.
 *
 * A client leaf inside server pages, so the screens it sits on stay on the
 * server. Only the words are shipped to the browser.
 */
export function T({ en, es }: { en: string; es: string }) {
  return <>{useSpanish() ? es : en}</>;
}

/** The same string as a value, where markup will not do. */
export function useT() {
  const spanish = useSpanish();
  return (en: string, es: string) => (spanish ? es : en);
}

/**
 * The switch itself. Rendered wherever there is something to switch, which is
 * the whole crew path: the picker, the position, the list, the guide.
 *
 * Both labels are always in their own language, never "EN / ES" and never
 * "Language:". A person looking for a way out of a screen they cannot read is
 * scanning for a word they recognise, and "Español" is it.
 */
export function LangSwitch({ className = "" }: { className?: string }) {
  const spanish = useSpanish();
  return (
    <div className={`flex gap-1 ${className}`} role="group" aria-label="Idioma">
      {(
        [
          ["en", "English", false],
          ["es", "Español", true],
        ] as const
      ).map(([key, label, es]) => (
        <button
          key={key}
          type="button"
          onClick={() => writeLang(es)}
          aria-pressed={spanish === es}
          className={`text-label min-h-9 rounded px-3 tracking-[0.08em] ${
            spanish === es
              ? "bg-ink text-paper"
              : "ring-card-border text-muted ring-1"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * A link that says which language it is for.
 *
 * The QR taped up in the prep room is printed in Spanish, so scanning it should
 * open the app in Spanish rather than in English with a button that says so.
 * It writes the same device setting the switch writes, so it is a one time
 * arrival and not a mode: whoever scans it can switch back at the top of the
 * screen, and the phone keeps whatever it was last told.
 */
export function LangFromLink({ lang }: { lang?: string }) {
  useEffect(() => {
    if (lang === "es") writeLang(true);
    else if (lang === "en") writeLang(false);
  }, [lang]);
  return null;
}
