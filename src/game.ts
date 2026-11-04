import Matter from 'matter-js';
import { SettleTracker, clamp, heightMeters, pieceIdForIndex } from './logic';
import { pieceById } from './pieces';
import {
  GROUND_TOP, WORLD_WIDTH, createEngine, createPieceBody, hasFallen, towerTop, type PieceBody,
} from './physics';
import { drawPreview, drawWorld, type FaceImages, type View } from './render';

const { Body, Composite, Engine } = Matter;

export const STEP_MS = 1000 / 60;
const SPAWN_GAP = 50;
const HUD_SPACE = 96;
const OVER_DELAY_FRAMES = 70;
const ROTATE_STEP = Math.PI / 4;

export type GameState = 'idle' | 'aim' | 'drop' | 'falling' | 'over';

function boundingRadius(p: PieceBody): number {
  let r = 0;
  for (const part of p.body.parts) {
    for (const v of part.vertices) {
      r = Math.max(r, Math.hypot(v.x - p.body.position.x, v.y - p.body.position.y));
    }
  }
  return r;
}

export class Game {
  state: GameState = 'idle';
  score = 0;
  pieces: PieceBody[] = [];
  current: PieceBody | null = null;
  next: PieceBody | null = null;
  onGameOver: (score: number) => void = () => {};

  private engine: Matter.Engine;
  private count = 0;
  private aimX = WORLD_WIDTH / 2;
  private angle = 0;
  private radius = 0;
  private camTop = 0;
  private overFrames = 0;
  private settle = new SettleTracker();
  private dragging = false;
  private dragStartX = 0;
  private dragStartAim = 0;

  constructor(
    private readonly rand: () => number = Math.random,
    private viewH = 640,
  ) {
    this.engine = createEngine().engine;
    this.camTop = this.baseCamTop();
  }

  setViewHeight(h: number): void {
    this.viewH = h;
    if (this.state === 'idle') this.camTop = this.baseCamTop();
  }

  private baseCamTop(): number {
    return GROUND_TOP - (this.viewH - 200);
  }

  start(): void {
    Engine.clear(this.engine);
    this.engine = createEngine().engine;
    this.pieces = [];
    this.score = 0;
    this.count = 0;
    this.overFrames = 0;
    this.aimX = WORLD_WIDTH / 2;
    this.camTop = this.baseCamTop();
    this.next = createPieceBody(pieceById(pieceIdForIndex(1, this.rand)), 0, 0);
    this.spawn();
  }

  private spawn(): void {
    this.count++;
    this.current = this.next;
    this.next = createPieceBody(pieceById(pieceIdForIndex(this.count + 1, this.rand)), 0, 0);
    if (!this.current) return;
    this.angle = 0;
    Body.setAngle(this.current.body, 0);
    this.radius = boundingRadius(this.current);
    const top = towerTop(this.pieces.map((p) => p.body));
    this.aimX = clamp(this.aimX, this.radius * 0.5, WORLD_WIDTH - this.radius * 0.5);
    Body.setPosition(this.current.body, { x: this.aimX, y: top - SPAWN_GAP - this.radius });
    this.state = 'aim';
  }

  get pieceNumber(): number {
    return this.count;
  }

  get heightM(): number {
    return heightMeters(GROUND_TOP - towerTop(this.pieces.map((p) => p.body)));
  }

  rotate(): void {
    if (this.state !== 'aim' || !this.current) return;
    this.angle += ROTATE_STEP;
    Body.setAngle(this.current.body, this.angle);
  }

  pointerDown(x: number): void {
    if (this.state !== 'aim') return;
    this.dragging = true;
    this.dragStartX = x;
    this.dragStartAim = this.aimX;
  }

  pointerMove(x: number): void {
    if (!this.dragging || this.state !== 'aim' || !this.current) return;
    this.aimX = clamp(this.dragStartAim + (x - this.dragStartX), 8, WORLD_WIDTH - 8);
    Body.setPosition(this.current.body, { x: this.aimX, y: this.current.body.position.y });
  }

  pointerUp(): void {
    const wasDragging = this.dragging;
    this.dragging = false;
    if (wasDragging) this.drop();
  }

  drop(): void {
    if (this.state !== 'aim' || !this.current) return;
    const p = this.current;
    Body.setVelocity(p.body, { x: 0, y: 0 });
    Body.setAngularVelocity(p.body, 0);
    Composite.add(this.engine.world, p.body);
    this.pieces.push(p);
    this.current = null;
    this.settle.reset();
    this.state = 'drop';
  }

  step(): void {
    if (this.state === 'idle' || this.state === 'over') {
      if (this.state === 'over') Engine.update(this.engine, STEP_MS);
      return;
    }
    Engine.update(this.engine, STEP_MS);

    if (this.state === 'falling') {
      if (++this.overFrames >= OVER_DELAY_FRAMES) {
        this.state = 'over';
        this.onGameOver(this.score);
      }
      return;
    }

    if (this.pieces.some((p) => hasFallen(p.body))) {
      this.state = 'falling';
      this.dragging = false;
      this.current = null;
      this.overFrames = 0;
      return;
    }

    if (this.state === 'drop') {
      const motions = this.pieces.map((p) => ({ speed: p.body.speed, angularSpeed: p.body.angularSpeed }));
      if (this.settle.update(motions)) {
        this.score = this.pieces.length;
        this.spawn();
      }
    }
  }

  private updateCamera(): void {
    let target = this.baseCamTop();
    if (this.current) {
      target = Math.min(target, this.current.body.position.y - this.radius - HUD_SPACE);
    } else if (this.pieces.length) {
      target = Math.min(target, this.camTop);
    }
    this.camTop += (target - this.camTop) * 0.12;
  }

  render(ctx: CanvasRenderingContext2D, scale: number, dpr: number, faces: FaceImages): void {
    this.updateCamera();
    const view: View = { scale, dpr, viewH: this.viewH, camTop: this.camTop };
    drawWorld(ctx, view, this.pieces, this.current, faces);
    if (this.state === 'idle') return;

    const k = scale * dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 150, 64, 12);
    ctx.roundRect(WORLD_WIDTH - 92, 10, 82, 74, 12);
    ctx.fill();

    ctx.fillStyle = '#23324a';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = 'bold 30px system-ui, sans-serif';
    const scoreText = `${this.score}`;
    const scoreW = ctx.measureText(scoreText).width;
    ctx.fillText(scoreText, 22, 46);
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('こ', 26 + scoreW, 46);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`たかさ ${this.heightM.toFixed(1)} m`, 22, 65);
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('つぎ', WORLD_WIDTH - 51, 26);

    if (this.next) drawPreview(ctx, view, this.next, faces, WORLD_WIDTH - 51, 54, 50);
  }
}
