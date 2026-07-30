"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { submitItem, type SubmitState } from "@/app/venue/actions";

const MAX_EDGE = 1600;
const TARGET_BYTES = 300 * 1024;
const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52, 0.42];

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality),
  );
}

/**
 * Re-encode to JPEG at max 1600px on the long edge, stepping quality down until
 * the file is around 300KB. Going through a canvas is also what converts an
 * iPhone HEIC capture into something every browser can render.
 */
async function compressToJpeg(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob: Blob | null = null;
  for (const quality of QUALITY_STEPS) {
    blob = await toBlob(canvas, quality);
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  if (!blob) throw new Error("Could not encode that image");

  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

function formatKb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

const initialState: SubmitState = { error: null };

export function PhotoSubmitForm({ itemId }: { itemId: string }) {
  const [state, formAction, pending] = useActionState(submitItem, initialState);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [processing, setProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  async function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const original = event.target.files?.[0];
    if (!original) return;

    setProcessing(true);
    setLocalError(null);
    try {
      const compressed = await compressToJpeg(original);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      const url = URL.createObjectURL(compressed);
      previewRef.current = url;
      setPhoto(compressed);
      setPreview(url);
    } catch {
      setLocalError("Couldn't read that photo. Try taking it again.");
      setPhoto(null);
      setPreview(null);
    } finally {
      setProcessing(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo || !comment.trim()) return;

    // Build the payload by hand so we upload the compressed JPEG, never the
    // multi-megabyte original the file input is holding.
    const data = new FormData();
    data.set("itemId", itemId);
    data.set("comment", comment);
    data.set("photo", photo, photo.name);
    formAction(data);
  }

  const ready = Boolean(photo) && comment.trim().length > 0;
  const busy = pending || processing;
  const error = localError ?? state.error;

  return (
    <form onSubmit={handleSubmit} className="panel space-y-5">
      <div className="space-y-2">
        <span className="label">Photo</span>

        <label className="block cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handlePick}
            disabled={busy}
          />
          <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-panel">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="label">
                {processing ? "Processing…" : "Tap to take or choose a photo"}
              </span>
            )}
          </div>
        </label>

        {photo ? (
          <p className="label">Ready · {formatKb(photo.size)}. Tap to retake.</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="label" htmlFor="comment">
          Comment (required)
        </label>
        <textarea
          id="comment"
          name="comment"
          rows={4}
          className="field resize-none"
          placeholder="What changed this week?"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          disabled={busy}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-fail">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn w-full" disabled={!ready || busy}>
        {pending ? "Submitting…" : "Submit this week"}
      </button>
    </form>
  );
}
