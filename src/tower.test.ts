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
      expect(t.poses[0].x).toBeCloseTo(pieces[i].x, 1);
      expect(t.poses[0].y).toBeCloseTo(pieces[i].y, 1);
      expect(t.poses[0].angle).toBeCloseTo(pieces[i].angle, 3);
    });
    const bodies = towerBodies(back);
    expect(bodies[2].angle).toBeCloseTo(pieces[2].angle, 3);
  });

  it('keeps each segment of a soft piece', () => {
    const soft = new PieceBody(ALL_PIECES.find((d) => d.id === 'axolotl')!);
    expect(soft.segments).toBe(7);
    soft.setPose(100, -50, 0);
    soft.setSegPose(2, { x: 104, y: -46, angle: 0.3 });
    const [back] = towerBodies(decodeTower(encodeTower([soft]))!);
    expect(back.segPose(0).x).toBeCloseTo(100, 1);
    expect(back.segPose(2).y).toBeCloseTo(-46, 1);
    expect(back.segPose(2).angle).toBeCloseTo(0.3, 3);
  });

  it('draws older axolotl records (fewer segments) with their bends', () => {
    const pose = (x: number, a: number) => `${x},-50,${a}`;
    // 5 segments: head, body, tail, front leg, back leg (before the knees were added).
    const [five] = towerBodies(decodeTower(`v1|axolotl,${[pose(1, 0), pose(2, 0.1), pose(3, 0.2), pose(4, 0.3), pose(5, 0.4)].join(',')}`)!);
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => five.segPose(i).angle)).toEqual([0, 0.1, 0.2, 0.3, 0.3, 0.4, 0.4]);
    // 6 segments: head, front body, back body, tail, front leg, back leg.
    const [six] = towerBodies(decodeTower(`v1|axolotl,${[0, 1, 2, 3, 4, 5].map((i) => pose(i, i / 10)).join(',')}`)!);
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => six.segPose(i).angle)).toEqual([0, 0.1, 0.3, 0.4, 0.4, 0.5, 0.5]);
    // 3 segments: head, body, tail; legs follow the body.
    const [three] = towerBodies(decodeTower(`v1|axolotl,${[0, 1, 2].map((i) => pose(i, i / 10)).join(',')}`)!);
    expect(three.segPose(6).angle).toBe(0.1);
    expect(three.segPose(2).x).toBe(2);
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
    expect(decodeTower('v1|cat,1,2,3,4')).toBeNull();
    expect(decodeTower('v1|')).toEqual([]);
  });
});
