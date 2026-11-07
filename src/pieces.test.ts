import { describe, expect, it } from 'vitest';
import { ALL_PIECES, ANIMALS, BUS } from './pieces';
import { PieceBody, Physics, shapeOutline } from './physics';

function isConvex(pts: [number, number][]): boolean {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const [cx, cy] = pts[(i + 2) % pts.length];
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(cross) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

describe('pieces', () => {
  it('has 17 distinct animals and plants (3 cats, 2 sloths) and a bus', () => {
    expect(ANIMALS).toHaveLength(17);
    expect(new Set(ALL_PIECES.map((p) => p.id)).size).toBe(18);
    expect(BUS.id).toBe('bus');
  });

  it('gives every animal, and the bus driver, a face spot', () => {
    for (const a of [...ANIMALS, BUS]) expect(a.face?.r, a.id).toBeGreaterThan(5);
  });

  it('uses only convex outlines of at most 12 vertices', () => {
    for (const p of ALL_PIECES) {
      for (const s of p.parts) {
        if (s.kind === 'circle' && s.exact) continue; // a true circle in physics
        const pts = shapeOutline(s);
        expect(isConvex(pts), `${p.id}`).toBe(true);
        expect(pts.length).toBeLessThanOrEqual(12);
      }
    }
  });

  it('builds a body with one fixture per part and maps local coordinates by the pose', () => {
    const physics = new Physics();
    for (const def of ALL_PIECES) {
      const p = new PieceBody(def, 100, 50);
      physics.add(p);
      let fixtures = 0;
      for (const b of p.bodies) {
        for (let f = b.getFixtureList(); f; f = f.getNext()) fixtures++;
        expect(b.getMass()).toBeGreaterThan(0);
      }
      expect(fixtures).toBe(def.parts.length);
      const o = p.localToWorld(0, 0);
      expect(o.x).toBeCloseTo(100, 6);
      expect(o.y).toBeCloseTo(50, 6);
      p.setPose(100, 50, Math.PI / 2);
      const after = p.localToWorld(10, 0);
      expect(after.x - 100).toBeCloseTo(0, 6);
      expect(after.y - 50).toBeCloseTo(10, 6);
    }
  });
});
