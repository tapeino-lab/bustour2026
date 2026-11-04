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
  it('has 20 distinct animals and a bus', () => {
    expect(ANIMALS).toHaveLength(20);
    expect(new Set(ALL_PIECES.map((p) => p.id)).size).toBe(21);
    expect(BUS.id).toBe('bus');
  });

  it('gives every animal a face spot', () => {
    for (const a of ANIMALS) expect(a.face?.r).toBeGreaterThan(5);
  });

  it('uses only convex outlines of at most 12 vertices', () => {
    for (const p of ALL_PIECES) {
      for (const s of p.parts) {
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
      for (let f = p.body!.getFixtureList(); f; f = f.getNext()) fixtures++;
      expect(fixtures).toBe(def.parts.length);
      expect(p.body!.getMass()).toBeGreaterThan(0);
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
