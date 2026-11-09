import { describe, expect, it } from 'vitest';
import { PieceBag, SettleTracker, formatHeight, heightMeters, shuffle } from './logic';
import { ANIMALS, BUS } from './pieces';

describe('PieceBag', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  it('starts every lap with the bus, then every animal once in a shuffled order', () => {
    const bag = new PieceBag(rand);
    const lap = ANIMALS.length + 1;
    const ids = Array.from({ length: lap * 3 }, () => bag.next());
    for (let l = 0; l < 3; l++) {
      const part = ids.slice(l * lap, (l + 1) * lap);
      expect(part[0]).toBe(BUS.id);
      expect([...part.slice(1)].sort()).toEqual(ANIMALS.map((a) => a.id).sort());
    }
    // Each lap is shuffled anew.
    expect(ids.slice(1, lap)).not.toEqual(ids.slice(lap + 1, 2 * lap));
  });
  it('a new bag (a new game) starts over with the bus', () => {
    const bag = new PieceBag(rand);
    bag.next();
    bag.next();
    expect(new PieceBag(rand).next()).toBe(BUS.id);
  });
  it('shuffle keeps every item exactly once', () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect([...shuffle(items, () => 0.999)].sort()).toEqual(items);
    expect([...shuffle(items, () => 0)].sort()).toEqual(items);
  });
});

describe('heightMeters', () => {
  it('converts pixels to metres with two decimals', () => {
    expect(heightMeters(0)).toBe(0);
    expect(heightMeters(-10)).toBe(0);
    expect(heightMeters(125)).toBe(2.5);
    expect(heightMeters(126.9)).toBe(2.53);
  });
  it('shows one decimal, cut off', () => {
    expect(formatHeight(2.53)).toBe('2.5');
    expect(formatHeight(9.96)).toBe('9.9');
    expect(formatHeight(4.2)).toBe('4.2');
    expect(formatHeight(0)).toBe('0.0');
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
