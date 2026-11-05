import './style.css';
import { loadFaces } from './faces';
import { Game, STEP_MS } from './game';
import { WORLD_WIDTH } from './physics';
import { buildBackground } from './render';
import { loadBest, saveBest } from './storage';
import { fetchLatestVersion, reloadToVersion } from './update';
import { Tutorial } from './tutorial';
import { waitForFont } from './fonts';
import { DebugOverlay } from './debug';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const app = $<HTMLDivElement>('app');
const canvas = $<HTMLCanvasElement>('game');
// Opaque canvas: the background is drawn into it (see buildBackground).
// Rendering switches for diagnosing device-specific flicker (e.g. ?canvas=soft&dpr=1&interp=0):
//  canvas=soft  ask for a CPU-backed canvas (willReadFrequently) instead of a GPU one
//  canvas=gpu   force the GPU canvas
//  dpr=N        cap the canvas resolution at N× (default 2)
//  interp=0     draw the latest physics pose without smoothing between steps
const params = new URLSearchParams(location.search);
// Firefox's GPU canvas flickers (stale frames in the lower half) on Android; the CPU canvas does not.
const IS_FIREFOX = /Firefox\//.test(navigator.userAgent);
const SOFT_CANVAS = params.get('canvas') === 'soft' || (IS_FIREFOX && params.get('canvas') !== 'gpu');
const DPR_CAP = Number(params.get('dpr')) > 0 ? Number(params.get('dpr')) : 2;
const INTERPOLATE = params.get('interp') !== '0';
const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: SOFT_CANVAS })!;
const rotateBtn = $<HTMLButtonElement>('rotate');
const overEl = $('over');

$('version').textContent = `v${__APP_VERSION__}`;

const faces = loadFaces();
const game = new Game();
let best = loadBest();
let scale = 1;
let dpr = 1;

const tutorial = new Tutorial(app);
/** The finger tutorial runs only for the first piece after the page is opened. */
let tutorialPending = true;

function startTutorial(): void {
  const bottom = game.aimBottomOnScreen;
  if (bottom === null) return;
  const a = app.getBoundingClientRect();
  const b = rotateBtn.getBoundingClientRect();
  const pieceBottom = bottom * scale;
  const ground = game.groundOnScreen * scale;
  tutorial.start({
    // Right part of the button, a little above its centre so the tilted hand stays on screen.
    tap: { x: b.left - a.left + b.width * 0.8, y: b.top - a.top + b.height * 0.4 },
    swipe: { left: a.width * 0.25, right: a.width * 0.75, y: (pieceBottom + ground) / 2 },
  });
}

/** A newer published version found at game over; loaded when the player retries. */
let pendingUpdate: string | null = null;

// Diagnostics are on by default until release; ?debug=0 hides them.
const debug = params.get('debug') === '0' ? null : new DebugOverlay(app);
const BROWSER = /Firefox\/(\d+)/.exec(navigator.userAgent)?.[0] ?? /Chrome\/(\d+)/.exec(navigator.userAgent)?.[0] ?? 'other';
/** Interpolation factor of the last frame, reused when a resize forces an extra draw. */
let lastAlpha = 1;

function draw(alpha: number): void {
  game.render(ctx, scale, dpr, faces, alpha);
  debug?.render();
}

function resize(): void {
  const h = window.innerHeight;
  const w = Math.min(window.innerWidth, Math.round(h * 0.62));
  // Setting canvas.width/height clears the canvas, so skip resize events that change nothing.
  // Capped at 2: a 3x canvas costs over twice the pixels for little visible gain.
  const d = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  if (canvas.width === Math.round(w * d) && canvas.height === Math.round(h * d)) return;
  app.style.width = `${w}px`;
  dpr = d;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  scale = w / WORLD_WIDTH;
  game.setViewHeight(h / scale);
  buildBackground(canvas.width, canvas.height, scale * dpr);
  debug?.resize(`${w}×${h}`);
  // Resizing clears the canvas; draw again right away so no blank frame is ever shown.
  // Use the same interpolation as the last frame so the extra draw matches it exactly.
  draw(lastAlpha);
  if (tutorial.running) startTutorial();
}
window.addEventListener('resize', resize);
resize();

function toLogicalX(e: PointerEvent): number {
  const r = canvas.getBoundingClientRect();
  return (e.clientX - r.left) / scale;
}

// Only the first finger moves the piece. Any further finger that touches the screen rotates it.
let dragPointer: number | null = null;
canvas.addEventListener('pointerdown', (e) => {
  tutorial.setPaused(true);
  if (dragPointer !== null) {
    game.rotate();
    return;
  }
  dragPointer = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  game.pointerDown(toLogicalX(e));
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId === dragPointer) game.pointerMove(toLogicalX(e));
});
function isOverRotate(e: PointerEvent): boolean {
  const r = rotateBtn.getBoundingClientRect();
  return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}
function endDrag(e: PointerEvent): void {
  if (e.pointerId !== dragPointer) return;
  dragPointer = null;
  // Releasing over the rotate button cancels the drop.
  if (e.type === 'pointercancel' || isOverRotate(e)) game.cancelDrag();
  else game.pointerUp();
  // Decide after the game reacted: show the hand again only if the piece was not dropped,
  // otherwise it would flash for a frame before the tutorial ends.
  if (game.state === 'aim') tutorial.setPaused(false);
  else tutorial.stop();
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
// pointerdown (not click) so the button also works while another finger is on the screen.
rotateBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  game.rotate();
});

function startGame(): void {
  if (pendingUpdate) {
    reloadToVersion(pendingUpdate);
    return;
  }
  overEl.classList.add('hidden');
  rotateBtn.classList.remove('hidden');
  game.start();
  if (tutorialPending) {
    tutorialPending = false;
    startTutorial();
  }
}

game.onGameOver = (score) => {
  const isNew = score > best;
  if (isNew) {
    best = score;
    saveBest(best);
  }
  $('over-best').textContent = String(best);
  $('over-score').textContent = String(score);
  $('new-best').classList.toggle('hidden', !isNew);
  rotateBtn.classList.add('hidden');
  overEl.classList.remove('hidden');
  void fetchLatestVersion().then((v) => {
    if (v && v !== __APP_VERSION__) pendingUpdate = v;
  });
};

$('retry').addEventListener('click', startGame);

let last = performance.now();
let acc = 0;
function frame(now: number): void {
  const dt = now - last;
  acc += Math.min(100, Math.max(0, dt));
  last = now;
  let steps = 0;
  while (acc >= STEP_MS) {
    game.step();
    acc -= STEP_MS;
    steps++;
  }
  lastAlpha = INTERPOLATE ? acc / STEP_MS : 1;
  draw(lastAlpha);
  if (debug) {
    debug.frame(dt, steps);
    debug.update(
      `state ${game.state} pieces ${game.pieces.length} canvas ${canvas.width}×${canvas.height}\n` +
        `mode canvas=${SOFT_CANVAS ? 'soft' : 'gpu'} dpr≤${DPR_CAP} interp=${INTERPOLATE ? 1 : 0}  ${BROWSER}`,
    );
  }
  // The tutorial ends once the first piece has been dropped.
  if (tutorial.running && game.state !== 'aim') tutorial.stop();
  requestAnimationFrame(frame);
}

// Start only after the comic font is ready, so canvas text never shows a fallback font.
void waitForFont('Dela Gothic One').then(() => {
  startGame();
  last = performance.now();
  requestAnimationFrame(frame);
});
