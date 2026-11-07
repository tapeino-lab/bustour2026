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

describe('spawn effect', () => {
  it('pops the new piece out of a smoke cloud', async () => {
    const { APPEAR_FRAMES, POOF_FRAMES } = await import('./game');
    const g = new Game(seeded(), 700);
    g.start();
    expect(g.appearScale).toBeLessThan(0.5);
    expect(g.poofProgress).toBe(0);
    let peak = 0;
    for (let i = 0; i < APPEAR_FRAMES; i++) {
      g.step();
      peak = Math.max(peak, g.appearScale);
    }
    expect(peak).toBeGreaterThan(1);
    expect(g.appearScale).toBe(1);
    for (let i = APPEAR_FRAMES; i < POOF_FRAMES; i++) g.step();
    expect(g.poofProgress).toBeNull();
  });
});

describe('best height', () => {
  it('records the highest settled tower and reports it at game over', () => {
    const g = new Game(seeded(), 700);
    let reported: [number, number] | null = null;
    let tower = '';
    g.onGameOver = (s, h, t) => {
      reported = [s, h];
      tower = t;
    };
    g.start();
    g.drop();
    for (let i = 0; i < 900 && g.state === 'drop'; i++) g.step();
    expect(g.bestHeight).toBeGreaterThan(0);
    expect(g.bestHeight).toBe(g.heightM);
    const settled = g.bestHeight;
    // Drop the next piece off the platform to end the game.
    g.pointerDown(180);
    g.pointerMove(180 - 175);
    g.pointerUp();
    for (let i = 0; i < 2000 && g.state !== 'over'; i++) g.step();
    expect(g.state).toBe('over');
    expect(reported).toEqual([1, settled]);
    // The snapshot is the tower as it last stood: one piece, not the one that fell.
    expect(tower.startsWith('v1|')).toBe(true);
    expect(tower.split(';')).toHaveLength(1);
  });
});

describe('game over timing', () => {
  it('ends only when a free-falling piece reaches the bottom edge of the screen', () => {
    const viewH = 700;
    const g = new Game(seeded(), viewH);
    g.start();
    // Throw the first piece off the side of the platform.
    g.pointerDown(180);
    g.pointerMove(5);
    g.pointerUp();
    const piece = g.pieces[0];
    const screenBottom = GROUND_TOP - (viewH - 190) + viewH; // camera at its start position
    let lastMaxY = -Infinity;
    for (let i = 0; i < 2000 && g.state === 'drop'; i++) {
      lastMaxY = piece.bounds.maxY;
      g.step();
    }
    expect(g.state === 'falling' || g.state === 'over').toBe(true);
    // Still above the bottom edge one step earlier, at or past it now.
    expect(lastMaxY).toBeLessThan(screenBottom);
    expect(piece.bounds.maxY).toBeGreaterThanOrEqual(screenBottom);
    expect(piece.touching).toBe(false);
  });
});
