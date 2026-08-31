/** Client-side photo preparation: phone camera files are far too big to store as-is. */

export const MAX_INPUT_MB = 25;
const MAX_EDGE = 1600;
const QUALITY = 0.82;

export class ImageError extends Error {
  constructor(key, vars) {
    super(key);
    this.key = key;
    this.vars = vars;
  }
}

/**
 * Resize + re-encode to JPEG. Returns { blob, width, height, preview }.
 * `preview` is an object URL the caller must revoke when done.
 */
export async function prepareImage(file) {
  if (!file || !file.type?.startsWith('image/')) throw new ImageError('gallery.notImage');
  if (file.size > MAX_INPUT_MB * 1024 * 1024)
    throw new ImageError('gallery.tooLarge', { n: MAX_INPUT_MB });

  // `from-image` applies the EXIF rotation phones write, so portrait shots
  // do not come out sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() =>
    loadViaImg(file),
  );

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', QUALITY));
  if (!blob) throw new ImageError('gallery.notImage');
  return { blob, width: w, height: h, preview: URL.createObjectURL(blob) };
}

function loadViaImg(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      res(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new ImageError('gallery.notImage'));
    };
    img.src = url;
  });
}

/** data: URL -> Blob, used by the one-time migration from the old tracker. */
export async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}
