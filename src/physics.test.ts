import { describe, expect, it } from 'vitest';
import { Box, Vec2 } from 'planck';
import { SettleTracker } from './logic';
import { ALL_PIECES, type PieceDef } from './pieces';
import { GROUND_TOP, PIECE_OUTLINE, PLATFORM_OUTLINE, PieceBody, Physics, WORLD_WIDTH, hasFallen } from './physics';

const PX = 30;

function dropAndRun(id: string, x: number, frames: number, height = 150) {
  const physics = new Physics();
  const def = ALL_PIECES.find((p) => p.id === id)!;
  const p = new PieceBody(def, x, GROUND_TOP - height);
  physics.add(p);
  const tracker = new SettleTracker(40, 100000);
  let settledAt = -1;
  for (let i = 0; i < frames; i++) {
    physics.step();
    if (settledAt < 0 && tracker.update([{ speed: p.speed, angularSpeed: p.angularSpeed }])) settledAt = i;
  }
  return { p, settledAt };
}

const block: PieceDef = {
  id: 'block', name: 'block',
  parts: [{ kind: 'rect', x: 0, y: 0, w: 60, h: 40, color: '#000' }],
};

describe('physics', () => {
  it.each(ALL_PIECES.map((p) => p.id))('%s lands on the platform and settles', (id) => {
    const { p, settledAt } = dropAndRun(id, WORLD_WIDTH / 2, 900);
    expect(hasFallen(p)).toBe(false);
    expect(settledAt).toBeGreaterThan(0);
    expect(p.bounds.maxY).toBeLessThan(GROUND_TOP + 2);
  });

  it('detects a piece dropped beside the platform as fallen', () => {
    const { p } = dropAndRun('capybara', 10, 120);
    expect(hasFallen(p)).toBe(true);
  });

  it.each([10, 20, 30, 40])('does not slide at all on a %i° slope', (deg) => {
    const physics = new Physics();
    const a = (deg * Math.PI) / 180;
    const ramp = physics.world.createBody({ type: 'static', position: new Vec2(0, -1000 / PX), angle: a });
    ramp.createFixture(new Box(300 / PX, 10 / PX), { friction: 1.2 });
    const p = new PieceBody(block, Math.sin(a) * 30.2, -1000 - Math.cos(a) * 30.2);
    p.setPose(p.x, p.y, a);
    physics.add(p);
    for (let i = 0; i < 30; i++) physics.step();
    const x = p.x;
    for (let i = 0; i < 600; i++) physics.step();
    expect(Math.abs(p.x - x)).toBeLessThan(0.5);
  });

  it.each([
    [0.45, false],
    [0.55, true],
    [0.7, true],
  ])('a block hanging %f over the platform edge falls: %s', (over, falls) => {
    const physics = new Physics();
    const edge = WORLD_WIDTH / 2 + 115;
    const p = new PieceBody(block, edge + 60 * (over - 0.5), GROUND_TOP - 20.2);
    physics.add(p);
    for (let i = 0; i < 600; i++) physics.step();
    expect(hasFallen(p)).toBe(falls);
  });

  it('rests so that the drawn outlines just touch (no visible overlap or gap)', () => {
    const physics = new Physics();
    const lower = new PieceBody(block, WORLD_WIDTH / 2, GROUND_TOP - 40);
    const upper = new PieceBody(block, WORLD_WIDTH / 2, GROUND_TOP - 100);
    physics.add(lower);
    physics.add(upper);
    for (let i = 0; i < 600; i++) physics.step();
    // Outline bottom of the lower block vs the outline top of the platform.
    const groundGap = GROUND_TOP - PLATFORM_OUTLINE - (lower.bounds.maxY + PIECE_OUTLINE);
    // Outline bottom of the upper block vs the outline top of the lower block.
    const stackGap = lower.bounds.minY - PIECE_OUTLINE - (upper.bounds.maxY + PIECE_OUTLINE);
    expect(Math.abs(groundGap)).toBeLessThan(0.6);
    expect(Math.abs(stackGap)).toBeLessThan(0.6);
  });

  it('the soft axolotl sags over an edge, then comes to rest', () => {
    const physics = new Physics();
    const def = ALL_PIECES.find((p) => p.id === 'axolotl')!;
    // Body on the platform, head sticking out past the left edge.
    const left = WORLD_WIDTH / 2 - 115;
    const p = new PieceBody(def, left + 26, GROUND_TOP - 40);
    physics.add(p);
    const tracker = new SettleTracker(40, 100000);
    let settledAt = -1;
    for (let i = 0; i < 900; i++) {
      physics.step();
      if (settledAt < 0 && tracker.update([{ speed: p.speed, angularSpeed: p.angularSpeed }])) settledAt = i;
    }
    const bend = Math.abs(p.segPose(0).angle - p.segPose(1).angle);
    expect(bend).toBeGreaterThan(0.03);
    expect(settledAt).toBeGreaterThan(0);
  });
});
