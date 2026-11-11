// Firebase connection: anonymous sign-in, membership by join code, face photos.
// Loaded lazily (dynamic import) so the game starts without waiting for it.
import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import {
  collection, connectFirestoreEmulator, deleteDoc, deleteField, doc, getDoc, getDocs, getFirestore, increment, limit,
  orderBy, query, serverTimestamp, setDoc, Timestamp, where, type Firestore,
} from 'firebase/firestore';
import { normalizeJoinCode } from './joincode';
import { DEFAULT_ENHANCE, ENHANCE_LEVELS, type Enhance, type FacePhoto } from './faces';

function enhanceOf(v: unknown): Enhance {
  return ENHANCE_LEVELS.includes(v as Enhance) ? (v as Enhance) : DEFAULT_ENHANCE;
}

/** Firebase settings come from build-time environment variables (GitHub Secrets), never the repo. */
export function firebaseOptions(env: Record<string, string | undefined>): FirebaseOptions | null {
  const o = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  return o.apiKey && o.authDomain && o.projectId && o.appId ? (o as FirebaseOptions) : null;
}

/**
 * A player's two records, each kept as the set of numbers from the game that made it:
 * the count record is `count` with `countHeight` (that game's height), the height record is
 * `height` with `heightCount` (that game's count). Entries saved before the sets existed lack
 * countHeight / heightCount.
 */
export interface ScoreEntry {
  uid: string;
  name: string;
  count: number;
  height: number;
  countHeight?: number;
  heightCount?: number;
  /** Tower snapshots (tower.ts) of the games that set the count / height records. */
  towerCount?: string;
  towerHeight?: string;
  /** When the count / height record was set (ms); breaks ties after the other value. */
  countAt?: number;
  heightAt?: number;
  /** When the entry was last saved (ms). */
  updatedAt?: number;
}

/** Which records a save sets (their time is stamped by the server). */
export interface NewRecords {
  count?: boolean;
  height?: boolean;
}

function toEntry(uid: string, data: Record<string, unknown>): ScoreEntry {
  const millis = (t: unknown) => (t instanceof Timestamp ? t.toMillis() : undefined);
  // Entries saved before record times existed fall back to their last update.
  const updated = millis(data.updatedAt);
  return {
    uid,
    name: data.name as string,
    count: data.count as number,
    height: data.height as number,
    countHeight: data.countHeight as number | undefined,
    heightCount: data.heightCount as number | undefined,
    towerCount: data.towerCount as string | undefined,
    towerHeight: data.towerHeight as string | undefined,
    countAt: millis(data.countAt) ?? updated,
    heightAt: millis(data.heightAt) ?? updated,
    updatedAt: updated,
  };
}

export type RankingKind = 'height' | 'count';

/** One player's (device's) play history: how many games and when the last one ended. */
export interface PlayRecord {
  uid: string;
  count: number;
  lastAt?: number;
  /** The player's name when they last played, if they had one. */
  name?: string;
}
export const RANKING_SIZE = 10;

export class Online {
  private constructor(
    private readonly db: Firestore,
    readonly uid: string,
  ) {}

  /** Signs in anonymously (the same uid is kept on this device). null when Firebase is not configured. */
  static async connect(): Promise<Online | null> {
    const options = firebaseOptions(import.meta.env as Record<string, string | undefined>);
    if (!options) return null;
    const app = initializeApp(options);
    const auth = getAuth(app);
    const db = getFirestore(app);
    // Local testing only: VITE_FIREBASE_EMULATOR=1 talks to the Firebase emulators.
    if (import.meta.env.VITE_FIREBASE_EMULATOR === '1') {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
    const user = await new Promise<User | null>((resolve) => {
      const stop = onAuthStateChanged(auth, (u) => {
        stop();
        resolve(u);
      });
    });
    const signedIn = user ?? (await signInAnonymously(auth)).user;
    return new Online(db, signedIn.uid);
  }

  async isMember(): Promise<boolean> {
    return (await getDoc(doc(this.db, 'members', this.uid))).exists();
  }

  async isAdmin(): Promise<boolean> {
    return (await getDoc(doc(this.db, 'admins', this.uid))).exists();
  }

  /** Tries to join with a code; false when the code is wrong. */
  async join(code: string): Promise<boolean> {
    try {
      await setDoc(doc(this.db, 'members', this.uid), {
        code: normalizeJoinCode(code),
        joinedAt: serverTimestamp(),
      });
      return true;
    } catch {
      return false;
    }
  }

  /** All face photos as { pieceId: JPEG data URL }. */
  /** Face photos that are switched on for display (the only ones members may read). */
  async loadFaces(): Promise<Map<string, FacePhoto>> {
    const snap = await getDocs(query(collection(this.db, 'faces'), where('visible', '==', true)));
    const out = new Map<string, FacePhoto>();
    snap.forEach((d) => {
      const image = d.get('image');
      if (typeof image === 'string') out.set(d.id, { image, enhance: enhanceOf(d.get('enhance')) });
    });
    return out;
  }

  /** Every registered photo with its display switch (admins only). */
  async loadAllFaces(): Promise<Map<string, FacePhoto & { visible: boolean }>> {
    const snap = await getDocs(collection(this.db, 'faces'));
    const out = new Map<string, FacePhoto & { visible: boolean }>();
    snap.forEach((d) => {
      const image = d.get('image');
      if (typeof image === 'string') {
        out.set(d.id, { image, visible: d.get('visible') === true, enhance: enhanceOf(d.get('enhance')) });
      }
    });
    return out;
  }

  /** Sets how strongly a photo is evened out in the game. */
  async setFaceEnhance(pieceId: string, enhance: Enhance): Promise<void> {
    await setDoc(doc(this.db, 'faces', pieceId), { enhance, updatedAt: serverTimestamp() }, { merge: true });
  }

  /** Registers (or replaces) a photo; its display switch is kept as it was (off for a new one). */
  async saveFace(pieceId: string, image: string): Promise<void> {
    await setDoc(doc(this.db, 'faces', pieceId), { image, updatedAt: serverTimestamp() }, { merge: true });
  }

  /** Turns showing a registered photo on or off. */
  async setFaceVisible(pieceId: string, visible: boolean): Promise<void> {
    await setDoc(doc(this.db, 'faces', pieceId), { visible, updatedAt: serverTimestamp() }, { merge: true });
  }

  /** This device's ranking entry, or null if it has none yet. */
  async myScore(): Promise<ScoreEntry | null> {
    const d = await getDoc(doc(this.db, 'scores', this.uid));
    return d.exists() ? toEntry(this.uid, d.data()) : null;
  }

  /**
   * Saves the entry (the caller keeps count/height at their personal bests). Merged, so the time
   * of a record that did not change stays as it was.
   */
  async saveScore(entry: Omit<ScoreEntry, 'uid'>, records: NewRecords = {}): Promise<void> {
    // Firestore rejects undefined fields, so leave out snapshots we do not have.
    const data: Record<string, unknown> = { name: entry.name, count: entry.count, height: entry.height };
    if (entry.towerCount) data.towerCount = entry.towerCount;
    if (entry.towerHeight) data.towerHeight = entry.towerHeight;
    // A record's partner number and time change only together with the record.
    if (records.count) {
      data.countHeight = entry.countHeight;
      data.countAt = serverTimestamp();
    }
    if (records.height) {
      data.heightCount = entry.heightCount;
      data.heightAt = serverTimestamp();
    }
    await setDoc(doc(this.db, 'scores', this.uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  }

  /** Top entries for one ranking, best first (ties are ordered in ranking.ts). */
  async ranking(kind: RankingKind): Promise<ScoreEntry[]> {
    const scores = collection(this.db, 'scores');
    let snap = await getDocs(query(scores, orderBy(kind, 'desc'), limit(RANKING_SIZE)));
    // Players tied with the last one fetched may still rank above it (see ranking.ts), so fetch them too.
    if (snap.size === RANKING_SIZE) {
      const last = snap.docs[snap.size - 1].get(kind) as number;
      snap = await getDocs(query(scores, where(kind, '>=', last), orderBy(kind, 'desc')));
    }
    return snap.docs.map((d) => toEntry(d.id, d.data()));
  }

  /** Background music as a data URL, or null if none has been uploaded. */
  async loadBgm(): Promise<string | null> {
    const d = await getDoc(doc(this.db, 'media', 'bgm'));
    const audio = d.exists() ? d.get('audio') : null;
    return typeof audio === 'string' ? audio : null;
  }

  async saveBgm(audio: string): Promise<void> {
    await setDoc(doc(this.db, 'media', 'bgm'), { audio, updatedAt: serverTimestamp() });
  }

  /** Counts one finished game for this device's play history. */
  async recordPlay(name?: string): Promise<void> {
    const data: Record<string, unknown> = { count: increment(1), lastAt: serverTimestamp() };
    if (name) data.name = name;
    await setDoc(doc(this.db, 'plays', this.uid), data, { merge: true });
  }

  /** Every player's play history (admins only). */
  async allPlays(): Promise<PlayRecord[]> {
    const snap = await getDocs(collection(this.db, 'plays'));
    return snap.docs.map((d) => {
      const lastAt = d.get('lastAt');
      const name = d.get('name');
      return {
        uid: d.id,
        count: Number(d.get('count')) || 0,
        lastAt: lastAt instanceof Timestamp ? lastAt.toMillis() : undefined,
        name: typeof name === 'string' ? name : undefined,
      };
    });
  }

  /** Every ranking entry (admins only, for the admin page). */
  async allScores(): Promise<ScoreEntry[]> {
    const snap = await getDocs(collection(this.db, 'scores'));
    return snap.docs.map((d) => toEntry(d.id, d.data()));
  }

  /**
   * Resets one player's count record (or height record) (admins only): it is cleared, the other
   * record stays. When the player then has neither record, the entry is deleted.
   */
  async resetScore(uid: string, kind: RankingKind): Promise<void> {
    const ref = doc(this.db, 'scores', uid);
    const d = await getDoc(ref);
    if (!d.exists()) return;
    const other: RankingKind = kind === 'count' ? 'height' : 'count';
    if (!(Number(d.get(other)) > 0)) {
      await deleteDoc(ref);
      return;
    }
    const cleared =
      kind === 'count'
        ? { count: 0, countHeight: deleteField(), countAt: deleteField(), towerCount: deleteField() }
        : { height: 0, heightCount: deleteField(), heightAt: deleteField(), towerHeight: deleteField() };
    await setDoc(ref, { ...cleared, updatedAt: serverTimestamp() }, { merge: true });
  }
}
