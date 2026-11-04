import { Box, Polygon, Vec2, World, type Body } from 'planck';
import type { PieceDef, Shape } from './pieces';

// All values outside this file are in logical pixels and "per step" (1/60 s) units,
// y pointing down. planck.js works in metres and seconds internally.

export const WORLD_WIDTH = 360;
export const GROUND_TOP = 0;
export const PLATFORM_WIDTH = 230;
/** Thickness of the platform (the green strip); there is nothing below it. */
export const PLATFORM_DEPTH = 12;
/** A piece whose top edge is this far below the platform top has fallen off. */
export const FALL_MARGIN = 30;
export const STEP_SEC = 1 / 60;

/** Pixels per metre. Keeps pieces around 1–4 m, the range Box2D-style engines like best. */
const PX = 30;
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
      for (let i = 0; i < CIRCLE_SIDES; i++) {
        const a = (Math.PI * 2 * i) / CIRCLE_SIDES;
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

/**
 * A piece. Before it is dropped it only has a pose (aiming / preview);
 * once dropped it is backed by a planck.js body.
 */
export class PieceBody {
  body: Body | null = null;
  private px: number;
  private py: number;
  private ang = 0;
  private readonly outline: Pt[];

  constructor(
    readonly def: PieceDef,
    x = 0,
    y = 0,
  ) {
    this.px = x;
    this.py = y;
    this.outline = def.parts.flatMap(shapeOutline);
  }

  get x(): number {
    return this.body ? this.body.getPosition().x * PX : this.px;
  }
  get y(): number {
    return this.body ? this.body.getPosition().y * PX : this.py;
  }
  get angle(): number {
    return this.body ? this.body.getAngle() : this.ang;
  }

  /** Moves a piece that is not in the world yet. */
  setPose(x: number, y: number, angle = this.ang): void {
    this.px = x;
    this.py = y;
    this.ang = angle;
    if (this.body) this.body.setTransform(new Vec2(x / PX, y / PX), angle);
  }

  /** Local pixel coordinate → world pixel coordinate, using the current pose. */
  localToWorld(lx: number, ly: number): { x: number; y: number } {
    const c = Math.cos(this.angle);
    const s = Math.sin(this.angle);
    return { x: this.x + lx * c - ly * s, y: this.y + lx * s + ly * c };
  }

  get bounds(): Bounds {
    const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const [lx, ly] of this.outline) {
      const p = this.localToWorld(lx, ly);
      b.minX = Math.min(b.minX, p.x);
      b.minY = Math.min(b.minY, p.y);
      b.maxX = Math.max(b.maxX, p.x);
      b.maxY = Math.max(b.maxY, p.y);
    }
    return b;
  }

  /** Largest distance from the local origin to the outline. */
  get radius(): number {
    return this.outline.reduce((r, [x, y]) => Math.max(r, Math.hypot(x, y)), 0);
  }

  /** Vertical velocity in px per step. */
  get velocityY(): number {
    return this.body ? (this.body.getLinearVelocity().y * PX) / 60 : 0;
  }
  set velocityY(vy: number) {
    if (!this.body) return;
    const v = this.body.getLinearVelocity();
    this.body.setLinearVelocity(new Vec2(v.x, (vy * 60) / PX));
  }

  /** Speed in px per step. */
  get speed(): number {
    if (!this.body) return 0;
    const v = this.body.getLinearVelocity();
    return (Math.hypot(v.x, v.y) * PX) / 60;
  }

  /** Angular speed in radians per step. */
  get angularSpeed(): number {
    return this.body ? Math.abs(this.body.getAngularVelocity()) / 60 : 0;
  }
}

export class Physics {
  readonly world: World;
  readonly platform: Body;
  /** Called when a dropped piece touches anything for the first time. */
  onContact: (piece: PieceBody) => void = () => {};

  constructor() {
    this.world = new World({ gravity: new Vec2(0, GRAVITY / PX) });
    this.platform = this.world.createBody({
      type: 'static',
      position: new Vec2(WORLD_WIDTH / 2 / PX, (GROUND_TOP + PLATFORM_DEPTH / 2) / PX),
    });
    this.platform.createFixture(new Box(PLATFORM_WIDTH / 2 / PX, PLATFORM_DEPTH / 2 / PX), { friction: FRICTION });
    this.world.on('begin-contact', (c) => {
      for (const f of [c.getFixtureA(), c.getFixtureB()]) {
        const piece = f.getBody().getUserData() as PieceBody | null;
        if (piece) this.onContact(piece);
      }
    });
  }

  /** Puts a piece into the world at its current pose, at rest. */
  add(piece: PieceBody): void {
    const body = this.world.createBody({
      type: 'dynamic',
      position: new Vec2(piece.x / PX, piece.y / PX),
      angle: piece.angle,
      linearDamping: LINEAR_DAMPING,
      angularDamping: ANGULAR_DAMPING,
      userData: piece,
    });
    for (const s of piece.def.parts) {
      const verts = shapeOutline(s).map(([x, y]) => new Vec2(x / PX, y / PX));
      body.createFixture(new Polygon(verts), { density: DENSITY, friction: FRICTION, restitution: 0 });
    }
    piece.body = body;
  }

  step(): void {
    this.world.step(STEP_SEC, 8, 3);
  }
}

export function hasFallen(p: PieceBody): boolean {
  return p.bounds.minY > GROUND_TOP + FALL_MARGIN;
}

/** Highest point (smallest y) among pieces; the platform top if there are none. */
export function towerTop(pieces: PieceBody[]): number {
  return pieces.reduce((top, p) => Math.min(top, p.bounds.minY), GROUND_TOP);
}
