import type { RankingKind, ScoreEntry } from './online';

export interface RankingRow extends ScoreEntry {
  /** Placeholder entry shown until enough real players are on the board. */
  dummy?: boolean;
}

export const RANKING_ROWS = 10;

/** Obvious placeholders at about the level of a three-piece tower. Delete to remove them. */
export const DUMMY_ROWS: RankingRow[] = [
  ['だみー', 3, 1.6], ['だみい', 3, 1.5], ['てすと', 3, 1.4], ['さんぷ', 3, 1.3], ['みほん', 2, 1.2],
  ['かりの', 2, 1.1], ['ほにゃ', 2, 1.0], ['なにか', 2, 0.9], ['だれか', 1, 0.8], ['ななし', 1, 0.7],
].map(([name, count, height], i) => ({
  uid: `dummy${i}`, name: name as string, count: count as number, height: height as number, dummy: true,
}));

/**
 * Real entries mixed with the dummies, best first, cut to `size`. A tie goes to the better other
 * value (height for the count ranking and the other way round), then to a real entry over a
 * dummy, then to whoever set the record first.
 */
export function topRows(real: ScoreEntry[], kind: RankingKind, size = RANKING_ROWS): RankingRow[] {
  const other: RankingKind = kind === 'count' ? 'height' : 'count';
  const at = (r: RankingRow) => (kind === 'count' ? r.countAt : r.heightAt) ?? Infinity;
  const rows: RankingRow[] = [...real, ...DUMMY_ROWS];
  return rows
    .sort((a, b) => b[kind] - a[kind] || b[other] - a[other] || Number(!!a.dummy) - Number(!!b.dummy) || at(a) - at(b))
    .slice(0, size);
}
