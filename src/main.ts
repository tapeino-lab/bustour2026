import './style.css';
import { loadFaces } from './faces';
import { Game, STEP_MS } from './game';
import { WORLD_WIDTH } from './physics';
import { loadBest, saveBest } from './storage';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const app = $<HTMLDivElement>('app');
const canvas = $<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d')!;
const rotateBtn = $<HTMLButtonElement>('rotate');
const titleEl = $('title');
const overEl = $('over');

$('version').textContent = `v${__APP_VERSION__}`;

const faces = loadFaces();
const game = new Game();
let best = loadBest();
let scale = 1;
let dpr = 1;

function showBest(): void {
  $('title-best').textContent = String(best);
  $('over-best').textContent = String(best);
}
showBest();

function resize(): void {
  const h = window.innerHeight;
  const w = Math.min(window.innerWidth, Math.round(h * 0.62));
  app.style.width = `${w}px`;
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  scale = w / WORLD_WIDTH;
  game.setViewHeight(h / scale);
}
window.addEventListener('resize', resize);
resize();

function toLogicalX(e: PointerEvent): number {
  const r = canvas.getBoundingClientRect();
  return (e.clientX - r.left) / scale;
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  game.pointerDown(toLogicalX(e));
});
canvas.addEventListener('pointermove', (e) => game.pointerMove(toLogicalX(e)));
canvas.addEventListener('pointerup', () => game.pointerUp());
canvas.addEventListener('pointercancel', () => game.pointerUp());
rotateBtn.addEventListener('click', () => game.rotate());

function startGame(): void {
  titleEl.classList.add('hidden');
  overEl.classList.add('hidden');
  rotateBtn.classList.remove('hidden');
  game.start();
}

game.onGameOver = (score) => {
  const isNew = score > best;
  if (isNew) {
    best = score;
    saveBest(best);
  }
  showBest();
  $('over-score').textContent = String(score);
  $('new-best').classList.toggle('hidden', !isNew);
  rotateBtn.classList.add('hidden');
  overEl.classList.remove('hidden');
};

$('start').addEventListener('click', startGame);
$('retry').addEventListener('click', startGame);
$('to-title').addEventListener('click', () => {
  overEl.classList.add('hidden');
  titleEl.classList.remove('hidden');
});

let last = performance.now();
let acc = 0;
function frame(now: number): void {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= STEP_MS) {
    game.step();
    acc -= STEP_MS;
  }
  game.render(ctx, scale, dpr, faces);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
