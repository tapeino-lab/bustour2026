// A tower snapshot: which piece is where, at which angle, when the tower last stood still.
// It is redrawn from this record (no physics), so it stays valid when physics settings change;
// it only assumes the piece shapes stay the same. Format: "v1|id,x,y,angle;id,x,y,angle;…".
import { ALL_PIECES } from './pieces';
import { PieceBody } from './physics';

const VERSION = 'v1';
export const MAX_TOWER_PIECES = 300;
/** Firestore rules accept tower strings shorter than this. */
export const MAX_TOWER_LENGTH = 12000;

export interface TowerPiece {
  id: string;
  x: number;
  y: number;
  angle: number;
}

const KNOWN_IDS = new Set(ALL_PIECES.map((p) => p.id));

export function encodeTower(pieces: { def: { id: string }; x: number; y: number; angle: number }[]): string {
  const parts = pieces
    .slice(0, MAX_TOWER_PIECES)
    .map((p) => `${p.def.id},${p.x.toFixed(1)},${p.y.toFixed(1)},${p.angle.toFixed(3)}`);
  return `${VERSION}|${parts.join(';')}`;
}

/** Parses a snapshot (it may come from other devices, so everything is checked). null if unusable. */
export function decodeTower(s: unknown): TowerPiece[] | null {
  if (typeof s !== 'string' || s.length > MAX_TOWER_LENGTH || !s.startsWith(`${VERSION}|`)) return null;
  const body = s.slice(VERSION.length + 1);
  if (!body) return [];
  const out: TowerPiece[] = [];
  for (const item of body.split(';').slice(0, MAX_TOWER_PIECES)) {
    const [id, xs, ys, as] = item.split(',');
    const x = Number(xs);
    const y = Number(ys);
    const angle = Number(as);
    if (!KNOWN_IDS.has(id) || ![x, y, angle].every(Number.isFinite)) return null;
    if (Math.abs(x) > 1e5 || Math.abs(y) > 1e5) return null;
    out.push({ id, x, y, angle });
  }
  return out;
}

/** Pieces ready to draw (posed, without physics). */
export function towerBodies(tower: TowerPiece[]): PieceBody[] {
  return tower.map((t) => {
    const def = ALL_PIECES.find((p) => p.id === t.id)!;
    const body = new PieceBody(def);
    body.setPose(t.x, t.y, t.angle);
    return body;
  });
}
