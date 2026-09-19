"use client";

import { useState } from "react";

export type GridPhoto = { id: string; url: string };

/**
 * The photo strip, everywhere a walkthrough shows photos.
 *
 * Three jobs in one place so signed, open, and display-only items all behave
 * the same. A tap opens the full picture over the page. A photo that does not
 * load shows a plain "tap to retry" tile instead of the browser's broken-image
 * icon, because a private signed URL can lapse and the file is almost always
 * still there. And when the caller passes onRemove, each open item's photo gets
 * the × to pull it back off, for the one that landed on the wrong task.
 */
export function PhotoGrid({
  photos,
  onRemove,
  busy,
}: {
  photos: GridPhoto[];
  onRemove?: (id: string) => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  // Bumped on a retry so the <img> remounts and re-fetches the same URL.
  const [attempt, setAttempt] = useState(0);

  if (photos.length === 0) return null;

  function markFailed(id: string) {
    setFailed((s) => new Set(s).add(id));
  }
  function retry(id: string) {
    setFailed((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
    setAttempt((a) => a + 1);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <span key={p.id} className="relative inline-block">
            {failed.has(p.id) ? (
              <button
                type="button"
                onClick={() => retry(p.id)}
                className="bg-inset text-muted ring-card-border grid h-16 w-16 place-items-center rounded-[4px] px-1 text-center text-[10px] leading-tight ring-1"
              >
                Didn’t load · tap to retry
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(p.url)}
                className="block cursor-zoom-in"
                aria-label="View photo larger"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={`${p.id}-${attempt}`}
                  src={p.url}
                  alt=""
                  onError={() => markFailed(p.id)}
                  className="h-16 w-16 rounded-[4px] object-cover"
                />
              </button>
            )}
            {onRemove ? (
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                disabled={busy}
                aria-label="Remove this photo"
                className="bg-surface text-warn ring-card-border absolute -top-2 -right-2 grid size-5 place-items-center rounded-full text-[13px] leading-none ring-1"
              >
                ×
              </button>
            ) : null}
          </span>
        ))}
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={open}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-[6px] object-contain"
          />
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(null)}
            className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-white/15 text-2xl leading-none text-white"
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}
