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

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="btn-ghost text-fail"
      >
        Wipe {venueCode}
      </button>
    );
  }

  return (
    <div className="border-fail/60 bg-fail/5 rounded-[20px] border p-6">
      <p className="label text-fail">Destructive · cannot be undone</p>

      <h3 className="text-fail mt-3 text-xl leading-tight font-medium tracking-tight">
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
          <button type="submit" className="btn bg-fail text-white">
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
