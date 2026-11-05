import { describe, expect, it } from 'vitest';
import { isValidName, normalizeName } from './names';

describe('ranking names', () => {
  it('accepts exactly three hiragana letters', () => {
    expect(isValidName('やまな')).toBe(true);
    expect(isValidName('ばすー')).toBe(true);
    for (const n of ['やま', 'やまなし', 'ヤマナ', 'abc', '山なし', '']) expect(isValidName(n)).toBe(false);
  });
  it('turns katakana (also half-width) into hiragana and drops spaces', () => {
    expect(normalizeName(' ヤマナ ')).toBe('やまな');
    expect(normalizeName('ﾊﾞｽｰ')).toBe('ばすー');
    expect(normalizeName('や ま な')).toBe('やまな');
  });
});
