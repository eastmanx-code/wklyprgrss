"use client";

import { useActionState, useState } from "react";

import {
  addItem,
  moveItem,
  restoreItem,
  retireItem,
  updateItem,
  type ManageState,
} from "@/app/close/manage";
import type { ProofKind, Shot } from "@/lib/close-checklist";

const initial: ManageState = { error: null };

export type EditableItem = {
  id: string;
  position: number;
  title: string;
  detail: string[];
  proof: Shot[];
  active: boolean;
};

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
