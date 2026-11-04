import type { Shape } from './pieces';
import { GROUND_TOP, PLATFORM_DEPTH, PLATFORM_WIDTH, WORLD_WIDTH, shapeOutline, type PieceBody } from './physics';

export interface View {
  /** CSS pixels per logical pixel. */
  scale: number;
  dpr: number;
  /** Visible height in logical pixels. */
  viewH: number;
  /** World y shown at the top of the screen. */
  camTop: number;
}

export type FaceImages = Map<string, HTMLImageElement>;

// Paths are built once per shape and reused every frame (no per-frame allocation).
const detailPaths = new Map<Shape, Path2D>();
const partPaths = new Map<Shape, Path2D>();

function detailPath(s: Shape): Path2D {
  let path = detailPaths.get(s);
  if (path) return path;
  path = new Path2D();
  switch (s.kind) {
    case 'rect':
      path.roundRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, s.round ?? 0);
      break;
    case 'circle':
      path.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      break;
    case 'poly':
      s.points.forEach(([x, y], i) => (i === 0 ? path!.moveTo(x, y) : path!.lineTo(x, y)));
      path.closePath();
      break;
  }
  detailPaths.set(s, path);
  return path;
}

/** Body parts use the same outline as the physics, so what you see is what collides. */
function partPath(s: Shape): Path2D {
  let path = partPaths.get(s);
  if (path) return path;
  path = new Path2D();
  shapeOutline(s).forEach(([x, y], i) => (i === 0 ? path!.moveTo(x, y) : path!.lineTo(x, y)));
  path.closePath();
  partPaths.set(s, path);
  return path;
}

function drawDummyFace(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.fillStyle = '#ffe3c4';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2a1e';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * r * 0.36, -r * 0.15, Math.max(1.2, r * 0.12), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#3a2a1e';
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.arc(0, r * 0.1, r * 0.42, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

/** Draws a piece in world coordinates (the current transform must map world → screen). */
export function drawPiece(ctx: CanvasRenderingContext2D, p: PieceBody, faces: FaceImages, alpha = 1): void {
  const pose = p.drawPose(alpha);
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(40, 30, 20, 0.45)';
  ctx.lineWidth = 1.5;
  for (const part of p.def.parts) {
    const path = partPath(part);
    ctx.fillStyle = part.color;
    ctx.fill(path);
    ctx.stroke(path);
  }

  for (const d of p.def.details ?? []) {
    ctx.fillStyle = d.color;
    ctx.fill(detailPath(d));
  }
  const f = p.def.face;
  if (f) {
    ctx.save();
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
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, f.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** The sky is a CSS background on the canvas; here we only clear. */
function drawBackground(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

/** The platform is just the green strip, drawn at exactly its physics size. */
function drawPlatform(ctx: CanvasRenderingContext2D): void {
  const left = (WORLD_WIDTH - PLATFORM_WIDTH) / 2;
  ctx.fillStyle = '#5bb04a';
  ctx.beginPath();
  ctx.roundRect(left, GROUND_TOP, PLATFORM_WIDTH, PLATFORM_DEPTH, 4);
  ctx.fill();
  ctx.fillStyle = '#4a9a3b';
  ctx.fillRect(left + 2, GROUND_TOP + PLATFORM_DEPTH - 4, PLATFORM_WIDTH - 4, 2);
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  view: View,
  pieces: PieceBody[],
  aim: PieceBody | null,
  faces: FaceImages,
  alpha = 1,
): void {
  const k = view.scale * view.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackground(ctx);

  ctx.setTransform(k, 0, 0, k, 0, -view.camTop * k);
  drawPlatform(ctx);
  for (const p of pieces) drawPiece(ctx, p, faces, alpha);

  if (aim) drawPiece(ctx, aim, faces);
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
