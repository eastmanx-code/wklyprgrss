"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useRouter } from "next/navigation";

import {
  createUploadTargets,
  submitItem,
  type SubmitState,
} from "@/app/venue/actions";

const MAX_EDGE = 1600;
const TARGET_BYTES = 300 * 1024;
const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52, 0.42];

function toBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
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
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
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

const AUTHOR_KEY = "ww_author";

/**
 * How long a remembered name stays valid. Long enough to cover one person
 * doing all ten items in a sitting; short enough that the next shift on a
 * shared venue iPad starts blank instead of quietly filing work under whoever
 * used it last.
 */
const AUTHOR_TTL_MS = 8 * 60 * 60 * 1000;

/** Never changes mid-session, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => {};

function readSavedAuthor(): string {
  try {
    const raw = localStorage.getItem(AUTHOR_KEY);
    if (!raw) return "";
    const saved = JSON.parse(raw) as { name?: string; at?: number };
    if (!saved?.name || typeof saved.at !== "number") return "";
    if (Date.now() - saved.at > AUTHOR_TTL_MS) return "";
    return saved.name;
  } catch {
    // Storage disabled, or an older plain-string value — start blank.
    return "";
  }
}

/** Empty on the server, so the first client render matches and hydration is clean. */
const noSavedAuthor = () => "";

export function PhotoSubmitForm({
  itemId,
  currentPhotoUrl = null,
}: {
  itemId: string;
  /** This week's photo, if one is already in. Shown so the well isn't empty. */
  currentPhotoUrl?: string | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitItem, initialState);
  const [uploading, setUploading] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [beforePhoto, setBeforePhoto] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  // Ten items a week is a lot of retyping, so the name is remembered. `null`
  // means untouched — fall back to whatever was saved last time.
  const savedAuthor = useSyncExternalStore(
    subscribeToNothing,
    readSavedAuthor,
    noSavedAuthor,
  );
  const [typedAuthor, setTypedAuthor] = useState<string | null>(null);
  const author = typedAuthor ?? savedAuthor;
  const [assistedBy, setAssistedBy] = useState("");
  const [progress, setProgress] = useState<"done" | "another_cycle" | null>(
    null,
  );
  const [processing, setProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  const beforePreviewRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      if (beforePreviewRef.current)
        URL.revokeObjectURL(beforePreviewRef.current);
    };
  }, []);

  useEffect(() => {
    // Pure navigation, not state — the action reports success and the client
    // moves, so a redirect thrown from the action can't blank the screen.
    if (state.ok) router.push("/venue");
  }, [state.ok, router]);

  async function handleBeforePick(event: React.ChangeEvent<HTMLInputElement>) {
    const original = event.target.files?.[0];
    if (!original) return;

    setProcessing(true);
    setLocalError(null);
    try {
      const compressed = await compressToJpeg(original);
      if (beforePreviewRef.current)
        URL.revokeObjectURL(beforePreviewRef.current);
      const url = URL.createObjectURL(compressed);
      beforePreviewRef.current = url;
      setBeforePhoto(compressed);
      setBeforePreview(url);
    } catch {
      setLocalError("Couldn't read that photo. Try taking it again.");
    } finally {
      setProcessing(false);
    }
  }

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo || !comment.trim() || !author.trim() || !progress) return;

    try {
      localStorage.setItem(
        AUTHOR_KEY,
        JSON.stringify({ name: author.trim(), at: Date.now() }),
      );
    } catch {
      // Not important enough to block the submission.
    }

    setLocalError(null);
    setUploading(true);
    try {
      // Photos go straight to storage; the action only ever carries text.
      const targets = await createUploadTargets(itemId, Boolean(beforePhoto));
      if (targets.error || !targets.after) {
        setLocalError(targets.error ?? "Couldn't start the upload.");
        return;
      }

      const put = async (target: { signedUrl: string }, file: File) => {
        const response = await fetch(target.signedUrl, {
          method: "PUT",
          headers: { "content-type": "image/jpeg" },
          body: file,
        });
        if (!response.ok) {
          throw new Error(`Upload failed (${response.status})`);
        }
      };

      await put(targets.after, photo);
      if (beforePhoto && targets.before) await put(targets.before, beforePhoto);

      const data = new FormData();
      data.set("itemId", itemId);
      data.set("comment", comment);
      data.set("author", author);
      data.set("assistedBy", assistedBy);
      data.set("progress", progress);
      data.set("photoPath", targets.after.path);
      if (beforePhoto && targets.before) {
        data.set("beforePhotoPath", targets.before.path);
      }
      formAction(data);
    } catch (error) {
      // Surface it in the form rather than throwing to the error screen, which
      // tells the person nothing and loses everything they typed.
      setLocalError(
        error instanceof Error
          ? `Couldn't upload that photo. ${error.message}`
          : "Couldn't upload that photo. Check your signal and try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  const ready =
    Boolean(photo) &&
    comment.trim().length > 0 &&
    author.trim().length > 0 &&
    progress !== null;
  const busy = pending || processing || uploading;
  const error = localError ?? state.error;

  return (
    <form onSubmit={handleSubmit} className="panel space-y-5">
      {/* Only for work executed inside the week. On an ongoing item the
          previous week's photo is the before, so this stays empty. */}
      <div className="space-y-2">
        <span className="label">Before (optional)</span>

        <label className="block cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleBeforePick}
            disabled={busy}
          />
          <div className="dotfield relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl">
            {beforePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={beforePreview}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="label text-ink bg-paper rounded-full px-3 py-1.5 shadow-[0_0_0_4px_var(--color-paper)]">
                Only if you shot one this week
              </span>
            )}
          </div>
        </label>

        {beforePhoto ? (
          <p className="label">Before ready · {formatKb(beforePhoto.size)}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <span className="label">
          {beforePhoto ? "After (required)" : "Photo (required)"}
        </span>

        <label className="block cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handlePick}
            disabled={busy}
          />
          <div className="bg-panel relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl">
            {preview || currentPhotoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview ?? currentPhotoUrl ?? ""}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {!preview ? (
                  <span className="label text-ink bg-paper absolute bottom-3 rounded-full px-3 py-1.5">
                    This week&apos;s · tap to replace
                  </span>
                ) : null}
              </>
            ) : (
              <span className="label">
                {processing ? "Processing…" : "Tap to take or choose a photo"}
              </span>
            )}
          </div>
        </label>

        {photo ? (
          <p className="label">
            Ready · {formatKb(photo.size)}. Tap to retake.
          </p>
        ) : null}
      </div>

      {/* The leader decides this, not the admin. Nothing can be approved until
          they've said the work is actually finished. */}
      <div className="space-y-2">
        <span className="label">Where is this at? (required)</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setProgress("done")}
            aria-pressed={progress === "done"}
            className={progress === "done" ? "btn" : "btn-ghost"}
            disabled={busy}
          >
            This is done
          </button>
          <button
            type="button"
            onClick={() => setProgress("another_cycle")}
            aria-pressed={progress === "another_cycle"}
            className={progress === "another_cycle" ? "btn" : "btn-ghost"}
            disabled={busy}
          >
            One more cycle
          </button>
        </div>
        {progress === "another_cycle" ? (
          <p className="label">
            Still counts for this week. It stays open and can&apos;t be approved
            until it&apos;s done.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="label" htmlFor="author">
          Who wrote this (required)
        </label>
        <input
          id="author"
          name="author"
          className="field"
          placeholder="Your name"
          autoComplete="name"
          value={author}
          onChange={(event) => setTypedAuthor(event.target.value)}
          disabled={busy}
        />
        {author && typedAuthor === null ? (
          <button
            type="button"
            className="label hover:text-ink"
            onClick={() => setTypedAuthor("")}
          >
            Not {author}? Tap to change
          </button>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="label" htmlFor="assistedBy">
          Who assisted (optional)
        </label>
        <input
          id="assistedBy"
          name="assistedBy"
          className="field"
          placeholder="Anyone who helped"
          value={assistedBy}
          onChange={(event) => setAssistedBy(event.target.value)}
          disabled={busy}
        />
      </div>

      <div className="space-y-2">
        <label className="label" htmlFor="comment">
          Comment on progress (required)
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
        {uploading ? "Uploading…" : pending ? "Saving…" : "Submit this week"}
      </button>
    </form>
  );
}
