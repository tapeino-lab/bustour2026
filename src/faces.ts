import { ALL_PIECES } from './pieces';
import type { FaceImages } from './render';

/**
 * Face photos per piece id, filled after the device has joined (see online.ts).
 * Photos are never stored in this (public) repository. Pieces without a photo show a dummy face.
 * Face photos are evened out for display (see enhanceFace); the stored photos stay untouched.
 */
export const faces: FaceImages = new Map();

/** Pieces drawn as a cut-out photo (like しげみ): shown as uploaded, not enhanced. */
const SPRITE_IDS = new Set(ALL_PIECES.filter((p) => p.sprite).map((p) => p.id));

/** How strongly a face photo is evened out, chosen per photo on the admin page. */
export type Enhance = 'none' | 'soft' | 'strong';
export const ENHANCE_LEVELS: Enhance[] = ['strong', 'soft', 'none'];
export const ENHANCE_LABELS: Record<Enhance, string> = { strong: 'つよめ', soft: 'よわめ', none: 'なし' };
/** Photos saved before the choice existed get the strong setting (what they had). */
export const DEFAULT_ENHANCE: Enhance = 'strong';
const ENHANCE_STRENGTH: Record<Enhance, number> = { strong: 1, soft: 0.5, none: 0 };

export interface FacePhoto {
  image: string;
  enhance?: Enhance;
}

export function setFaces(photos: Map<string, FacePhoto>): void {
  for (const [id, photo] of photos) {
    const img = new Image();
    img.onload = () => faces.set(id, SPRITE_IDS.has(id) ? img : enhancedFace(img, photo.enhance ?? DEFAULT_ENHANCE));
    img.src = photo.image;
  }
}

/** Target mean brightness (0–1) of the face area after enhancing. */
const TARGET_BRIGHTNESS = 0.58;
/** Colour boost (1 = unchanged) and sharpening strength (0 = none). */
const SATURATION = 1.25;
const SHARPEN = 1.0;
/** How much each colour is stretched on its own (1) rather than with the brightness (0). */
const COLOUR_BALANCE = 0.6;

/**
 * Evens out a face photo in place (RGBA pixels, w×h): measured on the round face area in the
 * middle (what the game shows), the darkest and brightest parts are stretched to full contrast,
 * the overall brightness is pulled to the same target for every photo, colours are boosted a
 * little and edges are sharpened, so dim or blurry photos look alike and crisp when small.
 * `strength` (0–1) blends between the photo as it is and the full effect.
 */
export function enhanceFace(data: Uint8ClampedArray, w: number, h: number, strength = 1): void {
  if (strength <= 0) return;
  const n = w * h;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];

  // Pixels of the face circle (ignoring the background in the corners).
  const circle: number[] = [];
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const r2 = (Math.min(w, h) * 0.45) ** 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) circle.push(y * w + x);
  /** Darkest and brightest (2% / 98%) of some values, at least 85 apart (no ×3+ stretch of flat images). */
  const range = (values: number[]): [number, number] => {
    const v = [...values].sort((a, b) => a - b);
    const at = (q: number) => v[Math.min(v.length - 1, Math.floor(q * v.length))] ?? 0;
    let lo = at(0.02);
    let hi = at(0.98);
    if (hi - lo < 85) {
      const mid = (hi + lo) / 2;
      lo = Math.max(0, mid - 42.5);
      hi = Math.min(255, mid + 42.5);
    }
    return [lo, hi];
  };
  // Levels: mostly per colour (which also takes out a colour cast), partly by brightness.
  const [lo, hi] = range(circle.map((i) => lum[i]));
  const levels = [0, 1, 2].map((c) => {
    const [clo, chi] = range(circle.map((i) => data[i * 4 + c]));
    const t = new Float32Array(256);
    for (let v = 0; v < 256; v++) {
      const own = (v - clo) / (chi - clo);
      const shared = (v - lo) / (hi - lo);
      const stretched = Math.min(1, Math.max(0, COLOUR_BALANCE * own + (1 - COLOUR_BALANCE) * shared));
      t[v] = strength * stretched + (1 - strength) * (v / 255);
    }
    return t;
  });
  // Brightness: the face area's mean is pulled to the same target for every photo.
  let mean = 0;
  for (const i of circle) {
    mean += 0.299 * levels[0][data[i * 4]] + 0.587 * levels[1][data[i * 4 + 1]] + 0.114 * levels[2][data[i * 4 + 2]];
  }
  mean = circle.length ? mean / circle.length : 0.5;
  const gamma = Math.min(2.2, Math.max(0.45, Math.log(TARGET_BRIGHTNESS) / Math.log(Math.min(0.97, Math.max(0.03, mean))))) ** strength;
  const saturation = 1 + (SATURATION - 1) * strength;
  const sharpen = SHARPEN * strength;
  const luts = levels.map((t) => t.map((v) => 255 * v ** gamma));

  // Levels + brightness, then colour boost around each pixel's own grey.
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = luts[0][data[i * 4]];
    const g = luts[1][data[i * 4 + 1]];
    const b = luts[2][data[i * 4 + 2]];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    out[i * 3] = y + (r - y) * saturation;
    out[i * 3 + 1] = y + (g - y) * saturation;
    out[i * 3 + 2] = y + (b - y) * saturation;
  }

  // Sharpen (unsharp mask with a 5×5 box blur): edges stay clear when the photo is shown small.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let count = 0;
        for (let dy = -2; dy <= 2; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            sum += out[(yy * w + xx) * 3 + c];
            count++;
          }
        }
        const v = out[(y * w + x) * 3 + c];
        data[(y * w + x) * 4 + c] = v + (v - sum / count) * sharpen;
      }
    }
  }
}

/** An enhanced copy of a face photo, ready to draw. */
export function enhancedFace(img: HTMLImageElement, level: Enhance = DEFAULT_ENHANCE): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height);
  enhanceFace(px.data, c.width, c.height, ENHANCE_STRENGTH[level]);
  g.putImageData(px, 0, 0);
  return c;
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
