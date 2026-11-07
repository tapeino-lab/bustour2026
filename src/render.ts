import type { Shape } from './pieces';
import { GROUND_TOP, PLATFORM_DEPTH, PLATFORM_WIDTH, WORLD_WIDTH, PIECE_OUTLINE, shapeOutline, type PieceBody } from './physics';

export interface View {
  /** CSS pixels per logical pixel. */
  scale: number;
  dpr: number;
  /** Visible height in logical pixels. */
  viewH: number;
  /** World y shown at the top of the screen. */
  camTop: number;
  /** How far (logical px) the distant scenery has scrolled down; it moves slower than the tower. */
  bgShift?: number;
}

export type FaceImages = Map<string, HTMLImageElement>;

/** The one font used everywhere (also in CSS), so Android and iOS look the same. */
export const FONT = '"Dela Gothic One", sans-serif';
export const INK = '#111111';
const OUTLINE = PIECE_OUTLINE;

// Shapes are traced directly each frame. (Reusing cached Path2D objects under changing
// transforms is a suspected cause of ghost images on iOS Safari.) Outline points are cached.
const outlines = new Map<Shape, [number, number][]>();

/** Body parts use the same outline as the physics, so what you see is what collides. */
function tracePart(ctx: CanvasRenderingContext2D, s: Shape): void {
  if (s.kind === 'circle' && s.exact) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    return;
  }
  let pts = outlines.get(s);
  if (!pts) {
    pts = shapeOutline(s);
    outlines.set(s, pts);
  }
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function traceDetail(ctx: CanvasRenderingContext2D, s: Shape): void {
  ctx.beginPath();
  switch (s.kind) {
    case 'rect':
      ctx.roundRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, s.round ?? 0);
      break;
    case 'circle':
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      break;
    case 'poly':
      ctx.moveTo(s.points[0][0], s.points[0][1]);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i][0], s.points[i][1]);
      ctx.closePath();
      break;
  }
}

function drawDummyFace(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.fillStyle = '#ffe3c4';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * r * 0.36, -r * 0.15, Math.max(1.2, r * 0.12), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.arc(0, r * 0.1, r * 0.42, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

/** Draws a piece in world coordinates (the current transform must map world → screen). */
export function drawPiece(
  ctx: CanvasRenderingContext2D,
  p: PieceBody,
  faces: FaceImages,
  alpha = 1,
  scale = 1,
): void {
  // Each segment of the piece is drawn in its own pose (most pieces have just one).
  const poses = Array.from({ length: p.segments }, (_, i) => p.drawSegPose(i, alpha));
  const inSeg = (seg: number | undefined, draw: () => void) => {
    const pose = poses[seg ?? 0];
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.angle);
    if (scale !== 1) ctx.scale(scale, scale);
    draw();
    ctx.restore();
  };
  // Comic ink: one thick outline around the whole silhouette (strokes first, fills on top),
  // so the parts read as one body.
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = OUTLINE * 2;
  for (const part of p.def.parts) {
    inSeg(part.seg, () => {
      tracePart(ctx, part);
      ctx.stroke();
    });
  }
  for (const part of p.def.parts) {
    inSeg(part.seg, () => {
      tracePart(ctx, part);
      ctx.fillStyle = part.color;
      ctx.fill();
    });
  }
  for (const d of p.def.details ?? []) {
    inSeg(d.seg, () => {
      traceDetail(ctx, d);
      ctx.fillStyle = d.color;
      ctx.fill();
    });
  }
  const f = p.def.face;
  if (f) {
    inSeg(f.seg, () => {
      ctx.translate(f.x, f.y);
      const img = faces.get(p.def.id);
      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, f.r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, -f.r, -f.r, f.r * 2, f.r * 2);
        ctx.restore();
      } else {
        drawDummyFace(ctx, f.r);
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, f.r, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
}

// The sky is pre-rendered once per screen size and copied each frame onto an opaque canvas.
// (A transparent canvas redrawn every frame over a CSS background can flicker on iOS Safari.)
let background: HTMLCanvasElement | null = null;
/** Mt. Fuji on its own transparent layer, so it can scroll as distant scenery. */
let scenery: HTMLCanvasElement | null = null;
let sceneryScale = 1;
const SCENERY_ALPHA = 0.55;

/** Builds the comic sky (gradient, rays, halftone dots) for a canvas of w×h device pixels. */
export function buildBackground(w: number, h: number, k: number): void {
  const c = background ?? document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.setTransform(k, 0, 0, k, 0, 0);
  const W = w / k;
  const H = h / k;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#36b6ec');
  sky.addColorStop(1, '#9fe0fb');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  // Rays from the top centre.
  g.fillStyle = 'rgba(255, 255, 255, 0.16)';
  const R = Math.hypot(W, H) * 1.2;
  for (let a = 0; a < 360; a += 14) {
    const a0 = (a * Math.PI) / 180;
    const a1 = ((a + 6) * Math.PI) / 180;
    g.beginPath();
    g.moveTo(W / 2, 0);
    g.lineTo(W / 2 + R * Math.cos(a0), R * Math.sin(a0));
    g.lineTo(W / 2 + R * Math.cos(a1), R * Math.sin(a1));
    g.closePath();
    g.fill();
  }
  // Halftone dots.
  g.fillStyle = 'rgba(255, 255, 255, 0.35)';
  g.beginPath();
  for (let y = 6; y < H; y += 12) {
    for (let x = 6; x < W; x += 12) {
      g.moveTo(x + 1.6, y);
      g.arc(x, y, 1.6, 0, Math.PI * 2);
    }
  }
  g.fill();
  background = c;

  const f = scenery ?? document.createElement('canvas');
  f.width = w;
  f.height = h;
  const fg = f.getContext('2d')!;
  fg.setTransform(k, 0, 0, k, 0, 0);
  drawFuji(fg, W, H);
  scenery = f;
  sceneryScale = k;
}

/** Comic-style Mt. Fuji filling the lower part of the screen, with a snow cap and clouds. */
function drawFuji(g: CanvasRenderingContext2D, W: number, H: number): void {
  // Wide feet and slopes that curve in towards a small flat top, like the real Fuji.
  const peakY = H * 0.44;
  const topHalf = W * 0.1;
  const cx = W * 0.5;
  const mountain = new Path2D();
  mountain.moveTo(-W * 0.9, H + 10);
  mountain.bezierCurveTo(-W * 0.2, H * 0.9, cx - W * 0.22, H * 0.66, cx - topHalf, peakY);
  mountain.lineTo(cx + topHalf, peakY);
  mountain.bezierCurveTo(cx + W * 0.22, H * 0.66, W * 1.2, H * 0.9, W * 1.9, H + 10);
  mountain.closePath();

  const body = g.createLinearGradient(0, peakY, 0, H);
  body.addColorStop(0, '#3f5fa8');
  body.addColorStop(1, '#7d9be0');
  g.fillStyle = body;
  g.fill(mountain);
  // Darker halftone inside the mountain.
  g.save();
  g.clip(mountain);
  g.fillStyle = 'rgba(20, 30, 70, 0.18)';
  g.beginPath();
  for (let y = peakY; y < H; y += 10) {
    for (let x = (y / 10) % 2 ? 0 : 5; x < W; x += 10) {
      g.moveTo(x + 1.8, y);
      g.arc(x, y, 1.8, 0, Math.PI * 2);
    }
  }
  g.fill();
  // Snow cap with a jagged lower edge.
  const snowY = peakY + H * 0.11;
  g.beginPath();
  g.moveTo(cx - topHalf - W * 0.02, peakY - 2);
  g.lineTo(cx + topHalf + W * 0.02, peakY - 2);
  g.lineTo(cx + W * 0.3, snowY);
  const teeth = 9;
  for (let i = 1; i <= teeth; i++) {
    const x = cx + W * 0.3 - (W * 0.6 * i) / teeth;
    g.lineTo(x + (W * 0.6) / teeth / 2, snowY - (i % 2 ? H * 0.035 : H * 0.015));
    g.lineTo(x, snowY + (i % 2 ? 0 : H * 0.012));
  }
  g.closePath();
  g.fillStyle = '#ffffff';
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 2;
  g.lineJoin = 'round';
  g.stroke();
  g.restore();
  // Ink outline of the mountain.
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.lineJoin = 'round';
  g.stroke(mountain);

  // A few comic clouds around the slopes.
  const cloud = (x: number, y: number, s: number) => {
    const puffs: [number, number, number][] = [[0, 0, 1], [-1.1, 0.25, 0.75], [1.1, 0.25, 0.75], [-0.5, -0.45, 0.7], [0.55, -0.4, 0.65]];
    g.lineWidth = 5;
    g.strokeStyle = INK;
    for (const [dx, dy, r] of puffs) {
      g.beginPath();
      g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#ffffff';
    for (const [dx, dy, r] of puffs) {
      g.beginPath();
      g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
      g.fill();
    }
  };
  cloud(W * 0.14, peakY + H * 0.1, 16);
  cloud(W * 0.86, peakY + H * 0.04, 13);
}

function drawBackground(ctx: CanvasRenderingContext2D, shift: number): void {
  if (background) {
    ctx.drawImage(background, 0, 0);
    // The mountain sinks as the tower (and the camera) goes up.
    if (scenery) {
      // Drawn faint so it stays in the background.
      ctx.globalAlpha = SCENERY_ALPHA;
      ctx.drawImage(scenery, 0, Math.round(shift * sceneryScale));
      ctx.globalAlpha = 1;
    }
  }
  else {
    ctx.fillStyle = '#36b6ec';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}

/** The platform is just the green strip, drawn at exactly its physics size. */
function drawPlatform(ctx: CanvasRenderingContext2D): void {
  const left = (WORLD_WIDTH - PLATFORM_WIDTH) / 2;
  // Hard shadow, then the strip with an ink outline and a highlight line.
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(left + 4, GROUND_TOP + 4, PLATFORM_WIDTH, PLATFORM_DEPTH, 4);
  ctx.fill();
  ctx.fillStyle = '#4fc23a';
  ctx.strokeStyle = INK;
  ctx.lineWidth = OUTLINE;
  ctx.beginPath();
  ctx.roundRect(left, GROUND_TOP, PLATFORM_WIDTH, PLATFORM_DEPTH, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#a6ec7a';
  ctx.fillRect(left + 6, GROUND_TOP + 3, PLATFORM_WIDTH - 12, 2);
}

/** Puffs around the spawn point, relative to the piece centre; deterministic so it looks the same each time. */
const PUFFS: [number, number, number][] = [
  [0, 0, 1], [0.9, -0.2, 0.75], [-0.85, -0.1, 0.8], [0.45, 0.75, 0.7], [-0.5, 0.7, 0.7],
  [0.3, -0.85, 0.65], [-0.35, -0.8, 0.65], [1.05, 0.5, 0.5], [-1.05, 0.45, 0.5],
];

/**
 * Comic smoke cloud ("ボフッ") at (x, y) in world coordinates. `t` runs 0 → 1.
 * Puffs grow quickly, then shrink away (no transparency, so the ink outline stays clean).
 */
export function drawPoof(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t: number): void {
  if (t >= 1) return;
  // Big and dense at first (it hides the piece), then the puffs drift apart and shrink away.
  const grow = t < 0.12 ? t / 0.12 : 1 - ((t - 0.12) / 0.88) ** 0.8;
  const spread = size * (0.3 + 0.7 * Math.min(1, t / 0.45));
  const base = size * 0.62 * grow;
  if (base > 0.5) {
    ctx.save();
    ctx.lineWidth = OUTLINE * 2;
    ctx.strokeStyle = INK;
    for (const pass of [0, 1]) {
      ctx.fillStyle = pass === 0 ? INK : '#ffffff';
      for (const [dx, dy, r] of PUFFS) {
        ctx.beginPath();
        ctx.arc(x + dx * spread, y + dy * spread, base * r, 0, Math.PI * 2);
        if (pass === 0) ctx.stroke();
        else ctx.fill();
      }
    }
    // A little grey shading on each puff for depth.
    ctx.fillStyle = '#d9dde3';
    for (const [dx, dy, r] of PUFFS) {
      ctx.beginPath();
      ctx.arc(x + dx * spread + base * r * 0.25, y + dy * spread + base * r * 0.3, base * r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Sound-effect lettering.
  const a = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
  const pop = t < 0.15 ? 0.6 + (t / 0.15) * 0.6 : 1.2 - Math.min(0.2, (t - 0.15) * 0.5);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x + size * 0.75, y - size * 0.75);
  ctx.rotate(-0.18);
  ctx.scale(pop, pop);
  ctx.font = `22px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.strokeText('ボフッ', 0, 0);
  ctx.fillStyle = '#ffd60a';
  ctx.fillText('ボフッ', 0, 0);
  ctx.restore();
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  view: View,
  pieces: PieceBody[],
  aim: PieceBody | null,
  faces: FaceImages,
  alpha = 1,
  aimScale = 1,
): void {
  const k = view.scale * view.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackground(ctx, view.bgShift ?? 0);

  ctx.setTransform(k, 0, 0, k, 0, -view.camTop * k);
  drawPlatform(ctx);
  for (const p of pieces) drawPiece(ctx, p, faces, alpha);

  if (aim) drawPiece(ctx, aim, faces, 1, aimScale);
}

/** Draws a piece scaled into a screen-space box (logical coordinates). */
export function drawPreview(
  ctx: CanvasRenderingContext2D,
  view: View,
  p: PieceBody,
  faces: FaceImages,
  cx: number,
  cy: number,
  size: number,
): void {
  const k = view.scale * view.dpr;
  const b = p.bounds;
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const s = Math.min(size / w, size / h, 0.6);
  const bx = (b.minX + b.maxX) / 2;
  const by = (b.minY + b.maxY) / 2;
  ctx.setTransform(k * s, 0, 0, k * s, (cx - bx * s) * k, (cy - by * s) * k);
  drawPiece(ctx, p, faces);
}

/**
 * Draws a still tower (pieces posed from a snapshot) into `canvas`, sized cssW×cssH CSS px,
 * scaled to fit with the platform at the bottom.
 */
export function drawTowerImage(
  canvas: HTMLCanvasElement,
  pieces: PieceBody[],
  cssW: number,
  cssH: number,
  faces: FaceImages,
): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#36b6ec');
  sky.addColorStop(1, '#9fe0fb');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // World area to show: the platform plus every piece (with its outline), and a little sky.
  const platformLeft = (WORLD_WIDTH - PLATFORM_WIDTH) / 2;
  let minX = platformLeft - 8;
  let maxX = platformLeft + PLATFORM_WIDTH + 8;
  let minY = GROUND_TOP - 40;
  const maxY = GROUND_TOP + PLATFORM_DEPTH + 8;
  for (const p of pieces) {
    const b = p.bounds;
    minX = Math.min(minX, b.minX - 6);
    maxX = Math.max(maxX, b.maxX + 6);
    minY = Math.min(minY, b.minY - 16);
  }
  const s = Math.min(cssW / (maxX - minX), cssH / (maxY - minY));
  const k = s * dpr;
  // Centre horizontally, sit the platform at the bottom.
  const ox = (cssW - (maxX - minX) * s) / 2 - minX * s;
  const oy = cssH - maxY * s;
  ctx.setTransform(k, 0, 0, k, ox * dpr, oy * dpr);
  drawPlatform(ctx);
  for (const p of pieces) drawPiece(ctx, p, faces);
}
