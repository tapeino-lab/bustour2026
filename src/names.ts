/** Ranking names: exactly three hiragana letters (the long-vowel mark ー is allowed). */
export const NAME_PATTERN = /^[ぁ-ゖー]{3}$/u;

/** Cleans typed input: full/half-width unified, spaces removed, katakana turned into hiragana. */
export function normalizeName(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/\s+/gu, '')
    .replace(/[ァ-ヶ]/gu, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name);
}
