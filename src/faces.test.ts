import { describe, expect, it } from 'vitest';
import { enhanceFace } from './faces';

/** A w×w test photo: a round "face" of one grey in the middle on a background grey, plus noise. */
function photo(w: number, face: number, back: number, spread = 0): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * w * 4);
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inFace = (x - w / 2) ** 2 + (y - w / 2) ** 2 < (w * 0.3) ** 2;
      const v = (inFace ? face : back) + (((x * 7 + y * 13) % 5) - 2) * spread;
      d[i] = v;
      d[i + 1] = v * 0.9;
      d[i + 2] = v * 0.8;
      d[i + 3] = 255;
    }
  }
  return d;
}

const centreMean = (d: Uint8ClampedArray, w: number) => {
  let sum = 0;
  let n = 0;
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      if ((x - w / 2) ** 2 + (y - w / 2) ** 2 > (w * 0.45) ** 2) continue;
      const i = (y * w + x) * 4;
      sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      n++;
    }
  }
  return sum / n / 255;
};

describe('enhanceFace', () => {
  it('brings dark and bright photos to about the same brightness', () => {
    const dark = photo(40, 50, 20, 3);
    const bright = photo(40, 235, 200, 3);
    enhanceFace(dark, 40, 40);
    enhanceFace(bright, 40, 40);
    expect(Math.abs(centreMean(dark, 40) - centreMean(bright, 40))).toBeLessThan(0.15);
    expect(centreMean(dark, 40)).toBeGreaterThan(0.35);
  });
  it('stretches a dull photo to more contrast', () => {
    const dull = photo(40, 140, 110, 2);
    const before = [dull[(20 * 40 + 20) * 4], dull[(2 * 40 + 2) * 4]];
    enhanceFace(dull, 40, 40);
    const after = [dull[(20 * 40 + 20) * 4], dull[(2 * 40 + 2) * 4]];
    expect(after[0] - after[1]).toBeGreaterThan((before[0] - before[1]) * 2);
  });
  it('leaves the alpha channel alone', () => {
    const d = photo(10, 100, 50);
    d[3] = 7;
    enhanceFace(d, 10, 10);
    expect(d[3]).toBe(7);
  });
});
