import Matter from 'matter-js';
import type { PieceDef, Shape } from './pieces';

const { Bodies, Body, Composite, Engine, Vertices } = Matter;

export const WORLD_WIDTH = 360;
export const GROUND_TOP = 0;
export const PLATFORM_WIDTH = 230;
export const PLATFORM_DEPTH = 400;
/** A body whose top edge is this far below the platform top has fallen off. */
export const FALL_MARGIN = 30;

const MATERIAL = { friction: 1.2, frictionStatic: 2, restitution: 0, density: 0.0015 };
/** Air damping on pieces: steadier landings and calmer towers. */
const PIECE_AIR = 0.05;
/** Circles are slightly faceted so round animals do not roll forever. */
const CIRCLE_SIDES = 10;

export interface PieceBody {
  def: PieceDef;
  body: Matter.Body;
  /** Local origin offset from the centre of mass at angle 0. */
  offsetX: number;
  offsetY: number;
}

export function createEngine(): { engine: Matter.Engine; platform: Matter.Body } {
  // Sleeping stops the slow creep Matter.js bodies show on slopes, whatever the friction.
  const engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 }, enableSleeping: true });
  const platform = Bodies.rectangle(
    WORLD_WIDTH / 2,
    GROUND_TOP + PLATFORM_DEPTH / 2,
    PLATFORM_WIDTH,
    PLATFORM_DEPTH,
    { isStatic: true, ...MATERIAL, label: 'platform' },
  );
  Composite.add(engine.world, platform);
  return { engine, platform };
}

function shapeBody(s: Shape, x: number, y: number): Matter.Body {
  const opts = { ...MATERIAL, render: { fillStyle: s.color } };
  switch (s.kind) {
    case 'rect':
      return Bodies.rectangle(x + s.x, y + s.y, s.w, s.h, s.round ? { ...opts, chamfer: { radius: s.round } } : opts);
    case 'circle':
      return Bodies.circle(x + s.x, y + s.y, s.r, opts, CIRCLE_SIDES);
    case 'poly': {
      const verts = s.points.map(([px, py]) => ({ x: px, y: py }));
      const c = Vertices.centre(verts);
      return Bodies.fromVertices(x + c.x, y + c.y, [verts], opts);
    }
  }
}

/** Builds a compound body for a piece with its local origin at (x, y). */
export function createPieceBody(def: PieceDef, x: number, y: number): PieceBody {
  const parts = def.parts.map((s) => shapeBody(s, x, y));
  const body = Body.create({ parts, ...MATERIAL, frictionAir: PIECE_AIR, label: def.id });
  return { def, body, offsetX: x - body.position.x, offsetY: y - body.position.y };
}

/** Converts a local piece coordinate to world coordinates using the body's current pose. */
export function localToWorld(p: PieceBody, lx: number, ly: number): { x: number; y: number } {
  const dx = lx + p.offsetX;
  const dy = ly + p.offsetY;
  const c = Math.cos(p.body.angle);
  const s = Math.sin(p.body.angle);
  return { x: p.body.position.x + dx * c - dy * s, y: p.body.position.y + dx * s + dy * c };
}

export function hasFallen(body: Matter.Body): boolean {
  return body.bounds.min.y > GROUND_TOP + FALL_MARGIN;
}

/** Highest point (smallest y) among bodies; the platform top if there are none. */
export function towerTop(bodies: Matter.Body[]): number {
  return bodies.reduce((top, b) => Math.min(top, b.bounds.min.y), GROUND_TOP);
}

export function halfHeight(body: Matter.Body): number {
  return Math.max(body.position.y - body.bounds.min.y, body.bounds.max.y - body.position.y);
}
