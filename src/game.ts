import { SettleTracker, clamp, heightMeters, pieceIdForIndex } from './logic';
import { pieceById } from './pieces';
import { GROUND_TOP, PieceBody, Physics, WORLD_WIDTH, towerTop } from './physics';
import { FONT, INK, drawPoof, drawPreview, drawWorld, type FaceImages, type View } from './render';
import { encodeTower } from './tower';

export const STEP_MS = 1000 / 60;
/** Gap between the tower top and the bottom of a newly spawned piece. */
export const SPAWN_GAP = 70;
/** Gravity multiplier for a dropped piece until it first touches something: a gentle, accelerating fall. */
export const FREE_FALL_GRAVITY = 0.4;
const HUD_SPACE = 100;
/** Logical px between the platform top and the bottom of the screen at the start. */
const GROUND_FROM_BOTTOM = 190;
/** Steps between a piece falling off and the game-over screen. */
const OVER_DELAY_FRAMES = 1;
/** A piece this far below the screen bottom ends the game even if it is still touching something. */
const FAR_BELOW = 200;
/** A new piece pops out of a smoke cloud: it grows to full size over this many steps… */
export const APPEAR_FRAMES = 24;
/** …while the cloud lasts this long. */
export const POOF_FRAMES = 36;
const ROTATE_STEP = Math.PI / 4;

export type GameState = 'idle' | 'aim' | 'drop' | 'falling' | 'over';

export class Game {
  state: GameState = 'idle';
  score = 0;
  pieces: PieceBody[] = [];
  current: PieceBody | null = null;
  next: PieceBody | null = null;
  /** Called once per game with the piece count, the highest settled tower (m) and the last standing tower. */
  onGameOver: (score: number, height: number, tower: string) => void = () => {};
  /** Snapshot of the tower the last time it stood still (see tower.ts). */
  lastTower = encodeTower([]);
  /** Highest settled tower in this game, in metres. */
  bestHeight = 0;

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
  /** Smoke cloud of the latest spawn (world position and size) and its age in steps. */
  private poof: { x: number; y: number; size: number } | null = null;
  private spawnAge = 0;

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
    this.poof = null;
    this.pieces = [];
    this.score = 0;
    this.bestHeight = 0;
    this.lastTower = encodeTower([]);
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
    this.poof = { x: this.current.x, y: this.current.y, size: Math.max(34, this.radius * 0.95) };
    this.spawnAge = 0;
    this.state = 'aim';
  }

  /** Bottom edge of the piece being aimed, in logical px from the top of the screen. */
  get aimBottomOnScreen(): number | null {
    return this.current ? this.current.bounds.maxY - this.camTop : null;
  }

  /** Top of the platform, in logical px from the top of the screen. */
  get groundOnScreen(): number {
    return GROUND_TOP - this.camTop;
  }

  get pieceNumber(): number {
    return this.count;
  }

  get heightM(): number {
    return heightMeters(GROUND_TOP - towerTop(this.pieces));
  }

  /** Drawing scale of the piece being aimed: pops from small to a little big, then settles at 1. */
  get appearScale(): number {
    // Hidden in the smoke for a moment, then it pops out a little too big and settles.
    const t = Math.min(1, this.spawnAge / APPEAR_FRAMES);
    if (t >= 1) return 1;
    const u = Math.max(0, (t - 0.2) / 0.8);
    const ease = 1 - (1 - u) ** 3;
    return 0.2 + 0.8 * ease + 0.22 * Math.sin(Math.PI * u);
  }

  /** 0 → 1 while the spawn smoke is showing, null when there is none. */
  get poofProgress(): number | null {
    return this.poof && this.spawnAge < POOF_FRAMES ? this.spawnAge / POOF_FRAMES : null;
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
    if (this.state !== 'idle') this.spawnAge++;
    if (this.state === 'idle' || this.state === 'over') {
      if (this.state === 'over') this.stepPhysics();
      return;
    }
    this.stepPhysics();

    if (this.state === 'falling') {
      if (++this.overFrames >= OVER_DELAY_FRAMES) {
        this.state = 'over';
        this.onGameOver(this.score, this.bestHeight, this.lastTower);
      }
      return;
    }

    if (this.pieces.some((p) => this.fellOff(p))) {
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
        this.bestHeight = Math.max(this.bestHeight, this.heightM);
        this.lastTower = encodeTower(this.pieces);
        this.spawn();
      }
    }
  }

  /**
   * Game over when a falling piece that touches nothing reaches the bottom edge of the screen
   * (or, as a safety net, is far below it).
   */
  private fellOff(p: PieceBody): boolean {
    const bottom = this.camTop + this.viewH;
    const maxY = p.bounds.maxY;
    return (maxY >= bottom && !p.touching) || maxY >= bottom + FAR_BELOW;
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
    drawWorld(ctx, view, this.pieces, this.current, faces, alpha, this.current ? this.appearScale : 1);
    if (this.state === 'idle') return;

    const k = scale * dpr;
    const poofT = this.poofProgress;
    if (this.poof && poofT !== null) {
      ctx.setTransform(k, 0, 0, k, 0, -this.camTop * k);
      drawPoof(ctx, this.poof.x, this.poof.y, this.poof.size, poofT);
    }

    // Comic panels: white boxes with an ink border and a hard offset shadow.
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const panel = (x: number, y: number, w: number, h: number) => {
      ctx.fillStyle = INK;
      ctx.fillRect(x + 4, y + 4, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
    };
    panel(10, 10, 104, 70);
    panel(WORLD_WIDTH - 94, 10, 82, 76);

    // Score: a big centred number, the height under it.
    const cx = 10 + 104 / 2;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.font = `40px ${FONT}`;
    ctx.lineWidth = 7;
    ctx.strokeStyle = INK;
    ctx.strokeText(`${this.score}`, cx, 54);
    ctx.fillStyle = '#ffd60a';
    ctx.fillText(`${this.score}`, cx, 54);
    ctx.fillStyle = INK;
    ctx.font = `11px ${FONT}`;
    ctx.fillText(`たかさ ${this.heightM.toFixed(1)}m`, cx, 72);
    ctx.font = `11px ${FONT}`;
    ctx.fillText('つぎ', WORLD_WIDTH - 53, 27);

    if (this.next) drawPreview(ctx, view, this.next, faces, WORLD_WIDTH - 53, 56, 50);
  }
}
