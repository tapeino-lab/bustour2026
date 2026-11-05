import './style.css';
import { faces, fileToFaceJpeg, setFaces } from './faces';
import type { Online, RankingKind, ScoreEntry } from './online';
import { ANIMALS } from './pieces';
import { Game, STEP_MS } from './game';
import { WORLD_WIDTH } from './physics';
import { buildBackground } from './render';
import { loadBest, loadBestHeight, loadName, saveBest, saveBestHeight, saveName } from './storage';
import { isValidName, normalizeName } from './names';
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

const game = new Game();
let best = loadBest();
let bestHeight = loadBestHeight();
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

game.onGameOver = (score, height) => {
  const isNew = score > best || height > bestHeight;
  if (score > best) {
    best = score;
    saveBest(best);
  }
  if (height > bestHeight) {
    bestHeight = height;
    saveBestHeight(bestHeight);
  }
  $('over-score').textContent = String(score);
  $('over-height').textContent = height.toFixed(1);
  $('over-best').textContent = String(best);
  $('over-best-height').textContent = bestHeight.toFixed(1);
  $('new-best').classList.toggle('hidden', !isNew);
  $('ranking').classList.add('hidden');
  if (online && member) void updateRanking(score, height);
  rotateBtn.classList.add('hidden');
  overEl.classList.remove('hidden');
  $('open-join').classList.toggle('hidden', !online || member);
  void fetchLatestVersion().then((v) => {
    if (v && v !== __APP_VERSION__) pendingUpdate = v;
  });
};

$('retry').addEventListener('click', startGame);

// ---- Online: join code, face photos, admin upload -------------------------------------------
let online: Online | null = null;
let member = false;
const JOIN_LATER_KEY = 'bustour2026.joinLater';
const joinEl = $('join');
const joinInput = $<HTMLInputElement>('join-code');

function joinLater(): boolean {
  try {
    return localStorage.getItem(JOIN_LATER_KEY) === '1';
  } catch {
    return false;
  }
}

function showOverlay(el: HTMLElement, show: boolean): void {
  el.classList.toggle('hidden', !show);
  tutorial.setPaused(show);
}

function showJoin(): void {
  $('join-error').classList.add('hidden');
  joinInput.value = '';
  showOverlay(joinEl, true);
}

async function becomeMember(): Promise<void> {
  member = true;
  if (!online) return;
  setFaces(await online.loadFaces());
  myEntry = await online.myScore().catch(() => null);
}

// ---- Rankings (members only) ------------------------------------------------------------------
let myEntry: ScoreEntry | null = null;
let rankingKind: RankingKind = 'height';
const nameEl = $('name');
const nameInput = $<HTMLInputElement>('name-input');
let nameResolve: ((name: string | null) => void) | null = null;

/** Asks for a three-letter hiragana name; null if the player chose not to register. */
function askName(current: string): Promise<string | null> {
  nameInput.value = current;
  $('name-error').classList.add('hidden');
  showOverlay(nameEl, true);
  return new Promise((resolve) => (nameResolve = resolve));
}
function closeName(result: string | null): void {
  showOverlay(nameEl, false);
  nameResolve?.(result);
  nameResolve = null;
}
$('name-ok').addEventListener('click', () => {
  const name = normalizeName(nameInput.value);
  if (!isValidName(name)) {
    $('name-error').classList.remove('hidden');
    return;
  }
  closeName(name);
});
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) $('name-ok').click();
});
$('name-skip').addEventListener('click', () => closeName(null));

async function saveEntry(entry: Omit<ScoreEntry, 'uid'>): Promise<void> {
  if (!online) return;
  await online.saveScore(entry);
  myEntry = { uid: online.uid, ...entry };
  saveName(entry.name);
}

/** After a game: register a new personal best (asking for a name the first time), then show the ranking. */
async function updateRanking(score: number, height: number): Promise<void> {
  if (!online) return;
  try {
    const improved = !myEntry || score > myEntry.count || height > myEntry.height;
    if (improved) {
      const name = myEntry?.name ?? (loadName() || (await askName('')));
      if (name) {
        await saveEntry({
          name,
          count: Math.max(score, myEntry?.count ?? 0),
          height: Math.max(height, myEntry?.height ?? 0),
        });
      }
    }
  } catch {
    // Saving failed (offline?): still show the ranking below.
  }
  await showRanking();
}

async function showRanking(): Promise<void> {
  if (!online) return;
  const list = $('ranking-list');
  let rows: ScoreEntry[];
  try {
    rows = await online.ranking(rankingKind);
  } catch {
    return;
  }
  list.replaceChildren();
  rows.forEach((r, i) => {
    const li = document.createElement('li');
    if (r.uid === online?.uid) li.className = 'me';
    const rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = `${i + 1}`;
    const name = document.createElement('span');
    name.textContent = r.name;
    const val = document.createElement('span');
    val.className = 'val';
    val.textContent = rankingKind === 'height' ? `${r.height.toFixed(1)}m` : `${r.count}こ`;
    li.append(rank, name, val);
    list.appendChild(li);
  });
  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'まだ だれも いないよ';
    list.appendChild(li);
  }
  $('rename').classList.toggle('hidden', !myEntry);
  $('ranking').classList.remove('hidden');
}

for (const tab of document.querySelectorAll<HTMLButtonElement>('.tab')) {
  tab.addEventListener('click', () => {
    rankingKind = tab.dataset.kind === 'count' ? 'count' : 'height';
    for (const t of document.querySelectorAll('.tab')) t.classList.toggle('on', t === tab);
    void showRanking();
  });
}
$('rename').addEventListener('click', async () => {
  if (!myEntry) return;
  const name = await askName(myEntry.name);
  if (!name || name === myEntry.name) return;
  try {
    await saveEntry({ name, count: myEntry.count, height: myEntry.height });
  } catch {
    return;
  }
  await showRanking();
});

$('join-ok').addEventListener('click', async () => {
  if (!online || !joinInput.value.trim()) return;
  const ok = await online.join(joinInput.value);
  if (!ok) {
    $('join-error').classList.remove('hidden');
    return;
  }
  showOverlay(joinEl, false);
  $('open-join').classList.add('hidden');
  await becomeMember();
});
joinInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('join-ok').click();
});
$('join-later').addEventListener('click', () => {
  try {
    localStorage.setItem(JOIN_LATER_KEY, '1');
  } catch {
    // Without storage the question simply comes back next time.
  }
  showOverlay(joinEl, false);
});
$('open-join').addEventListener('click', showJoin);

async function showAdmin(): Promise<void> {
  if (!online) return;
  const o = online;
  const adminEl = $('admin');
  $('admin-uid').textContent = o.uid;
  const admin = await o.isAdmin().catch(() => false);
  $('admin-status').textContent = admin
    ? 'どうぶつを えらんで しゃしんを とうろく（まんなかを せいほうけいに きりとります）'
    : 'まだ かんりしゃでは ありません。上の ID を Firestore の admins に とうろくしてね';
  const list = $('admin-list');
  list.replaceChildren();
  if (admin) {
    const current = await o.loadFaces();
    for (const a of ANIMALS) {
      const li = document.createElement('li');
      const pic = document.createElement('img');
      pic.alt = '';
      const src = current.get(a.id);
      if (src) pic.src = src;
      else pic.className = 'noface';
      const name = document.createElement('span');
      name.textContent = a.name;
      const label = document.createElement('label');
      label.textContent = 'しゃしん';
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        label.textContent = 'ほぞんちゅう…';
        try {
          const jpeg = await fileToFaceJpeg(file);
          await o.saveFace(a.id, jpeg);
          pic.src = jpeg;
          pic.className = '';
          setFaces(new Map([[a.id, jpeg]]));
          label.textContent = 'かえる';
        } catch {
          label.textContent = 'しっぱい';
        }
        input.value = '';
      });
      label.appendChild(input);
      li.append(pic, name, label);
      list.appendChild(li);
    }
  }
  showOverlay(adminEl, true);
}
$('admin-close').addEventListener('click', () => showOverlay($('admin'), false));

async function initOnline(): Promise<void> {
  // Without Firebase settings the game runs offline with dummy faces (and skips the download).
  if (!import.meta.env.VITE_FIREBASE_API_KEY) return;
  try {
    const { Online } = await import('./online');
    online = await Online.connect();
  } catch {
    online = null;
  }
  if (!online) return;
  member = await online.isMember().catch(() => false);
  if (member) await becomeMember().catch(() => undefined);
  else if (!joinLater()) showJoin();
  if (params.get('admin') === '1') await showAdmin().catch(() => undefined);
}

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
        `mode canvas=${SOFT_CANVAS ? 'soft' : 'gpu'} dpr≤${DPR_CAP} interp=${INTERPOLATE ? 1 : 0}  ${BROWSER}\n` +
        `net ${online ? (member ? 'member' : 'guest') : 'off'} faces ${faces.size}`,
    );
  }
  // The tutorial ends once the first piece has been dropped.
  if (tutorial.running && game.state !== 'aim') tutorial.stop();
  requestAnimationFrame(frame);
}

// Start only after the comic font is ready, so canvas text never shows a fallback font.
void waitForFont('Dela Gothic One').then(() => {
  startGame();
  void initOnline();
  last = performance.now();
  requestAnimationFrame(frame);
});
