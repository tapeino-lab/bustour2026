import { describe, expect, it } from 'vitest';
import { isValidName, normalizeName } from './names';

describe('ranking names', () => {
  it('accepts one to three hiragana letters', () => {
    for (const n of ['やまな', 'ばすー', 'やま', 'や']) expect(isValidName(n)).toBe(true);
    for (const n of ['やまなし', 'ヤマナ', 'abc', '山なし', '']) expect(isValidName(n)).toBe(false);
  });
  it('turns katakana (also half-width) into hiragana and drops spaces', () => {
    expect(normalizeName(' ヤマナ ')).toBe('やまな');
    expect(normalizeName('ﾊﾞｽｰ')).toBe('ばすー');
    expect(normalizeName('や ま な')).toBe('やまな');
  });
});

describe('on-screen kana keyboard', () => {
  it('types at most three letters', async () => {
    const { typeKana } = await import('./names');
    expect(typeKana(typeKana(typeKana(typeKana('', 'や'), 'ま'), 'な'), 'し')).toBe('やまな');
  });
  it('toggles dakuten, handakuten and small kana on the last letter', async () => {
    const { toggleDakuten, toggleHandakuten, toggleSmall } = await import('./names');
    expect(toggleDakuten('か')).toBe('が');
    expect(toggleDakuten('が')).toBe('か');
    expect(toggleDakuten('ぱ')).toBe('ば');
    expect(toggleDakuten('あ')).toBe('あ');
    expect(toggleHandakuten('は')).toBe('ぱ');
    expect(toggleHandakuten('ぱ')).toBe('は');
    expect(toggleHandakuten('ば')).toBe('ぱ');
    expect(toggleHandakuten('か')).toBe('か');
    expect(toggleSmall('きや')).toBe('きゃ');
    expect(toggleSmall('きゃ')).toBe('きや');
    expect(toggleSmall('つ')).toBe('っ');
    expect(toggleSmall('ん')).toBe('ん');
    expect(toggleDakuten('')).toBe('');
  });
  it('only produces names the rules accept', async () => {
    const { KANA_COLUMNS, isValidName } = await import('./names');
    for (const col of KANA_COLUMNS) for (const k of col) if (k) expect(isValidName(k + k + k), k).toBe(true);
  });
});
