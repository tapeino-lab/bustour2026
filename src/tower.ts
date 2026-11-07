// A tower snapshot: which piece is where, at which angle, when the tower last stood still.
// It is redrawn from this record (no physics), so it stays valid when physics settings change;
// it only assumes the piece shapes stay the same. Format: "v1|id,x,y,angle;id,x,y,angle;…".
// A soft piece made of several segments lists x,y,angle once per segment: "id,x,y,a,x2,y2,a2,…".
import { ALL_PIECES } from './pieces';
import { PieceBody, type Pose } from './physics';

const VERSION = 'v1';
export const MAX_TOWER_PIECES = 300;
/** Firestore rules accept tower strings shorter than this. */
export const MAX_TOWER_LENGTH = 12000;

export interface TowerPiece {
  id: string;
  /** Pose of each segment (one for ordinary pieces). */
  poses: Pose[];
}

const KNOWN_IDS = new Set(ALL_PIECES.map((p) => p.id));

export function encodeTower(pieces: PieceBody[]): string {
  const parts = pieces.slice(0, MAX_TOWER_PIECES).map((p) => {
    const nums = Array.from({ length: p.segments }, (_, i) => {
      const q = p.segPose(i);
      return `${q.x.toFixed(1)},${q.y.toFixed(1)},${q.angle.toFixed(3)}`;
    });
    return `${p.def.id},${nums.join(',')}`;
  });
  return `${VERSION}|${parts.join(';')}`;
}

/** Parses a snapshot (it may come from other devices, so everything is checked). null if unusable. */
export function decodeTower(s: unknown): TowerPiece[] | null {
  if (typeof s !== 'string' || s.length > MAX_TOWER_LENGTH || !s.startsWith(`${VERSION}|`)) return null;
  const body = s.slice(VERSION.length + 1);
  if (!body) return [];
  const out: TowerPiece[] = [];
  for (const item of body.split(';').slice(0, MAX_TOWER_PIECES)) {
    const [id, ...rest] = item.split(',');
    const nums = rest.map(Number);
    if (!KNOWN_IDS.has(id) || nums.length === 0 || nums.length % 3 !== 0 || nums.length > 30) return null;
    if (!nums.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e5)) return null;
    const poses: Pose[] = [];
    for (let i = 0; i < nums.length; i += 3) poses.push({ x: nums[i], y: nums[i + 1], angle: nums[i + 2] });
    out.push({ id, poses });
  }
  return out;
}

/** Pieces ready to draw (posed, without physics). */
export function towerBodies(tower: TowerPiece[]): PieceBody[] {
  return tower.map((t) => {
    const def = ALL_PIECES.find((p) => p.id === t.id)!;
    const body = new PieceBody(def);
    const [first] = t.poses;
    body.setPose(first.x, first.y, first.angle);
    // Restore each segment's own pose when the snapshot has them (soft pieces).
    if (t.poses.length === body.segments) t.poses.forEach((q, i) => body.setSegPose(i, q));
    return body;
  });
}
