import Link from "next/link";
import type { ReviewState, WeekStatus } from "@/lib/types";

export function StatusPill({ status }: { status: WeekStatus }) {
  const className =
    status === "PASS"
      ? "pill pill-done"
      : status === "FAIL"
        ? "pill pill-fail"
        : "pill pill-pending";
  return <span className={className}>{status}</span>;
}

export function DonePill({ done }: { done: boolean }) {
  return (
    <span className={done ? "pill pill-done" : "pill pill-pending"}>
      {done ? "Done" : "Pending"}
    </span>
  );
}

/**
 * Completion as a dot matrix rather than a number — reads at a glance across a
 * long list of venues, and matches the rest of the type.
 */
export function DotStrip({ done, total }: { done: number; total: number }) {
  if (total === 0) {
    return <span className="label">no items</span>;
  }
  return (
    <span className="flex items-center gap-[3px]" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-[7px] w-[7px] rounded-full ${
            i < done ? "bg-ink" : "bg-line"
          }`}
        />
      ))}
    </span>
  );
}

/**
 * Tap a code to jump straight to that venue's row. The list is sorted by
 * status, so a venue moves around week to week — this strip stays alphabetical
 * so people can always find their own without scanning.
 */
export function VenueJumpBar({
  venues,
  ownVenueId,
}: {
  venues: { id: string; code: string }[];
  ownVenueId?: string | null;
}) {
  const sorted = [...venues].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <nav
      aria-label="Jump to venue"
      className="-mx-4 mb-5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max gap-[6px]">
        {sorted.map((venue) => (
          <li key={venue.id}>
            <a
              href={`#venue-${venue.code}`}
              className={`flex h-8 items-center rounded-full px-3 font-mono text-[11px] tracking-wider ${
                venue.id === ownVenueId
                  ? "bg-ink text-paper"
                  : "bg-surface text-muted"
              }`}
            >
              {venue.code}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Stands in wherever a photo is missing. A labelled dot field reads as a slot
 * still waiting to be filled, rather than as a broken or empty card.
 */
export function PhotoPlaceholder({
  aspect = "square",
  label = "Photo needed",
}: {
  aspect?: "square" | "wide";
  label?: string;
}) {
  return (
    <div
      className={`dotfield relative flex items-center justify-center overflow-hidden rounded-xl ${
        aspect === "square" ? "aspect-square" : "aspect-[4/3]"
      }`}
    >
      <span className="label text-ink bg-paper max-w-[88%] truncate rounded-full px-2.5 py-1 whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

/**
 * A photo that has aged out of storage. The record of the work survives — this
 * only means the image file was cleared.
 */
export function PurgedPhoto({ aspect = "square" }: { aspect?: "square" | "wide" }) {
  return <PhotoPlaceholder aspect={aspect} label="Cleared" />;
}

export function ReviewPill({ review }: { review: ReviewState }) {
  if (review === "approved") {
    return <span className="pill pill-done">Approved</span>;
  }
  if (review === "sent_back") {
    return <span className="pill pill-fail">Sent back</span>;
  }
  return <span className="pill pill-pending">Needs review</span>;
}

/**
 * An unconfigured slot. Every venue owes ten items a week, so the grid always
 * shows ten tiles — a venue with only four set up reads as six slots missing
 * rather than as a short, complete-looking board.
 */
export function EmptySlot({ index }: { index: number }) {
  return (
    <li className="panel flex flex-col p-3 opacity-60">
      <PhotoPlaceholder label="Not set up" />
      <p className="label mt-3">Slot {index}</p>
      <p className="note mt-1 text-muted">Awaiting setup</p>
    </li>
  );
}

/** Pads a grid out to the weekly target. */
export function emptySlots(count: number, target: number): number[] {
  return Array.from({ length: Math.max(0, target - count) }, (_, i) => count + i + 1);
}

/** Byline for a submission: who wrote it, and who helped. */
export function Attribution({
  author,
  assistedBy,
}: {
  author: string;
  assistedBy: string | null;
}) {
  return (
    <p className="label mt-2">
      By {author || "—"}
      {assistedBy ? ` · assisted by ${assistedBy}` : ""}
    </p>
  );
}

export function PageHeader({
  eyebrow,
  title,
  meta,
  action,
}: {
  eyebrow: string;
  title: string;
  meta?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="label">{eyebrow}</p>
        <h1 className="mt-2 truncate text-2xl font-medium tracking-tight">
          {title}
        </h1>
        {meta ? <p className="label mt-2">{meta}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="label hover:text-ink">
      ← {children}
    </Link>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="panel-quiet text-center">
      <p className="note text-muted">{children}</p>
    </div>
  );
}
