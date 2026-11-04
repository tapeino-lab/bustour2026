import { describe, expect, it } from 'vitest';
import Matter from 'matter-js';
import { ALL_PIECES, ANIMALS, BUS } from './pieces';
import { createPieceBody, localToWorld } from './physics';

describe('pieces', () => {
  it('has 20 distinct animals and a bus', () => {
    expect(ANIMALS).toHaveLength(20);
    expect(new Set(ALL_PIECES.map((p) => p.id)).size).toBe(21);
    expect(BUS.id).toBe('bus');
  });

  it('gives every animal a face spot', () => {
    for (const a of ANIMALS) expect(a.face?.r).toBeGreaterThan(5);
  });

  it('uses only convex polygons', () => {
    for (const p of ALL_PIECES) {
      for (const s of p.parts) {
        if (s.kind !== 'poly') continue;
        const verts = s.points.map(([x, y]) => ({ x, y }));
        expect(Matter.Vertices.isConvex(verts), `${p.id}`).toBe(true);
      }
    }
  });

  it('builds compound bodies whose local origin maps back correctly', () => {
    for (const def of ALL_PIECES) {
      const p = createPieceBody(def, 100, 50);
      expect(p.body.parts.length).toBe(def.parts.length + 1);
      expect(p.body.area).toBeGreaterThan(0);
      const o = localToWorld(p, 0, 0);
      expect(o.x).toBeCloseTo(100, 6);
      expect(o.y).toBeCloseTo(50, 6);
      Matter.Body.setAngle(p.body, Math.PI / 2);
      const after = localToWorld(p, 10, 0);
      const origin = localToWorld(p, 0, 0);
      expect(after.x - origin.x).toBeCloseTo(0, 6);
      expect(after.y - origin.y).toBeCloseTo(10, 6);
    }
  });
});
