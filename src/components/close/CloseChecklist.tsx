"use client";

import { useEffect, useRef, useState } from "react";

import type { CloseItem, ProofKind } from "@/lib/close-checklist";

type Capture = { url: string; kind: "photo" | "video" };

/** One capture slot: item number and which of that item's shots. */
const slotKey = (item: number, shot: number) => `${item}:${shot}`;



/**
 * A close checklist, for review. Nothing is saved yet.
 *
 * Two rules shape the whole thing. Evidence is the check: an item that owes a
 * photo or a video cannot be hand-ticked, and capturing the proof is what
 * completes it. And the initials on every tick are what make a shared iPad
 * legible afterwards — four people work a close, and "who did the restrooms"
 * has to have an answer.
 */
export function CloseChecklist({ items }: { items: CloseItem[] }) {
  const CLOSE_CHECKLIST = items;
  const CLOSE_TOTAL = items.length;
  const shotsOfKind = (kind: ProofKind) =>
    items.flatMap((item) => item.proof ?? []).filter((s) => s.kind === kind)
      .length;
  const PHOTO_SHOTS = shotsOfKind("photo");
  const VIDEO_SHOTS = shotsOfKind("video");
  const NOTE_SHOTS = shotsOfKind("note");

  const [done, setDone] = useState<Record<number, boolean>>({});
  const [captures, setCaptures] = useState<Record<string, Capture>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rowInitials, setRowInitials] = useState<Record<number, string>>({});
  const [initialsWanted, setInitialsWanted] = useState<number | null>(null);
  /** Tapped, and waiting on its initials before it does anything. */
  const [pending, setPending] = useState<number | null>(null);
  const [certifier, setCertifier] = useState("");
  const [signed, setSigned] = useState(false);
  const [certified, setCertified] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<string | null>(null);
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);

  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const notesRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const initialsRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const objectUrls = useRef<string[]>([]);
  const byPointer = useRef(false);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  /** A shot is met by a capture, or — for a note — by words in the box. */
  const shotFilled = (item: number, index: number, kind: ProofKind) =>
    kind === "note"
      ? Boolean(notes[slotKey(item, index)]?.trim())
      : Boolean(captures[slotKey(item, index)]);

  /** An item owing proof is complete only when every one of its shots is in. */
  const shotsTaken = (item: CloseItem) =>
    (item.proof ?? []).filter((shot, index) =>
      shotFilled(item.number, index, shot.kind),
    ).length;
  const doneCount = CLOSE_CHECKLIST.filter((item) => done[item.number]).length;
  const openItems = CLOSE_CHECKLIST.filter((item) => !done[item.number]);
  const untouched = doneCount === 0;

  /**
   * Never prefilled. Ten items initialled ten times is the point — a single
   * value applied to the whole night records who opened the app, not who did
   * the work, and the second is the only one worth keeping.
   */
  const initialsFor = (number: number) => rowInitials[number] ?? "";

  /** Nothing happens on a row until it is signed for. */
  function haveInitials(number: number) {
    if (initialsFor(number).trim()) return true;
    setInitialsWanted(number);
    setPending(number);
    initialsRefs.current[number]?.focus();
    return false;
  }

  function toggle(item: CloseItem) {
    if (locked) return;
    if (done[item.number]) {
      setDone((c) => ({ ...c, [item.number]: false }));
      if (item.proof) {
        setCaptures((c) => {
          const next = { ...c };
          item.proof!.forEach((_, index) => delete next[slotKey(item.number, index)]);
          return next;
        });
        setNotes((c) => {
          const next = { ...c };
          item.proof!.forEach((_, index) => delete next[slotKey(item.number, index)]);
          return next;
        });
      }
      return;
    }

    if (!haveInitials(item.number)) return;

    // Evidence is the check. Tapping the card jumps to the first shot still
    // outstanding rather than ticking anything.
    if (item.proof) {
      const at = Math.max(
        0,
        item.proof.findIndex(
          (shot, index) => !shotFilled(item.number, index, shot.kind),
        ),
      );
      const key = slotKey(item.number, at);
      if (item.proof[at].kind === "note") notesRefs.current[key]?.focus();
      else inputs.current[key]?.click();
      return;
    }

    setDone((c) => ({ ...c, [item.number]: true }));
  }

  function onCapture(item: CloseItem, shotIndex: number, file: File | undefined) {
    if (locked || !file || !item.proof) return;
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    const kind = item.proof[shotIndex].kind;
    if (kind === "note") return;

    setCaptures((current) => {
      const next = { ...current, [slotKey(item.number, shotIndex)]: { url, kind } };
      const all = item.proof!.every((shot, index) =>
        shot.kind === "note"
          ? Boolean(notes[slotKey(item.number, index)]?.trim())
          : Boolean(next[slotKey(item.number, index)]),
      );
      if (all) {
        setDone((c) => ({ ...c, [item.number]: true }));
      }
      return next;
    });
  }

  function certify() {
    if (locked) return;
    const missing: string[] = [];
    if (!certifier.trim()) missing.push("your name");
    if (!signed) missing.push("your signature");
    if (missing.length > 0) {
      setShortfall(`Still needed: ${missing.join(" and ")}.`);
      return;
    }
    // The one gate. Signing with items open is the design; signing a night
    // nobody touched is almost certainly a mistake.
    if (untouched && !confirmingEmpty) {
      setShortfall(null);
      setConfirmingEmpty(true);
      return;
    }
    setShortfall(null);
    setConfirmingEmpty(false);
    setCertified(
      doneCount === CLOSE_TOTAL
        ? "Certified · all ten"
        : `Certified · ${doneCount} of ${CLOSE_TOTAL}, ${CLOSE_TOTAL - doneCount} left open`,
    );
  }

  const who = certifier.trim() ? `I, ${certifier.trim()},` : "I";
  /** Signed is finished. Nothing about the night moves after it is certified. */
  const locked = certified !== null;

  return (
    <div className="space-y-3">
      {/* Compact and pinned: it is on screen the whole way down, and the
          bottom of a phone belongs to the back/out bar. */}
      {locked ? (
        <section className="panel border-ink bg-ink text-paper px-4 py-3">
          <p className="text-title tracking-[0.08em]">{certified}</p>
          <p className="text-label mt-1 tracking-[0.08em] opacity-70">
            Closed out and locked. Nothing on this night can change now.
          </p>
        </section>
      ) : null}

      <section className="border-card-border bg-paper sticky top-0 z-30 -mx-4 mb-1 border-b px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-title tabular-nums tracking-[0.08em]">
            {doneCount}/{CLOSE_TOTAL} done
          </p>
          <p className="label">
            {[
              PHOTO_SHOTS ? `${PHOTO_SHOTS} photos` : null,
              VIDEO_SHOTS ? `${VIDEO_SHOTS} video` : null,
              NOTE_SHOTS ? `${NOTE_SHOTS} written` : null,
              "nothing is timed",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="mt-2.5 flex gap-[3px]" aria-hidden>
          {CLOSE_CHECKLIST.map((item, index) => (
            <span
              key={item.number}
              className={`h-1.5 flex-1 rounded-[1px] ${
                index < doneCount ? "bg-ink" : "bg-inset"
              }`}
            />
          ))}
        </div>

      </section>

      <ul className="space-y-3">
        {CLOSE_CHECKLIST.map((item) => {
          const isDone = Boolean(done[item.number]);
          const shots = item.proof ?? [];
          const taken = shotsTaken(item);

          const mine = initialsFor(item.number);
          const wanted = initialsWanted === item.number && !mine.trim();

          return (
            <li key={item.number} className="panel p-0">
              <div className="flex items-start">
              <button
                type="button"
                onPointerDown={() => {
                  byPointer.current = true;
                }}
                onClick={(event) => {
                  toggle(item);
                  // Keyboard focus keeps its ring; a tap does not leave one
                  // behind on the card it just acted on.
                  if (byPointer.current) event.currentTarget.blur();
                  byPointer.current = false;
                }}
                aria-pressed={isDone}
                className="flex w-full items-start gap-3.5 p-4 text-left"
              >
                <span
                  aria-hidden
                  className={`mt-px grid size-7 shrink-0 place-items-center rounded border ${
                    isDone ? "bg-ink border-ink" : "border-muted"
                  }`}
                >
                  {isDone ? (
                    <span className="text-paper text-sm leading-none">✓</span>
                  ) : null}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <span className="label shrink-0 tabular-nums">
                      {item.number}
                    </span>
                    {/* Title stays white when checked — the card records what
                        was done, and a greyed title reads as cancelled. */}
                    <span className="text-title leading-tight tracking-[0.08em] break-words">
                      {item.title}
                    </span>
                    {/* Says how many, because three separate photographs is a
                        different job from one and a MOD scanning the list
                        should see that before opening the card. */}
                    {shots.length > 0 ? (
                      <span className="text-muted ring-muted/60 inline-flex h-[22px] shrink-0 items-center rounded px-2 text-label tracking-[0.08em] ring-1 ring-inset">
                        {shots.length > 1
                          ? `${taken}/${shots.length} ${shots[0].kind === "video" ? "videos" : "photos"}`
                          : shots[0].kind === "video"
                            ? "Video"
                            : shots[0].kind === "note"
                              ? "Written"
                              : "Photo"}
                      </span>
                    ) : null}
                  </span>

                  {/* Caps throughout — house style, no exceptions. Bulleted
                      when there is more than one line. */}
                  {item.detail.length === 1 ? (
                    <span
                      className={`text-[14px] leading-relaxed ${
                        isDone ? "text-ink/40" : "text-ink/65"
                      }`}
                    >
                      {item.detail[0]}
                    </span>
                  ) : (
                    <span
                      className={`flex flex-col gap-1 text-[13px] leading-snug ${
                        isDone ? "text-ink/40" : "text-ink/65"
                      }`}
                    >
                      {item.detail.map((line) => (
                        <span
                          key={line}
                          className="relative break-words pl-3.5 before:absolute before:top-[0.62em] before:left-0 before:h-px before:w-1.5 before:bg-current"
                        >
                          {line}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </button>

              {/* At the end of the line it belongs to. Not inside the button —
                  an input cannot live in one — so it sits beside it, aligned
                  to the title. */}
              {/* The whole cell lights up until it is filled, rather than a
                  stripe on the box — the thing being asked for is the area,
                  and a border on a dark field is easy to miss. Fixed width so
                  the boxes stay in a column whether or not the prompt shows,
                  and centred so the prompt sits under the box instead of
                  hanging off its edge. */}
              <span
                className={`m-2 flex w-[5.5rem] shrink-0 flex-col items-center gap-2 rounded-lg py-2 ${
                  wanted ? "bg-warn/15 ring-warn/50 ring-1" : ""
                }`}
              >
                <input
                  ref={(node) => {
                    initialsRefs.current[item.number] = node;
                  }}
                  className="field h-11 min-h-0 w-16 px-1.5 text-center tracking-[0.1em]"
                  placeholder="––"
                  maxLength={4}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={mine}
                  disabled={isDone || locked}
                  aria-label={`Initials for ${item.title}`}
                  onChange={(event) => {
                    setRowInitials((c) => ({
                      ...c,
                      [item.number]: event.target.value,
                    }));
                    if (event.target.value.trim()) setInitialsWanted(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                  }}
                  onBlur={() => {
                    // Tapped first, initialled second — finish what the tap
                    // started rather than making them tap the card again.
                    if (pending === item.number && initialsFor(item.number).trim()) {
                      setPending(null);
                      toggle(item);
                    }
                  }}
                />
                {wanted ? (
                  <span className="label text-warn text-center">Initial it</span>
                ) : null}
              </span>
              </div>

              {/* One control per shot. Two things that both need proving are
                  rarely in the same place, so each names what it has to show
                  and is taken on its own. */}
              {shots.length > 0 ? (
                <div className="border-divider space-y-3.5 border-t px-4 py-5 sm:pl-[3.6rem]">
                  {shots.map((shot, index) => {
                    const key = slotKey(item.number, index);
                    const got = captures[key];
                    return (
                      <div key={key} className="flex flex-wrap items-start gap-x-3 gap-y-2">
                        <input
                          ref={(node) => {
                            inputs.current[key] = node;
                          }}
                          type="file"
                          accept={shot.kind === "video" ? "video/*" : "image/*"}
                          capture="environment"
                          className="sr-only"
                          onChange={(event) =>
                            onCapture(item, index, event.target.files?.[0])
                          }
                        />

                        {locked && !got && shot.kind !== "note" ? (
                          <p className="label text-muted">Not captured</p>
                        ) : shot.kind === "note" ? (
                          <div className="w-full">
                            <textarea
                              ref={(node) => {
                                notesRefs.current[key] = node;
                              }}
                              rows={3}
                              className="field w-full resize-none"
                              disabled={locked}
                              placeholder="What was said"
                              value={notes[key] ?? ""}
                              onChange={(event) => {
                                const text = event.target.value;
                                setNotes((c) => ({ ...c, [key]: text }));
                                // Written words are the capture. Completing the
                                // last shot completes the item, same as a photo.
                                const all = shots.every((other, otherIndex) =>
                                  otherIndex === index
                                    ? Boolean(text.trim())
                                    : shotFilled(item.number, otherIndex, other.kind),
                                );
                                if (all && initialsFor(item.number).trim()) {
                                  setDone((c) => ({ ...c, [item.number]: true }));
                                } else if (!all) {
                                  setDone((c) => ({ ...c, [item.number]: false }));
                                }
                              }}
                              aria-label={shot.prompt}
                            />
                          </div>
                        ) : got ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="pill pill-done">
                              {shot.kind === "video" ? "Recorded" : "Taken"}
                            </span>
                            {locked ? null : (
                              <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => {
                                  if (!haveInitials(item.number)) return;
                                  inputs.current[key]?.click();
                                }}
                              >
                                Retake
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (!haveInitials(item.number)) return;
                              inputs.current[key]?.click();
                            }}
                            className="bg-warn text-on-warn inline-flex min-h-11 items-center gap-2.5 rounded px-4 text-body tracking-[0.08em]"
                          >
                            <CaptureGlyph kind={shot.kind} />
                            {shot.kind === "video" ? "Record" : "Photograph"}
                          </button>
                        )}

                        {/* Beside the control, not under it. The spec is the
                            mechanism, so it keeps its width; putting it on the
                            same line as the button is what stops three shots
                            from costing half a screen. */}
                        <p className="text-ink/50 min-w-0 flex-1 self-center text-[12px] leading-snug">
                          {shot.prompt}
                        </p>

                        {got && shot.kind !== "note" ? (
                          <div className="w-full">
                          {got.kind === "video" ? (
                            <video
                              src={got.url}
                              controls
                              playsInline
                              className="bg-inset max-h-72 w-full rounded-lg"
                            />
                          ) : (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={got.url}
                              alt=""
                              className="bg-inset max-h-72 w-full rounded-lg object-contain"
                            />
                          )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

            </li>
          );
        })}
      </ul>

      <section className="panel mt-5">
        <p className={openItems.length > 0 ? "label text-warn" : "label"}>
          {openItems.length > 0
            ? `Still open · ${openItems.length}`
            : `All ${CLOSE_TOTAL} complete`}
        </p>

        <div className="border-ink mt-2.5 border-l-2 pl-4">
          <p className="attest">
            {doneCount === CLOSE_TOTAL
              ? `${who} have completed every item on tonight's close. The venue is secured and ready for the opening team. I hold myself accountable for this team's work tonight.`
              : `${who} have completed ${doneCount} of the ${CLOSE_TOTAL} items on tonight's close, and I am signing with the following still open. I hold myself accountable for this team's work tonight, including what I am leaving open.`}
          </p>
          {openItems.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {openItems.map((item) => (
                /* Hanging indent: a wrapped title lines up under the title,
                   not under the number. */
                <li
                  key={item.number}
                  className="text-warn text-label leading-snug tracking-[0.08em] break-words pl-7 -indent-7"
                >
                  {item.number} · {item.title}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <label className="label" htmlFor="certifier">
              MOD certifying (required)
            </label>
            <input
              id="certifier"
              className="field"
              placeholder="Your name"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={certifier}
              disabled={locked}
              onChange={(event) => setCertifier(event.target.value)}
            />
          </div>

          <SignaturePad
            signed={signed}
            onSignedChange={setSigned}
            locked={locked}
          />

          {shortfall ? (
            <p role="alert" className="text-body text-warn">
              {shortfall}
            </p>
          ) : null}

          {confirmingEmpty ? (
            <div className="border-warn/40 rounded-[8px] border p-4">
              <p className="note text-warn">
                Nothing was checked tonight. Sign anyway?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm" onClick={certify}>
                  Yes, sign it
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setConfirmingEmpty(false)}
                >
                  Go back
                </button>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="btn w-full"
            onClick={certify}
            disabled={locked}
          >
            {certified ??
              (doneCount === CLOSE_TOTAL
                ? "Certify this close"
                : `Certify with ${CLOSE_TOTAL - doneCount} open`)}
          </button>
        </div>
      </section>
    </div>
  );
}

function CaptureGlyph({ kind }: { kind: "photo" | "video" }) {
  return (
    <span
      aria-hidden
      className="relative h-[13px] w-4 shrink-0 rounded-[2px] border border-current"
    >
      <span
        className={`absolute inset-[3px] border border-current ${
          kind === "video" ? "rounded-full bg-current" : "rounded-full"
        }`}
      />
    </span>
  );
}

/** Drawn with a finger, kept with the night. */
function SignaturePad({
  signed,
  onSignedChange,
  locked,
}: {
  signed: boolean;
  onSignedChange: (value: boolean) => void;
  locked: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<{ x: number; y: number }[][]>([]);
  const drawing = useRef(false);

  function paint() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(rect.width * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--ink")
      .trim();
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokes.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (const point of stroke.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  }

  useEffect(() => {
    paint();
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  });

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label">Signature (required)</p>
        {locked ? null : (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              strokes.current = [];
              onSignedChange(false);
              paint();
            }}
          >
            Clear
          </button>
        )}
      </div>
      <div className="bg-panel border-card-border relative touch-none overflow-hidden rounded-lg border">
        <canvas
          ref={canvasRef}
          className="block h-40 w-full"
          onPointerDown={(event) => {
            if (locked) return;
            drawing.current = true;
            onSignedChange(true);
            strokes.current.push([pointFrom(event)]);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drawing.current) return;
            strokes.current[strokes.current.length - 1]?.push(pointFrom(event));
            paint();
          }}
          onPointerUp={() => {
            drawing.current = false;
          }}
          onPointerCancel={() => {
            drawing.current = false;
          }}
        />
        {!signed ? (
          <div className="label pointer-events-none absolute inset-0 grid place-items-center">
            Sign here with your finger
          </div>
        ) : null}
      </div>
      <p className="label">
        Kept with the night&apos;s record, alongside what was open when you
        signed.
      </p>
    </div>
  );
}
