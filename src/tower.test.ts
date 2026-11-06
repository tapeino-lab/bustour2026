import { describe, expect, it } from 'vitest';
import { ALL_PIECES } from './pieces';
import { PieceBody } from './physics';
import { decodeTower, encodeTower, MAX_TOWER_LENGTH, towerBodies } from './tower';

describe('tower snapshots', () => {
  it('round-trips pieces, positions and angles', () => {
    const pieces = ALL_PIECES.slice(0, 3).map((def, i) => {
      const p = new PieceBody(def);
      p.setPose(100 + i * 10.04, -20.26 * i, 0.78539 * i);
      return p;
    });
    const s = encodeTower(pieces);
    const back = decodeTower(s)!;
    expect(back.map((t) => t.id)).toEqual(pieces.map((p) => p.def.id));
    back.forEach((t, i) => {
      expect(t.x).toBeCloseTo(pieces[i].x, 1);
      expect(t.y).toBeCloseTo(pieces[i].y, 1);
      expect(t.angle).toBeCloseTo(pieces[i].angle, 3);
    });
    const bodies = towerBodies(back);
    expect(bodies[2].angle).toBeCloseTo(pieces[2].angle, 3);
  });

  it('keeps a 50-piece tower well under the size limit', () => {
    const many = Array.from({ length: 50 }, () => {
      const p = new PieceBody(ALL_PIECES[1]);
      p.setPose(-123.4, -2345.6, -3.141);
      return p;
    });
    expect(encodeTower(many).length).toBeLessThan(MAX_TOWER_LENGTH / 4);
  });

  it('rejects bad or foreign data', () => {
    expect(decodeTower(undefined)).toBeNull();
    expect(decodeTower('v2|cat,1,2,3')).toBeNull();
    expect(decodeTower('v1|nosuchanimal,1,2,3')).toBeNull();
    expect(decodeTower('v1|cat,1,NaN,3')).toBeNull();
    expect(decodeTower('v1|cat,1')).toBeNull();
    expect(decodeTower('v1|')).toEqual([]);
  });
});
