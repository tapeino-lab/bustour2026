import { describe, expect, it } from 'vitest';
import { Game, MAX_FALL_SPEED, SPAWN_GAP } from './game';
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

  it('limits the fall speed until the piece lands', () => {
    const g = new Game(seeded(), 700);
    g.start();
    const piece = g.current!;
    g.drop();
    let maxVy = 0;
    for (let i = 0; i < 40; i++) {
      g.step();
      maxVy = Math.max(maxVy, piece.velocityY);
    }
    expect(maxVy).toBeLessThanOrEqual(MAX_FALL_SPEED + 0.3);
    expect(maxVy).toBeGreaterThan(MAX_FALL_SPEED * 0.8);
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
