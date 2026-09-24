import { attachWalkPhoto, walkPhotoUploadUrl } from "@/app/walkthroughs/actions";
import type { WalkPhotoOp } from "@/lib/outbox";

/**
 * Getting one walkthrough photo up, and telling everyone who cares to try.
 *
 * The queue in `outbox.ts` holds the photos; this is the send it drains through
 * and the nudge that starts a drain. Both live here because two places need the
 * send, the page's drainer and the card's own fall-back when the queue will not
 * take a photo, and a second copy of the sign-put-record dance is a second
 * place to get the retry rules wrong.
 */

/**
 * Three tries with a widening pause. The smaller resilience on top of the
 * queue: a blip inside one drain, ridden out now rather than waited on until
 * the next. A refusal the server means is returned rather than thrown, so it is
 * not retried against an answer that will not change.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 400 * 2 ** i));
      }
    }
  }
  throw last;
}

/**
 * Sign this photo's own fixed path, put the bytes, record the row.
 *
 * A returned error is the server's settled opinion and drops the op; a thrown
 * one is the network or storage and keeps it for the next drain. The record is
 * thrown on too, because bytes with no row behind them are invisible, and the
 * path is idempotent so a repeat is safe where losing the photo is not.
 */
export async function sendWalkPhoto(
  op: WalkPhotoOp,
  blob: Blob,
): Promise<{ error: string | null }> {
  return withRetry(async () => {
    const target = await walkPhotoUploadUrl(op.commitmentId, op.path);
    if (target.error) {
      // "Could not start the upload." is storage and can come back; the others
      // (signed, not yours) will not, so those drop and this one retries.
      if (target.error === "Could not start the upload.") {
        throw new Error(target.error);
      }
      return { error: target.error };
    }
    if (!target.signedUrl || !target.path) throw new Error("no signed url");

    const res = await fetch(target.signedUrl, {
      method: "PUT",
      headers: { "content-type": "image/jpeg" },
      body: blob,
    });
    if (!res.ok) throw new Error(`upload ${res.status}`);

    const rec = await attachWalkPhoto(op.commitmentId, target.path, op.name);
    if (rec.error) throw new Error(rec.error);
    return { error: null };
  });
}

/**
 * The nudge. A card that just queued a photo calls this; the one drainer
 * mounted on the page hears it and drains. Kept to a bare notify so nothing
 * about who is listening leaks into the card.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function onWalkDrain(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function bumpWalkDrain(): void {
  for (const cb of listeners) cb();
}
