"use client";

import { useEffect, useRef, useState } from "react";

/** One frame in a set the overlay can page through. */
export type PhotoFrame = { src: string; label: string };

/**
 * A photo with a way to see all of it.
 *
 * Fitting the whole frame into a card shrinks it to the point of being
 * useless, and cropping to fill hides the edge someone stood there to
 * photograph. So the card crops, and tapping it opens the whole frame over the
 * page.
 *
 * It used to open the file in a new tab instead. On a phone that leaves the
 * app: the reviewer lands in the browser's image viewer, then has to find
 * their way back to the task they were ruling on. Grading a before and after
 * means going back and forth between two shots, and every trip out was a trip
 * back. The link to the file is still there inside the overlay, for when the
 * original at full resolution is what is wanted.
 *
 * Given a set, the overlay pages through it in place: swipe, the arrow keys,
 * or the buttons at the foot. Before and after were two overlays, and
 * comparing them meant closing one to open the other, which is the trip out
 * and back all over again, only inside the app.
 */
export function PhotoView({
  src,
  alt = "",
  className = "",
  hint = true,
  set,
}: {
  src: string;
  alt?: string;
  className?: string;
  /** The corner chip. Off on thumbnails, where it covers the picture. */
  hint?: boolean;
  /**
   * The frames this photo sits among, in order. The overlay opens on this
   * photo and moves side to side through the rest. Absent, it is one frame.
   */
  set?: PhotoFrame[];
}) {
  const frames: PhotoFrame[] =
    set && set.length > 0 ? set : [{ src, label: alt }];
  const start = Math.max(
    0,
    frames.findIndex((f) => f.src === src),
  );

  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(start);
  // Filling the screen is not magnification on a phone, where the photo was
  // already full width in the card. Zoomed, the image overflows and the layer
  // scrolls, so a reviewer can get in close on the corner they are judging.
  const [zoomed, setZoomed] = useState(false);
  const touchX = useRef<number | null>(null);

  const many = frames.length > 1;
  const go = (step: number) => {
    setZoomed(false);
    setAt((i) => Math.min(frames.length - 1, Math.max(0, i + step)));
  };

  // Escape closes it. A full-screen layer with no keyboard way out is a trap
  // on a laptop, where there is nothing obvious to tap. The arrows page.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const frame = frames[at] ?? frames[0];

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setZoomed(false);
          setAt(start);
          setOpen(true);
        }}
        /* w-full because a button sizes to its content, not its box: the
           image inside is height-driven, so without it the whole photo
           collapsed to nothing the moment this stopped being a span. */
        className={`bg-inset relative block w-full cursor-zoom-in overflow-hidden ${className}`}
        title="Tap to enlarge"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-full w-full object-cover" />
        {hint ? (
          <span className="label text-ink bg-paper/85 absolute right-2 bottom-2 rounded-full px-2.5 py-1 backdrop-blur-sm">
            Bigger
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={`fixed inset-0 z-50 bg-black/95 ${
            zoomed ? "overflow-auto" : "flex items-center justify-center p-4"
          }`}
          onClick={() => setOpen(false)}
          onTouchStart={(e) => {
            touchX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const from = touchX.current;
            touchX.current = null;
            if (from === null || zoomed || !many) return;
            const dx = (e.changedTouches[0]?.clientX ?? from) - from;
            if (dx <= -50) go(1);
            if (dx >= 50) go(-1);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={frame.src}
            alt={frame.label}
            onClick={(e) => {
              e.stopPropagation();
              setZoomed((was) => !was);
            }}
            className={
              zoomed
                ? "w-[220%] max-w-none cursor-zoom-out"
                : "max-h-full max-w-full cursor-zoom-in object-contain"
            }
          />
          <div className="fixed top-4 right-4 flex gap-2">
            <a
              href={frame.src}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="label text-ink bg-paper/85 hover:bg-paper rounded-full px-3 py-1.5"
            >
              Full size
            </a>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              className="label text-ink bg-paper/85 hover:bg-paper rounded-full px-3 py-1.5"
            >
              Close
            </button>
          </div>

          {many ? (
            /* Side to side. The two buttons name what is either side, so
               "After →" is on the before shot and "← Before" on the after,
               and the label between them says which one is up. */
            <div className="fixed right-4 bottom-4 left-4 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={at === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                className="label text-ink bg-paper/85 hover:bg-paper min-h-11 rounded-full px-4 disabled:invisible"
              >
                ← {frames[at - 1]?.label}
              </button>
              <span className="label text-ink/70 text-center">
                {frame.label}
              </span>
              <button
                type="button"
                disabled={at === frames.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                className="label text-ink bg-paper/85 hover:bg-paper min-h-11 rounded-full px-4 disabled:invisible"
              >
                {frames[at + 1]?.label} →
              </button>
            </div>
          ) : (
            /* Says the tap is there. Nothing else on the layer suggests the
                picture itself does anything. */
            <p className="label text-ink/70 fixed bottom-4 left-1/2 -translate-x-1/2">
              {zoomed ? "Tap the photo to fit" : "Tap the photo to zoom"}
            </p>
          )}
        </div>
      ) : null}
    </>
  );
}
