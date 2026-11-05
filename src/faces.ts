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
