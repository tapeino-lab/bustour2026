import { describe, expect, it } from 'vitest';
import { FREE_FALL_GRAVITY, Game, SPAWN_GAP } from './game';
import { GROUND_TOP, towerTop } from './physics';

function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('Game', () => {
  it('spawns a piece a little above the tower top', () => {
    const g = new Game(seeded(), 700);
    g.start();
    const b = g.current!;
    expect(b.bounds.maxY).toBeLessThanOrEqual(GROUND_TOP - SPAWN_GAP + 0.01);
    expect(b.bounds.maxY).toBeGreaterThan(GROUND_TOP - SPAWN_GAP - 150);
  });

  it('spawns the next piece relative to the new tower top', () => {
    const g = new Game(seeded(), 700);
    g.start();
    g.drop();
    for (let i = 0; i < 900 && g.state === 'drop'; i++) g.step();
    expect(g.state).toBe('aim');
    const top = towerTop(g.pieces);
    expect(g.current!.bounds.maxY).toBeLessThanOrEqual(top - SPAWN_GAP + 0.01);
    expect(g.current!.bounds.maxY).toBeGreaterThan(top - SPAWN_GAP - 150);
  });

  it('falls with gentle, increasing speed until it lands, then gets full gravity back', () => {
    const g = new Game(seeded(), 700);
    g.start();
    const piece = g.current!;
    g.drop();
    const vs: number[] = [];
    for (let i = 0; i < 10; i++) {
      g.step();
      vs.push(piece.velocityY);
    }
    for (let i = 1; i < vs.length; i++) expect(vs[i]).toBeGreaterThan(vs[i - 1]);
    const fullGravityPerStep = 1000 / 3600;
    expect(vs[9]).toBeGreaterThan(10 * fullGravityPerStep * FREE_FALL_GRAVITY * 0.8);
    expect(vs[9]).toBeLessThan(10 * fullGravityPerStep * FREE_FALL_GRAVITY * 1.2);
    for (let i = 0; i < 900 && g.state === 'drop'; i++) g.step();
    expect(piece.body!.getGravityScale()).toBe(1);
  });

  it('draws a just-dropped piece where it is, not blended from an old pose', () => {
    const g = new Game(seeded(), 700);
    g.start();
    g.pointerDown(180);
    g.pointerMove(240);
    g.rotate();
    const piece = g.current!;
    g.pointerUp();
    for (const alpha of [0, 0.5, 1]) {
      const pose = piece.drawPose(alpha);
      expect(pose.x).toBeCloseTo(piece.x, 6);
      expect(pose.y).toBeCloseTo(piece.y, 6);
      expect(pose.angle).toBeCloseTo(piece.angle, 6);
    }
  });

  it('does not drop when the drag is cancelled', () => {
    const g = new Game(seeded(), 700);
    g.start();
    g.pointerDown(180);
    g.pointerMove(220);
    g.cancelDrag();
    g.pointerUp();
    for (let i = 0; i < 30; i++) g.step();
    expect(g.state).toBe('aim');
    expect(g.pieces.length).toBe(0);
  });
});
