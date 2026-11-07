import { Box, Circle, Polygon, RevoluteJoint, Vec2, WeldJoint, World, type Body, type Joint } from 'planck';
import { segmentCount, type PieceDef, type Shape } from './pieces';

// All values outside this file are in logical pixels and "per step" (1/60 s) units,
// y pointing down. planck.js works in metres and seconds internally.

export const WORLD_WIDTH = 360;
export const GROUND_TOP = 0;
export const PLATFORM_WIDTH = 230;
/** Thickness of the platform (the green strip); there is nothing below it. */
export const PLATFORM_DEPTH = 12;
/**
 * A piece whose lowest point is this far below the platform's underside has fallen off:
 * the platform is only a thin strip, so nothing down there can hold it any more.
 */
export const FALL_MARGIN = 8;
export const STEP_SEC = 1 / 60;

/** Pixels per metre. Keeps pieces around 1–4 m, the range Box2D-style engines like best. */
const PX = 30;
/**
 * Width of the ink outline drawn outside every piece shape, in px. Pieces collide with this
 * outline included (a rounded skin around the polygon), so touching pieces look touching.
 */
export const PIECE_OUTLINE = 3;
/** The platform's outline sticks out half its 3px line width. */
export const PLATFORM_OUTLINE = 1.5;
/** Skin of parts drawn without an outline (Box2D's usual thin polygon skin), px. */
const THIN_SKIN = 0.3;

/** Gives a polygon a rounded skin of `px` pixels, the same shape a round-joined stroke draws. */
function withSkin<T extends { m_radius: number }>(shape: T, px: number): T {
  shape.m_radius = px / PX;
  return shape;
}
/** Gravity in px/s² (same feel as before). */
const GRAVITY = 1000;
/** High friction so pieces stick instead of sliding (a slope must exceed ~50° to slide). */
const FRICTION = 1.2;
const DENSITY = 1;
/** Air damping on pieces: steadier landings and calmer towers. */
const LINEAR_DAMPING = 0.1;
const ANGULAR_DAMPING = 0.1;
/** Circles are slightly faceted so round animals do not roll forever. */
const CIRCLE_SIDES = 10;
/** Points per corner when approximating a rounded rectangle (max 12 vertices per polygon). */
const CORNER_POINTS = 3;

type Pt = [number, number];

/** Outline of a shape as a convex polygon in local pixel coordinates. */
export function shapeOutline(s: Shape): Pt[] {
  switch (s.kind) {
    case 'rect': {
      const hw = s.w / 2;
      const hh = s.h / 2;
      const r = Math.min(s.round ?? 0, hw, hh);
      if (r <= 0.5) {
        return [[s.x - hw, s.y - hh], [s.x + hw, s.y - hh], [s.x + hw, s.y + hh], [s.x - hw, s.y + hh]];
      }
      const pts: Pt[] = [];
      const corners: [number, number, number][] = [
        [s.x + hw - r, s.y + hh - r, 0],
        [s.x - hw + r, s.y + hh - r, Math.PI / 2],
        [s.x - hw + r, s.y - hh + r, Math.PI],
        [s.x + hw - r, s.y - hh + r, (3 * Math.PI) / 2],
      ];
      for (const [cx, cy, a0] of corners) {
        for (let i = 0; i < CORNER_POINTS; i++) {
          const a = a0 + ((Math.PI / 2) * i) / (CORNER_POINTS - 1);
          pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
        }
      }
      return pts;
    }
    case 'circle': {
      const pts: Pt[] = [];
      // Exact circles (wheels) are true circles in physics; these points only serve bounds.
      const sides = s.exact ? 24 : CIRCLE_SIDES;
      for (let i = 0; i < sides; i++) {
        const a = (Math.PI * 2 * i) / sides;
        pts.push([s.x + s.r * Math.cos(a), s.y + s.r * Math.sin(a)]);
      }
      return pts;
    }
    case 'poly':
      return s.points.map(([x, y]) => [x, y]);
  }
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Pose {
  x: number;
  y: number;
  angle: number;
}

/**
 * A piece. Before it is dropped it only has a pose (aiming / preview / tower snapshot);
 * once dropped it is backed by planck.js bodies: one per segment (most pieces have one).
 * All segments share the piece's local coordinates, so at rest they all sit at the same pose.
 */
export class PieceBody {
  /** One body per segment once the piece is in the world. */
  bodies: Body[] = [];
  /** Joints between segments (until the piece is frozen). */
  joints: Joint[] = [];
  /** True once the dropped piece has touched something (another piece or the platform). */
  landed = false;
  /** True once a soft piece has been locked into its current shape. */
  frozen = false;
  readonly segments: number;
  /** Poses while not in the world, per segment. */
  private poses: Pose[];
  /** Poses before the last physics step, for drawing between steps. */
  private prev: Pose[];
  /** Outline points per segment (local px). */
  private readonly outlines: Pt[][];
  private boundsCache: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  private boundsKey: number[] = [];

  constructor(
    readonly def: PieceDef,
    x = 0,
    y = 0,
  ) {
    this.segments = segmentCount(def);
    this.poses = Array.from({ length: this.segments }, () => ({ x, y, angle: 0 }));
    this.prev = this.poses.map((p) => ({ ...p }));
    this.outlines = Array.from({ length: this.segments }, (_, i) =>
      def.parts.filter((s) => (s.seg ?? 0) === i).flatMap(shapeOutline),
    );
  }

  /** The main body (segment 0), or null before the piece is dropped. */
  get body(): Body | null {
    return this.bodies[0] ?? null;
  }

  /** Once frozen: each segment's pose in segment 0's frame (segment 0 carries them all). */
  private rigid: Pose[] | null = null;

  setRigidOffsets(rel: Pose[]): void {
    this.rigid = rel;
  }

  /** Current pose of a segment. */
  segPose(i: number): Pose {
    if (this.rigid && i > 0) {
      const p = this.segPose(0);
      const r = this.rigid[i];
      const c = Math.cos(p.angle);
      const s = Math.sin(p.angle);
      return { x: p.x + r.x * c - r.y * s, y: p.y + r.x * s + r.y * c, angle: p.angle + r.angle };
    }
    const b = this.bodies[i];
    if (!b) return this.poses[i];
    const p = b.getPosition();
    return { x: p.x * PX, y: p.y * PX, angle: b.getAngle() };
  }

  /** Remembers the current poses; call right before each physics step. */
  savePrev(): void {
    for (let i = 0; i < this.segments; i++) this.prev[i] = this.segPose(i);
  }

  /** Pose of a segment to draw: between the previous and current step by `alpha` (0..1). */
  drawSegPose(i: number, alpha: number): Pose {
    if (this.rigid && i > 0) {
      // Frozen: follow segment 0's smoothed pose exactly.
      const p = this.drawSegPose(0, alpha);
      const r = this.rigid[i];
      const c = Math.cos(p.angle);
      const s = Math.sin(p.angle);
      return { x: p.x + r.x * c - r.y * s, y: p.y + r.x * s + r.y * c, angle: p.angle + r.angle };
    }
    const cur = this.segPose(i);
    if (!this.bodies[i]) return cur;
    const t = Math.max(0, Math.min(1, alpha));
    const p = this.prev[i];
    return { x: p.x + (cur.x - p.x) * t, y: p.y + (cur.y - p.y) * t, angle: p.angle + (cur.angle - p.angle) * t };
  }

  drawPose(alpha: number): Pose {
    return this.drawSegPose(0, alpha);
  }

  /** Scales gravity for this piece (used for the gentle first fall). */
  setGravityScale(scale: number): void {
    for (const b of this.bodies) b.setGravityScale(scale);
  }

  get x(): number {
    return this.segPose(0).x;
  }
  get y(): number {
    return this.segPose(0).y;
  }
  get angle(): number {
    return this.segPose(0).angle;
  }

  /** Moves the whole piece (all segments together, rigidly). */
  setPose(x: number, y: number, angle = this.poses[0].angle): void {
    for (let i = 0; i < this.segments; i++) this.setSegPose(i, { x, y, angle });
  }

  /** Moves one segment (used when restoring a tower snapshot of a soft piece). */
  setSegPose(i: number, pose: Pose): void {
    this.poses[i] = { ...pose };
    this.bodies[i]?.setTransform(new Vec2(pose.x / PX, pose.y / PX), pose.angle);
    // A teleport is not motion: drawing must not blend from the old pose.
    this.prev[i] = { ...pose };
  }

  /** Local pixel coordinate of segment 0 → world pixel coordinate. */
  localToWorld(lx: number, ly: number): { x: number; y: number } {
    const p = this.segPose(0);
    const c = Math.cos(p.angle);
    const s = Math.sin(p.angle);
    return { x: p.x + lx * c - ly * s, y: p.y + lx * s + ly * c };
  }

  /** Axis-aligned bounds in world pixels (cached until a pose changes; do not mutate). */
  get bounds(): Bounds {
    const poses = Array.from({ length: this.segments }, (_, i) => this.segPose(i));
    const key = poses.flatMap((p) => [p.x, p.y, p.angle]);
    if (key.length === this.boundsKey.length && key.every((v, i) => v === this.boundsKey[i])) return this.boundsCache;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    poses.forEach((p, i) => {
      const c = Math.cos(p.angle);
      const s = Math.sin(p.angle);
      for (const [lx, ly] of this.outlines[i]) {
        const wx = p.x + lx * c - ly * s;
        const wy = p.y + lx * s + ly * c;
        if (wx < minX) minX = wx;
        if (wx > maxX) maxX = wx;
        if (wy < minY) minY = wy;
        if (wy > maxY) maxY = wy;
      }
    });
    this.boundsCache = { minX, minY, maxX, maxY };
    this.boundsKey = key;
    return this.boundsCache;
  }

  /** Rough area in px² (sum of the parts' outlines; overlaps count twice). */
  get area(): number {
    return this.def.parts.reduce((sum, part) => {
      const pts = shapeOutline(part);
      let a = 0;
      pts.forEach(([x1, y1], i) => {
        const [x2, y2] = pts[(i + 1) % pts.length];
        a += x1 * y2 - x2 * y1;
      });
      return sum + Math.abs(a) / 2;
    }, 0);
  }

  /** Largest distance from the local origin to the outline. */
  get radius(): number {
    return this.outlines.flat().reduce((r, [x, y]) => Math.max(r, Math.hypot(x, y)), 0);
  }

  /** Vertical velocity in px per step (main segment). */
  get velocityY(): number {
    return this.body ? (this.body.getLinearVelocity().y * PX) / 60 : 0;
  }

  /** True while the piece is in contact with anything else (another piece or the platform). */
  get touching(): boolean {
    for (const b of this.bodies) {
      for (let ce = b.getContactList(); ce; ce = ce.next ?? null) {
        if (ce.contact.isTouching() && ce.other?.getUserData() !== this) return true;
      }
    }
    return false;
  }

  /** Bodies that count for coming to rest (see PieceDef.settleSegments). */
  private get settleBodies(): Body[] {
    const segs = this.def.settleSegments;
    if (!segs || this.bodies.length < 2) return this.bodies;
    return segs.map((i) => this.bodies[i]).filter((b) => b);
  }

  /** Fastest (settle) segment speed in px per step. */
  get speed(): number {
    let v = 0;
    for (const b of this.settleBodies) {
      const l = b.getLinearVelocity();
      v = Math.max(v, (Math.hypot(l.x, l.y) * PX) / 60);
    }
    return v;
  }

  /** Fastest segment angular speed in radians per step. */
  get angularSpeed(): number {
    let w = 0;
    for (const b of this.settleBodies) w = Math.max(w, Math.abs(b.getAngularVelocity()) / 60);
    return w;
  }
}

/** Soft welds: springy enough to sag, damped enough not to keep wobbling. */
const SOFT_WELD = { frequencyHz: 3.5, dampingRatio: 1 };
/** Friction torque in hinges (N·m): enough to stop dangling, too little to hold up the body. */
const HINGE_FRICTION = 0.15;

export class Physics {
  readonly world: World;
  readonly platform: Body;
  /** Called when a dropped piece touches anything for the first time. */
  onContact: (piece: PieceBody) => void = () => {};
  /** Pieces that touched something for the first time during the current step. */
  private justLanded = new Set<PieceBody>();

  constructor() {
    this.world = new World({ gravity: new Vec2(0, GRAVITY / PX) });
    this.platform = this.world.createBody({
      type: 'static',
      position: new Vec2(WORLD_WIDTH / 2 / PX, (GROUND_TOP + PLATFORM_DEPTH / 2) / PX),
    });
    this.platform.createFixture(withSkin(new Box(PLATFORM_WIDTH / 2 / PX, PLATFORM_DEPTH / 2 / PX), PLATFORM_OUTLINE), {
      friction: FRICTION,
    });
    this.world.on('begin-contact', (c) => {
      const a = c.getFixtureA().getBody().getUserData() as PieceBody | null;
      const b = c.getFixtureB().getBody().getUserData() as PieceBody | null;
      if (a === b) return; // two segments of the same piece
      for (const p of [a, b]) {
        if (!p) continue;
        if (!p.landed) this.justLanded.add(p);
        this.onContact(p);
      }
    });
  }

  /** Puts a piece into the world at its current pose, at rest. */
  add(piece: PieceBody): void {
    const bodies: Body[] = [];
    for (let i = 0; i < piece.segments; i++) {
      const pose = piece.segPose(i);
      const body = this.world.createBody({
        type: 'dynamic',
        position: new Vec2(pose.x / PX, pose.y / PX),
        angle: pose.angle,
        linearDamping: LINEAR_DAMPING,
        angularDamping: ANGULAR_DAMPING,
        userData: piece,
      });
      for (const s of piece.def.parts.filter((p) => (p.seg ?? 0) === i)) {
        const shape =
          s.kind === 'circle' && s.exact
            ? new Circle(new Vec2(s.x / PX, s.y / PX), (s.r + (s.noOutline ? 0 : PIECE_OUTLINE)) / PX)
            : withSkin(new Polygon(shapeOutline(s).map(([x, y]) => new Vec2(x / PX, y / PX))), s.noOutline ? THIN_SKIN : PIECE_OUTLINE);
        body.createFixture(shape, { density: DENSITY, friction: s.friction ?? FRICTION, restitution: 0 });
      }
      bodies.push(body);
    }
    piece.joints = [];
    for (const j of piece.def.joints ?? []) {
      const anchor = piece.localToWorld(j.x, j.y);
      const at = new Vec2(anchor.x / PX, anchor.y / PX);
      const joint = j.hinge
        ? // A limited hinge with a little friction, so the limb swings to its limit and stays
          // (or none at all for a loose one, which dangles).
          new RevoluteJoint(
            {
              enableLimit: true,
              lowerAngle: j.hinge[0],
              upperAngle: j.hinge[1],
              enableMotor: !j.loose,
              motorSpeed: 0,
              maxMotorTorque: j.loose ? 0 : HINGE_FRICTION,
              collideConnected: false,
            },
            bodies[j.a],
            bodies[j.b],
            at,
          )
        : new WeldJoint(
            {
              frequencyHz: j.hz ?? SOFT_WELD.frequencyHz,
              dampingRatio: j.damping ?? SOFT_WELD.dampingRatio,
              collideConnected: false,
            },
            bodies[j.a],
            bodies[j.b],
            at,
          );
      const created = this.world.createJoint(joint);
      if (created) piece.joints.push(created);
    }
    piece.bodies = bodies;
    piece.savePrev();
  }

  /**
   * Locks a soft piece into the shape it has now: all its segments are merged into one rigid
   * body (segment 0), keeping each segment's current position and angle relative to it.
   */
  freeze(piece: PieceBody): void {
    if (piece.frozen || piece.bodies.length < 2) return;
    const main = piece.bodies[0];
    const p0 = piece.segPose(0);
    const c0 = Math.cos(p0.angle);
    const s0 = Math.sin(p0.angle);
    const rel: Pose[] = [{ x: 0, y: 0, angle: 0 }];
    for (let i = 1; i < piece.segments; i++) {
      const q = piece.segPose(i);
      const dx = q.x - p0.x;
      const dy = q.y - p0.y;
      rel.push({ x: dx * c0 + dy * s0, y: -dx * s0 + dy * c0, angle: q.angle - p0.angle });
    }
    for (const j of piece.joints) this.world.destroyJoint(j);
    piece.joints = [];
    for (let i = 1; i < piece.segments; i++) {
      const r = rel[i];
      const c = Math.cos(r.angle);
      const s = Math.sin(r.angle);
      const toMain = (x: number, y: number) => new Vec2((r.x + x * c - y * s) / PX, (r.y + x * s + y * c) / PX);
      for (const part of piece.def.parts.filter((p) => (p.seg ?? 0) === i)) {
        const shape =
          part.kind === 'circle' && part.exact
            ? new Circle(toMain(part.x, part.y), (part.r + (part.noOutline ? 0 : PIECE_OUTLINE)) / PX)
            : withSkin(new Polygon(shapeOutline(part).map(([x, y]) => toMain(x, y))), part.noOutline ? THIN_SKIN : PIECE_OUTLINE);
        main.createFixture(shape, { density: DENSITY, friction: part.friction ?? FRICTION, restitution: 0 });
      }
      this.world.destroyBody(piece.bodies[i]);
    }
    piece.bodies = [main];
    piece.setRigidOffsets(rel);
    piece.frozen = true;
  }

  step(): void {
    this.world.step(STEP_SEC, 8, 3);
    // Joints get their landed range after the step (not while the world is solving contacts).
    for (const p of this.justLanded) {
      p.landed = true;
      // joints[i] belongs to def.joints[i] (all are created together in add()).
      if (p.frozen || p.joints.length !== p.def.joints?.length) continue;
      p.def.joints.forEach((j, i) => {
        const joint = p.joints[i];
        if (j.landed && joint instanceof RevoluteJoint) joint.setLimits(j.landed[0], j.landed[1]);
      });
    }
    this.justLanded.clear();
  }
}

export function hasFallen(p: PieceBody): boolean {
  return p.bounds.maxY > GROUND_TOP + PLATFORM_DEPTH + FALL_MARGIN;
}

/** Highest point (smallest y) among pieces; the platform top if there are none. */
export function towerTop(pieces: PieceBody[]): number {
  return pieces.reduce((top, p) => Math.min(top, p.bounds.minY), GROUND_TOP);
}
