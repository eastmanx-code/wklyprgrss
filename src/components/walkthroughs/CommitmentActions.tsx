"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  removeWalkPhoto,
  reopenWalkCommitment,
  signWalkCommitment,
} from "@/app/walkthroughs/actions";
import { compressToJpeg, decodeMessage } from "@/lib/compress";
import { enqueueWalkPhoto, walkPhotoKey, type WalkPhotoOp } from "@/lib/outbox";
import { bumpWalkDrain, sendWalkPhoto } from "@/lib/walk-send";
import { PhotoGrid } from "@/components/walkthroughs/PhotoGrid";

/** A stable, collision-free object key, with a fallback for old Safari. */
function newPath(commitmentId: string, ext = "jpg"): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `walk/${commitmentId}/${id}.${ext}`;
}

/**
 * The check-off: photograph the thing done, put a name to it, sign.
 *
 * The photo is the gate. The sign button stays dead until at least one picture
 * is on the commitment, the same rule the close lists live by. A photo put on
 * the wrong item can be pulled back off while the item is still open, so a
 * mistake is the manager's to fix and does not need the office. Once signed the
 * row locks; only an admin can reopen it, and a photo can be removed again once
 * it is open.
 *
 * A picked photo goes to the same offline queue the nightly close lists ride,
 * so a walkthrough closed out in a basement bar survives the page being shut or
 * the signal dropping outright. It lands durably in the browser here and the
 * sending belongs to the one WalkQueue drainer on the board, which this nudges.
 */
export function CommitmentActions({
  id,
  signed,
  canReopen,
  initialPhotos,
  hidePhotos,
  tile,
  caption,
}: {
  id: string;
  signed: boolean;
  canReopen: boolean;
  initialPhotos: { id: string; url: string; isDoc?: boolean }[];
  /** A photo-led tile already shows the photos as its hero, so the signed
      view here renders only the reopen control, not the photos again. */
  hidePhotos?: boolean;
  /** Render as a uniform grid tile: an aspect-square photo or add-a-photo
      well up top, the caption below it, and the sign-off fields only once a
      photo is on it. Keeps an untouched to-do the same size as a photo card. */
  tile?: boolean;
  /** The ask and its dates, shown between the photo area and the controls. */
  caption?: React.ReactNode;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  const hasPhoto = initialPhotos.length > 0;

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    setError(null);
    let sentNow = false;
    try {
      for (const file of files) {
        // No silent fallback to the raw file: an iPhone HEIC that fails to
        // convert uploads as a picture most browsers cannot render. compressToJpeg
        // reads HEIC too, so a real failure here is worth surfacing.
        const jpeg = await compressToJpeg(file);
        const path = newPath(id);
        const op: WalkPhotoOp = {
          kind: "walkphoto",
          key: walkPhotoKey(path),
          commitmentId: id,
          path,
          name: name.trim(),
          bytes: jpeg.size,
          clientAt: new Date().toISOString(),
        };

        const held = await enqueueWalkPhoto(op, jpeg);
        if (!held.stored) {
          // The queue would not take it, so sending now is the only way through.
          // A failure here is real and surfaces, the same as before the queue.
          const r = await sendWalkPhoto(op, jpeg);
          if (r.error) throw new Error(r.error);
          sentNow = true;
        }
      }
      // Wake the board's drainer to push up whatever just queued, if there is
      // signal. Offline, it does nothing and the photos wait, which is the point.
      bumpWalkDrain();
      // A photo sent past the queue is already a row, so show it now; queued
      // ones appear when the drainer lands them.
      if (sentNow) router.refresh();
    } catch (e) {
      setError(decodeMessage(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /**
   * Attach a PDF instead of a photo. For a walkthrough ask whose proof is a
   * document (the HOH checklist and its kind), which had nowhere to go before.
   * No compression: a PDF rides the same offline queue as a photo, uploaded
   * as-is to a `.pdf` path so storage serves it as a document.
   */
  async function pickDoc(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const isPdf =
      file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      setError("That has to be a PDF.");
      if (docRef.current) docRef.current.value = "";
      return;
    }
    setBusy(true);
    setError(null);
    let sentNow = false;
    try {
      const path = newPath(id, "pdf");
      const op: WalkPhotoOp = {
        kind: "walkphoto",
        key: walkPhotoKey(path),
        commitmentId: id,
        path,
        name: name.trim(),
        bytes: file.size,
        clientAt: new Date().toISOString(),
      };
      const held = await enqueueWalkPhoto(op, file);
      if (!held.stored) {
        const r = await sendWalkPhoto(op, file);
        if (r.error) throw new Error(r.error);
        sentNow = true;
      }
      bumpWalkDrain();
      if (sentNow) router.refresh();
    } catch (e) {
      setError(decodeMessage(e));
    } finally {
      setBusy(false);
      if (docRef.current) docRef.current.value = "";
    }
  }

  async function remove(photoId: string) {
    setBusy(true);
    setError(null);
    const data = new FormData();
    data.set("photoId", photoId);
    const r = await removeWalkPhoto({ error: null }, data);
    setBusy(false);
    if (r.error) setError(r.error);
    else router.refresh();
  }

  async function sign() {
    if (!hasPhoto) {
      setError("Add a photo or document first.");
      return;
    }
    if (name.trim().length < 2) {
      setError("Put your name to it.");
      return;
    }
    setBusy(true);
    setError(null);
    const data = new FormData();
    data.set("id", id);
    data.set("signedBy", name.trim());
    data.set("note", note.trim());
    const r = await signWalkCommitment({ error: null }, data);
    setBusy(false);
    if (r.error) setError(r.error);
    else router.refresh();
  }

  async function reopen() {
    setBusy(true);
    setError(null);
    const data = new FormData();
    data.set("id", id);
    const r = await reopenWalkCommitment({ error: null }, data);
    setBusy(false);
    if (r.error) setError(r.error);
    else router.refresh();
  }

  if (signed) {
    if (initialPhotos.length === 0 && !canReopen) return null;
    return (
      <div className="mt-3 space-y-2">
        {/* Signed: photos are view-only, tap to enlarge, no remove. On a
            photo-led tile the hero is drawn above, so skip them here. */}
        {hidePhotos ? null : <PhotoGrid photos={initialPhotos} />}
        {canReopen ? (
          <button
            type="button"
            onClick={reopen}
            disabled={busy}
            className="btn-ghost btn-sm text-warn"
          >
            {busy ? "…" : "Reopen"}
          </button>
        ) : null}
        {error ? (
          <p role="alert" className="label text-warn">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  // Uniform grid tile. Every card is the same shape: a square photo or a
  // square "add a photo" well, the caption, then the controls pinned to the
  // bottom. The sign-off fields appear only once there is a photo to sign
  // against, so an untouched to-do stays the size of a photo card.
  if (tile) {
    return (
      <div className="flex h-full flex-col gap-2">
        {hasPhoto ? (
          <PhotoGrid photos={initialPhotos} onRemove={remove} busy={busy} cols={1} />
        ) : (
          <label className="dotfield flex aspect-square cursor-pointer items-center justify-center rounded-[10px]">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={pick}
              disabled={busy}
            />
            <span className="label text-ink bg-paper rounded-full px-3 py-1.5">
              {busy ? "Working…" : "Add a photo"}
            </span>
          </label>
        )}

        {caption}

        {hasPhoto ? (
          <div className="mt-auto space-y-2 pt-1">
            <label className="btn-ghost btn-sm inline-flex cursor-pointer items-center">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={pick}
                disabled={busy}
              />
              {busy ? "Working…" : "Add another"}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="field w-full"
              autoComplete="off"
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
              rows={2}
              className="field w-full"
            />
            <button
              type="button"
              onClick={sign}
              disabled={busy || !hasPhoto}
              className="btn btn-sm w-full"
            >
              Sign off
            </button>
          </div>
        ) : (
          <label className="btn-ghost btn-sm mt-auto inline-flex w-fit cursor-pointer items-center">
            <input
              ref={docRef}
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={pickDoc}
              disabled={busy}
            />
            {busy ? "Working…" : "Attach a PDF"}
          </label>
        )}

        {error ? (
          <p role="alert" className="label text-warn">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {/* Open: tap to enlarge, and the × pulls a photo back off the wrong task. */}
      <PhotoGrid photos={initialPhotos} onRemove={remove} busy={busy} />

      <label className="btn-ghost btn-sm inline-flex cursor-pointer items-center">
        {/* No forced camera here, unlike the nightly close. A walkthrough
            follow-up is a repair worked over days, so the honest photo is
            often one taken earlier, and a manager may be closing it out from a
            computer. This matches the weekly board, which also lets a chosen
            file stand in for a live shot. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={pick}
          disabled={busy}
        />
        {busy ? "Working…" : hasPhoto ? "Add another photo" : "Add a photo"}
      </label>

      {/* A document instead of a photo, for an ask whose proof is a checklist
          or a sheet. It counts as proof the same way a photo does, so it
          satisfies the sign-off gate. */}
      <label className="btn-ghost btn-sm ml-2 inline-flex cursor-pointer items-center">
        <input
          ref={docRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={pickDoc}
          disabled={busy}
        />
        {busy ? "Working…" : "Attach a PDF"}
      </label>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="field w-full"
        autoComplete="off"
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note, if anything (optional)"
        rows={2}
        className="field w-full"
      />

      <button
        type="button"
        onClick={sign}
        disabled={busy || !hasPhoto}
        className="btn btn-sm"
      >
        Sign off
      </button>

      {error ? (
        <p role="alert" className="label text-warn">
          {error}
        </p>
      ) : null}
    </div>
  );
}
