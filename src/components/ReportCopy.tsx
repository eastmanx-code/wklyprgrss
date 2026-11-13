"use client";

import { useState } from "react";

/**
 * The finished card text in one box, with one button that copies all of it.
 *
 * A read-only field rather than something editable: the sharpening happens
 * after it lands in the ClickUp comment, and a textarea you can scroll but not
 * fat-finger is the safest thing to hand somebody who just wants the whole
 * thing on the clipboard. Selecting by hand in a tall box is exactly where a
 * partial copy comes from, which is the one thing this is here to stop.
 */
export function ReportCopy({
  text,
  button = "Copy the whole report",
  hint = "Paste into the ClickUp card, then sharpen the voice sections before it goes up.",
  tall = true,
}: {
  text: string;
  /** What the button says. The weekly report's words unless told otherwise. */
  button?: string;
  /** The line beside the button: where this text is going. */
  hint?: string;
  /** The weekly report fills the screen. A short text gets a short box. */
  tall?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (an insecure context, or a browser that refuses):
      // the text is still selectable in the box, so the fallback is manual.
      setCopied(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={copy} className="btn">
          {copied ? "Copied" : button}
        </button>
        <span className="label">{hint}</span>
      </div>
      <textarea
        readOnly
        value={text}
        spellCheck={false}
        onFocus={(e) => e.currentTarget.select()}
        className={`bg-inset text-ink w-full resize-y rounded-[6px] p-4 font-mono text-sm leading-relaxed ${
          tall ? "h-[70vh]" : "h-64"
        }`}
      />
    </div>
  );
}
