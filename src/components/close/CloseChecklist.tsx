"use client";

import { useEffect, useRef, useState } from "react";

import {
  CLOSE_CHECKLIST,
  CLOSE_TOTAL,
  type CloseItem,
} from "@/lib/close-checklist";

type Capture = { url: string; kind: "photo" | "video" };

/** One capture slot: item number and which of that item's shots. */
const slotKey = (item: number, shot: number) => `${item}:${shot}`;

const ALL_SHOTS = CLOSE_CHECKLIST.flatMap((item) => item.proof ?? []);
const PHOTO_SHOTS = ALL_SHOTS.filter((shot) => shot.kind === "photo").length;
const VIDEO_SHOTS = ALL_SHOTS.filter((shot) => shot.kind === "video").length;

/**
 * A close checklist, for review. Nothing is saved yet.
 *
 * Two rules shape the whole thing. Evidence is the check: an item that owes a
 * photo or a video cannot be hand-ticked, and capturing the proof is what
 * completes it. And the initials on every tick are what make a shared iPad
 * legible afterwards — four people work a close, and "who did the restrooms"
 * has to have an answer.
 */
export function CloseChecklist() {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [byWhom, setByWhom] = useState<Record<number, string>>({});
  const [captures, setCaptures] = useState<Record<string, Capture>>({});
  const [initials, setInitials] = useState("");
  const [initialsWanted, setInitialsWanted] = useState(false);
  const [certifier, setCertifier] = useState("");
  const [signed, setSigned] = useState(false);
  const [certified, setCertified] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<string | null>(null);
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);

  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const initialsRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);
  const byPointer = useRef(false);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  /** An item owing proof is complete only when every one of its shots is in. */
  const shotsTaken = (item: CloseItem) =>
    (item.proof ?? []).filter((_, index) => captures[slotKey(item.number, index)])
      .length;
  const doneCount = CLOSE_CHECKLIST.filter((item) => done[item.number]).length;
  const openItems = CLOSE_CHECKLIST.filter((item) => !done[item.number]);
  const untouched = doneCount === 0;

  /** Nothing gets ticked anonymously. */
  function haveInitials() {
    if (initials.trim()) return true;
    setInitialsWanted(true);
    initialsRef.current?.focus();
    initialsRef.current?.scrollIntoView({ block: "center" });
    return false;
  }

  function toggle(item: CloseItem) {
    if (done[item.number]) {
      setDone((c) => ({ ...c, [item.number]: false }));
      setByWhom((c) => {
        const next = { ...c };
        delete next[item.number];
        return next;
      });
      if (item.proof) {
        setCaptures((c) => {
          const next = { ...c };
          item.proof!.forEach((_, index) => delete next[slotKey(item.number, index)]);
          return next;
        });
      }
      return;
    }

    if (!haveInitials()) return;

    // Evidence is the check. Tapping the card jumps to the first shot still
    // outstanding rather than ticking anything.
    if (item.proof) {
      const next = item.proof.findIndex(
        (_, index) => !captures[slotKey(item.number, index)],
      );
      inputs.current[slotKey(item.number, Math.max(0, next))]?.click();
      return;
    }

    setDone((c) => ({ ...c, [item.number]: true }));
    setByWhom((c) => ({ ...c, [item.number]: initials.trim().toUpperCase() }));
  }

  function onCapture(item: CloseItem, shotIndex: number, file: File | undefined) {
    if (!file || !item.proof) return;
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    const kind = item.proof[shotIndex].kind;

    setCaptures((current) => {
      const next = { ...current, [slotKey(item.number, shotIndex)]: { url, kind } };
      const all = item.proof!.every((_, index) => next[slotKey(item.number, index)]);
      if (all) {
        setDone((c) => ({ ...c, [item.number]: true }));
        setByWhom((c) => ({ ...c, [item.number]: initials.trim().toUpperCase() }));
      }
      return next;
    });
  }

  function certify() {
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

  return (
    <div className="space-y-2.5">
      {/* Compact and pinned: it is on screen the whole way down, and the
          bottom of a phone belongs to the back/out bar. */}
      <section className="panel bg-surface/95 sticky top-2 z-30 px-4 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-title tabular-nums tracking-[0.08em]">
            {doneCount}/{CLOSE_TOTAL} done
          </p>
          <p className="label">
            {PHOTO_SHOTS} photos · {VIDEO_SHOTS} video · nothing is timed
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

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="label shrink-0" htmlFor="initials">
            Ticking as
          </label>
          <input
            id="initials"
            ref={initialsRef}
            className={`field h-10 min-h-0 w-24 px-3 text-center tracking-[0.2em] ${
              initialsWanted && !initials.trim() ? "border-warn" : ""
            }`}
            placeholder="AB"
            maxLength={4}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={initials}
            onChange={(event) => {
              setInitials(event.target.value);
              if (event.target.value.trim()) setInitialsWanted(false);
            }}
            aria-label="Your initials"
          />
          <p className="label min-w-0 flex-1">
            {initialsWanted && !initials.trim()
              ? "Add your initials before ticking anything."
              : "Change these when someone else takes over."}
          </p>
        </div>
      </section>

      <ul className="space-y-2.5">
        {CLOSE_CHECKLIST.map((item) => {
          const isDone = Boolean(done[item.number]);
          const stamp = byWhom[item.number];
          const shots = item.proof ?? [];
          const taken = shotsTaken(item);

          return (
            <li key={item.number} className="panel p-0">

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
                            : "Photo"}
                      </span>
                    ) : null}
                    {stamp ? (
                      <span className="bg-inset text-muted inline-flex h-[22px] shrink-0 items-center rounded px-2 text-label tracking-[0.08em]">
                        {stamp}
                      </span>
                    ) : null}
                  </span>

                  {/* Sentence case, and bulleted when there is more than one.
                      Four lines of caps is slow reading at 1am, and this is
                      the one place the specimen look loses to the job. */}
                  {item.detail.length === 1 ? (
                    <span
                      className={`text-[14px] leading-relaxed normal-case ${
                        isDone ? "text-ink/40" : "text-ink/65"
                      }`}
                    >
                      {item.detail[0]}
                    </span>
                  ) : (
                    <span
                      className={`flex flex-col gap-1 text-[13px] leading-snug normal-case ${
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

              {/* One control per shot. Two things that both need proving are
                  rarely in the same place, so each names what it has to show
                  and is taken on its own. */}
              {shots.length > 0 ? (
                <div className="border-divider space-y-4 border-t px-4 py-4">
                  {shots.map((shot, index) => {
                    const key = slotKey(item.number, index);
                    const got = captures[key];
                    return (
                      <div key={key}>
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

                        {got ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="pill pill-done">
                              {shot.kind === "video" ? "Recorded" : "Taken"}
                            </span>
                            <button
                              type="button"
                              className="btn-ghost"
                              onClick={() => {
                                if (!haveInitials()) return;
                                inputs.current[key]?.click();
                              }}
                            >
                              Retake
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (!haveInitials()) return;
                              inputs.current[key]?.click();
                            }}
                            className="ring-ink/70 text-ink inline-flex min-h-11 items-center gap-2.5 rounded px-4 text-body tracking-[0.08em] ring-1"
                          >
                            <CaptureGlyph kind={shot.kind} />
                            {shot.kind === "video" ? "Record" : "Photograph"}
                          </button>
                        )}

                        {/* The framing spec sits under the control, not inside
                            it — a button label should be one verb. */}
                        <p className="text-ink/50 mt-2 text-[12px] leading-snug normal-case">
                          {shot.prompt}
                        </p>

                        {got ? (
                          got.kind === "video" ? (
                            <video
                              src={got.url}
                              controls
                              playsInline
                              className="bg-inset mt-2 max-h-72 w-full rounded-lg"
                            />
                          ) : (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={got.url}
                              alt=""
                              className="bg-inset mt-2 max-h-72 w-full rounded-lg object-contain"
                            />
                          )
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

      <section className="panel">
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
              onChange={(event) => setCertifier(event.target.value)}
            />
          </div>

          <SignaturePad signed={signed} onSignedChange={setSigned} />

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

          <button type="button" className="btn w-full" onClick={certify}>
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
}: {
  signed: boolean;
  onSignedChange: (value: boolean) => void;
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
      </div>
      <div className="bg-panel border-card-border relative touch-none overflow-hidden rounded-lg border">
        <canvas
          ref={canvasRef}
          className="block h-40 w-full"
          onPointerDown={(event) => {
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
