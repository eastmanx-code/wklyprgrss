"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { CommitmentActions } from "@/components/walkthroughs/CommitmentActions";
import { PhotoGrid, type GridPhoto } from "@/components/walkthroughs/PhotoGrid";
import { QuestionAnswer } from "@/components/walkthroughs/QuestionAnswer";

/** Short month and day in UTC, e.g. "Nov 11". */
function fmtDate(date: string | null): string {
  if (!date) return "—";
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed)) return date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

type TileStatus =
  | "open"
  | "overdue"
  | "submitted"
  | "signed"
  | "question"
  | "answered"
  | "goal"
  | "covered";

const PILL: Record<TileStatus, { text: string; cls: string }> = {
  signed: { text: "Signed", cls: "pill-done" },
  submitted: { text: "Submitted", cls: "bg-panel text-ink" },
  overdue: { text: "Overdue", cls: "bg-warn text-on-warn" },
  open: { text: "Open", cls: "bg-panel text-muted" },
  question: { text: "Question", cls: "bg-panel text-muted" },
  answered: { text: "Answered", cls: "pill-done" },
  goal: { text: "Goal", cls: "bg-panel text-muted" },
  covered: { text: "Covered", cls: "bg-panel text-muted" },
};

function StatusPill({ status }: { status: TileStatus }) {
  const pill = PILL[status] ?? PILL.open;
  return (
    <span className={`pill shrink-0 ${pill.cls}`} style={{ height: 24 }}>
      {pill.text}
    </span>
  );
}

export type TileData = {
  id: string;
  badge: string;
  commitment: string;
  due: string | null;
  status: TileStatus;
  daysOverdue: number;
  actionable: boolean;
  question: boolean;
  special: boolean;
  signedBy: string | null;
  signedAt: string | null;
  note: string | null;
  repeatCount: number;
  photos: GridPhoto[];
  observed: string | null;
  isAdmin: boolean;
};

/**
 * One commitment, as a uniform gallery tile that opens into a full detail
 * sheet.
 *
 * The tile stays small and even so the board reads as one grid, photo card or
 * to-do alike. But the finding itself does not fit three clamped lines, and a
 * manager has to read the whole thing and then work it, so the whole tile is a
 * button: a tap opens a sheet over the page with the finding in full, the dates,
 * and the controls to add a photo, sign it off, answer it, or reopen it. Nothing
 * on the tile is tappable on its own, which is what keeps the whole surface one
 * clean target.
 */
export function CommitmentTile(props: TileData) {
  const {
    id,
    badge,
    commitment,
    due,
    status,
    daysOverdue,
    actionable,
    question,
    special,
    signedBy,
    signedAt,
    note,
    repeatCount,
    photos,
    observed,
    isAdmin,
  } = props;

  const [open, setOpen] = useState(false);

  const overdue = status === "overdue";
  const signed = status === "signed";
  const answered = status === "answered";
  const hasPhoto = photos.length > 0;
  const repeat = repeatCount > 1;

  const hero = photos[0] ?? null;

  // The square at the top of every tile, so a photo card and a to-do line up.
  const heroBlock = hero ? (
    hero.isDoc ? (
      <div className="bg-inset text-muted ring-card-border flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-[10px] ring-1">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
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
        <span className="text-[11px] leading-none">PDF</span>
      </div>
    ) : (
      <div className="aspect-square w-full overflow-hidden rounded-[10px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hero.url} alt="" className="h-full w-full object-cover" />
      </div>
    )
  ) : (
    <div className="dotfield flex aspect-square w-full items-center justify-center rounded-[10px]">
      <span className="label text-ink bg-paper rounded-full px-3 py-1.5">
        {question
          ? answered
            ? "Answered"
            : "Answer"
          : special
            ? badge
            : "Add a photo"}
      </span>
    </div>
  );

  return (
    <li className="h-full">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex h-full w-full flex-col gap-2 rounded-[10px] p-3 text-left ${
          overdue ? "bg-warn/10 ring-warn/40 ring-1" : "bg-inset"
        }`}
      >
        {heroBlock}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-3 text-[13px] text-ink leading-snug break-words">
              {commitment}
            </p>
            <StatusPill status={status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="label text-[11px]">seen {fmtDate(observed)}</span>
            {status !== "goal" && status !== "covered" ? (
              <span className={`label text-[11px] ${overdue ? "text-warn" : ""}`}>
                due {fmtDate(due)}
                {overdue ? ` · ${daysOverdue}d late` : ""}
              </span>
            ) : null}
            {repeat ? (
              <span className="label text-warn text-[11px]">
                repeat ×{repeatCount}
              </span>
            ) : null}
          </div>
          {signedBy ? (
            <p className="label mt-1 text-[11px]">
              {question ? "Answered " : "Signed "}
              {signedBy}
              {signedAt ? ` · ${fmtDate(signedAt.slice(0, 10))}` : ""}
            </p>
          ) : null}
        </div>

        <span className="label text-muted mt-auto text-[11px]">Tap to open</span>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[100] grid place-items-end bg-black/60 p-0 sm:place-items-center sm:p-4"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-surface ring-card-border max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl p-5 ring-1 sm:rounded-2xl"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="pill bg-panel text-muted">{badge}</span>
                    {repeat ? (
                      <span className="pill bg-warn text-on-warn">
                        repeat ×{repeatCount}
                      </span>
                    ) : null}
                    <StatusPill status={status} />
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                    className="bg-inset text-ink ring-card-border -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-lg leading-none ring-1"
                  >
                    ×
                  </button>
                </div>

                {/* The finding in full, no clamp: this is the whole reason to
                    open the sheet. */}
                <p className="text-[15px] text-ink leading-relaxed break-words whitespace-pre-wrap">
                  {commitment}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="label text-[12px]">seen {fmtDate(observed)}</span>
                  {status !== "goal" && status !== "covered" ? (
                    <span className={`label text-[12px] ${overdue ? "text-warn" : ""}`}>
                      due {fmtDate(due)}
                      {overdue ? ` · ${daysOverdue}d late` : ""}
                    </span>
                  ) : null}
                </div>

                {signedBy ? (
                  <p className="label mt-2 text-[12px]">
                    {question ? "Answered by " : "Signed "}
                    {signedBy}
                    {signedAt ? ` · ${fmtDate(signedAt.slice(0, 10))}` : ""}
                  </p>
                ) : null}

                {/* The controls, the same ones the board used inline before, now
                    in the sheet where there is room to read them. */}
                {question ? (
                  answered ? (
                    note ? (
                      <p className="note mt-3 text-[13px] leading-relaxed text-ink/80">
                        {note}
                      </p>
                    ) : null
                  ) : (
                    <QuestionAnswer id={id} />
                  )
                ) : actionable ? (
                  <CommitmentActions
                    id={id}
                    signed={signed}
                    canReopen={isAdmin}
                    initialPhotos={photos}
                  />
                ) : (
                  <>
                    {hasPhoto ? (
                      <div className="mt-3">
                        <PhotoGrid photos={photos} />
                      </div>
                    ) : null}
                    {note ? (
                      <p className="note mt-3 text-[13px] leading-relaxed text-ink/80">
                        {note}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </li>
  );
}
