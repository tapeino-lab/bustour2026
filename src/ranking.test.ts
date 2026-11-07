import { describe, expect, it } from 'vitest';
import { DUMMY_ROWS, topRows } from './ranking';
import { isValidName } from './names';

describe('rankings with dummies', () => {
  it('uses valid three-letter hiragana names for the dummies', () => {
    for (const d of DUMMY_ROWS) expect(isValidName(d.name), d.name).toBe(true);
  });
  it('fills an empty board with ten dummies, best first', () => {
    const rows = topRows([], 'height');
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => r.dummy)).toBe(true);
    expect(rows.map((r) => r.height)).toEqual([...rows.map((r) => r.height)].sort((a, b) => b - a));
  });
  it('puts real players in order and ahead of dummies on a tie', () => {
    const real = [
      { uid: 'a', name: 'ふじさ', count: 3, height: 5 },
      { uid: 'b', name: 'ぶどう', count: 12, height: 0.2 },
    ];
    const byCount = topRows(real, 'count');
    expect(byCount[0].uid).toBe('b');
    expect(byCount[1].uid).toBe('a');
    expect(byCount[1].dummy).toBeUndefined();
    const byHeight = topRows(real, 'height');
    expect(byHeight[0].uid).toBe('a');
    expect(byHeight.map((r) => r.uid)).not.toContain('b');
  });
  it('breaks ties by the other value, then by who set the record first', () => {
    const real = [
      { uid: 'late', name: 'おそい', count: 8, height: 4.21, countAt: 300, heightAt: 300 },
      { uid: 'low', name: 'ひくい', count: 8, height: 3.5, countAt: 100, heightAt: 100 },
      { uid: 'early', name: 'はやい', count: 8, height: 4.21, countAt: 200, heightAt: 200 },
      { uid: 'few', name: 'すこし', count: 7, height: 4.21, countAt: 50, heightAt: 50 },
    ];
    expect(topRows(real, 'count').slice(0, 4).map((r) => r.uid)).toEqual(['early', 'late', 'low', 'few']);
    expect(topRows(real, 'height').slice(0, 4).map((r) => r.uid)).toEqual(['early', 'late', 'few', 'low']);
  });
  it('keeps a real entry ahead of a dummy with the same values', () => {
    const d = DUMMY_ROWS[0];
    const rows = topRows([{ uid: 'r', name: 'ほんと', count: d.count, height: d.height }], 'count');
    expect(rows[0].uid).toBe('r');
  });
});
