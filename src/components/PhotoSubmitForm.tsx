"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useRouter } from "next/navigation";

import { compressToJpeg, decodeMessage, formatKb } from "@/lib/compress";
import {
  createUploadTargets,
  submitItem,
  type SubmitState,
} from "@/app/venue/actions";

/** "a photo, your name and a comment" — a sentence, not a bulleted list. */
function listOut(entries: string[]): string {
  if (entries.length < 2) return entries[0] ?? "";
  return `${entries.slice(0, -1).join(", ")} and ${entries[entries.length - 1]}`;
}

/** The four things a week needs, in the order they appear on the form. */
type Needed = "photo" | "progress" | "author" | "comment";

const NEEDED_LABEL: Record<Needed, string> = {
  photo: "a photo",
  progress: "where this is at",
  author: "your name",
  comment: "a comment",
};

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
  doneHref,
  itemId,
  currentPhotoUrl = null,
}: {
  /** Where to land after submitting — the board the person came from. */
  doneHref: string;
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
  // What a submit press found missing. Only ever set by pressing submit, so
  // the form doesn't scold anyone for fields they haven't reached yet.
  const [pressed, setPressed] = useState<Needed[]>([]);
  const previewRef = useRef<string | null>(null);
  const beforePreviewRef = useRef<string | null>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const authorRef = useRef<HTMLInputElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

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
    if (state.ok) router.push(doneHref);
  }, [state.ok, router, doneHref]);

  async function handleBeforePick(event: React.ChangeEvent<HTMLInputElement>) {
    const original = event.target.files?.[0];
    if (!original) return;

    setProcessing(true);
    setLocalError(null);
    try {
      // No timeout out here: every call inside that can hang carries its own,
      // and a ceiling on the whole pipeline would cut the fallback decoder off
      // before it got its turn.
      const compressed = await compressToJpeg(original);
      if (beforePreviewRef.current)
        URL.revokeObjectURL(beforePreviewRef.current);
      const url = URL.createObjectURL(compressed);
      beforePreviewRef.current = url;
      setBeforePhoto(compressed);
      setBeforePreview(url);
    } catch (error) {
      setLocalError(decodeMessage(error));
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
    } catch (error) {
      setLocalError(decodeMessage(error));
      setPhoto(null);
      setPreview(null);
    } finally {
      setProcessing(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Say what is missing, mark it, and go to it — rather than refusing to
    // move. The button used to be disabled until all four were in, which on a
    // phone reads as a broken submit: someone who skipped "where is this at" —
    // the one field that is buttons rather than a box, and so the easiest to
    // scroll past — tapped a dead control, got nothing back, and left thinking
    // the week was filed.
    if (!photo || !progress || !author.trim() || !comment.trim()) {
      setPressed(unmet);
      const first = unmet[0];
      const target = {
        photo: photoRef,
        progress: progressRef,
        author: authorRef,
        comment: commentRef,
      }[first].current;
      // scroll-behavior is set globally and already answers to
      // prefers-reduced-motion, so this is smooth or instant to taste.
      target?.scrollIntoView({ block: "center" });
      // Only the two text fields; focus means nothing on a photo well or a
      // pair of buttons, and on a phone it would open a keyboard over them.
      if (first === "author" || first === "comment") target?.focus();
      return;
    }

    setPressed([]);

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

  const unmet: Needed[] = [];
  if (!photo) unmet.push("photo");
  if (!progress) unmet.push("progress");
  if (!author.trim()) unmet.push("author");
  if (!comment.trim()) unmet.push("comment");

  // Derived, not stored: a mark clears the moment its field is filled, so
  // nobody is left staring at a warning about something they've just done.
  const flagged = pressed.filter((need) => unmet.includes(need));
  const marked = (need: Needed) => flagged.includes(need);

  const busy = pending || processing || uploading;
  // A week already submitted shows its photo in the well, so "a photo" would
  // read as a lie — what's missing is a fresh one for this submission.
  const needLabel = (need: Needed) =>
    need === "photo" && currentPhotoUrl ? "a new photo" : NEEDED_LABEL[need];
  const shortfall =
    flagged.length > 0
      ? `Still needed: ${listOut(flagged.map(needLabel))}.`
      : null;
  // The shortfall wins: if it's set, the submit never ran, so anything below
  // it is from an earlier attempt.
  const error = shortfall ?? localError ?? state.error;

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
                className="h-full w-full object-contain"
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

      <div className="space-y-2" ref={photoRef}>
        <span className={marked("photo") ? "label text-warn" : "label"}>
          {beforePhoto ? "After (required)" : "Photo (required)"}
          {marked("photo")
            ? currentPhotoUrl
              ? " · take a new one"
              : " · still needed"
            : ""}
        </span>

        <label className="block cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handlePick}
            disabled={busy}
          />
          <div
            className={`bg-panel relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl ${
              marked("photo") ? "ring-warn ring-1" : ""
            }`}
          >
            {preview || currentPhotoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview ?? currentPhotoUrl ?? ""}
                  alt=""
                  className="h-full w-full object-contain"
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
      <div className="space-y-2" ref={progressRef}>
        <span className={marked("progress") ? "label text-warn" : "label"}>
          Where is this at? (required)
          {marked("progress") ? " · pick one" : ""}
        </span>
        {/* A ring rather than a border: it draws outside the box, so marking
            these can't shift the two buttons around. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setProgress("done")}
            aria-pressed={progress === "done"}
            className={`${progress === "done" ? "btn" : "btn-ghost"} ${
              marked("progress") ? "ring-warn ring-1" : ""
            }`}
            disabled={busy}
          >
            This is done
          </button>
          <button
            type="button"
            onClick={() => setProgress("another_cycle")}
            aria-pressed={progress === "another_cycle"}
            className={`${progress === "another_cycle" ? "btn" : "btn-ghost"} ${
              marked("progress") ? "ring-warn ring-1" : ""
            }`}
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
        <label
          className={marked("author") ? "label text-warn" : "label"}
          htmlFor="author"
        >
          Who wrote this (required)
          {marked("author") ? " · still needed" : ""}
        </label>
        <input
          id="author"
          name="author"
          ref={authorRef}
          className={`field ${marked("author") ? "border-warn" : ""}`}
          aria-invalid={marked("author")}
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
        <label
          className={marked("comment") ? "label text-warn" : "label"}
          htmlFor="comment"
        >
          Comment on progress (required)
          {marked("comment") ? " · still needed" : ""}
        </label>
        <textarea
          id="comment"
          name="comment"
          rows={4}
          ref={commentRef}
          className={`field resize-none ${
            marked("comment") ? "border-warn" : ""
          }`}
          aria-invalid={marked("comment")}
          placeholder="What changed this week?"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          disabled={busy}
        />
      </div>

      {error ? (
        <p role="alert" className="text-body text-warn">
          {error}
        </p>
      ) : null}

      {/* Only disabled while something is actually in flight. Incomplete is
          handled on press, with a message naming what's left. */}
      <button type="submit" className="btn w-full" disabled={busy}>
        {uploading ? "Uploading…" : pending ? "Saving…" : "Submit this week"}
      </button>
    </form>
  );
}
