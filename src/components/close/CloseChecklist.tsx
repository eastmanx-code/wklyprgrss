"use client";

import { useEffect, useRef, useState } from "react";

import {
  CLOSE_CHECKLIST,
  CLOSE_TOTAL,
  type CloseItem,
} from "@/lib/close-checklist";

type Capture = { url: string; kind: "photo" | "video" };

/**
 * A close checklist, for review.
 *
 * Nothing here is saved. This is on the real site so it can be handed to a GM
 * on a real phone, which is the only way to find out whether the flow survives
 * 2am — but the night it records goes no further than the browser tab.
 *
 * The rule that matters: an item that owes proof cannot be ticked. Tapping it
 * opens the camera, and it is the capture that marks it done. A checkbox you
 * can tick without doing the thing is the whole reason the old system's
 * numbers stopped meaning anything.
 */
export function CloseChecklist() {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [captures, setCaptures] = useState<Record<number, Capture>>({});
  const [certifier, setCertifier] = useState("");
  const [signed, setSigned] = useState(false);
  const [certified, setCertified] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<string | null>(null);

  const inputs = useRef<Record<number, HTMLInputElement | null>>({});
  const objectUrls = useRef<string[]>([]);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const doneCount = CLOSE_CHECKLIST.filter((item) => done[item.number]).length;
  const open = CLOSE_CHECKLIST.filter((item) => !done[item.number]);

  function toggle(item: CloseItem) {
    if (item.proof) {
      // Ticked already: tapping again clears it, so a wrong shot can be redone.
      if (done[item.number]) {
        setDone((current) => ({ ...current, [item.number]: false }));
        setCaptures((current) => {
          const next = { ...current };
          delete next[item.number];
          return next;
        });
        return;
      }
      // Not ticked: there is no way to tick it but to capture something.
      inputs.current[item.number]?.click();
      return;
    }
    setDone((current) => ({ ...current, [item.number]: !current[item.number] }));
  }

  function onCapture(item: CloseItem, file: File | undefined) {
    if (!file || !item.proof) return;
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    setCaptures((current) => ({
      ...current,
      [item.number]: { url, kind: item.proof!.kind },
    }));
    setDone((current) => ({ ...current, [item.number]: true }));
  }

  function certify() {
    const missing: string[] = [];
    if (!certifier.trim()) missing.push("your name");
    if (!signed) missing.push("your signature");
    if (missing.length > 0) {
      setShortfall(`Still needed: ${missing.join(" and ")}.`);
      return;
    }
    setShortfall(null);
    setCertified(
      doneCount === CLOSE_TOTAL
        ? "Certified · all ten"
        : `Certified · ${doneCount} of ${CLOSE_TOTAL}, ${CLOSE_TOTAL - doneCount} left open`,
    );
  }

  const who = certifier.trim() ? `I, ${certifier.trim()},` : "I";

  return (
    /* Phone first: one column, and on a tablet the signing panel moves
       alongside instead of sitting under a screen's worth of scrolling.
       Two columns are never used for the items themselves — a close is done
       in order, and order is the one thing columns destroy. */
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-6">
      <div className="space-y-2.5">
        {/* Sticky at the top rather than the bottom: the bottom of a phone
            already belongs to the corner menu. Compact, because it is on
            screen the whole way down. */}
        <section className="panel bg-surface/95 sticky top-2 z-30 px-4 py-3 backdrop-blur-md">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-title tabular-nums tracking-[0.08em]">
              {doneCount}/{CLOSE_TOTAL} done
            </p>
            <p className="label">3 photos · 1 video · nothing is timed</p>
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

        <ul className="space-y-2.5">
        {CLOSE_CHECKLIST.map((item) => {
          const isDone = Boolean(done[item.number]);
          const capture = captures[item.number];

          return (
            <li key={item.number} className="panel p-0">
              {item.proof ? (
                <input
                  ref={(node) => {
                    inputs.current[item.number] = node;
                  }}
                  type="file"
                  accept={item.proof.kind === "video" ? "video/*" : "image/*"}
                  capture="environment"
                  className="sr-only"
                  onChange={(event) =>
                    onCapture(item, event.target.files?.[0])
                  }
                />
              ) : null}

              <button
                type="button"
                onClick={() => toggle(item)}
                aria-pressed={isDone}
                className="flex w-full items-start gap-3.5 p-4 text-left"
              >
                <span
                  aria-hidden
                  className={`mt-px grid size-6 shrink-0 place-items-center rounded border ${
                    isDone ? "bg-ink border-ink" : "border-muted"
                  }`}
                >
                  {isDone ? (
                    <span className="text-paper text-[13px] leading-none">
                      ✓
                    </span>
                  ) : null}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-baseline gap-2.5">
                    <span className="label shrink-0 tabular-nums">
                      {item.number}
                    </span>
                    <span
                      className={`text-title leading-tight tracking-[0.08em] break-words ${
                        isDone ? "text-muted" : ""
                      }`}
                    >
                      {item.title}
                    </span>
                  </span>

                  {/* The standard folds away once met. Ten items with their
                      detail open is about eleven feet of phone; collapsing
                      what's done means the list shortens as the night does,
                      and what's left is what you can still see. */}
                  {isDone ? null : (
                    <span className="text-muted flex flex-col gap-1 text-body leading-snug">
                      {item.detail.map((line) => (
                        <span key={line} className="break-words">
                          {line}
                        </span>
                      ))}
                    </span>
                  )}

                  {item.proof ? (
                    <span
                      className={`mt-0.5 flex items-start gap-2 rounded-md px-2.5 py-2 text-label leading-snug tracking-[0.08em] ${
                        isDone
                          ? "bg-ink text-paper"
                          : "bg-warn text-on-warn"
                      }`}
                    >
                      <span className="break-words">
                        {isDone
                          ? `${item.proof.kind === "video" ? "Video" : "Photo"} taken · ${item.proof.prompt}`
                          : `Tap to ${item.proof.kind === "video" ? "record" : "photograph"} · ${item.proof.prompt}`}
                      </span>
                    </span>
                  ) : null}

                  {capture ? (
                    /* Capped: what this is for is checking you shot the right
                       thing, and a tall portrait capture at full width would
                       push the next item off the screen. */
                    capture.kind === "video" ? (
                      <video
                        src={capture.url}
                        controls
                        playsInline
                        className="bg-inset mt-1 max-h-72 w-full rounded-lg"
                      />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={capture.url}
                        alt=""
                        className="bg-inset mt-1 max-h-72 w-full rounded-lg object-contain"
                      />
                    )
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
        </ul>
      </div>

      <section className="panel mt-2.5 lg:sticky lg:top-2 lg:mt-0">
        <p className="label">What you are signing</p>
        <div className="border-ink mt-2.5 border-l-2 pl-4">
          <p className="attest">
            {doneCount === CLOSE_TOTAL
              ? `${who} have completed every item on tonight's close. The venue is secured and ready for the opening team. I hold myself accountable for this team's work tonight.`
              : `${who} have completed ${doneCount} of the ${CLOSE_TOTAL} items on tonight's close, and I am signing with the following still open. I hold myself accountable for this team's work tonight, including what I am leaving open.`}
          </p>
          {open.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {open.map((item) => (
                <li key={item.number} className="label text-warn break-words">
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

          <button type="button" className="btn w-full" onClick={certify}>
            {certified ?? "Certify this close"}
          </button>
        </div>
      </section>
    </div>
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function repaint() {
      const node = canvasRef.current;
      if (!node) return;
      const ctx = node.getContext("2d");
      if (!ctx) return;
      const rect = node.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      node.width = Math.round(rect.width * dpr);
      node.height = Math.round(rect.height * dpr);
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

    repaint();
    window.addEventListener("resize", repaint);
    return () => window.removeEventListener("resize", repaint);
  }, [signed]);

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function draw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
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
            draw();
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
            strokes.current[strokes.current.length - 1]?.push(
              pointFrom(event),
            );
            draw();
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
