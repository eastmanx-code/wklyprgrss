/**
 * A photo with a way to see all of it.
 *
 * Fitting the whole frame into a card shrinks it to the point of being
 * useless, and cropping to fill hides the edge someone stood there to
 * photograph. So the card crops, and the corner control opens the full
 * resolution image in its own tab — no lightbox to trap focus, no JavaScript,
 * and it works the same for the leader who took it and the admin reviewing it.
 */
export function PhotoView({
  src,
  alt = "",
  className = "",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  return (
    <span className={`bg-inset relative block overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-full w-full object-cover" />
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="label text-ink bg-paper/85 hover:bg-paper absolute right-2 bottom-2 rounded-full px-2.5 py-1 backdrop-blur-sm"
        title="Open the full photo"
      >
        Full
      </a>
    </span>
  );
}
