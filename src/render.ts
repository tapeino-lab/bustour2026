import type { Shape } from './pieces';
import { GROUND_TOP, PLATFORM_WIDTH, WORLD_WIDTH, localToWorld, type PieceBody } from './physics';

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
  const parts = p.body.parts.length > 1 ? p.body.parts.slice(1) : [p.body];
  ctx.lineJoin = 'round';
  for (const part of parts) {
    ctx.beginPath();
    part.vertices.forEach((v, i) => (i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)));
    ctx.closePath();
    ctx.fillStyle = part.render.fillStyle ?? '#ccc';
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 30, 20, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const o = localToWorld(p, 0, 0);
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(p.body.angle);
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

  // Distant mountain with a snowy cap, slow parallax.
  const groundScreenY = GROUND_TOP - view.camTop;
  const base = groundScreenY * 0.3 + h * 0.7 - 110;
  const peakY = base - 210;
  ctx.fillStyle = '#7d93b8';
  ctx.beginPath();
  ctx.moveTo(-40, base);
  ctx.lineTo(150, peakY);
  ctx.lineTo(210, peakY);
  ctx.lineTo(400, base);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f7fbff';
  ctx.beginPath();
  ctx.moveTo(150, peakY);
  ctx.lineTo(210, peakY);
  ctx.lineTo(244, peakY + 46);
  ctx.lineTo(226, peakY + 38);
  ctx.lineTo(206, peakY + 52);
  ctx.lineTo(184, peakY + 40);
  ctx.lineTo(162, peakY + 54);
  ctx.lineTo(140, peakY + 34);
  ctx.closePath();
  ctx.fill();
}

function drawPlatform(ctx: CanvasRenderingContext2D, view: View): void {
  const left = (WORLD_WIDTH - PLATFORM_WIDTH) / 2;
  const bottom = view.camTop + view.viewH + 10;
  if (bottom < GROUND_TOP) return;
  ctx.fillStyle = '#8a6a48';
  ctx.fillRect(left, GROUND_TOP, PLATFORM_WIDTH, bottom - GROUND_TOP);
  ctx.fillStyle = '#7a5c3c';
  for (let y = GROUND_TOP + 30; y < bottom; y += 34) {
    ctx.fillRect(left + 20 + ((y / 34) % 2) * 60, y, 50, 8);
    ctx.fillRect(left + 130 - ((y / 34) % 2) * 40, y + 16, 44, 8);
  }
  ctx.fillStyle = '#5bb04a';
  ctx.beginPath();
  ctx.roundRect(left - 4, GROUND_TOP - 2, PLATFORM_WIDTH + 8, 14, 5);
  ctx.fill();
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
  drawPlatform(ctx, view);
  for (const p of pieces) drawPiece(ctx, p, faces);

  if (aim) {
    const x = aim.body.position.x;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(x, aim.body.bounds.max.y + 4);
    ctx.lineTo(x, view.camTop + view.viewH);
    ctx.stroke();
    ctx.restore();
    drawPiece(ctx, aim, faces);
  }
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
  const w = p.body.bounds.max.x - p.body.bounds.min.x;
  const h = p.body.bounds.max.y - p.body.bounds.min.y;
  const s = Math.min(size / w, size / h, 0.6);
  const bx = (p.body.bounds.min.x + p.body.bounds.max.x) / 2;
  const by = (p.body.bounds.min.y + p.body.bounds.max.y) / 2;
  ctx.setTransform(k * s, 0, 0, k * s, (cx - bx * s) * k, (cy - by * s) * k);
  drawPiece(ctx, p, faces);
}
