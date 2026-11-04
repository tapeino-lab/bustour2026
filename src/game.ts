import { SettleTracker, clamp, heightMeters, pieceIdForIndex } from './logic';
import { pieceById } from './pieces';
import { GROUND_TOP, PieceBody, Physics, WORLD_WIDTH, hasFallen, towerTop } from './physics';
import { drawPreview, drawWorld, type FaceImages, type View } from './render';

export const STEP_MS = 1000 / 60;
/** Gap between the tower top and the bottom of a newly spawned piece. */
export const SPAWN_GAP = 70;
/** Gravity multiplier for a dropped piece until it first touches something: a gentle, accelerating fall. */
export const FREE_FALL_GRAVITY = 0.4;
const HUD_SPACE = 100;
/** Logical px between the platform top and the bottom of the screen at the start. */
const GROUND_FROM_BOTTOM = 190;
const OVER_DELAY_FRAMES = 70;
const ROTATE_STEP = Math.PI / 4;

export type GameState = 'idle' | 'aim' | 'drop' | 'falling' | 'over';

export class Game {
  state: GameState = 'idle';
  score = 0;
  pieces: PieceBody[] = [];
  current: PieceBody | null = null;
  next: PieceBody | null = null;
  onGameOver: (score: number) => void = () => {};

  private physics: Physics;
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
  /** The dropped piece while it is still in free fall. */
  private freeFall: PieceBody | null = null;

  constructor(
    private readonly rand: () => number = Math.random,
    private viewH = 640,
  ) {
    this.physics = this.newPhysics();
    this.camTop = this.baseCamTop();
  }

  private newPhysics(): Physics {
    const physics = new Physics();
    physics.onContact = (piece) => {
      if (piece === this.freeFall) {
        piece.setGravityScale(1);
        this.freeFall = null;
      }
    };
    return physics;
  }

  setViewHeight(h: number): void {
    this.viewH = h;
    if (this.state === 'idle') this.camTop = this.baseCamTop();
  }

  private baseCamTop(): number {
    return GROUND_TOP - (this.viewH - GROUND_FROM_BOTTOM);
  }

  start(): void {
    this.physics = this.newPhysics();
    this.freeFall = null;
    this.pieces = [];
    this.score = 0;
    this.count = 0;
    this.overFrames = 0;
    this.aimX = WORLD_WIDTH / 2;
    this.camTop = this.baseCamTop();
    this.next = new PieceBody(pieceById(pieceIdForIndex(1, this.rand)));
    this.spawn();
  }

  private spawn(): void {
    this.count++;
    this.current = this.next;
    this.next = new PieceBody(pieceById(pieceIdForIndex(this.count + 1, this.rand)));
    if (!this.current) return;
    this.angle = 0;
    this.radius = this.current.radius;
    const top = towerTop(this.pieces);
    this.aimX = clamp(this.aimX, this.radius * 0.5, WORLD_WIDTH - this.radius * 0.5);
    this.current.setPose(this.aimX, top - SPAWN_GAP - this.radius, 0);
    this.state = 'aim';
  }

  get pieceNumber(): number {
    return this.count;
  }

  get heightM(): number {
    return heightMeters(GROUND_TOP - towerTop(this.pieces));
  }

  rotate(): void {
    if (this.state !== 'aim' || !this.current) return;
    this.angle += ROTATE_STEP;
    this.current.setPose(this.current.x, this.current.y, this.angle);
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
    this.current.setPose(this.aimX, this.current.y);
  }

  /** Ends a drag without dropping (finger released over the rotate button). */
  cancelDrag(): void {
    this.dragging = false;
  }

  pointerUp(): void {
    const wasDragging = this.dragging;
    this.dragging = false;
    if (wasDragging) this.drop();
  }

  drop(): void {
    if (this.state !== 'aim' || !this.current) return;
    const p = this.current;
    this.physics.add(p);
    p.setGravityScale(FREE_FALL_GRAVITY);
    this.pieces.push(p);
    this.freeFall = p;
    this.current = null;
    this.settle.reset();
    this.state = 'drop';
  }

  step(): void {
    if (this.state === 'idle' || this.state === 'over') {
      if (this.state === 'over') this.stepPhysics();
      return;
    }
    this.stepPhysics();

    if (this.state === 'falling') {
      if (++this.overFrames >= OVER_DELAY_FRAMES) {
        this.state = 'over';
        this.onGameOver(this.score);
      }
      return;
    }

    if (this.pieces.some((p) => hasFallen(p))) {
      this.state = 'falling';
      this.dragging = false;
      this.current = null;
      this.overFrames = 0;
      return;
    }

    if (this.state === 'drop') {
      const motions = this.pieces.map((p) => ({ speed: p.speed, angularSpeed: p.angularSpeed }));
      if (this.settle.update(motions)) {
        this.score = this.pieces.length;
        this.spawn();
      }
    }
  }

  private stepPhysics(): void {
    for (const p of this.pieces) p.savePrev();
    this.physics.step();
  }

  private updateCamera(): void {
    let target = this.baseCamTop();
    if (this.current) {
      target = Math.min(target, this.current.y - this.radius - HUD_SPACE);
    } else if (this.pieces.length) {
      target = Math.min(target, this.camTop);
    }
    this.camTop += (target - this.camTop) * 0.12;
  }

  /** `alpha` (0..1) is how far we are between the last physics step and the next one. */
  render(ctx: CanvasRenderingContext2D, scale: number, dpr: number, faces: FaceImages, alpha = 1): void {
    this.updateCamera();
    const view: View = { scale, dpr, viewH: this.viewH, camTop: this.camTop };
    drawWorld(ctx, view, this.pieces, this.current, faces, alpha);
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
