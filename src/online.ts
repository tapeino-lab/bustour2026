// Firebase connection: anonymous sign-in, membership by join code, face photos.
// Loaded lazily (dynamic import) so the game starts without waiting for it.
import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import {
  collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, limit, orderBy, query,
  serverTimestamp, setDoc, type Firestore,
} from 'firebase/firestore';
import { normalizeJoinCode } from './joincode';

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

export interface ScoreEntry {
  uid: string;
  name: string;
  count: number;
  height: number;
}

export type RankingKind = 'height' | 'count';
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
  async loadFaces(): Promise<Map<string, string>> {
    const snap = await getDocs(collection(this.db, 'faces'));
    const out = new Map<string, string>();
    snap.forEach((d) => {
      const image = d.get('image');
      if (typeof image === 'string') out.set(d.id, image);
    });
    return out;
  }

  async saveFace(pieceId: string, image: string): Promise<void> {
    await setDoc(doc(this.db, 'faces', pieceId), { image, updatedAt: serverTimestamp() });
  }

  /** This device's ranking entry, or null if it has none yet. */
  async myScore(): Promise<ScoreEntry | null> {
    const d = await getDoc(doc(this.db, 'scores', this.uid));
    return d.exists() ? { uid: this.uid, ...(d.data() as Omit<ScoreEntry, 'uid'>) } : null;
  }

  /** Saves the entry (the caller keeps count/height at their personal bests). */
  async saveScore(entry: Omit<ScoreEntry, 'uid'>): Promise<void> {
    await setDoc(doc(this.db, 'scores', this.uid), { ...entry, updatedAt: serverTimestamp() });
  }

  /** Top entries for one ranking, best first. */
  async ranking(kind: RankingKind): Promise<ScoreEntry[]> {
    const snap = await getDocs(query(collection(this.db, 'scores'), orderBy(kind, 'desc'), limit(RANKING_SIZE)));
    return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<ScoreEntry, 'uid'>) }));
  }
}
