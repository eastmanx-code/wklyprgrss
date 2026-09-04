/**
 * The queue a tick or a photograph survives in when there is no signal.
 *
 * A walk-in has no bars on it and neither does half a cellar, which is exactly
 * where the close list gets walked. Before this, a tap in a cold room went to
 * a server action, failed, and the work was gone — and somebody who loses six
 * ticks once does not open the list again.
 *
 * Only the tick surface needs this. Nobody reads a compliance report in a
 * walk-in, so the reports stay ordinary server-rendered pages.
 *
 * Why a queue rather than a sync engine: a tick is not a row that gets edited,
 * it is a fact that gets appended, and `close_ticks` already carries a unique
 * constraint on (night_id, item_id) that the write already upserts against.
 * Replaying the same tick five times is therefore a no-op on the server, which
 * is the property that makes retrying safe and makes a few hundred lines
 * enough where a merge engine would otherwise be needed. `close_proof` carries
 * the same guarantee on (night_id, item_id, shot_index).
 *
 * IndexedDB rather than localStorage: localStorage is synchronous, holds about
 * five megabytes of strings, and cannot take a photograph.
 */

const DB_NAME = "ww-close";
const DB_VERSION = 2;
const STORE = "outbox";
/**
 * The bytes, kept apart from the queue that describes them.
 *
 * One store would have been simpler and wrong: reading the queue to count what
 * is pending would pull every photograph into memory to do it, on the phone
 * least able to afford that. The metadata is small and read constantly; a blob
 * is large and read once, at the moment it goes up.
 */
const BLOBS = "blobs";

/**
 * One queued write.
 *
 * `key` is what makes a long time offline cheap. Ticking an item, unticking it
 * and ticking it again leaves one entry rather than three, because the server
 * holds a set rather than a log: what matters is whether a row exists for that
 * item tonight, not the route taken to it. Collapsing is therefore not a
 * shortcut, it is the same answer with less to send. A retaken photograph
 * replaces the one still queued for the same shot, for the same reason.
 */
export type TickOp = {
  kind: "tick";
  key: string;
  slug: string;
  itemId: string;
  initials: string;
  on: boolean;
  /** The device's clock. Untrusted, recorded anyway. */
  clientAt: string;
};

export type ProofOp = {
  kind: "proof";
  key: string;
  slug: string;
  itemId: string;
  shotIndex: number;
  /** What the item asked for. Note shots never come through here. */
  shot: "photo" | "video";
  /** The real extension, for video: an iPhone records .mov, not .mp4. */
  extension: string;
  initials: string;
  bytes: number;
  clientAt: string;
};

export type Op = TickOp | ProofOp;

export const tickKey = (slug: string, itemId: string) =>
  `tick:${slug}:${itemId}`;

export const proofKey = (slug: string, itemId: string, shotIndex: number) =>
  `proof:${slug}:${itemId}:${shotIndex}`;

/**
 * What the device will hold before it says no.
 *
 * A phone will not carry a whole night of video, and the failure mode of
 * finding that out at the quota is the browser throwing inside a click
 * handler, which looks to the person holding it like the camera not working.
 * Better to refuse one shot with a sentence than to lose the lot.
 */
export const QUEUE_BYTES_MAX = 60 * 1024 * 1024;

let open: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (open) return open;
  open = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const held = request.result;
      if (!held.objectStoreNames.contains(STORE)) {
        held.createObjectStore(STORE, { keyPath: "key" });
      }
      if (!held.objectStoreNames.contains(BLOBS)) {
        held.createObjectStore(BLOBS);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return open;
}

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return db().then(
    (held) =>
      new Promise<T>((resolve, reject) => {
        const tx = held.transaction(store, mode);
        const request = work(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

/** Whether this browser can queue at all. */
export function canQueue(): boolean {
  return typeof indexedDB !== "undefined";
}

/** Put a tick in the queue, replacing any earlier one for the same item. */
export async function enqueue(op: TickOp): Promise<void> {
  await run(STORE, "readwrite", (store) => store.put(op));
}

/**
 * Put a capture in the queue, bytes and all.
 *
 * Refuses rather than throws when the device is already carrying too much, so
 * the caller can say something useful instead of the camera appearing broken.
 */
export async function enqueueProof(
  op: ProofOp,
  blob: Blob,
): Promise<{ error: string | null }> {
  const held = await queuedBytes();
  if (held + blob.size > QUEUE_BYTES_MAX) {
    return {
      error:
        "This device is holding as much as it can offline. Find signal so the photos already taken can go up.",
    };
  }
  await run(BLOBS, "readwrite", (store) => store.put(blob, op.key));
  await run(STORE, "readwrite", (store) => store.put(op));
  return { error: null };
}

export async function queued(): Promise<Op[]> {
  const all = await run<Op[]>(STORE, "readonly", (store) => store.getAll());
  // Oldest first. Two items are independent, but replaying in the order the
  // person worked keeps the server's own stamps in the same order as the
  // shift, which is what a report reads back.
  return [...all].sort((a, b) => a.clientAt.localeCompare(b.clientAt));
}

/** The bytes waiting to go up, so the cap can be enforced before a write. */
export async function queuedBytes(): Promise<number> {
  const all = await queued();
  return all.reduce((n, op) => n + (op.kind === "proof" ? op.bytes : 0), 0);
}

/** One queued capture's bytes, for the upload or for a preview. */
export async function blobFor(key: string): Promise<Blob | undefined> {
  return run<Blob | undefined>(BLOBS, "readonly", (store) => store.get(key));
}

async function drop(key: string): Promise<void> {
  await run(STORE, "readwrite", (store) => store.delete(key));
  await run(BLOBS, "readwrite", (store) => store.delete(key));
}

export type Pending = { ticks: number; proof: number; total: number };

export async function pending(): Promise<Pending> {
  const all = await queued();
  const proof = all.filter((op) => op.kind === "proof").length;
  return { ticks: all.length - proof, proof, total: all.length };
}

/**
 * Send what is queued, oldest first, and keep whatever will not go.
 *
 * Serial rather than parallel: ten writes firing at once on a phone that just
 * found one bar of signal is how you get ten timeouts instead of one success
 * followed by nine failures. Stops at the first network failure and leaves the
 * rest queued, because that almost always means the signal went away again and
 * the next nine will fail the same way.
 *
 * A write the server actively refuses is dropped rather than retried for ever.
 * A list that has been certified will refuse its ticks, and a queue that
 * cannot drain is a queue that grows until the browser evicts the lot. The
 * refusal is handed back so the screen can say what happened rather than
 * quietly losing the work.
 */
export async function flush(
  send: (op: Op, blob?: Blob) => Promise<{ error: string | null }>,
): Promise<{ sent: number; refused: string[]; left: Pending }> {
  if (!canQueue()) {
    return { sent: 0, refused: [], left: { ticks: 0, proof: 0, total: 0 } };
  }

  let sent = 0;
  const refused: string[] = [];

  for (const op of await queued()) {
    let result: { error: string | null };
    try {
      const blob = op.kind === "proof" ? await blobFor(op.key) : undefined;
      // The bytes are gone but the queue still describes them. Nothing can be
      // done with that but forget it, and leaving it would block the queue.
      if (op.kind === "proof" && !blob) {
        await drop(op.key);
        continue;
      }
      result = await send(op, blob);
    } catch {
      // Network, not refusal. Keep it and stop.
      break;
    }
    await drop(op.key);
    if (result.error) refused.push(result.error);
    else sent += 1;
  }

  return { sent, refused, left: await pending() };
}
