import './style.css';
import {
  DEFAULT_ENHANCE, ENHANCE_LABELS, ENHANCE_LEVELS, enhancedFace, faces, fileToFaceJpeg, fileToSpritePng, setFaces,
  type Enhance,
} from './faces';
import type { NewRecords, Online, PlayRecord, RankingKind, ScoreEntry } from './online';
import { ALL_PIECES } from './pieces';
import { Game, STEP_MS } from './game';
import { WORLD_WIDTH } from './physics';
import { buildBackground } from './render';
import { loadBest, loadBestHeight, loadName, saveBest, saveBestHeight, saveName } from './storage';
import {
  KANA_COLUMNS, NAME_LENGTH, isValidName, toggleDakuten, toggleHandakuten, toggleSmall, typeKana,
} from './names';
import { beatsRecord, topRows, type RankingRow } from './ranking';
import { formatHeight } from './logic';
import { decodeTower, towerBodies, towerBreaker } from './tower';
import { drawTowerImage } from './render';
import { fetchLatestVersion, reloadToVersion } from './update';
import { Tutorial } from './tutorial';
import { waitForFont } from './fonts';
import { DebugOverlay } from './debug';
import { Sound } from './sound';

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
// Diagnostics: shown only when an admin device opens the game with ?admin=1 (otherwise everyone,
// admins included, plays as an ordinary user), or with ?debug=1; ?debug=0 hides them.
let debug: DebugOverlay | null = params.get('debug') === '1' ? new DebugOverlay(app) : null;
function showDiagnostics(): void {
  if (!debug && params.get('debug') !== '0') debug = new DebugOverlay(app);
}
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
  // Sound toggles sit right under the つぎ panel (drawn on the canvas in logical px).
  const soundEl = $('sound');
  soundEl.style.left = `${(WORLD_WIDTH - 94) * scale}px`;
  soundEl.style.top = `${96 * scale}px`;
  soundEl.style.width = `${82 * scale}px`;
  // The ranking button sits under the score panel on the left, level with the sound switches.
  const rankBtn = $('ranking-open');
  rankBtn.style.left = `${10 * scale}px`;
  rankBtn.style.top = `${96 * scale}px`;
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
// PC: right click rotates (and never opens the browser menu).
// mousedown fires for the right button even while the left one is held (dragging), whereas a
// second button on the same mouse gives no new pointerdown, so rotation listens to mousedown.
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 2) game.rotate();
});
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button === 2) return; // handled by mousedown
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
  if (e.pointerId !== dragPointer) return;
  game.pointerMove(toLogicalX(e));
  showCancel(isOverRotate(e));
});
function isOverRotate(e: PointerEvent): boolean {
  const r = rotateBtn.getBoundingClientRect();
  return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}
/** While a swipe is over the rotate button, it lights up and reads キャンセル (letting go there cancels). */
function showCancel(on: boolean): void {
  if (rotateBtn.classList.contains('cancel') === on) return;
  rotateBtn.classList.toggle('cancel', on);
  $('rotate-label').textContent = on ? 'キャンセル' : 'かいてん';
}
function endDrag(e: PointerEvent): void {
  if (e.pointerId !== dragPointer) return;
  dragPointer = null;
  showCancel(false);
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
  if (pendingUpdate && reloadToVersion(pendingUpdate)) {
    return;
  }
  overEl.classList.add('hidden');
  rotateBtn.classList.remove('hidden');
  game.start();
  // The music starts again from the beginning with every new game.
  sound.restartMusic();
  if (tutorialPending) {
    tutorialPending = false;
    startTutorial();
  }
}

let lastTower = '';
$('my-tower').addEventListener('click', () => showTower('こんかいの タワー', `${$('over-score').textContent}こ`, lastTower));

game.onGameOver = (score, height, tower) => {
  lastTower = tower;
  // This game's tower as a tall thumbnail (tap to enlarge).
  const myTower = score > 0 ? decodeTower(tower) : null;
  if (myTower) drawTowerImage($<HTMLCanvasElement>('my-tower-canvas'), towerBodies(myTower), 110, 150, faces);
  $('my-tower').classList.toggle('hidden', !myTower);
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
  $('over-height').textContent = formatHeight(height);
  $('over-best').textContent = String(best);
  $('over-best-height').textContent = formatHeight(bestHeight);
  $('new-best').classList.toggle('hidden', !isNew);
  // On a new best the best line would just repeat this game's numbers.
  $('over-best-block').classList.toggle('hidden', isNew);
  sound.stopMusic();
  sound.play(isNew && score > 0 ? 'best' : 'over');
  // Members see only the score first, then "つぎへ" leads to the ranking (with もういちど there).
  const ranked = !!online && member;
  rankingSaved = ranked ? updateRanking(score, height, tower) : Promise.resolve();
  // Play history (members, not admin test plays): after the ranking, so a first name is known.
  if (ranked && !adminDevice) {
    const o = online!;
    void rankingSaved.then(() => o.recordPlay(myEntry?.name ?? (loadName() || undefined))).catch(() => undefined);
  }
  $('retry').classList.toggle('hidden', ranked);
  $('to-ranking').classList.toggle('hidden', !ranked);
  rotateBtn.classList.add('hidden');
  overEl.classList.remove('hidden');
  alignToRankingButton();
  $('open-join').classList.toggle('hidden', !online || member);
  void checkForUpdate();
};

/**
 * The score panel is shorter than the ranking panel, so つぎへ would sit higher than the
 * ranking's もういちど！. Move it down (only the button; the panel stays as it is) by half the
 * height difference, which is how far the centred layout puts the ranking's button lower.
 */
function alignToRankingButton(): void {
  const panelH = document.querySelector<HTMLElement>('#over .result-panel')!.offsetHeight;
  $('to-ranking').style.top = `calc((var(--rank-panel-h) - ${panelH}px) / 2)`;
}

$('retry').addEventListener('click', startGame);
$('rv-retry').addEventListener('click', () => {
  showOverlay(rankingViewEl, false);
  startGame();
});
$('to-ranking').addEventListener('click', async () => {
  await rankingSaved;
  if (await openRankingView(true)) {
    overEl.classList.add('hidden');
  } else {
    // The ranking could not be loaded (offline?): stay on the score with もういちど.
    $('to-ranking').classList.add('hidden');
    $('retry').classList.remove('hidden');
  }
});

// ---- Updates: look for a new version regularly, apply it only at a natural moment ----------
const UPDATE_CHECK_MS = 60_000;

async function checkForUpdate(): Promise<void> {
  const v = await fetchLatestVersion();
  if (v && v !== __APP_VERSION__) pendingUpdate = v;
}

/** Nothing would be lost by reloading now: no piece dropped yet, no finger down, no dialog open. */
function atFreshStart(): boolean {
  const dialogOpen = [...document.querySelectorAll('.overlay')].some((el) => !el.classList.contains('hidden'));
  return game.state === 'aim' && game.pieceNumber === 1 && dragPointer === null && !dialogOpen;
}

/** Applies a pending update if this is a natural moment (never in the middle of a game). */
function maybeApplyUpdate(returning = false): void {
  if (!pendingUpdate) return;
  // Coming back to the app with only the result screen up (no name entry etc.) is also fine.
  const open = [...document.querySelectorAll('.overlay')].filter((el) => !el.classList.contains('hidden'));
  const resultsShown =
    returning && game.state === 'over' && open.length === 1 && (open[0] === overEl || open[0] === rankingViewEl);
  if (atFreshStart() || resultsShown) reloadToVersion(pendingUpdate);
}

setInterval(() => {
  void checkForUpdate().then(() => maybeApplyUpdate());
}, UPDATE_CHECK_MS);
setInterval(() => maybeApplyUpdate(), 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void checkForUpdate().then(() => maybeApplyUpdate(true));
});

// ---- Sound: off at every launch; toggles under the つぎ panel --------------------------------
const sound = new Sound();
game.onSound = (name, size) => sound.play(name, size);
// Another app/tab in front, or the screen locked: pause the music and effects until we are back.
document.addEventListener('visibilitychange', () => sound.setHidden(document.hidden));
window.addEventListener('pagehide', () => sound.setHidden(true));
window.addEventListener('pageshow', () => sound.setHidden(document.hidden));
const sfxToggle = $<HTMLButtonElement>('sfx-toggle');
const bgmToggle = $<HTMLButtonElement>('bgm-toggle');
sfxToggle.addEventListener('click', () => {
  sound.setSfx(!sound.sfxOn);
  sfxToggle.setAttribute('aria-pressed', String(sound.sfxOn));
});
bgmToggle.addEventListener('click', async () => {
  const on = !sound.bgmOn;
  bgmToggle.setAttribute('aria-pressed', String(on));
  const ok = await sound.setBgm(on);
  if (!ok) {
    // No music uploaded yet: hide the switch again.
    bgmToggle.setAttribute('aria-pressed', 'false');
    bgmToggle.classList.add('hidden');
  }
});

// ---- Online: join code, face photos, admin upload -------------------------------------------
let online: Online | null = null;
let member = false;
/**
 * An admin device opened with ?admin=1 (test plays): its games are not put on the ranking.
 * Without ?admin=1 an admin plays and ranks like everyone else.
 */
let adminDevice = false;
const joinEl = $('join');
const joinInput = $<HTMLInputElement>('join-code');

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
  // Music is members-only and downloaded only when someone switches it on.
  const o = online;
  sound.loadBgm = () => o.loadBgm();
  $('bgm-toggle').classList.remove('hidden');
  $('ranking-open').classList.remove('hidden');
  setFaces(await online.loadFaces());
  myEntry = await online.myScore().catch(() => null);
  adminDevice = params.get('admin') === '1' && (await online.isAdmin().catch(() => false));
}

// ---- Rankings (members only) ------------------------------------------------------------------
let myEntry: ScoreEntry | null = null;
/** Saving this game's record (and asking for a name); the ranking is shown once it is done. */
let rankingSaved: Promise<void> = Promise.resolve();
const rankingViewEl = $('ranking-view');
const nameEl = $('name');
// Names are typed on an on-screen 50-sound keyboard, so only hiragana (max three) can be entered.
let typedName = '';
function showTypedName(): void {
  const boxes = $('name-boxes').children;
  for (let i = 0; i < NAME_LENGTH; i++) {
    boxes[i].textContent = typedName[i] ?? '';
    boxes[i].classList.toggle('next', i === typedName.length);
  }
  $('name-error').classList.add('hidden');
}
function key(label: string, onPress: () => void, className = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  if (className) b.className = className;
  b.addEventListener('click', () => {
    onPress();
    showTypedName();
  });
  return b;
}
{
  const keys = $('kana-keys');
  for (const col of KANA_COLUMNS) {
    for (const k of col) {
      const b = key(k || '・', () => (typedName = typeKana(typedName, k)));
      if (!k) {
        b.className = 'blank';
        b.disabled = true;
      }
      keys.appendChild(b);
    }
  }
  const tools = document.createElement('div');
  tools.className = 'kana-tools';
  tools.append(
    key('゛', () => (typedName = toggleDakuten(typedName)), 'mark'),
    key('゜', () => (typedName = toggleHandakuten(typedName)), 'mark'),
    key('小', () => (typedName = toggleSmall(typedName))),
    key('ー', () => (typedName = typeKana(typedName, 'ー'))),
  );
  keys.after(tools);
  // けす sits next to the letters, away from けってい.
  $('name-del').addEventListener('click', () => {
    typedName = typedName.slice(0, -1);
    showTypedName();
  });
}
let nameResolve: ((name: string | null) => void) | null = null;

/** Asks for a three-letter hiragana name; null if the player chose not to register. */
/**
 * Asks for a name. The first time (no name yet) the other button is のせない (the record is not
 * put on the ranking); when renaming it is キャンセル (the old name stays).
 */
function askName(current: string): Promise<string | null> {
  $('name-skip').textContent = current ? 'キャンセル' : 'のせない';
  typedName = current;
  showTypedName();
  showOverlay(nameEl, true);
  return new Promise((resolve) => (nameResolve = resolve));
}
function closeName(result: string | null): void {
  showOverlay(nameEl, false);
  nameResolve?.(result);
  nameResolve = null;
}
$('name-ok').addEventListener('click', () => {
  const name = typedName;
  if (!isValidName(name)) {
    $('name-error').classList.remove('hidden');
    return;
  }
  closeName(name);
});
$('name-skip').addEventListener('click', () => closeName(null));

async function saveEntry(entry: Omit<ScoreEntry, 'uid'>, records: NewRecords = {}): Promise<void> {
  if (!online) return;
  await online.saveScore(entry, records);
  const now = Date.now();
  myEntry = {
    uid: online.uid,
    ...entry,
    countAt: records.count ? now : myEntry?.countAt,
    heightAt: records.height ? now : myEntry?.heightAt,
  };
  saveName(entry.name);
}

/** After a game: register a new personal best (asking for a name the first time). */
async function updateRanking(score: number, height: number, tower: string): Promise<void> {
  if (!online || adminDevice) return;
  try {
    // Compare with the records as they are now (an admin may have reset or deleted them).
    myEntry = await online.myScore().catch(() => myEntry);
    // Nothing to register for a game where no piece was stacked.
    const game = { count: score, height };
    const countUp = score > 0 && beatsRecord(game, myEntry, 'count');
    const heightUp = score > 0 && beatsRecord(game, myEntry, 'height');
    if (countUp || heightUp) {
      const name = myEntry?.name ?? (loadName() || (await askName('')));
      if (name) {
        // Each record keeps the numbers and the tower of the game that set it.
        await saveEntry({
          name,
          count: countUp ? score : myEntry!.count,
          countHeight: countUp ? height : myEntry?.countHeight,
          towerCount: countUp ? tower : myEntry?.towerCount,
          height: heightUp ? height : myEntry!.height,
          heightCount: heightUp ? score : myEntry?.heightCount,
          towerHeight: heightUp ? tower : myEntry?.towerHeight,
        }, { count: countUp, height: heightUp });
      }
    }
  } catch {
    // Saving failed (offline?): the ranking is still shown afterwards.
  }
}

/** Opens the tower viewer for a snapshot string; does nothing if it cannot be read. */
function showTower(name: string, record: string, snapshot: string | undefined): void {
  const tower = decodeTower(snapshot);
  if (!tower) return;
  const w = Math.min(300, Math.round(window.innerWidth * 0.78));
  const h = Math.min(Math.round(w * 1.35), Math.round(window.innerHeight * 0.62));
  drawTowerImage($<HTMLCanvasElement>('tower-canvas'), towerBodies(tower), w, h, faces, towerBreaker(snapshot));
  const nameEl = document.createElement('span');
  nameEl.className = 'tt-name';
  nameEl.textContent = name;
  const recordEl = document.createElement('span');
  recordEl.className = 'tt-val';
  recordEl.textContent = record;
  $('tower-title').replaceChildren(nameEl, recordEl);
  showOverlay($('tower'), true);
}
$('tower-close').addEventListener('click', () => showOverlay($('tower'), false));

/**
 * Rows are a grid: rank | name | value | slot. The slot holds a thumbnail for the top three,
 * a "みる" chip for the other rows with a snapshot, or stays empty, so the values line up.
 */
const THUMBS = 3;

function fillRanking(list: HTMLElement, rows: RankingRow[], kind: RankingKind): void {
  list.replaceChildren();
  rows.forEach((r, i) => {
    const li = document.createElement('li');
    if (r.dummy) li.classList.add('dummy');
    else if (r.uid === online?.uid) li.classList.add('me');
    const snapshot = kind === 'height' ? r.towerHeight : r.towerCount;
    const tower = r.dummy ? null : decodeTower(snapshot);
    const rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = `${i + 1}`;
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = r.name;
    const val = document.createElement('span');
    val.className = 'val';
    // In the list the count has no unit (the column header says こすう); the viewer title keeps it.
    val.textContent = kind === 'height' ? formatHeight(r.height) : `${r.count}`;
    if (kind === 'height') {
      const unit = document.createElement('small');
      unit.textContent = 'm';
      val.appendChild(unit);
    }
    const record = kind === 'height' ? `${formatHeight(r.height)}m` : `${r.count}こ`;
    let slot: HTMLElement = document.createElement('span');
    if (tower && i < THUMBS) {
      const thumb = document.createElement('canvas');
      thumb.className = 'thumb';
      drawTowerImage(thumb, towerBodies(tower), 30, 40, faces);
      li.classList.add('thumb-row');
      slot = thumb;
    } else if (tower) {
      slot.className = 'chip';
      slot.textContent = 'みる';
    }
    li.append(rank, name, val, slot);
    if (tower) {
      li.classList.add('has-tower');
      li.addEventListener('click', () => showTower(r.name, record, snapshot));
    }
    list.appendChild(li);
  });
}

/** Loads both rankings (top 10 each, mixed with placeholder rows) into two lists. */
async function loadRankingInto(heightList: HTMLElement, countList: HTMLElement): Promise<boolean> {
  if (!online) return false;
  try {
    const [byHeight, byCount] = await Promise.all([online.ranking('height'), online.ranking('count')]);
    fillRanking(heightList, topRows(byHeight, 'height'), 'height');
    fillRanking(countList, topRows(byCount, 'count'), 'count');
    return true;
  } catch {
    return false;
  }
}

/**
 * The ranking screen, shared by the trophy button and the end of a game. After a game it offers
 * もういちど instead of とじる. The rename button shows whenever the player is on the ranking.
 */
async function openRankingView(afterGame: boolean): Promise<boolean> {
  if (!(await loadRankingInto($('rv-height'), $('rv-count')))) return false;
  $('rename').classList.toggle('hidden', !myEntry);
  $('rv-retry').classList.toggle('hidden', !afterGame);
  $('ranking-close').classList.toggle('hidden', afterGame);
  showOverlay(rankingViewEl, true);
  return true;
}

// Trophy button (top left): the rankings at any time.
$('ranking-open').addEventListener('click', () => void openRankingView(false));
$('ranking-close').addEventListener('click', () => showOverlay(rankingViewEl, false));

$('rename').addEventListener('click', async () => {
  if (!myEntry) return;
  const name = await askName(myEntry.name);
  if (!name || name === myEntry.name) return;
  try {
    // Only the name changes; the records (and their sets) stay as they are.
    await saveEntry({ ...myEntry, name });
  } catch {
    return;
  }
  await loadRankingInto($('rv-height'), $('rv-count'));
});

$('join-ok').addEventListener('click', async () => {
  const code = joinDigits(joinInput.value);
  joinInput.value = code;
  if (!online || !code) return;
  const ok = await online.join(code);
  if (!ok) {
    $('join-error').classList.remove('hidden');
    return;
  }
  showOverlay(joinEl, false);
  $('open-join').classList.add('hidden');
  await becomeMember();
});
// Join codes are numbers of up to four digits: drop anything else as it is typed.
// Join codes are numbers of up to four digits. Clean the field only once typing is settled:
// rewriting it while a Japanese keyboard is still composing (iOS) doubles characters and moves
// the cursor, which made correct codes fail.
function joinDigits(text: string): string {
  return text.normalize('NFKC').replace(/[^0-9]/g, '').slice(0, 4);
}
function cleanJoinInput(): void {
  const digits = joinDigits(joinInput.value);
  if (digits !== joinInput.value) joinInput.value = digits;
}
joinInput.addEventListener('input', (e) => {
  if (!(e as InputEvent).isComposing) cleanJoinInput();
});
joinInput.addEventListener('compositionend', cleanJoinInput);
joinInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('join-ok').click();
});
$('join-later').addEventListener('click', () => showOverlay(joinEl, false));
$('open-join').addEventListener('click', showJoin);

async function showAdmin(): Promise<void> {
  if (!online) return;
  const o = online;
  const adminEl = $('admin');
  $('admin-uid').textContent = o.uid;
  const admin = await o.isAdmin().catch(() => false);
  $('admin-status').textContent = admin
    ? ''
    : 'まだ かんりしゃでは ありません。上の ID を Firestore の admins に とうろくしてね';
  $('admin-tabs').classList.toggle('hidden', !admin);
  if (admin) showAdminTab(o, 'faces');
  const list = $('admin-list');
  list.replaceChildren();
  if (admin) {
    const current = await o.loadAllFaces();
    for (const a of ALL_PIECES) {
      const li = document.createElement('li');
      const pic = document.createElement('img');
      pic.alt = '';
      const entry = current.get(a.id);
      if (entry) pic.src = entry.image;
      else pic.className = 'noface';
      // Next to the uploaded photo: how the game shows it (evened out; cut-outs stay as they are).
      const after = document.createElement('canvas');
      after.className = 'after hidden';
      let enablePick = () => {};
      let enhance: Enhance = entry?.enhance ?? DEFAULT_ENHANCE;
      const showAfter = () => {
        if (a.sprite || !pic.src) return;
        const e = enhancedFace(pic, enhance);
        after.width = e.width;
        after.height = e.height;
        after.getContext('2d')!.drawImage(e, 0, 0);
        after.classList.remove('hidden');
      };
      pic.addEventListener('load', showAfter);
      const name = document.createElement('span');
      name.className = 'face-name';
      name.textContent = a.name;
      // Name on top, the controls (かこう, ひょうじ, しゃしん) under it.
      const controls = document.createElement('span');
      controls.className = 'face-controls';
      // How strongly the photo is evened out (some faces get too red with the strong setting).
      if (!a.sprite) {
        const pick = document.createElement('select');
        pick.className = 'enhance';
        for (const level of ENHANCE_LEVELS) {
          const opt = document.createElement('option');
          opt.value = level;
          opt.textContent = `かこう：${ENHANCE_LABELS[level]}`;
          pick.appendChild(opt);
        }
        pick.value = enhance;
        pick.disabled = !entry;
        pick.addEventListener('change', async () => {
          const before = enhance;
          enhance = pick.value as Enhance;
          showAfter();
          pick.disabled = true;
          try {
            await o.setFaceEnhance(a.id, enhance);
            if (show.getAttribute('aria-pressed') === 'true') setFaces(new Map([[a.id, { image: pic.src, enhance }]]));
          } catch {
            enhance = before;
            pick.value = before;
            showAfter();
          }
          pick.disabled = false;
        });
        controls.appendChild(pick);
        enablePick = () => (pick.disabled = false);
      }
      // Registering and showing are separate: a photo appears in the game only while this is on.
      const show = document.createElement('button');
      show.type = 'button';
      show.className = 'toggle show';
      show.textContent = 'ひょうじ';
      show.setAttribute('aria-pressed', String(entry?.visible ?? false));
      show.disabled = !entry;
      show.addEventListener('click', async () => {
        const on = show.getAttribute('aria-pressed') !== 'true';
        show.disabled = true;
        try {
          await o.setFaceVisible(a.id, on);
          show.setAttribute('aria-pressed', String(on));
          if (on) setFaces(new Map([[a.id, { image: pic.src, enhance }]]));
          else faces.delete(a.id);
        } catch {
          // Leave the switch as it was.
        }
        show.disabled = false;
      });
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
          // Cut-out photos (like しげみ) keep their transparent background.
          const jpeg = a.sprite ? await fileToSpritePng(file) : await fileToFaceJpeg(file);
          await o.saveFace(a.id, jpeg);
          pic.src = jpeg;
          pic.className = '';
          // Only shown in the game if the display switch is on.
          if (show.getAttribute('aria-pressed') === 'true') setFaces(new Map([[a.id, { image: jpeg, enhance }]]));
          show.disabled = false;
          enablePick();
          label.textContent = 'かえる';
        } catch {
          label.textContent = 'しっぱい';
        }
        input.value = '';
      });
      label.appendChild(input);
      const photos = document.createElement('span');
      photos.className = 'photos';
      photos.append(pic, after);
      controls.append(show, label);
      const body = document.createElement('span');
      body.className = 'face-body';
      body.append(name, controls);
      li.append(photos, body);
      list.appendChild(li);
    }
  }
  if (admin) {
    for (const tab of document.querySelectorAll<HTMLButtonElement>('#admin-tabs [data-tab]')) {
      tab.onclick = () => showAdminTab(o, tab.dataset.tab as AdminTab);
    }
    const resetStatus = $('admin-reset-status');
    for (const kind of ['count', 'height'] as RankingKind[]) {
      const label = kind === 'count' ? 'こすう' : 'たかさ';
      $(kind === 'count' ? 'admin-reset-count' : 'admin-reset-height').onclick = async () => {
        if (!window.confirm(`${label}の ランキングを リセットしますか？（もとに もどせません。${kind === 'count' ? 'たかさ' : 'こすう'}は そのまま）`)) return;
        resetStatus.textContent = 'リセットちゅう…';
        try {
          const n = await o.resetRanking(kind);
          resetStatus.textContent = `${label}を リセットしました（${n}けん）`;
          await showAdminScores(o);
        } catch (e) {
          // Show why (e.g. permission-denied when the console still has older rules).
          resetStatus.textContent = `しっぱい（${(e as { code?: string }).code ?? String(e)}）`;
        }
      };
    }
    const fileInput = $<HTMLInputElement>('admin-bgm-file');
    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;
      const status = $('admin-bgm-status');
      if (file.size > 700_000) {
        status.textContent = 'おおきすぎます（700KBまで）';
        return;
      }
      status.textContent = 'ほぞんちゅう…';
      try {
        const audio = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => reject(r.error);
          r.readAsDataURL(file);
        });
        await o.saveBgm(audio);
        status.textContent = 'ほぞんしました';
      } catch {
        status.textContent = 'しっぱい';
      }
    };
  }
  showOverlay(adminEl, true);
}
type AdminTab = 'faces' | 'ranking' | 'plays' | 'bgm';

/** Admin page tabs: shows one, and loads the ranking / play history fresh when opened. */
function showAdminTab(o: Online, tab: AdminTab): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>('#admin-tabs [data-tab]')) {
    b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  }
  for (const t of ['faces', 'ranking', 'plays', 'bgm'] as AdminTab[]) $(`tab-${t}`).classList.toggle('hidden', t !== tab);
  if (tab === 'ranking') void showAdminScores(o);
  if (tab === 'plays') void showAdminPlays(o);
}

/** Short date and time, e.g. 11/11 21:40. */
function shortDate(ms?: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Admin page: every player's number of games and last game, most recent first. */
async function showAdminPlays(o: Online): Promise<void> {
  const status = $('admin-plays-status');
  const list = $('admin-plays-list');
  status.textContent = 'よみこみちゅう…';
  let plays: PlayRecord[];
  const names = new Map<string, string>();
  try {
    plays = await o.allPlays();
    // The ranking name is the newest one; the play history keeps the name from the last game.
    for (const e of await o.allScores().catch(() => [])) names.set(e.uid, e.name);
  } catch (e) {
    status.textContent = `しっぱい（${(e as { code?: string }).code ?? String(e)}）`;
    return;
  }
  plays.sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0));
  const total = plays.reduce((n, p) => n + p.count, 0);
  status.textContent = `${plays.length}にん・ぜんぶで ${total}かい`;
  list.replaceChildren();
  for (const p of plays) {
    const li = document.createElement('li');
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = names.get(p.uid) ?? p.name ?? '（なまえ なし）';
    const rec = document.createElement('span');
    rec.className = 'rec';
    const mine = p.uid === o.uid ? '　この たんまつ' : '';
    rec.textContent = `${p.count}かい${mine}\nさいご ${shortDate(p.lastAt)}`;
    rec.style.whiteSpace = 'pre-line';
    li.append(who, rec);
    list.appendChild(li);
  }
}

/**
 * Admin page: every ranking entry with a delete button, sorted by name (then newest first) so a
 * player who played in two browsers shows up as two rows next to each other (marked).
 */
async function showAdminScores(o: Online): Promise<void> {
  const status = $('admin-scores-status');
  const list = $('admin-scores-list');
  status.textContent = 'よみこみちゅう…';
  let entries: ScoreEntry[];
  try {
    entries = await o.allScores();
  } catch (e) {
    status.textContent = `しっぱい（${(e as { code?: string }).code ?? String(e)}）`;
    return;
  }
  status.textContent = `${entries.length}けん`;
  entries.sort((a, b) => a.name.localeCompare(b.name, 'ja') || (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const names = new Map<string, number>();
  for (const e of entries) names.set(e.name, (names.get(e.name) ?? 0) + 1);
  const date = shortDate;
  list.replaceChildren();
  for (const e of entries) {
    const li = document.createElement('li');
    if ((names.get(e.name) ?? 0) > 1) li.classList.add('dup');
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = e.name;
    const rec = document.createElement('span');
    rec.className = 'rec';
    const mine = e.uid === o.uid ? '　この たんまつ' : '';
    // A record reset by an admin shows as —.
    const count = e.count > 0 ? `${e.count}こ` : '—こ';
    const height = e.height > 0 ? `${formatHeight(e.height)}m` : '—m';
    rec.textContent = `${count} ${height}${mine}\nほぞん ${date(e.updatedAt)}`;
    rec.style.whiteSpace = 'pre-line';
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = 'けす';
    del.addEventListener('click', async () => {
      const when = date(e.updatedAt);
      if (!window.confirm(`「${e.name}」の きろく（${e.count}こ ${formatHeight(e.height)}m、${when}）を けしますか？（もとに もどせません）`)) return;
      del.disabled = true;
      try {
        await o.deleteScore(e.uid);
        if (e.uid === o.uid) myEntry = null;
        await showAdminScores(o);
      } catch (err) {
        del.disabled = false;
        status.textContent = `しっぱい（${(err as { code?: string }).code ?? String(err)}）`;
      }
    });
    li.append(who, rec, del);
    list.appendChild(li);
  }
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
  // Devices without the code are asked at every launch.
  else showJoin();
  if (params.get('admin') === '1' && (await online.isAdmin().catch(() => false))) showDiagnostics();
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
