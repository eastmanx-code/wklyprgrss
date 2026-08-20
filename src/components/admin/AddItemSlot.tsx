import Link from "next/link";

import type { House } from "@/lib/types";

/**
 * An empty slot, as a target rather than a form.
 *
 * Naming used to happen in a pill inside this well, which made the whole tile
 * a text field about eighty pixels wide. The tile is now just something to
 * tap; the naming happens on its own page, where the field is full width and
 * the button is a button.
 *
 * A venue owns its own list — same control the admin has. Only approving stays
 * admin-only.
 */
export function AddItemSlot({
  venueId,
  house,
  index,
}: {
  venueId: string;
  /** Which board this slot belongs to — the new item lands in it. */
  house: House;
  index: number;
}) {
  return (
    <li>
      <Link
        href={`/venue/item/new?venue=${venueId}&house=${house}&slot=${index}`}
        className="panel panel-link flex h-full flex-col p-3"
      >
        <div className="dotfield flex aspect-square w-full items-center justify-center rounded-[8px]">
          {/* Same solid pill as the "photo needed" marker — it holds contrast
              against the ruled ground, and the two empty states read as one
              family. */}
          <span className="label text-ink bg-paper rounded-full px-3 py-1.5">
            Add a task
          </span>
        </div>
        <p className="label mt-3">
          Slot {index} · name it, then take the photo
        </p>
      </Link>
    </li>
  );
}
