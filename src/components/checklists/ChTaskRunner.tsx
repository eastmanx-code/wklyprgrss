"use client";

import { useRef, useState } from "react";

import {
  completeChTask,
  doneUploadTarget,
} from "@/app/checklists/tasks/actions";
import { compressToJpeg, decodeMessage } from "@/lib/compress";
import type { ChTaskOpen } from "@/lib/ch-tasks";

/**
 * The MOD's side: the open tasks for this venue, each cleared with a done photo
 * and initials. Completed tasks drop out of the list on the spot.
 */
export function ChTaskRunner({ tasks }: { tasks: ChTaskOpen[] }) {
  const [open, setOpen] = useState<ChTaskOpen[]>(tasks);

  if (open.length === 0) {
    return (
      <p className="note text-muted leading-relaxed">
        Nothing on the list right now. Tasks the owner flags on a walk land here.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {open.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onDone={() => setOpen((cur) => cur.filter((t) => t.id !== task.id))}
        />
      ))}
    </ul>
  );
}

function TaskCard({ task, onDone }: { task: ChTaskOpen; onDone: () => void }) {
  const [working, setWorking] = useState(false);
  const [initials, setInitials] = useState("");
  const [donePath, setDonePath] = useState<string | null>(null);
  const [donePreview, setDonePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const objectUrls = useRef<string[]>([]);

  async function onDonePhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);

    let upload: File;
    try {
      upload = await compressToJpeg(file);
    } catch (thrown) {
      setUploading(false);
      setError(decodeMessage(thrown));
      return;
    }

    const target = await doneUploadTarget(task.id);
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
    setDonePath(target.path);
    setDonePreview(url);
    setUploading(false);
  }

  async function onComplete() {
    if (!donePath) {
      setError("Take the done photo first.");
      return;
    }
    if (!initials.trim()) {
      setError("Put your initials.");
      return;
    }
    setSaving(true);
    setError(null);
    const data = new FormData();
    data.set("taskId", task.id);
    data.set("initials", initials.trim());
    data.set("donePhotoPath", donePath);
    const result = await completeChTask({ error: null }, data);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    for (const url of objectUrls.current) URL.revokeObjectURL(url);
    onDone();
  }

  return (
    <li className="panel space-y-3">
      <div className="flex items-start gap-3">
        {task.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={task.photoUrl}
            alt=""
            className="bg-inset h-20 w-20 shrink-0 rounded object-cover"
          />
        ) : null}
        <p className="text-title tracking-[0.04em] break-words">{task.title}</p>
      </div>

      {!working ? (
        <button
          type="button"
          className="btn w-full"
          onClick={() => setWorking(true)}
        >
          Mark done
        </button>
      ) : (
        <div className="border-divider space-y-3 border-t pt-3">
          <div className="flex items-start gap-3">
            {donePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={donePreview}
                alt="Done"
                className="bg-inset h-20 w-20 shrink-0 rounded object-cover"
              />
            ) : (
              <span className="bg-inset label text-muted flex h-20 w-20 shrink-0 items-center justify-center rounded text-center">
                Done photo
              </span>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => onDonePhoto(e.target.files?.[0] ?? undefined)}
            />
            <button
              type="button"
              className="btn-ghost min-h-11"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              {uploading
                ? "Uploading…"
                : donePreview
                  ? "Retake"
                  : "Photograph it done"}
            </button>
          </div>

          <input
            className="field tracking-[0.3em]"
            placeholder="Initials"
            inputMode="text"
            autoComplete="off"
            maxLength={12}
            value={initials}
            onChange={(e) => setInitials(e.target.value)}
          />

          {error ? (
            <p role="alert" className="text-body text-warn">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              className="btn flex-1"
              disabled={saving || uploading}
              onClick={onComplete}
            >
              {saving ? "Saving…" : "Done"}
            </button>
            <button
              type="button"
              className="btn-ghost min-h-11"
              onClick={() => setWorking(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
