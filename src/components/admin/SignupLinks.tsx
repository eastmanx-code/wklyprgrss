"use client";

import { useState } from "react";

import { rotateSignupToken, setSignupOpen } from "@/app/admin/actions";

export type SignupVenue = {
  id: string;
  code: string;
  url: string;
  open: boolean;
};

export function SignupLinks({ venues }: { venues: SignupVenue[] }) {
  return (
    <ul className="space-y-4">
      {venues.map((venue) => (
        <SignupRow key={venue.id} venue={venue} />
      ))}
    </ul>
  );
}

function SignupRow({ venue }: { venue: SignupVenue }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(venue.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <li className="panel space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-body text-ink tracking-normal">{venue.code}</span>
        <span className={`label ${venue.open ? "text-ink" : "text-muted"}`}>
          {venue.open ? "Signup open" : "Signup closed"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-body text-muted min-w-0 flex-1 truncate">
          {venue.url}
        </span>
        <button
          type="button"
          onClick={copy}
          className="btn-secondary btn-sm shrink-0"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <form action={setSignupOpen}>
          <input type="hidden" name="venueId" value={venue.id} />
          <input type="hidden" name="open" value={venue.open ? "no" : "yes"} />
          <button type="submit" className="btn-secondary btn-sm">
            {venue.open ? "Close signup" : "Open signup"}
          </button>
        </form>
        <form action={rotateSignupToken}>
          <input type="hidden" name="venueId" value={venue.id} />
          <button type="submit" className="btn-ghost btn-sm">
            New link
          </button>
        </form>
      </div>
    </li>
  );
}
