import { describe, expect, it } from 'vitest';
import { SettleTracker, heightMeters, pieceIdForIndex } from './logic';
import { ANIMALS, BUS } from './pieces';

describe('pieceIdForIndex', () => {
  it('gives the bus first and never again', () => {
    expect(pieceIdForIndex(1, () => 0.5)).toBe(BUS.id);
    for (const n of [2, 10, 11, 20, 100]) expect(pieceIdForIndex(n, () => 0.5)).not.toBe(BUS.id);
  });
  it('covers every animal', () => {
    const ids = new Set<string>();
    for (let i = 0; i < ANIMALS.length; i++) ids.add(pieceIdForIndex(2, () => (i + 0.5) / ANIMALS.length));
    expect(ids.size).toBe(ANIMALS.length);
    expect(pieceIdForIndex(9, () => 0.9999999)).toBe(ANIMALS[ANIMALS.length - 1].id);
  });
  it('never repeats the previous animal, counting colour variants as the same animal', () => {
    const kind = (id: string) => ANIMALS.find((a) => a.id === id)!.kind ?? id;
    for (const prev of ANIMALS) {
      for (let k = 0; k < 20; k++) expect(kind(pieceIdForIndex(5, () => k / 20, prev.id))).not.toBe(kind(prev.id));
    }
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
