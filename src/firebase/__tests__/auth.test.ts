// Tests for the M5 Firebase Auth service (auth.ts).
// The real native modules are never touched: ensureAnonymousUser and
// authUnavailableReason read isFirebaseConfigured() from './firebase',
// which is mocked here so both the configured and unconfigured paths
// are exercisable under Jest (the real module returns false under Jest
// because the native module is absent).
import { isFirebaseConfigured } from '../firebase';

jest.mock('../firebase', () => ({
  isFirebaseConfigured: jest.fn(() => true),
  PLACEHOLDER_PROJECT_ID: 'techieman-placeholder',
  getFirebaseProjectId: jest.fn(() => 'real-project'),
}));

import {
  authStatusFor,
  authUnavailableReason,
  ensureAnonymousUser,
  type AuthPort,
  type AuthUser,
} from '../auth';

const mockedIsConfigured = isFirebaseConfigured as jest.Mock;

function user(partial: Partial<AuthUser> = {}): AuthUser {
  return { uid: 'uid-1', email: null, isAnonymous: true, providerId: 'anonymous', ...partial };
}

/** Minimal in-memory AuthPort: only currentUser / signInAnonymously are
 *  exercised here; the rest throw if a test ever reaches them by mistake. */
class FakeAuthPort implements AuthPort {
  current: AuthUser | null = null;
  signInCalls = 0;
  signInError: Error | null = null;

  currentUser(): AuthUser | null {
    return this.current;
  }
  async signInAnonymously(): Promise<AuthUser> {
    this.signInCalls += 1;
    if (this.signInError) throw this.signInError;
    const created = user({ uid: 'anon-1', isAnonymous: true, providerId: 'anonymous' });
    this.current = created;
    return created;
  }
  async linkWithEmail(): Promise<AuthUser> {
    throw new Error('not exercised');
  }
  async signInWithEmail(): Promise<AuthUser> {
    throw new Error('not exercised');
  }
  async signInWithGoogle(): Promise<AuthUser> {
    throw new Error('not exercised');
  }
  async signOut(): Promise<void> {}
  async deleteCurrentUser(): Promise<void> {}
  onAuthStateChanged(): () => void {
    return () => {};
  }
}

beforeEach(() => {
  mockedIsConfigured.mockReturnValue(true);
});

describe('authStatusFor', () => {
  it('null user → guest', () => {
    expect(authStatusFor(null)).toBe('guest');
  });

  it('anonymous user → anonymous', () => {
    expect(authStatusFor(user({ isAnonymous: true, providerId: 'anonymous' }))).toBe('anonymous');
  });

  it('password provider → email', () => {
    expect(
      authStatusFor(user({ isAnonymous: false, email: 'v@example.com', providerId: 'password' })),
    ).toBe('email');
  });

  it('google.com provider → google', () => {
    expect(
      authStatusFor(user({ isAnonymous: false, email: 'v@example.com', providerId: 'google.com' })),
    ).toBe('google');
  });

  it('isAnonymous wins over the provider id', () => {
    expect(authStatusFor(user({ isAnonymous: true, providerId: 'google.com' }))).toBe('anonymous');
  });
});

describe('authUnavailableReason', () => {
  it('returns a non-null string when Firebase is unconfigured', () => {
    mockedIsConfigured.mockReturnValue(false);
    const reason = authUnavailableReason();
    expect(typeof reason).toBe('string');
    expect(reason).toContain('not configured');
  });

  it('returns null when Firebase is configured', () => {
    mockedIsConfigured.mockReturnValue(true);
    expect(authUnavailableReason()).toBeNull();
  });
});

describe('ensureAnonymousUser', () => {
  it('returns null without touching the port when Firebase is unconfigured', async () => {
    mockedIsConfigured.mockReturnValue(false);
    const port = new FakeAuthPort();
    port.current = user();
    await expect(ensureAnonymousUser(port)).resolves.toBeNull();
    expect(port.signInCalls).toBe(0);
  });

  it('returns the existing user without calling signInAnonymously', async () => {
    const port = new FakeAuthPort();
    const existing = user({ uid: 'existing-uid', isAnonymous: true });
    port.current = existing;
    await expect(ensureAnonymousUser(port)).resolves.toBe(existing);
    expect(port.signInCalls).toBe(0);
  });

  it('no current user → signs in anonymously and returns the new user', async () => {
    const port = new FakeAuthPort();
    const created = await ensureAnonymousUser(port);
    expect(port.signInCalls).toBe(1);
    expect(created).toMatchObject({ uid: 'anon-1', isAnonymous: true });
  });

  it('throwing port → null (stays a local guest, never crashes)', async () => {
    const port = new FakeAuthPort();
    port.signInError = new Error('offline');
    await expect(ensureAnonymousUser(port)).resolves.toBeNull();
  });
});
