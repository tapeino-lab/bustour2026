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

function shapePath(ctx: CanvasRenderingContext2D, s: Shape): void {
  ctx.beginPath();
  switch (s.kind) {
    case 'rect':
      ctx.roundRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, s.round ?? 0);
      break;
    case 'circle':
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      break;
    case 'poly':
      s.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
      break;
  }
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
export function drawPiece(ctx: CanvasRenderingContext2D, p: PieceBody, faces: FaceImages): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  // Body parts are drawn from the same outline the physics uses, so what you see is what collides.
  ctx.lineJoin = 'round';
  for (const part of p.def.parts) {
    ctx.beginPath();
    shapeOutline(part).forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = part.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 30, 20, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  for (const d of p.def.details ?? []) {
    shapePath(ctx, d);
    ctx.fillStyle = d.color;
    ctx.fill();
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

function drawBackground(ctx: CanvasRenderingContext2D, view: View): void {
  const h = view.viewH;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#6ec3f0');
  sky.addColorStop(1, '#d8f0fb');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, h);
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
): void {
  const k = view.scale * view.dpr;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  drawBackground(ctx, view);

  ctx.setTransform(k, 0, 0, k, 0, -view.camTop * k);
  drawPlatform(ctx);
  for (const p of pieces) drawPiece(ctx, p, faces);

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
