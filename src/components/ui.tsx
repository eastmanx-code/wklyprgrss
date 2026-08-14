import Link from "next/link";
import type { ReviewState, WeekStatus } from "@/lib/types";

export function StatusPill({ status }: { status: WeekStatus }) {
  const className =
    status === "PASS"
      ? "pill pill-done"
      : status === "FAIL"
        ? "pill pill-warn"
        : status === "SETUP"
          ? "pill pill-rolling"
          : "pill pill-pending";
  return <span className={className}>{status}</span>;
}

/**
 * Whether this week's photo has been taken. Not a review state.
 *
 * It read "Pending", which is the same word the review uses for waiting on an
 * admin. A leader who had filed a full week and been approved came back on
 * Monday, saw every tile say Pending, and read it as her work being stuck in a
 * queue — when it only ever meant the new week hadn't started yet.
 */
export function DonePill({ done }: { done: boolean }) {
  return (
    <span className={done ? "pill pill-done" : "pill pill-pending"}>
      {done ? "Done" : "To do"}
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
export function PurgedPhoto({
  aspect = "square",
}: {
  aspect?: "square" | "wide";
}) {
  return <PhotoPlaceholder aspect={aspect} label="Cleared" />;
}

export function ReviewPill({ review }: { review: ReviewState }) {
  if (review === "approved") {
    return <span className="pill pill-done">Approved</span>;
  }
  if (review === "sent_back") {
    return <span className="pill pill-warn">Sent back</span>;
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
  return Array.from(
    { length: Math.max(0, target - count) },
    (_, i) => count + i + 1,
  );
}

/**
 * People type "na" in a field they have nothing to put in.
 *
 * Printed literally that becomes "ASSISTED BY NA" on the card — a second line
 * of uppercase that says nobody helped, which is what an empty field already
 * said. Treated as blank it just goes away.
 */
const NOBODY = new Set([
  "na",
  "n/a",
  "n\\a",
  "none",
  "no one",
  "noone",
  "nobody",
  "-",
  "--",
  "—",
  ".",
  "0",
]);

/** Byline for a submission: who wrote it, and who helped. */
export function Attribution({
  author,
  assistedBy,
}: {
  author: string;
  assistedBy: string | null;
}) {
  const helper = (assistedBy ?? "").trim();
  const helped = helper && !NOBODY.has(helper.toLowerCase());
  return (
    <p className="label mt-2">
      By {author || "—"}
      {helped ? ` · assisted by ${helper}` : ""}
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
        <h1 className="mt-2 truncate text-metric font-medium">{title}</h1>
        {meta ? <p className="label mt-2">{meta}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
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
