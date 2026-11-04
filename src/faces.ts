import type { FaceImages } from './render';

/**
 * Face photos per piece id. Put images in public/faces/ and list them here, e.g.
 *   elephant: 'faces/elephant.png',
 * Pieces without an entry show a dummy face.
 */
export const FACE_IMAGES: Record<string, string> = {};

export function loadFaces(): FaceImages {
  const faces: FaceImages = new Map();
  for (const [id, path] of Object.entries(FACE_IMAGES)) {
    const img = new Image();
    img.onload = () => faces.set(id, img);
    img.src = `${import.meta.env.BASE_URL}${path}`;
  }
  return faces;
}
