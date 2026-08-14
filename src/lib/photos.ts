import "server-only";

import { PHOTO_BUCKET, db } from "./supabase";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Reused for less than it is valid for, deliberately.
 *
 * A URL handed out at the last moment of its life is a broken image a second
 * later, so entries are retired well before the signature is. The gap is the
 * guarantee: anything served has at least a quarter of an hour left on it.
 */
const CACHE_TTL_MS = 45 * 60 * 1000;

/**
 * Signed URLs, kept between renders.
 *
 * An object path is written once and never rewritten — the name carries a
 * timestamp and a random suffix — so a path always points at the same
 * photograph and its URL can be handed out again rather than minted again.
 *
 * This is the approval screen's whole cost. Every review re-renders the venue
 * page, and the page signs every photograph on it — sixty-seven of them at
 * UBLI, which is a round trip to storage measured at over a tenth of a second
 * before anything else on the page starts. Ten approvals is ten of those, for
 * URLs that were already in hand.
 */
const cache = new Map<string, { url: string; expiresAt: number }>();

function prune(now: number): void {
  for (const [path, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(path);
  }
}

/**
 * The `photos` bucket is private, so every image the browser renders needs a
 * short-lived signed URL minted here on the server.
 */
export async function signedUrls(
  paths: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const result = new Map<string, string>();
  if (unique.length === 0) return result;

  const now = Date.now();
  const missing: string[] = [];
  for (const path of unique) {
    const hit = cache.get(path);
    if (hit && hit.expiresAt > now) result.set(path, hit.url);
    else missing.push(path);
  }

  if (missing.length === 0) return result;

  const { data, error } = await db()
    .storage.from(PHOTO_BUCKET)
    .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);

  if (error) throw new Error(error.message);

  prune(now);
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) {
      result.set(entry.path, entry.signedUrl);
      cache.set(entry.path, {
        url: entry.signedUrl,
        expiresAt: now + CACHE_TTL_MS,
      });
    }
  }
  return result;
}

/**
 * Forget a photograph's URL.
 *
 * Only needed where a path stops being servable — a purge — since nothing else
 * changes what sits at a path.
 */
export function forgetSignedUrl(path: string): void {
  cache.delete(path);
}

export async function signedUrl(path: string): Promise<string | null> {
  return (await signedUrls([path])).get(path) ?? null;
}

/** Deterministic, collision-free object path: VENUE/ITEM/WEEK-timestamp.jpg */
export function photoPath(
  venueCode: string,
  itemId: string,
  weekStart: string,
): string {
  const unique = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  return `${venueCode}/${itemId}/${weekStart}-${unique}.jpg`;
}
