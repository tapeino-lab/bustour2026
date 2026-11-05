import { describe, expect, it } from 'vitest';
import { normalizeJoinCode } from './joincode';
import { firebaseOptions } from './online';

describe('normalizeJoinCode', () => {
  it('accepts full-width input, spaces and capitals', () => {
    expect(normalizeJoinCode('  Ｙａｍａｎａｓｈｉ２０２６ ')).toBe('yamanashi2026');
    expect(normalizeJoinCode('bus-Tour')).toBe('bus-tour');
  });
});

describe('firebaseOptions', () => {
  it('needs all four settings', () => {
    const env = {
      VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_AUTH_DOMAIN: 'a', VITE_FIREBASE_PROJECT_ID: 'p', VITE_FIREBASE_APP_ID: 'i',
    };
    expect(firebaseOptions(env)).toEqual({ apiKey: 'k', authDomain: 'a', projectId: 'p', appId: 'i' });
    expect(firebaseOptions({ ...env, VITE_FIREBASE_APP_ID: '' })).toBeNull();
    expect(firebaseOptions({})).toBeNull();
  });
});
