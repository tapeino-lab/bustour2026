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
 * The other number of a record's game: the height of the game that set the count record, or
 * the count of the game that set the height record (the other best for older entries).
 */
export function partner(r: ScoreEntry, kind: RankingKind): number {
  return kind === 'count' ? (r.countHeight ?? r.height) : (r.heightCount ?? r.count);
}

/**
 * Real entries mixed with the dummies, best first, cut to `size`. A tie goes to the better
 * other number of that same game, then to a real entry over a dummy, then to whoever set the
 * record first.
 */
export function topRows(real: ScoreEntry[], kind: RankingKind, size = RANKING_ROWS): RankingRow[] {
  const at = (r: RankingRow) => (kind === 'count' ? r.countAt : r.heightAt) ?? Infinity;
  // A record that was reset (0) is not on that ranking.
  const rows: RankingRow[] = [...real.filter((r) => r[kind] > 0), ...DUMMY_ROWS];
  return rows
    .sort(
      (a, b) =>
        b[kind] - a[kind] ||
        partner(b, kind) - partner(a, kind) ||
        Number(!!a.dummy) - Number(!!b.dummy) ||
        at(a) - at(b),
    )
    .slice(0, size);
}

/** A game's result. */
export interface GameResult {
  count: number;
  height: number;
}

/**
 * Whether a game beats a record: the count record by more pieces, or as many pieces and a
 * taller tower; the height record by a taller tower, or as tall with more pieces.
 */
export function beatsRecord(game: GameResult, entry: ScoreEntry | null, kind: RankingKind): boolean {
  if (!entry) return true;
  const other: RankingKind = kind === 'count' ? 'height' : 'count';
  return game[kind] > entry[kind] || (game[kind] === entry[kind] && game[other] > (kind === 'count' ? (entry.countHeight ?? -1) : (entry.heightCount ?? -1)));
}
