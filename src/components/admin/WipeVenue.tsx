"use client";

import { useState } from "react";

import { wipeVenue } from "@/app/admin/actions";

/**
 * Two-step, and loud about it. Wiping deletes every photo file for a venue and
 * retires its whole list — recoverable for nothing but the text. The first tap
 * only opens the warning; the action itself needs a second, deliberate press.
 */
export function WipeVenue({
  venueId,
  venueCode,
  itemCount,
  photoCount,
}: {
  venueId: string;
  venueCode: string;
  itemCount: number;
  photoCount: number;
}) {
  const [armed, setArmed] = useState(false);

  // At rest this states what it does, rather than sitting under a one-word
  // label as a quiet ghost button. Somebody reaching this row should be able
  // to read the consequence without having to press anything to find it out.
  if (!armed) {
    return (
      <div className="border-warn/40 rounded-[8px] border p-5">
        <p className="label text-warn">Destructive · cannot be undone</p>
        <p className="note text-muted mt-2 max-w-prose leading-relaxed">
          Deletes every photo file for {venueCode} and retires its whole list.
          Comments, names, dates and pass/fail history are kept.
        </p>
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="btn-ghost text-warn ring-warn/50 mt-4 ring-1"
        >
          Wipe {venueCode}
        </button>
      </div>
    );
  }

  return (
    /* border-warn: this read border-fail, and there is no fail token — so the
       panel that exists to look alarming had no border at all. */
    <div className="border-warn/60 bg-warn/5 rounded-[8px] border p-6">
      <p className="label text-warn">Destructive · cannot be undone</p>

      <h3 className="text-warn mt-3 text-metric leading-tight font-medium">
        Wipe {venueCode}&apos;s board?
      </h3>

      <ul className="mt-5 space-y-2">
        <li className="note leading-relaxed">
          <strong>{photoCount}</strong>{" "}
          {photoCount === 1 ? "photo is" : "photos are"} deleted from storage.
          Gone for good — there is no copy.
        </li>
        <li className="note leading-relaxed">
          <strong>{itemCount}</strong> {itemCount === 1 ? "item" : "items"} are
          retired. The board comes back empty, ready for ten new ones.
        </li>
        <li className="note leading-relaxed">
          Comments, names, dates and pass/fail history are <strong>kept</strong>
          , so streaks and reports stay honest.
        </li>
      </ul>

      <p className="note mt-5 leading-relaxed">
        Only do this at a reset — a new quarter, a new set of focus areas. It
        will not undo a bad week.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <form action={wipeVenue}>
          <input type="hidden" name="venueId" value={venueId} />
          <input type="hidden" name="confirm" value="WIPE" />
          <button type="submit" className="btn bg-warn text-on-warn">
            Yes — wipe {venueCode}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="btn-ghost"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
