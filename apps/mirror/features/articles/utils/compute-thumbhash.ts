import { rgbaToThumbHash } from "thumbhash";

const MAX_DIM = 100;

/**
 * Downscale an image File to <=100px on its longest side, then encode the
 * pixels as a base64 thumbhash. Returns the base64 string (NOT a data URL).
 *
 * Why 100px: thumbhash's reference impl downsamples this far server-side; any
 * larger and the encode is slower without payload benefit.
 */
export async function computeThumbhashFromFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(MAX_DIM / bitmap.width, MAX_DIM / bitmap.height, 1);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  const hashBytes = rgbaToThumbHash(w, h, data);

  // base64 encode
  let binary = "";
  for (const byte of hashBytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
