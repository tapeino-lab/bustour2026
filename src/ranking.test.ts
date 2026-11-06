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
});
