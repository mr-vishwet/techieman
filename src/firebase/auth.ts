// TechieMan — Firebase Auth service (M5).
// Guest-first, always: a guest plays immediately with a local MMKV guest id
// (see storage/guest.ts). Auth is an OPTIONAL upgrade, never a wall.
//
// Flow:
//   1. First launch (Firebase configured): signInAnonymously() — the
//      anonymous Firebase uid is stored in MMKV next to the guest id, and
//      the local snapshot is uploaded under that uid (see sync.ts).
//   2. Upgrade: linkWithCredential (email/password) or Google sign-in.
//      Linking KEEPS the same uid, so nothing is ever re-keyed.
//   3. Sign-out keeps all local data (SQLite + MMKV) — it only drops the
//      Firebase session. Deleting the account is a separate explicit action
//      (deleteAccount) and is never wired to sign-out.
//
// The service talks to Firebase only through the AuthPort interface, so
// tests inject a fake in-memory port and never touch native modules. The
// real port lazy-requires @react-native-firebase/auth (and Google Sign-In)
// inside each method.

import { isFirebaseConfigured } from './firebase';

export interface AuthUser {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
  /** 'password' | 'google.com' | 'anonymous' — the provider that signed this user in. */
  providerId: string;
}

export type AuthStatus = 'guest' | 'anonymous' | 'email' | 'google';

/** The Firebase surface M5 actually uses — nothing more. */
export interface AuthPort {
  currentUser(): AuthUser | null;
  signInAnonymously(): Promise<AuthUser>;
  /** Link the current (anonymous) user to an email/password credential. Same uid is kept. */
  linkWithEmail(email: string, password: string): Promise<AuthUser>;
  /** Sign in with an existing email/password account. */
  signInWithEmail(email: string, password: string): Promise<AuthUser>;
  /** Google sign-in. Returns the signed-in user (links when already anonymous). */
  signInWithGoogle(): Promise<AuthUser>;
  signOut(): Promise<void>;
  /** Delete the Firebase user itself. Callers must delete Firestore data first. */
  deleteCurrentUser(): Promise<void>;
  onAuthStateChanged(cb: (user: AuthUser | null) => void): () => void;
}

export function authStatusFor(user: AuthUser | null): AuthStatus {
  if (!user) return 'guest';
  if (user.isAnonymous) return 'anonymous';
  if (user.providerId === 'google.com') return 'google';
  return 'email';
}

// ---------------------------------------------------------------------------
// Real port (lazy native requires — safe under Jest and without config)
// ---------------------------------------------------------------------------

type RNFirebaseAuth = {
  (): {
    currentUser: {
      uid: string;
      email: string | null;
      isAnonymous: boolean;
      providerData: { providerId: string }[];
      linkWithCredential: (credential: unknown) => Promise<{ user: unknown }>;
      delete: () => Promise<void>;
    } | null;
    signInAnonymously: () => Promise<{ user: unknown }>;
    signInWithEmailAndPassword: (email: string, password: string) => Promise<{ user: unknown }>;
    signInWithCredential: (credential: unknown) => Promise<{ user: unknown }>;
    signOut: () => Promise<void>;
    onAuthStateChanged: (cb: (user: unknown) => void) => () => void;
  };
  EmailAuthProvider: { credential: (email: string, password: string) => unknown };
  GoogleAuthProvider: { credential: (idToken: string) => unknown };
};

function loadAuth(): RNFirebaseAuth {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@react-native-firebase/auth') as { default: RNFirebaseAuth };
  return mod.default;
}

function toAuthUser(raw: unknown): AuthUser {
  const u = raw as {
    uid: string;
    email: string | null;
    isAnonymous: boolean;
    providerData?: { providerId: string }[];
  };
  return {
    uid: u.uid,
    email: u.email ?? null,
    isAnonymous: u.isAnonymous,
    providerId: u.providerData?.[0]?.providerId ?? (u.isAnonymous ? 'anonymous' : 'password'),
  };
}

function toAuthUserOrThrow(raw: unknown): AuthUser {
  if (!raw) throw new Error('Firebase Auth returned no user');
  return toAuthUser(raw);
}

export const FirebaseAuthPort: AuthPort = {
  currentUser() {
    try {
      const auth = loadAuth();
      return toAuthUserOrThrow(auth().currentUser);
    } catch {
      return null;
    }
  },

  async signInAnonymously() {
    const auth = loadAuth();
    const cred = await auth().signInAnonymously();
    return toAuthUserOrThrow(cred.user);
  },

  async linkWithEmail(email, password) {
    const auth = loadAuth();
    const current = auth().currentUser;
    if (!current) throw new Error('No anonymous user to link — sign in anonymously first');
    const credential = auth.EmailAuthProvider.credential(email, password);
    const linked = await current.linkWithCredential(credential);
    return toAuthUserOrThrow(linked.user);
  },

  async signInWithEmail(email, password) {
    const auth = loadAuth();
    const cred = await auth().signInWithEmailAndPassword(email, password);
    return toAuthUserOrThrow(cred.user);
  },

  async signInWithGoogle() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleSignin } = require('@react-native-google-signin/google-signin') as {
      GoogleSignin: {
        configure: (opts: Record<string, unknown>) => void;
        hasPlayServices: () => Promise<void>;
        signIn: () => Promise<{ data?: { idToken?: string | null } | null }>;
      };
    };
    // No webClientId passed: the google-services plugin generates
    // default_web_client_id from the REAL google-services.json. With the
    // placeholder config this call fails — callers treat that as "Google
    // sign-in not configured" (see FIREBASE_SETUP.md).
    GoogleSignin.configure({});
    await GoogleSignin.hasPlayServices();
    const res = await GoogleSignin.signIn();
    const idToken = res.data?.idToken;
    if (!idToken) throw new Error('Google sign-in returned no idToken');
    const auth = loadAuth();
    const credential = auth.GoogleAuthProvider.credential(idToken);
    const current = auth().currentUser;
    // When anonymous, LINK (keeps the uid — the progress stays keyed to
    // it). signInWithCredential would orphan the anonymous account.
    if (current?.isAnonymous) {
      const linked = await current.linkWithCredential(credential);
      return toAuthUserOrThrow(linked.user);
    }
    const cred = await auth().signInWithCredential(credential);
    return toAuthUserOrThrow(cred.user);
  },

  async signOut() {
    const auth = loadAuth();
    await auth().signOut();
  },

  async deleteCurrentUser() {
    const auth = loadAuth();
    const current = auth().currentUser;
    if (!current) throw new Error('No signed-in user to delete');
    await current.delete();
  },

  onAuthStateChanged(cb) {
    const auth = loadAuth();
    return auth().onAuthStateChanged(raw => cb(raw ? toAuthUser(raw) : null));
  },
};

// ---------------------------------------------------------------------------
// Service helpers (port-injected, testable)
// ---------------------------------------------------------------------------

/** Human-readable reason when an auth action is unavailable. Null = available. */
export function authUnavailableReason(): string | null {
  if (!isFirebaseConfigured()) {
    return 'Firebase is not configured yet — add the real config files (see FIREBASE_SETUP.md). Your progress is safe locally.';
  }
  return null;
}

export async function ensureAnonymousUser(port: AuthPort): Promise<AuthUser | null> {
  if (!isFirebaseConfigured()) return null;
  const existing = port.currentUser();
  if (existing) return existing;
  try {
    return await port.signInAnonymously();
  } catch {
    // Auth misconfigured / offline: stay a local guest, never crash.
    return null;
  }
}

/**
 * Upgrade an anonymous account to email/password. Tries linking first
 * (keeps the uid); if the email already has an account, signs into that
 * account instead — the caller must then sync+merge (see syncManager).
 */
export async function upgradeToEmail(
  port: AuthPort,
  email: string,
  password: string,
): Promise<{ user: AuthUser; method: 'linked' | 'signed-in' }> {
  const current = port.currentUser();
  if (current && current.isAnonymous) {
    try {
      const user = await port.linkWithEmail(email, password);
      return { user, method: 'linked' };
    } catch (e) {
      const code = (e as { code?: string })?.code ?? '';
      if (!code.includes('email-already-in-use') && !String(e).includes('email-already-in-use')) {
        throw e;
      }
      // Fall through to sign-in with the existing account.
    }
  }
  const user = await port.signInWithEmail(email, password);
  return { user, method: 'signed-in' };
}
