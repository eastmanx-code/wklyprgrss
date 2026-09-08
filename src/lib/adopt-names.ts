/**
 * Reading a capture back out of its own filename.
 *
 * Import-free on purpose, the same way the night maths is, so the fixtures in
 * scripts/check-adopt.mjs can run it without a database or a browser. What it
 * decides is whether a photograph counts, so it is worth being able to prove
 * rather than reason about.
 *
 * The shape is set by captureTarget:
 *   close/<night>/<item>/<shot>-<stamp>.<ext>
 * and the two questions here are which shot a file belongs to and which of
 * several is the one that counts.
 */

const PHOTO_EXT = ["jpg", "jpeg", "png", "heic", "heif", "webp"];
const VIDEO_EXT = ["mov", "mp4", "m4v", "webm"];

/**
 * What the extension says it is.
 *
 * Photos are jpg because they are re-encoded before they leave the phone,
 * except one that refused to re-encode, which now goes up whole under its own
 * name. Anything unrecognised is not a capture and is left alone: better to
 * miss a file than to file something unknown as evidence.
 */
export function kindOf(name: string): "photo" | "video" | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (PHOTO_EXT.includes(ext)) return "photo";
  if (VIDEO_EXT.includes(ext)) return "video";
  return null;
}

/**
 * The stamp in the name, if this file belongs to that shot.
 *
 * A retake writes a new file rather than replacing the old one, so a shot can
 * own several and the newest is the one that counts. Storage's own created_at
 * would answer it too, at the cost of another call per file, and the name
 * already carries it.
 *
 * Anchored at both ends: "10-123.jpg" belongs to shot 10 and must not be read
 * as shot 1, which is the mistake a looser match makes on the one item that
 * has ever had ten shots.
 */
export function stampOf(name: string, shotIndex: number): number | null {
  const match = /^(\d+)-(\d+)\.[A-Za-z0-9]+$/.exec(name);
  if (!match) return null;
  if (Number(match[1]) !== shotIndex) return null;
  const stamp = Number(match[2]);
  return Number.isFinite(stamp) && stamp > 0 ? stamp : null;
}

/** The one file that counts for a shot, or null when none of them do. */
export function newestFor(names: string[], shotIndex: number): string | null {
  let best: { name: string; stamp: number } | null = null;
  for (const name of names) {
    const stamp = stampOf(name, shotIndex);
    if (stamp === null) continue;
    if (!kindOf(name)) continue;
    if (!best || stamp > best.stamp) best = { name, stamp };
  }
  return best?.name ?? null;
}
