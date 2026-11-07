import { describe, expect, it } from 'vitest';
import { Box, RevoluteJoint, Vec2 } from 'planck';
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
    const p = new PieceBody(def, left + 36, GROUND_TOP - 40);
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

  it('axolotl legs only bend outwards while falling, then mostly outwards once landed', () => {
    const physics = new Physics();
    const def = ALL_PIECES.find((p) => p.id === 'axolotl')!;
    const p = new PieceBody(def, WORLD_WIDTH / 2, GROUND_TOP - 200);
    physics.add(p);
    // Front leg turns left (negative), back leg right (positive) relative to the body.
    const hipFront = () => p.segPose(3).angle - p.segPose(1).angle;
    const hipBack = () => p.segPose(5).angle - p.segPose(1).angle;
    for (let i = 0; i < 400 && !p.landed; i++) {
      physics.step();
      if (!p.landed) {
        expect(hipFront()).toBeLessThan(0.02);
        expect(hipBack()).toBeGreaterThan(-0.02);
      }
    }
    expect(p.landed).toBe(true);
    // Once landed the front hip turns far outwards (left) but only a little inwards.
    const hip = p.joints[3] as RevoluteJoint;
    expect(hip.getLowerLimit()).toBeCloseTo(-2.6);
    expect(hip.getUpperLimit()).toBeCloseTo(0.25);
  });

  it('a landed soft piece calms down quickly instead of jiggling on', () => {
    const physics = new Physics();
    const def = ALL_PIECES.find((p) => p.id === 'axolotl')!;
    const p = new PieceBody(def, WORLD_WIDTH / 2, GROUND_TOP - 200);
    physics.add(p);
    // Every segment, legs and tail included, is still within 3 seconds.
    const tracker = new SettleTracker(24, 100000, 0.15, 0.008);
    let settledAt = -1;
    for (let i = 0; i < 180 && settledAt < 0; i++) {
      physics.step();
      const motions = p.bodies.map((b) => {
        const v = b.getLinearVelocity();
        // 30 px per metre (PX in physics.ts).
        return { speed: (Math.hypot(v.x, v.y) * 30) / 60, angularSpeed: Math.abs(b.getAngularVelocity()) / 60 };
      });
      if (tracker.update(motions)) settledAt = i;
    }
    expect(settledAt).toBeGreaterThan(0);
    // Frozen, it is an ordinary rigid piece again (normal damping).
    physics.freeze(p);
    expect(p.bodies[0].getAngularDamping()).toBeLessThan(1);
  });

  it('a frozen soft piece keeps its shape even with weight on it', () => {
    const physics = new Physics();
    const def = ALL_PIECES.find((p) => p.id === 'axolotl')!;
    const p = new PieceBody(def, WORLD_WIDTH / 2, GROUND_TOP - 40);
    physics.add(p);
    for (let i = 0; i < 300; i++) physics.step();
    physics.freeze(p);
    expect(p.frozen).toBe(true);
    const rel = () => Array.from({ length: p.segments }, (_, i) => p.segPose(i).angle - p.segPose(1).angle);
    const before = rel();
    // Drop something heavy right on it.
    const bus = new PieceBody(ALL_PIECES.find((d) => d.id === 'bus')!, WORLD_WIDTH / 2, GROUND_TOP - 140);
    physics.add(bus);
    for (let i = 0; i < 300; i++) physics.step();
    rel().forEach((r, i) => expect(Math.abs(r - before[i])).toBeLessThan(0.005));
    expect(p.bodies).toHaveLength(1);
  });
});

