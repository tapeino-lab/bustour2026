import type { FaceImages } from './render';

/**
 * Face photos per piece id, filled after the device has joined (see online.ts).
 * Photos are never stored in this (public) repository. Pieces without a photo show a dummy face.
 */
export const faces: FaceImages = new Map();

export function setFaces(images: Map<string, string>): void {
  for (const [id, src] of images) {
    const img = new Image();
    img.onload = () => faces.set(id, img);
    img.src = src;
  }
}

/** Center-crops an image file to a square JPEG data URL (small enough for Firestore). */
export async function fileToFaceJpeg(file: File, size = 160, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  g.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return c.toDataURL('image/jpeg', quality);
}

/**
 * Shrinks a cut-out photo (transparent background) to a PNG data URL, keeping its transparency
 * and aspect ratio. Gets smaller until it fits the Firestore size limit.
 */
export async function fileToSpritePng(file: File, maxH = 300, limit = 190000): Promise<string> {
  const bitmap = await createImageBitmap(file);
  let h = Math.min(maxH, bitmap.height);
  let url: string;
  for (;;) {
    const w = Math.max(1, Math.round((bitmap.width * h) / bitmap.height));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    url = c.toDataURL('image/png');
    if (url.length < limit || h <= 60) break;
    h = Math.round(h * 0.85);
  }
  bitmap.close();
  return url;
}
