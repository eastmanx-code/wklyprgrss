"use client";

import { useEffect, useState } from "react";

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
 */
export function PhotoView({
  src,
  alt = "",
  className = "",
  hint = true,
}: {
  src: string;
  alt?: string;
  className?: string;
  /** The corner chip. Off on thumbnails, where it covers the picture. */
  hint?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Filling the screen is not magnification on a phone, where the photo was
  // already full width in the card. Zoomed, the image overflows and the layer
  // scrolls, so a reviewer can get in close on the corner they are judging.
  const [zoomed, setZoomed] = useState(false);

  // Escape closes it. A full-screen layer with no keyboard way out is a trap
  // on a laptop, where there is nothing obvious to tap.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setZoomed(false);
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
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
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
              href={src}
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
          {/* Says the tap is there. Nothing else on the layer suggests the
              picture itself does anything. */}
          <p className="label text-ink/70 fixed bottom-4 left-1/2 -translate-x-1/2">
            {zoomed ? "Tap the photo to fit" : "Tap the photo to zoom"}
          </p>
        </div>
      ) : null}
    </>
  );
}
