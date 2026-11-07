// Tests for firestore.rules against the Firestore emulator. Run with: npm run test:rules
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';

const CODE = 'yamanashi-2026';
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bustour',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config/join'), { code: CODE });
    await setDoc(doc(db, 'admins/admin1'), {});
    await setDoc(doc(db, 'members/member1'), { code: CODE, joinedAt: new Date() });
    await setDoc(doc(db, 'faces/cat'), { image: JPEG, visible: true, updatedAt: new Date() });
    await setDoc(doc(db, 'faces/dog'), { image: JPEG, visible: false, updatedAt: new Date() });
    await setDoc(doc(db, 'faces/bird'), { image: JPEG, updatedAt: new Date() });
    await setDoc(doc(db, 'members/member2'), { code: CODE, joinedAt: new Date() });
    await setDoc(doc(db, 'scores/member2'), { name: 'ばすた', count: 5, height: 2.5, updatedAt: new Date() });
  });
});

const as = (uid: string | null) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

describe('join code', () => {
  it('cannot be read by anyone', async () => {
    await assertFails(getDoc(doc(as('member1'), 'config/join')));
    await assertFails(getDoc(doc(as('admin1'), 'config/join')));
  });
  it('lets a device join with the right code', async () => {
    await assertSucceeds(setDoc(doc(as('u1'), 'members/u1'), { code: CODE, joinedAt: serverTimestamp() }));
  });
  it('accepts the code when the console stored it as a number', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'config/join'), { code: 123 });
    });
    await assertSucceeds(setDoc(doc(as('u1'), 'members/u1'), { code: '123', joinedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as('u2'), 'members/u2'), { code: '124', joinedAt: serverTimestamp() }));
  });
  it('rejects a wrong code', async () => {
    await assertFails(setDoc(doc(as('u1'), 'members/u1'), { code: 'nope', joinedAt: serverTimestamp() }));
  });
  it('rejects joining for another uid, extra fields, or without signing in', async () => {
    await assertFails(setDoc(doc(as('u1'), 'members/u2'), { code: CODE, joinedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as('u1'), 'members/u1'), { code: CODE, joinedAt: serverTimestamp(), x: 1 }));
    await assertFails(setDoc(doc(as(null), 'members/u1'), { code: CODE, joinedAt: serverTimestamp() }));
  });
  it('does not let members list, change or delete membership', async () => {
    await assertFails(getDocs(collection(as('member1'), 'members')));
    await assertFails(setDoc(doc(as('member1'), 'members/member1'), { code: CODE, joinedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(as('member1'), 'members/member1')));
    await assertFails(getDoc(doc(as('u1'), 'members/member1')));
  });
});

describe('faces', () => {
  it('are readable by members and admins only', async () => {
    await assertSucceeds(getDoc(doc(as('member1'), 'faces/cat')));
    // Members must ask only for visible photos; hidden or never-switched-on ones stay unreadable.
    await assertSucceeds(getDocs(query(collection(as('member1'), 'faces'), where('visible', '==', true))));
    await assertFails(getDocs(collection(as('member1'), 'faces')));
    await assertFails(getDoc(doc(as('member1'), 'faces/dog')));
    await assertFails(getDoc(doc(as('member1'), 'faces/bird')));
    await assertSucceeds(getDoc(doc(as('admin1'), 'faces/dog')));
    await assertSucceeds(getDocs(collection(as('admin1'), 'faces')));
    await assertSucceeds(getDoc(doc(as('admin1'), 'faces/cat')));
    await assertFails(getDoc(doc(as('stranger'), 'faces/cat')));
    await assertFails(getDocs(collection(as('stranger'), 'faces')));
    await assertFails(getDoc(doc(as(null), 'faces/cat')));
  });
  it('can be written by admins only, as a JPEG data URL', async () => {
    await assertSucceeds(setDoc(doc(as('admin1'), 'faces/dog'), { image: JPEG, updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(as('admin1'), 'faces/dog'), { image: JPEG, visible: true, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as('admin1'), 'faces/dog'), { image: JPEG, visible: 'yes', updatedAt: serverTimestamp() }));
    // Cut-out photos keep their transparency as PNG; other formats are refused.
    await assertSucceeds(setDoc(doc(as('admin1'), 'faces/shigemi'), { image: 'data:image/png;base64,iVBORw0KGgo=', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as('admin1'), 'faces/dog'), { image: 'data:image/gif;base64,R0lGOD==', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as('member1'), 'faces/cat'), { image: JPEG, visible: false, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as('member1'), 'faces/dog'), { image: JPEG, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as('admin1'), 'faces/dog'), { image: 'data:text/html;base64,AAAA', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as('admin1'), 'faces/Dog!'), { image: JPEG, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as('admin1'), 'faces/dog'), { image: `${JPEG}${'A'.repeat(200000)}`, updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(as('admin1'), 'faces/cat')));
    await assertFails(deleteDoc(doc(as('member1'), 'faces/cat')));
  });
});

describe('admins', () => {
  it('can only check themselves, and nobody can write', async () => {
    await assertSucceeds(getDoc(doc(as('admin1'), 'admins/admin1')));
    await assertSucceeds(getDoc(doc(as('u1'), 'admins/u1')));
    await assertFails(getDoc(doc(as('u1'), 'admins/admin1')));
    await assertFails(setDoc(doc(as('u1'), 'admins/u1'), {}));
    await assertFails(setDoc(doc(as('admin1'), 'admins/u1'), {}));
  });
});

describe('scores', () => {
  const score = (name: string, count: number, height: number) => ({ name, count, height, updatedAt: serverTimestamp() });
  it('members can create their own entry with a 1-3 letter hiragana name', async () => {
    await assertSucceeds(setDoc(doc(as('member1'), 'scores/member1'), score('やまな', 3, 1.2)));
    await assertSucceeds(setDoc(doc(as('member1'), 'scores/member1'), score('ばすー', 3, 1.2)));
    await assertSucceeds(setDoc(doc(as('member1'), 'scores/member1'), score('や', 3, 1.2)));
  });
  it('rejects bad names', async () => {
    for (const name of ['やまなし', 'ヤマナ', 'abc', 'や ま', '']) {
      await assertFails(setDoc(doc(as('member1'), 'scores/member1'), score(name, 3, 1.2)));
    }
  });
  it('rejects bad numbers, extra fields, other uids and non-members', async () => {
    await assertFails(setDoc(doc(as('member1'), 'scores/member1'), score('やまな', -1, 1.2)));
    await assertFails(setDoc(doc(as('member1'), 'scores/member1'), score('やまな', 2.5, 1.2)));
    await assertFails(setDoc(doc(as('member1'), 'scores/member1'), score('やまな', 3, 5000)));
    await assertFails(setDoc(doc(as('member1'), 'scores/member1'), { ...score('やまな', 3, 1), x: 1 }));
    await assertFails(setDoc(doc(as('member1'), 'scores/member2'), score('やまな', 30, 9)));
    await assertFails(setDoc(doc(as('stranger'), 'scores/stranger'), score('やまな', 3, 1.2)));
  });
  it('accepts tower snapshots but not oversized or foreign ones', async () => {
    const tower = 'v1|cat,180.0,-20.5,0.000;bus,175.2,-60.1,0.785';
    await assertSucceeds(setDoc(doc(as('member1'), 'scores/member1'), { ...score('やまな', 2, 1.2), towerCount: tower, towerHeight: tower }));
    await assertFails(setDoc(doc(as('member1'), 'scores/member1'), { ...score('やまな', 2, 1.2), towerCount: 'x'.repeat(10) }));
    await assertFails(setDoc(doc(as('member1'), 'scores/member1'), { ...score('やまな', 2, 1.2), towerCount: `v1|${'a'.repeat(12000)}` }));
    await assertFails(setDoc(doc(as('member1'), 'scores/member1'), { ...score('やまな', 2, 1.2), towerCount: 5 }));
  });
  it('lets bests only go up', async () => {
    const ref = doc(as('member2'), 'scores/member2');
    await assertSucceeds(setDoc(ref, { ...score('ばすた', 6, 2.5), countAt: serverTimestamp() }, { merge: true }));
    await assertSucceeds(setDoc(ref, { ...score('なまえ', 6, 3.1), heightAt: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(ref, score('なまえ', 5, 3.1), { merge: true }));
    await assertFails(setDoc(ref, score('なまえ', 6, 3.0), { merge: true }));
    await assertFails(deleteDoc(doc(as('member2'), 'scores/member2')));
    // Ranking reset: only admins can delete entries.
    await assertSucceeds(deleteDoc(doc(as('admin1'), 'scores/member2')));
  });
  it('stamps a record time only when that record goes up', async () => {
    const ref = doc(as('member2'), 'scores/member2');
    // Old entries have no record times: they may stay without them.
    await assertSucceeds(setDoc(ref, { name: 'なまえ', updatedAt: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(ref, { count: 6, updatedAt: serverTimestamp() }, { merge: true }));
    await assertSucceeds(setDoc(ref, { count: 6, countAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }));
    // An unchanged record keeps its time: it cannot be moved, earlier or later.
    await assertFails(setDoc(ref, { countAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(ref, { countAt: new Date(0), updatedAt: serverTimestamp() }, { merge: true }));
    await assertSucceeds(setDoc(ref, { height: 3, heightAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(ref, { height: 4, heightAt: new Date(0), updatedAt: serverTimestamp() }, { merge: true }));
    await assertSucceeds(setDoc(ref, { name: 'ばす', updatedAt: serverTimestamp() }, { merge: true }));
    // A new entry may only carry times of now.
    await assertSucceeds(setDoc(doc(as('member1'), 'scores/member1'), { ...score('やまな', 2, 1.25), countAt: serverTimestamp(), heightAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as('member1'), 'scores/member1'), { ...score('やまな', 2, 1.2), countAt: new Date(0) }));
  });
  it('keeps each record as a set and lets it get better only', async () => {
    const ref = doc(as('member2'), 'scores/member2');
    const now = serverTimestamp();
    // member2 starts at 5 pieces / 2.5m (no sets yet).
    await assertSucceeds(setDoc(ref, { count: 6, countHeight: 2.0, countAt: now, updatedAt: now }, { merge: true }));
    // Same count, taller tower: a better count record (new time); a shorter one is not.
    await assertSucceeds(setDoc(ref, { countHeight: 2.4, countAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(ref, { countHeight: 2.1, countAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }));
    // The partner cannot change without the time, nor the time without a better record.
    await assertFails(setDoc(ref, { countHeight: 3.0, updatedAt: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(ref, { countAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }));
    // Height record: same height with more pieces is better.
    await assertSucceeds(setDoc(ref, { heightCount: 4, heightAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(ref, { heightCount: 3, heightAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(ref, { heightCount: 2.5, heightAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }));
    // A lower count is never accepted, whatever its partner.
    await assertFails(setDoc(ref, { count: 5, countHeight: 9, countAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }));
    // Renaming leaves both sets alone.
    await assertSucceeds(setDoc(ref, { name: 'ばすた', updatedAt: serverTimestamp() }, { merge: true }));
  });
  it('rankings are readable by members only', async () => {
    const top = (uid: string) => getDocs(query(collection(as(uid), 'scores'), orderBy('height', 'desc'), limit(20)));
    await assertSucceeds(top('member1'));
    await assertSucceeds(top('admin1'));
    await assertFails(top('stranger'));
  });
});

describe('media (bgm)', () => {
  const MP3 = 'data:audio/mpeg;base64,SUQzBAAAAAAA';
  it('is readable by members only and writable by admins only', async () => {
    await assertSucceeds(setDoc(doc(as('admin1'), 'media/bgm'), { audio: MP3, updatedAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(as('member1'), 'media/bgm')));
    await assertFails(getDoc(doc(as('stranger'), 'media/bgm')));
    await assertFails(setDoc(doc(as('member1'), 'media/bgm'), { audio: MP3, updatedAt: serverTimestamp() }));
  });
  it('accepts only audio data URLs under the size limit, only as bgm', async () => {
    await assertFails(setDoc(doc(as('admin1'), 'media/bgm'), { audio: 'data:text/html;base64,AAAA', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as('admin1'), 'media/other'), { audio: MP3, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as('admin1'), 'media/bgm'), { audio: MP3 + 'A'.repeat(950000), updatedAt: serverTimestamp() }));
  });
});

