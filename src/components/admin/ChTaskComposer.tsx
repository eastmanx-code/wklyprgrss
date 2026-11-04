"use client";

import { useEffect, useRef, useState } from "react";

import {
  askUploadTarget,
  postChTask,
} from "@/app/admin/tasks/actions";
import { compressToJpeg, decodeMessage } from "@/lib/compress";

type Venue = { id: string; code: string; name: string | null };

const REMEMBER_KEY = "ch-task-venue";

/**
 * The owner's in-the-moment composer: pick a venue, snap a photo, type a line,
 * post. Built for one hand on a walk.
 *
 * The photo goes up the moment it is taken, before Post, so a tap away does not
 * lose it — the same order the rest of the app uploads in. The task id is made
 * here so the picture and the row that follows it share one name.
 */
export function ChTaskComposer({
  venues,
  defaultVenueId,
}: {
  venues: Venue[];
  defaultVenueId: string;
}) {
  const [taskId, setTaskId] = useState<string>(() => crypto.randomUUID());
  const [venueId, setVenueId] = useState(defaultVenueId);
  const [title, setTitle] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const objectUrls = useRef<string[]>([]);

  // Remember the venue between posts, so a walk through one building is not a
  // dropdown every time.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      // Synced once on mount, after hydration, so the server and first client
      // render both use the default and nothing mismatches.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && venues.some((v) => v.id === saved)) setVenueId(saved);
    } catch {
      // Private window or blocked storage. The default stands.
    }
  }, [venues]);

  useEffect(
    () => () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  function rememberVenue(id: string) {
    setVenueId(id);
    try {
      localStorage.setItem(REMEMBER_KEY, id);
    } catch {
      // Fine. It just will not be remembered next time.
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    setPosted(null);

    let upload: File;
    try {
      upload = await compressToJpeg(file);
    } catch (thrown) {
      setUploading(false);
      setError(decodeMessage(thrown));
      return;
    }

    const target = await askUploadTarget(taskId);
    if (target.error || !target.signedUrl || !target.path) {
      setUploading(false);
      setError(target.error ?? "Could not start the upload.");
      return;
    }

    try {
      const response = await fetch(target.signedUrl, {
        method: "PUT",
        headers: { "content-type": "image/jpeg" },
        body: upload,
      });
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      setUploading(false);
      setError("Could not upload that. Check your signal and try again.");
      return;
    }

    const url = URL.createObjectURL(upload);
    objectUrls.current.push(url);
    setPhotoPath(target.path);
    setPreview(url);
    setUploading(false);
  }

  async function onPost() {
    if (!venueId) {
      setError("Pick a location.");
      return;
    }
    if (!title.trim()) {
      setError("Say what needs doing.");
      return;
    }
    if (!photoPath) {
      setError("Add a photo first.");
      return;
    }
    setPosting(true);
    setError(null);

    const data = new FormData();
    data.set("taskId", taskId);
    data.set("venueId", venueId);
    data.set("title", title.trim());
    data.set("photoPath", photoPath);
    const result = await postChTask({ error: null }, data);
    setPosting(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    // Clear for the next one, and a fresh id so its photo lands on its own row.
    const venueName =
      venues.find((v) => v.id === venueId)?.code ?? "the location";
    setPosted(`Posted to ${venueName}.`);
    setTitle("");
    setPhotoPath(null);
    setPreview(null);
    setTaskId(crypto.randomUUID());
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className="panel space-y-5">
      <div className="space-y-2">
        <label className="label" htmlFor="ch-venue">
          Location
        </label>
        <span className="select-wrap">
          <select
            id="ch-venue"
            className="field"
            value={venueId}
            onChange={(e) => rememberVenue(e.target.value)}
          >
            <option value="" disabled>
              Pick a location
            </option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code}
                {v.name && v.name !== v.code ? ` — ${v.name}` : ""}
              </option>
            ))}
          </select>
        </span>
      </div>

      <div className="space-y-2">
        <span className="label">Photo</span>
        <div className="flex items-start gap-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="The task"
              className="bg-inset h-20 w-20 shrink-0 rounded object-cover"
            />
          ) : (
            <span className="bg-inset label text-muted flex h-20 w-20 shrink-0 items-center justify-center rounded text-center">
              No photo
            </span>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => onPhoto(e.target.files?.[0] ?? undefined)}
          />
          <button
            type="button"
            className="btn-ghost min-h-11"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? "Uploading…" : preview ? "Retake" : "Snap a photo"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="label" htmlFor="ch-title">
          What needs doing
        </label>
        <textarea
          id="ch-title"
          className="field resize-y"
          rows={2}
          maxLength={200}
          placeholder="Wipe down the host stand brass"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {error ? (
        <p role="alert" className="text-body text-warn">
          {error}
        </p>
      ) : null}
      {posted ? <p className="label text-ink">{posted}</p> : null}

      <button
        type="button"
        className="btn w-full"
        disabled={posting || uploading}
        onClick={onPost}
      >
        {posting ? "Posting…" : "Post to the MOD list"}
      </button>
    </div>
  );
}
