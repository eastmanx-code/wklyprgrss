/**
 * Turning whatever a phone hands over into a JPEG every browser can render.
 *
 * Shared, because there are now two places that take photographs and the
 * hardening here is not obvious: an iPhone shoots HEIC by default,
 * createImageBitmap on iOS Safari refuses it — sometimes by rejecting and
 * sometimes by never settling at all — and toBlob takes a callback the browser
 * is free never to invoke. A second copy of this would be a second copy to
 * forget to fix.
 */

export const MAX_EDGE = 1600;
const TARGET_BYTES = 300 * 1024;
const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52, 0.42];

/**
 * How long to let a photo decode before giving up on it.
 *
 * Neither of the two browser calls below is guaranteed to settle. toBlob takes
 * a callback the browser is free never to invoke, and createImageBitmap has
 * hung outright on iOS Safari for HEIC captures. A promise that never settles
 * leaves `processing` stuck true, and `processing` disables every control on
 * this form — the photo wells, both progress buttons, the two text fields and
 * submit. The whole screen goes dead with nothing said, which is exactly what
 * "the submit button isn't clickable" looks like from the outside.
 *
 * Generous: a big capture on a slow phone is legitimately a few seconds, and
 * this only needs to catch the case that is never coming back.
 */
const DECODE_TIMEOUT_MS = 30_000;

/**
 * Shorter, because failing this one isn't fatal — it just moves to the <img>
 * decoder. createImageBitmap on a phone photo is normally well under a second,
 * so this is already generous, and it decides how long someone stares at a
 * frozen well before the fallback quietly rescues them.
 */
const FIRST_DECODER_TIMEOUT_MS = 8_000;

class DecodeTimeout extends Error {}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new DecodeTimeout()), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function toBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality),
  );
}

/**
 * The older way to decode a picture: hand it to an <img> and wait for load.
 *
 * Kept as the fallback because it is the path that works where the modern one
 * doesn't. createImageBitmap is faster and handles EXIF rotation explicitly,
 * but on iOS Safari it refuses HEIC — the format every iPhone shoots by
 * default — sometimes by rejecting and sometimes by never settling at all. An
 * <img> renders the same file, because that is the decoder Safari uses to show
 * photos in the first place. Orientation comes out right too: browsers apply
 * EXIF rotation to <img> by default, and drawImage inherits it.
 */
function decodeViaImgElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image decode failed"));
    };
    img.src = url;
  });
}

/**
 * Is this an Apple HEIC/HEIF capture?
 *
 * Type is the tell when it is there, but a file picked from the library often
 * arrives with an empty type on Android and some desktop browsers, so the
 * extension is the backstop. Either way, the browser decoders below cannot read
 * it off anything but Safari, which is what makes the WASM step below necessary.
 */
function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type.includes("heic") || type.includes("heif")) return true;
  return /\.hei[cf]$/i.test(file.name);
}

/**
 * Decode a HEIC to a JPEG blob in pure WASM, no browser support required.
 *
 * This is the one thing a canvas cannot do for us: Chrome, Firefox and every
 * non-Safari browser refuse HEIC outright, so `decode` below throws on them and
 * the raw HEIC was being uploaded as-is — a file most browsers then cannot
 * render, which is the "tap to retry that never works" a manager hit. libheif,
 * loaded only when a HEIC actually appears, reads it everywhere. The result
 * still goes through the canvas pass below for sizing, so nothing else changes.
 */
async function heicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const blob = Array.isArray(out) ? out[0] : out;
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

/** Whichever decoder can actually read this file, modern one first. */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await withTimeout(
      createImageBitmap(file, { imageOrientation: "from-image" }),
      FIRST_DECODER_TIMEOUT_MS,
    );
  } catch {
    // Falling through on *any* failure, timeout included: the point is to try
    // the other decoder, and which way the first one failed doesn't change
    // that. If this one fails too the error reaches the caller.
    return withTimeout(decodeViaImgElement(file), DECODE_TIMEOUT_MS);
  }
}

/**
 * Re-encode to JPEG at max 1600px on the long edge, stepping quality down until
 * the file is around 300KB. Going through a canvas is also what converts an
 * iPhone HEIC capture into something every browser can render.
 */
export async function compressToJpeg(file: File): Promise<File> {
  // HEIC first, on any browser but Safari the canvas decoders below cannot read
  // it. This turns it into a JPEG they can, before the sizing pass.
  const readable = isHeic(file)
    ? await withTimeout(heicToJpeg(file), DECODE_TIMEOUT_MS)
    : file;
  const source = await decode(readable);
  const sourceWidth =
    source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const sourceHeight =
    source instanceof HTMLImageElement ? source.naturalHeight : source.height;

  const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(source, 0, 0, width, height);
  if (source instanceof ImageBitmap) source.close();

  let blob: Blob | null = null;
  for (const quality of QUALITY_STEPS) {
    blob = await withTimeout(toBlob(canvas, quality), DECODE_TIMEOUT_MS);
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  if (!blob) throw new Error("Could not encode that image");

  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

export function formatKb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

export function decodeMessage(error: unknown): string {
  // A photo that never came back is almost always a library HEIC the browser
  // won't decode, so point at the camera rather than saying "try again" about
  // something that will fail the same way twice.
  if (error instanceof DecodeTimeout) {
    return "That photo took too long to read. Take a new one with the camera instead of picking it from the library.";
  }
  return "Couldn't read that photo. Try taking it again.";
}
