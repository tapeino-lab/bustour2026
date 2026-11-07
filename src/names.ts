/** Ranking names: one to three hiragana letters (the long-vowel mark ー is allowed). */
export const NAME_PATTERN = /^[ぁ-ゖー]{1,3}$/u;

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

export const NAME_LENGTH = 3;

/** On-screen keyboard: columns あ…わ, rows あいうえお (blank cells are ''). */
export const KANA_COLUMNS: string[][] = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', '', 'ゆ', '', 'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', '', 'を', '', 'ん'],
];

const DAKUTEN: Record<string, string> = {};
const HANDAKUTEN: Record<string, string> = {};
const SMALL: Record<string, string> = {};
'かきくけこさしすせそたちつてとはひふへほ'.split('').forEach((c) => {
  DAKUTEN[c] = String.fromCharCode(c.charCodeAt(0) + 1);
});
'はひふへほ'.split('').forEach((c) => {
  HANDAKUTEN[c] = String.fromCharCode(c.charCodeAt(0) + 2);
});
'あいうえおやゆよつわ'.split('').forEach((c) => {
  SMALL[c] = String.fromCharCode(c.charCodeAt(0) - 1);
});

function lastSwap(name: string, table: Record<string, string>): string {
  if (!name) return name;
  const last = name[name.length - 1];
  const reverse = Object.entries(table).find(([, v]) => v === last);
  const next = table[last] ?? reverse?.[0];
  return next ? name.slice(0, -1) + next : name;
}

/** ゛ key: か→が, が→か (also ぱ→ば). */
export function toggleDakuten(name: string): string {
  const last = name[name.length - 1];
  const fromHandakuten = Object.entries(HANDAKUTEN).find(([, v]) => v === last)?.[0];
  if (fromHandakuten) return name.slice(0, -1) + DAKUTEN[fromHandakuten];
  return lastSwap(name, DAKUTEN);
}

/** ゜ key: は→ぱ, ぱ→は (also ば→ぱ). */
export function toggleHandakuten(name: string): string {
  const last = name[name.length - 1];
  const fromDakuten = Object.entries(DAKUTEN).find(([, v]) => v === last)?.[0];
  if (fromDakuten && HANDAKUTEN[fromDakuten]) return name.slice(0, -1) + HANDAKUTEN[fromDakuten];
  return lastSwap(name, HANDAKUTEN);
}

/** 小 key: や→ゃ, っ→つ … */
export function toggleSmall(name: string): string {
  return lastSwap(name, SMALL);
}

/** Adds one character, keeping at most three. */
export function typeKana(name: string, kana: string): string {
  return name.length >= NAME_LENGTH ? name : name + kana;
}
