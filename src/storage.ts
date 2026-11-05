const BEST_KEY = 'bustour2026.best';

export function loadBest(): number {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

export function saveBest(score: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Storage may be unavailable (private mode); the best score is then kept for this session only.
  }
}

const BEST_HEIGHT_KEY = 'bustour2026.bestHeight';
const NAME_KEY = 'bustour2026.name';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Kept for this session only when storage is unavailable.
  }
}

export function loadBestHeight(): number {
  const v = Number(read(BEST_HEIGHT_KEY));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function saveBestHeight(height: number): void {
  write(BEST_HEIGHT_KEY, String(height));
}

export function loadName(): string {
  return read(NAME_KEY) ?? '';
}

export function saveName(name: string): void {
  write(NAME_KEY, name);
}
