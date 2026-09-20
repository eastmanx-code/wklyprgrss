"use client";

import { useRef, useState } from "react";

import { refreshWalkPhotoUrl } from "@/app/walkthroughs/actions";

export type GridPhoto = { id: string; url: string };

/**
 * The photo strip, everywhere a walkthrough shows photos.
 *
 * Three jobs in one place so signed, open, and display-only items all behave
 * the same. A tap opens the full picture over the page.
 *
 * The pictures sit in a private bucket behind a signed URL that lapses after an
 * hour, so a strip left open past that would load nothing but broken images
 * with no way back, worst of all on a signed item that has no upload control.
 * Two things keep that from happening. When an image fails, the grid quietly
 * asks the server for a freshly signed URL and swaps it in, so a lapsed link
 * heals itself with nothing for the person to do. Only if that fresh URL also
 * fails does the broken tile appear, and its tap re-signs again rather than
 * re-loading the same dead link. A file that is genuinely gone lands on that
 * tile and stays there.
 *
 * And when the caller passes onRemove, each open item's photo gets the × to
 * pull it back off, for the one that landed on the wrong task.
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
  // A refresh mints a new signed URL server-side; when it lands, it lives here
  // and wins over the one that was passed in. Keyed by photo id.
  const [fresh, setFresh] = useState<Record<string, string>>({});
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  // Which photos have already had their one silent auto-refresh. A ref, not
  // state, so a second onError firing before the re-render still sees it and
  // does not fetch twice or loop.
  const autoTried = useRef<Set<string>>(new Set());

  if (photos.length === 0) return null;

  const urlOf = (p: GridPhoto) => fresh[p.id] ?? p.url;

  function markFailed(id: string) {
    setFailed((s) => new Set(s).add(id));
  }
  function setRetry(id: string, on: boolean) {
    setRetrying((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  /** Pull a fresh signed URL in; returns whether one came back. */
  async function resign(id: string): Promise<boolean> {
    const url = await refreshWalkPhotoUrl(id);
    if (!url) return false;
    setFresh((f) => ({ ...f, [id]: url }));
    setFailed((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
    return true;
  }
  // First failure: try once to heal it silently before the broken tile shows.
  // If it lapsed, the fresh URL loads and the person never sees a gap; if the
  // file is really gone, or the fresh one fails too, fall through to the tile.
  async function onImgError(id: string) {
    if (autoTried.current.has(id)) {
      markFailed(id);
      return;
    }
    autoTried.current.add(id);
    if (!(await resign(id))) markFailed(id);
  }
  async function retry(id: string) {
    if (retrying.has(id)) return;
    setRetry(id, true);
    try {
      // A null answer means the file is genuinely gone or not ours to see, so
      // the tile stays failed rather than flickering back to a broken image.
      await resign(id);
    } finally {
      setRetry(id, false);
    }
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
                disabled={retrying.has(p.id)}
                className="bg-inset text-muted ring-card-border grid h-16 w-16 place-items-center rounded-[4px] px-1 text-center text-[10px] leading-tight ring-1"
              >
                {retrying.has(p.id) ? "Loading…" : "Didn’t load · tap to retry"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(urlOf(p))}
                className="block cursor-zoom-in"
                aria-label="View photo larger"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={urlOf(p)}
                  src={urlOf(p)}
                  alt=""
                  onError={() => onImgError(p.id)}
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
