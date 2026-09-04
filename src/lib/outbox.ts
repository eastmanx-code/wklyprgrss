/**
 * The queue a tick survives in when there is no signal.
 *
 * A walk-in has no bars on it and neither does half a cellar, which is exactly
 * where the close list gets walked. Before this, a tap in a cold room went to
 * a server action, failed, and the tick was gone — and somebody who loses six
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
 * enough where a merge engine would otherwise be needed.
 *
 * IndexedDB rather than localStorage: localStorage is synchronous, holds about
 * five megabytes of strings, and cannot take a photograph. The photo queue is
 * not built yet but it is going in the same place, and moving stores later is
 * worse than picking the right one now.
 */

const DB_NAME = "ww-close";
const DB_VERSION = 1;
const STORE = "outbox";

/**
 * One queued write.
 *
 * `key` is what makes a long time offline cheap. Ticking an item, unticking
 * it and ticking it again leaves one entry rather than three, because the
 * server holds a set rather than a log: what matters is whether a row exists
 * for that item tonight, not the route taken to it. Collapsing is therefore
 * not a shortcut, it is the same answer with less to send.
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

export const tickKey = (slug: string, itemId: string) => `tick:${slug}:${itemId}`;

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
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return open;
}

function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return db().then(
    (held) =>
      new Promise<T>((resolve, reject) => {
        const tx = held.transaction(STORE, mode);
        const request = work(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

/** Whether this browser can queue at all. */
export function canQueue(): boolean {
  return typeof indexedDB !== "undefined";
}

/** Put a write in the queue, replacing any earlier one for the same item. */
export async function enqueue(op: TickOp): Promise<void> {
  await run("readwrite", (store) => store.put(op));
}

export async function queued(): Promise<TickOp[]> {
  const all = await run<TickOp[]>("readonly", (store) => store.getAll());
  // Oldest first. Two items are independent, but replaying in the order the
  // person worked keeps the server's own created_at stamps in the same order
  // as the shift, which is what a report reads back.
  return [...all].sort((a, b) => a.clientAt.localeCompare(b.clientAt));
}

async function drop(key: string): Promise<void> {
  await run("readwrite", (store) => store.delete(key));
}

export async function pendingCount(): Promise<number> {
  return run<number>("readonly", (store) => store.count());
}

/**
 * Send what is queued, oldest first, and keep whatever will not go.
 *
 * Serial rather than parallel: ten ticks firing at once on a phone that just
 * found one bar of signal is how you get ten timeouts instead of one success
 * followed by nine. Stops at the first failure and leaves the rest queued,
 * because a failure here almost always means the network went away again and
 * the next nine will fail the same way.
 *
 * A write that the server actively rejects is dropped rather than retried for
 * ever. A list that has been certified will refuse its ticks, and a queue that
 * cannot drain is a queue that grows until the browser evicts the lot.
 */
export async function flush(
  send: (op: TickOp) => Promise<{ error: string | null }>,
): Promise<{ sent: number; left: number }> {
  if (!canQueue()) return { sent: 0, left: 0 };

  let sent = 0;
  for (const op of await queued()) {
    let result: { error: string | null };
    try {
      result = await send(op);
    } catch {
      // Network, not refusal. Keep it and stop.
      break;
    }
    // Refused with a reason: the server has an opinion and repeating the call
    // will not change it.
    await drop(op.key);
    if (!result.error) sent += 1;
  }

  return { sent, left: await pendingCount() };
}
