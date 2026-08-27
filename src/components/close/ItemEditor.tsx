"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  addItem,
  moveItem,
  referenceTarget,
  restoreItem,
  retireItem,
  setReference,
  updateItem,
  type ManageState,
} from "@/app/close/manage";
import { compressToJpeg, decodeMessage } from "@/lib/compress";
import type { ProofKind, Reference, Shot } from "@/lib/close-checklist";

const initial: ManageState = { error: null };

export type EditableItem = {
  id: string;
  position: number;
  title: string;
  detail: string[];
  proof: Shot[];
  /** What right looks like. Empty until a manager writes one. */
  reference: Reference[];
  /**
   * Signed URLs for the reference photographs, in slot order, minted on the
   * server. Null where the slot is still a placeholder.
   */
  referenceUrls: (string | null)[];
  active: boolean;
};

const MAX_REFERENCES = 4;

const KINDS: { key: ProofKind; label: string; help: string }[] = [
  { key: "photo", label: "Photo", help: "A picture of the thing, taken now." },
  { key: "video", label: "Video", help: "A walk-through, narrated." },
  {
    key: "note",
    label: "Written",
    help: "Words are the record — what was said.",
  },
];

/**
 * The proof editor for one item.
 *
 * Each shot is a kind and a prompt, and the prompt is the whole mechanism: a
 * covered lens is obviously wrong against "the back door, closed and locked,
 * with the latch visible", and nothing has to judge the picture. So a shot
 * without a prompt is not saved — an unnamed photo requirement is a tick with
 * extra steps.
 *
 * A list rather than one field, because two things that both need proving are
 * usually nowhere near each other. A safe count and a locked back door cannot
 * be got into one frame, and asking for it produces either a bad photo of both
 * or an honest photo of one.
 */
function ShotFields({ shots }: { shots: Shot[] }) {
  const [rows, setRows] = useState<Shot[]>(shots);

  return (
    <div className="space-y-2">
      <span className="label">Proof needed</span>

      {rows.length === 0 ? (
        <p className="note text-muted">
          None. The item is done when somebody initials it.
        </p>
      ) : null}

      <ul className="space-y-3">
        {rows.map((shot, index) => (
          <li key={index} className="border-divider space-y-2 border-t pt-3">
            <div className="flex flex-wrap gap-2">
              {KINDS.map((kind) => (
                <button
                  key={kind.key}
                  type="button"
                  aria-pressed={shot.kind === kind.key}
                  onClick={() =>
                    setRows((current) =>
                      current.map((row, i) =>
                        i === index ? { ...row, kind: kind.key } : row,
                      ),
                    )
                  }
                  className={
                    shot.kind === kind.key ? "btn btn-sm" : "btn-ghost min-h-11"
                  }
                >
                  {kind.label}
                </button>
              ))}
              <button
                type="button"
                className="btn-ghost min-h-11"
                onClick={() =>
                  setRows((current) => current.filter((_, i) => i !== index))
                }
              >
                Remove
              </button>
            </div>

            <input type="hidden" name="shotKind" value={shot.kind} />
            <input
              name="shotPrompt"
              className="field"
              placeholder="What it has to show"
              maxLength={200}
              value={shot.prompt}
              onChange={(event) =>
                setRows((current) =>
                  current.map((row, i) =>
                    i === index ? { ...row, prompt: event.target.value } : row,
                  ),
                )
              }
            />
            <p className="label">
              {KINDS.find((k) => k.key === shot.kind)?.help}
            </p>
          </li>
        ))}
      </ul>

      {rows.length < 6 ? (
        <button
          type="button"
          className="btn-ghost min-h-11"
          onClick={() =>
            setRows((current) => [...current, { kind: "photo", prompt: "" }])
          }
        >
          Add proof
        </button>
      ) : null}
    </div>
  );
}

/**
 * The reference shots for one item: what right looks like.
 *
 * The other direction from proof. Proof is what the item owes at the end of
 * the night; this is what somebody looks at while they are doing it, and the
 * paper lists have been reaching for it for years without being able to
 * deliver. Young Blood's bartender open says "make sure your well is FULL
 * (refer to well photo)" and there is no well photo. The fridge order is a
 * paragraph naming six fortifieds back to front. Each of those is a
 * photograph pretending to be a sentence.
 *
 * The manager takes it, not us. Whoever runs the bar knows what a correct well
 * looks like on their bar, and a picture taken anywhere else is a different
 * bar. That also means it can be retaken the week the layout changes, by the
 * person who changed it.
 *
 * A caption with no photograph is kept rather than dropped. That is the
 * placeholder: the standard has been named and nobody has been in with a
 * camera yet, which is a useful thing to be able to see on the list.
 */
type Slot = Reference & { url: string | null };

function ReferenceFields({
  itemId,
  reference,
  urls,
}: {
  /** Absent on a brand new item — there is no row to hang a photograph off. */
  itemId?: string;
  reference: Reference[];
  urls: (string | null)[];
}) {
  // Caption, path and the URL it renders at, on one row. Two parallel arrays
  // came apart the moment a shot was added or removed in the middle.
  const [rows, setRows] = useState<Slot[]>(() =>
    reference.map((ref, i) => ({ ...ref, url: urls[i] ?? null })),
  );
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Record<number, HTMLInputElement | null>>({});
  const objectUrls = useRef<string[]>([]);

  useEffect(
    () => () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  /**
   * What goes up with a photograph: the captions on screen, blanks dropped,
   * and where in that list this shot belongs.
   *
   * Sending the list rather than one index is the whole guard. A manager can
   * add and remove captions before saving anything, so the third box on screen
   * is not always the third entry on the row, and writing by index alone put
   * the photograph under somebody else's caption.
   */
  function payload(index: number): { data: FormData; slot: number } | null {
    const data = new FormData();
    let slot = -1;
    for (const [i, row] of rows.entries()) {
      const caption = row.caption.trim();
      if (!caption) continue;
      if (i === index) slot = data.getAll("refCaption").length;
      data.append("refCaption", caption);
      data.append("refPath", row.path ?? "");
    }
    if (slot < 0) return null;
    data.set("itemId", itemId ?? "");
    data.set("slot", String(slot));
    return { data, slot };
  }

  /**
   * Straight to storage, then the row points at it — the same order the rest
   * of the app uploads in, so the action only ever carries text.
   *
   * Saved on the spot rather than with the form. A photograph sitting in a
   * hidden field waiting for somebody to press Save is a photograph that gets
   * lost when they close the tab, and they have already done the hard part.
   */
  async function onPick(index: number, file: File | undefined) {
    if (!file || !itemId) return;
    const built = payload(index);
    if (!built) {
      setError("Name the shot first, so the picture has something to mean.");
      return;
    }

    setBusy(index);
    setError(null);

    let upload: File;
    try {
      upload = await compressToJpeg(file);
    } catch (thrown) {
      setBusy(null);
      setError(decodeMessage(thrown));
      return;
    }

    const target = await referenceTarget(itemId, built.slot);
    if (target.error || !target.signedUrl || !target.path) {
      setBusy(null);
      setError(target.error ?? "Could not start the upload.");
      return;
    }
    const path = target.path;

    try {
      const response = await fetch(target.signedUrl, {
        method: "PUT",
        headers: { "content-type": "image/jpeg" },
        body: upload,
      });
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      setBusy(null);
      setError("Could not upload that. Check your signal and try again.");
      return;
    }

    built.data.set("path", path);
    const saved = await setReference({ error: null }, built.data);
    setBusy(null);
    if (saved.error) {
      setError(saved.error);
      return;
    }

    const preview = URL.createObjectURL(upload);
    objectUrls.current.push(preview);
    setRows((current) =>
      current.map((row, i) =>
        i === index ? { ...row, path, url: preview } : row,
      ),
    );
  }

  async function onClear(index: number) {
    if (!itemId) return;
    const built = payload(index);
    if (!built) return;
    setBusy(index);
    setError(null);
    built.data.set("path", "");
    const saved = await setReference({ error: null }, built.data);
    setBusy(null);
    if (saved.error) {
      setError(saved.error);
      return;
    }
    setRows((current) =>
      current.map((row, i) =>
        i === index ? { ...row, path: null, url: null } : row,
      ),
    );
  }

  return (
    <div className="space-y-2">
      <span className="label">What right looks like</span>

      {rows.length === 0 ? (
        <p className="note text-muted">
          Nothing to show them. Add a shot where words have been doing a
          photograph&apos;s job.
        </p>
      ) : null}

      <ul className="space-y-3">
        {rows.map((ref, index) => (
          <li key={index} className="border-divider space-y-2 border-t pt-3">
            <div className="flex items-start gap-3">
              {ref.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ref.url}
                  alt={ref.caption || "Reference"}
                  className="bg-inset h-16 w-16 shrink-0 rounded object-cover"
                />
              ) : (
                <span className="bg-inset label text-muted flex h-16 w-16 shrink-0 items-center justify-center rounded text-center">
                  No shot
                </span>
              )}

              <div className="min-w-0 flex-1 space-y-2">
                <input type="hidden" name="refPath" value={ref.path ?? ""} />
                <input
                  name="refCaption"
                  className="field"
                  placeholder="What the picture shows"
                  maxLength={200}
                  value={ref.caption}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((row, i) =>
                        i === index
                          ? { ...row, caption: event.target.value }
                          : row,
                      ),
                    )
                  }
                />

                <div className="flex flex-wrap gap-2">
                  <input
                    ref={(node) => {
                      inputs.current[index] = node;
                    }}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) =>
                      onPick(index, event.target.files?.[0] ?? undefined)
                    }
                  />
                  {itemId ? (
                    <button
                      type="button"
                      className="btn-ghost min-h-11"
                      disabled={busy === index}
                      onClick={() => inputs.current[index]?.click()}
                    >
                      {busy === index
                        ? "Uploading…"
                        : ref.path
                          ? "Replace photo"
                          : "Take the photo"}
                    </button>
                  ) : (
                    // No row to hang it off yet. Said plainly rather than
                    // shown as a button that fails.
                    <p className="label text-muted">
                      Add the item, then photograph it
                    </p>
                  )}
                  {itemId && ref.path ? (
                    <button
                      type="button"
                      className="btn-ghost min-h-11"
                      disabled={busy === index}
                      onClick={() => onClear(index)}
                    >
                      Clear photo
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn-ghost min-h-11"
                    onClick={() =>
                      setRows((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>

                {ref.path ? null : (
                  <p className="label text-warn">Named, not photographed yet</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="text-body text-warn">
          {error}
        </p>
      ) : null}

      {rows.length < MAX_REFERENCES ? (
        <button
          type="button"
          className="btn-ghost min-h-11"
          onClick={() =>
            setRows((current) => [
              ...current,
              { caption: "", path: null, url: null },
            ])
          }
        >
          Add a reference shot
        </button>
      ) : null}
    </div>
  );
}

function DetailField({ detail }: { detail: string[] }) {
  return (
    <div className="space-y-2">
      <label className="label" htmlFor="detail">
        What done means
      </label>
      <textarea
        id="detail"
        name="detail"
        rows={4}
        className="field resize-y"
        placeholder={
          "One line per standard.\nThey are shown, never separately ticked."
        }
        defaultValue={detail.join("\n")}
      />
    </div>
  );
}

/** One existing item, open for editing. */
export function ItemRow({
  item,
  isFirst,
  isLast,
}: {
  item: EditableItem;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [state, action, pending] = useActionState(updateItem, initial);
  const [, retire, retiring] = useActionState(retireItem, initial);
  const [, restore, restoring] = useActionState(restoreItem, initial);
  const [, move, moving] = useActionState(moveItem, initial);
  const [open, setOpen] = useState(false);

  return (
    <li className={`panel ${item.active ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
        <p className="text-title tracking-[0.08em] break-words">
          <span className="label tabular-nums mr-2">{item.position}</span>
          {item.title}
        </p>

        <div className="flex flex-wrap gap-2">
          {item.active ? (
            <>
              {/* Reordering is two buttons, not a drag. A drag on a shared
                  venue iPad, in a kitchen, with wet hands, is a way to move
                  something you did not mean to. */}
              <form action={move}>
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="direction" value="up" />
                <button
                  type="submit"
                  className="btn-ghost min-h-11"
                  disabled={isFirst || moving}
                  aria-label="Move up"
                >
                  ↑
                </button>
              </form>
              <form action={move}>
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="direction" value="down" />
                <button
                  type="submit"
                  className="btn-ghost min-h-11"
                  disabled={isLast || moving}
                  aria-label="Move down"
                >
                  ↓
                </button>
              </form>
              <button
                type="button"
                className="btn-ghost min-h-11"
                onClick={() => setOpen((v) => !v)}
              >
                {open ? "Close" : "Edit"}
              </button>
            </>
          ) : (
            <form action={restore}>
              <input type="hidden" name="itemId" value={item.id} />
              <button
                type="submit"
                className="btn-ghost min-h-11"
                disabled={restoring}
              >
                Bring back
              </button>
            </form>
          )}
        </div>
      </div>

      {item.detail.length > 0 && !open ? (
        <ul className="mt-2 space-y-1">
          {item.detail.map((line) => (
            <li key={line} className="text-ink/65 text-[13px] leading-snug">
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      {item.proof.length > 0 && !open ? (
        <p className="label mt-2">
          {item.proof.map((shot) => shot.kind).join(" · ")}
        </p>
      ) : null}

      {/* Worth seeing without opening the item: a named standard with no
          picture behind it is a promise the list is making and not keeping. */}
      {item.reference.length > 0 && !open ? (
        <p
          className={`label mt-2 ${
            item.reference.some((ref) => !ref.path) ? "text-warn" : ""
          }`}
        >
          {item.reference.filter((ref) => ref.path).length} of{" "}
          {item.reference.length} reference shots taken
        </p>
      ) : null}

      {item.active ? null : <p className="label text-muted mt-2">Retired</p>}

      {open ? (
        <form action={action} className="mt-4 space-y-4">
          <input type="hidden" name="itemId" value={item.id} />

          <div className="space-y-2">
            <label className="label" htmlFor={`title-${item.id}`}>
              Item
            </label>
            <input
              id={`title-${item.id}`}
              name="title"
              className="field"
              maxLength={200}
              defaultValue={item.title}
            />
          </div>

          <DetailField detail={item.detail} />
          <ShotFields shots={item.proof} />
          <ReferenceFields
            itemId={item.id}
            reference={item.reference}
            urls={item.referenceUrls}
          />

          {state.error ? (
            <p role="alert" className="text-body text-warn">
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn-ghost min-h-11"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {open && item.active ? (
        <form action={retire} className="border-divider mt-4 border-t pt-4">
          <input type="hidden" name="itemId" value={item.id} />
          <button
            type="submit"
            className="btn-ghost min-h-11"
            disabled={retiring}
          >
            Retire this item
          </button>
          {/* Said plainly, because "retire" sounds like a soft delete and the
              whole point is that it is not one. */}
          <p className="label mt-2">
            Stops it appearing tonight. Every night it was checked keeps its
            ticks and photos, and the report keeps counting them.
          </p>
        </form>
      ) : null}
    </li>
  );
}

/** The blank row at the bottom of the list. */
export function AddItemForm({ checklistId }: { checklistId: string }) {
  const [state, action, pending] = useActionState(addItem, initial);
  const [key, setKey] = useState(0);

  return (
    <details className="panel">
      <summary className="card-title cursor-pointer">Add an item</summary>

      <form
        key={key}
        action={(data) => {
          action(data);
          // A fresh form for the next one: ten items in a sitting is the
          // normal way this gets used, and clearing it by hand each time is
          // ten chances to submit the last one twice.
          setKey((k) => k + 1);
        }}
        className="mt-4 space-y-4"
      >
        <input type="hidden" name="checklistId" value={checklistId} />

        <div className="space-y-2">
          <label className="label" htmlFor="title">
            Item
          </label>
          <input
            id="title"
            name="title"
            className="field"
            placeholder="Back door & kitchen entrance"
            maxLength={200}
            autoComplete="off"
          />
        </div>

        <DetailField detail={[]} />
        <ShotFields shots={[]} />
        <ReferenceFields reference={[]} urls={[]} />

        {state.error ? (
          <p role="alert" className="text-body text-warn">
            {state.error}
          </p>
        ) : null}

        <button type="submit" className="btn w-full" disabled={pending}>
          {pending ? "Adding…" : "Add to the list"}
        </button>
      </form>
    </details>
  );
}
