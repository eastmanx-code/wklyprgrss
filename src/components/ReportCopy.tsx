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
export function ReportCopy({ text }: { text: string }) {
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
          {copied ? "Copied" : "Copy the whole report"}
        </button>
        <span className="label">
          Paste into the ClickUp card, then sharpen the voice sections before it
          goes up.
        </span>
      </div>
      <textarea
        readOnly
        value={text}
        spellCheck={false}
        onFocus={(e) => e.currentTarget.select()}
        className="bg-inset text-ink h-[70vh] w-full resize-y rounded-[6px] p-4 font-mono text-sm leading-relaxed"
      />
    </div>
  );
}
