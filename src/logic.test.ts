import { describe, expect, it } from 'vitest';
import { SettleTracker, heightMeters, pieceIdForIndex } from './logic';
import { ANIMALS, BUS } from './pieces';

describe('pieceIdForIndex', () => {
  it('gives the bus every 10th piece', () => {
    for (const n of [10, 20, 30, 100]) expect(pieceIdForIndex(n, () => 0.5)).toBe(BUS.id);
  });
  it('gives an animal otherwise, covering every animal', () => {
    const ids = new Set<string>();
    for (let i = 0; i < ANIMALS.length; i++) {
      const id = pieceIdForIndex(1, () => (i + 0.5) / ANIMALS.length);
      expect(id).not.toBe(BUS.id);
      ids.add(id);
    }
    expect(ids.size).toBe(20);
    expect(pieceIdForIndex(9, () => 0.9999999)).toBe(ANIMALS[19].id);
  });
});

describe('heightMeters', () => {
  it('converts pixels to metres with one decimal', () => {
    expect(heightMeters(0)).toBe(0);
    expect(heightMeters(-10)).toBe(0);
    expect(heightMeters(125)).toBe(2.5);
  });
});

describe('SettleTracker', () => {
  it('needs consecutive still frames', () => {
    const t = new SettleTracker(3, 100);
    const still = [{ speed: 0, angularSpeed: 0 }];
    const moving = [{ speed: 1, angularSpeed: 0 }];
    expect(t.update(still)).toBe(false);
    expect(t.update(still)).toBe(false);
    expect(t.update(moving)).toBe(false);
    t.update(still);
    t.update(still);
    expect(t.update(still)).toBe(true);
  });
  it('gives up waiting after the maximum frames', () => {
    const t = new SettleTracker(3, 5);
    const moving = [{ speed: 1, angularSpeed: 0 }];
    for (let i = 0; i < 4; i++) expect(t.update(moving)).toBe(false);
    expect(t.update(moving)).toBe(true);
  });
});
