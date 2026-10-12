/**
 * Showing a document where a photo would go.
 *
 * A submission can be evidenced by a PDF instead of a photo (the HOH checklist
 * and its kind), and a PDF cannot go in an <img>. These render the two places a
 * photo appears — a thumbnail tile on a board, and an inline link in a history
 * or review — as a document affordance that opens the file in a new tab.
 *
 * Plain anchors, not the lightbox: a PDF opens in the browser's own viewer. The
 * href is a short-lived signed URL minted server-side, the same as a photo's.
 */

function PdfGlyph({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A thumbnail-sized document tile that fills the box a photo thumbnail would.
 * `href` is null when the object has been purged or could not be signed, which
 * shows a static tile rather than a dead link.
 */
export function DocThumb({ href }: { href: string | null }) {
  const className =
    "flex h-full w-full flex-col items-center justify-center gap-1.5 bg-panel text-muted";
  const inner = (
    <>
      <PdfGlyph />
      <span className="label">PDF</span>
    </>
  );
  if (!href) return <div className={className}>{inner}</div>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`${className} hover:text-ink`}
    >
      {inner}
    </a>
  );
}

/** An inline "open the document" link, for a history row or a review screen. */
export function DocLink({ href }: { href: string | null }) {
  if (!href) {
    return <span className="label text-muted">Document filed · no longer stored</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="btn-ghost inline-flex items-center gap-2"
    >
      <PdfGlyph size={18} />
      Open document (PDF)
    </a>
  );
}
