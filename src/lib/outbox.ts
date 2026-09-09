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

import { words } from "./trouble";

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

/**
 * Set the first time the store refuses to open.
 *
 * Not a cache of a slow answer, a memory of a permanent one. A browser that
 * will not open the database on the first shot will not open it on the tenth,
 * and every attempt after the first is another second of a person watching
 * nothing happen.
 */
let shut = false;

/**
 * The one refusal that goes away on its own.
 *
 * Blocked means another tab in this browser is holding an older version of the
 * database open. The moment that tab closes, this works. Every other refusal
 * is permanent for the life of the page.
 */
const BLOCKED = "blocked by another tab holding an older version";

/**
 * What the browser actually said, the first time it refused.
 *
 * The refusal used to be reported as the words "queue unavailable" and nothing
 * else, which is the same string whether the store threw, the open was blocked
 * by a tab holding an older version, or the phone is out of room. Three
 * different problems with three different fixes, and the record could not tell
 * them apart — which is precisely the hole the record was added to close.
 */
let shutBecause: string | null = null;

/** The browser's own words for why the queue is shut, if it is. */
export function queueTrouble(): string | null {
  return shutBecause;
}

function db(): Promise<IDBDatabase> {
  if (open) return open;
  open = new Promise<IDBDatabase>((resolve, reject) => {
    // `open` itself throws in a sandboxed frame, before any handler can run.
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
    request.onsuccess = () => {
      const held = request.result;
      // Yield instead of blocking. Without this a tab somebody left open
      // stops every other tab in that browser from ever upgrading, and the
      // person holding the phone has no way to know which tab is doing it —
      // the app simply stops keeping their work, on that device, for ever.
      // This is the standard pairing for onblocked and it was missing.
      held.onversionchange = () => {
        held.close();
        open = null;
      };
      // Safari closes a connection out from under a backgrounded tab. Letting
      // go of the handle here means the next call opens a fresh one rather
      // than using one that throws on every transaction it is given.
      held.onclose = () => {
        open = null;
      };
      resolve(held);
    };
    // request.error, not a message of our own. It is a DOMException whose name
    // is the diagnosis: QuotaExceededError is a full phone, VersionError is a
    // database newer than this build, UnknownError on iOS is usually the
    // storage layer having given up on the whole origin.
    request.onerror = () =>
      reject(request.error ?? new Error("open failed with no error given"));
    // A version change nobody closed. It will never resolve on its own, and on
    // a phone with a dozen Safari tabs it is the likeliest of the three: one
    // old tab holding version 1 open blocks every new one for ever.
    request.onblocked = () => reject(new Error(BLOCKED));
  }).catch((error: unknown) => {
    const why = words(error);
    shutBecause = why;
    // Latch on the permanent ones only. A browser that is out of room or has
    // given up on the origin will not open on the tenth try either, and every
    // attempt after the first is another second of somebody watching nothing
    // happen. Blocked is not that: it clears the moment the other tab goes,
    // and latching it turned a tab somebody could close into a phone that had
    // stopped keeping work until the whole browser was restarted.
    shut = why !== BLOCKED;
    open = null;
    throw error;
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

/**
 * Whether this browser can queue at all.
 *
 * This used to ask only whether `indexedDB` was a word the browser knew, which
 * is a different question and the wrong one. iOS Safari in a private window
 * knows the word and then refuses to open the database, so the check passed,
 * the write threw, nothing caught it, and the person holding the phone saw the
 * camera do nothing at all. That cost three photographs and two unsigned lists
 * on the first real night. Now a store that has refused to open once is known
 * to be shut, and every caller has somewhere else to go.
 */
export function canQueue(): boolean {
  return typeof indexedDB !== "undefined" && !shut;
}

/**
 * Why a caller that skipped the queue skipped it.
 *
 * `canQueue` answers yes or no and the no has two causes: a browser with no
 * IndexedDB at all, and a store that refused to open earlier in this page's
 * life. They are not the same problem and the record has to say which.
 */
export function whyNotQueued(): string {
  if (typeof indexedDB === "undefined") return "no indexedDB in this browser";
  return shutBecause ?? "the store is shut for a reason nobody recorded";
}

/**
 * Ask the store to open, rather than assuming it will.
 *
 * The honest version of `canQueue`, for the one place that can afford to wait
 * for the answer: the screen deciding on load whether it is holding work.
 */
export async function queueWorks(): Promise<boolean> {
  if (!canQueue()) return false;
  try {
    await db();
    return true;
  } catch {
    return false;
  }
}

/**
 * Put a tick in the queue, replacing any earlier one for the same item.
 *
 * Says whether it landed instead of throwing. A tap that cannot be stored has
 * to go to the network right now, and a caller cannot make that call if the
 * failure arrives as an exception nobody is standing under.
 */
export async function enqueue(op: TickOp): Promise<boolean> {
  try {
    await run(STORE, "readwrite", (store) => store.put(op));
    return true;
  } catch {
    return false;
  }
}

/**
 * Why a capture did not make it into the queue.
 *
 * `full` is the device carrying all it agreed to carry. `unavailable` is the
 * store refusing to work at all. They read the same to the person holding the
 * phone and mean different things to the code: neither is a reason to lose the
 * shot, and both leave sending it now as the only way through.
 */
export type Held =
  | { stored: true }
  | {
      stored: false;
      reason: "full" | "unavailable";
      /** What the browser said, where it said anything. */
      why?: string;
    };

/**
 * Put a capture in the queue, bytes and all.
 *
 * Never throws. Every way this can fail ends with the caller having to send
 * the bytes itself, so the failures come back as answers rather than as
 * exceptions, and the word for what went wrong is left to the screen, which
 * knows which language the person reads.
 */
export async function enqueueProof(op: ProofOp, blob: Blob): Promise<Held> {
  try {
    const held = await queuedBytes();
    if (held + blob.size > QUEUE_BYTES_MAX) {
      return { stored: false, reason: "full" };
    }
    await run(BLOBS, "readwrite", (store) => store.put(blob, op.key));
    await run(STORE, "readwrite", (store) => store.put(op));
    return { stored: true };
  } catch (problem) {
    // The browser's own words, carried out rather than swallowed. Without
    // them every refusal reads the same and none of them names a fix.
    return { stored: false, reason: "unavailable", why: words(problem) };
  }
}

/**
 * What is waiting to go up.
 *
 * Empty when the store will not open. A screen that cannot read the queue is
 * in the same position as a screen with nothing in it, and saying so quietly
 * beats an unhandled rejection in the middle of a shift.
 */
export async function queued(): Promise<Op[]> {
  let all: Op[];
  try {
    all = await run<Op[]>(STORE, "readonly", (store) => store.getAll());
  } catch {
    return [];
  }
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
  try {
    return await run<Blob | undefined>(BLOBS, "readonly", (store) =>
      store.get(key),
    );
  } catch {
    return undefined;
  }
}

async function drop(key: string): Promise<void> {
  try {
    await run(STORE, "readwrite", (store) => store.delete(key));
    await run(BLOBS, "readwrite", (store) => store.delete(key));
  } catch {
    // The store went away mid-drain. Whatever is left in it is unreachable
    // anyway, and throwing here would take down the drain that is currently
    // getting the rest of the night up.
  }
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
 *
 * So is a capture whose bytes are no longer there, which used to be dropped
 * in silence. That is the worst outcome the queue can produce — the person
 * saw the picture, the thumbnail is on their screen, and nothing anywhere
 * says it went. Handed back now, so it can be said out loud and written down.
 */
export async function flush(
  send: (op: Op, blob?: Blob) => Promise<{ error: string | null }>,
): Promise<{
  sent: number;
  refused: string[];
  /** Captures the queue described and could no longer produce. */
  lost: ProofOp[];
  left: Pending;
}> {
  if (!canQueue()) {
    return {
      sent: 0,
      refused: [],
      lost: [],
      left: { ticks: 0, proof: 0, total: 0 },
    };
  }

  let sent = 0;
  const refused: string[] = [];
  const lost: ProofOp[] = [];

  for (const op of await queued()) {
    let result: { error: string | null };
    try {
      const blob = op.kind === "proof" ? await blobFor(op.key) : undefined;
      // The bytes are gone but the queue still describes them. Nothing can be
      // done with that but forget it, and leaving it would block the queue —
      // but it does not go quietly. The shot needs taking again and only the
      // person standing there can do it.
      if (op.kind === "proof" && !blob) {
        lost.push(op);
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

  return { sent, refused, lost, left: await pending() };
}
