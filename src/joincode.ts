/**
 * Join codes are compared exactly by the Firestore rules, so normalise what people type:
 * full-width letters/digits → half-width (NFKC), surrounding spaces removed, lower case.
 * Set the code in the console already in this form (e.g. "yamanashi2026").
 */
export function normalizeJoinCode(input: string): string {
  return input.normalize('NFKC').trim().toLowerCase();
}
