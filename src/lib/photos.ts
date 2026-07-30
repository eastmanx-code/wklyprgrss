import "server-only";

import { PHOTO_BUCKET, db } from "./supabase";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

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

  const { data, error } = await db()
    .storage.from(PHOTO_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);

  if (error) throw new Error(error.message);

  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) result.set(entry.path, entry.signedUrl);
  }
  return result;
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
