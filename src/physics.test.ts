import { describe, expect, it } from 'vitest';
import Matter from 'matter-js';
import { SettleTracker } from './logic';
import { ALL_PIECES } from './pieces';
import { GROUND_TOP, WORLD_WIDTH, createEngine, createPieceBody, hasFallen } from './physics';

const STEP = 1000 / 60;

function dropAndRun(id: string, x: number, frames: number) {
  const { engine } = createEngine();
  const def = ALL_PIECES.find((p) => p.id === id)!;
  const p = createPieceBody(def, 0, 0);
  Matter.Body.setPosition(p.body, { x, y: GROUND_TOP - 150 });
  Matter.Composite.add(engine.world, p.body);
  const tracker = new SettleTracker(40, 100000);
  let settledAt = -1;
  for (let i = 0; i < frames; i++) {
    Matter.Engine.update(engine, STEP);
    if (settledAt < 0 && tracker.update([{ speed: p.body.speed, angularSpeed: p.body.angularSpeed }])) settledAt = i;
  }
  return { p, settledAt };
}

describe('physics', () => {
  it.each(ALL_PIECES.map((p) => p.id))('%s lands on the platform and settles', (id) => {
    const { p, settledAt } = dropAndRun(id, WORLD_WIDTH / 2, 900);
    expect(hasFallen(p.body)).toBe(false);
    expect(settledAt).toBeGreaterThan(0);
    expect(p.body.bounds.max.y).toBeLessThan(GROUND_TOP + 2);
  });

  it('detects a piece dropped beside the platform as fallen', () => {
    const { p } = dropAndRun('bear', 10, 120);
    expect(hasFallen(p.body)).toBe(true);
  });
});
