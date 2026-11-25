// TechieMan — Firebase availability detection (M5).
// The app MUST run fully without real Firebase config (guest-only mode).
// We ship placeholder google-services.json / GoogleService-Info.plist with
// project id 'techieman-placeholder' so the Android google-services Gradle
// plugin still succeeds; the JS layer treats that project id as "Firebase
// absent" and never calls a Firebase API. No real credentials are ever
// committed — see FIREBASE_SETUP.md for the console steps.
//
// All native imports are lazy-required inside functions (same pattern as
// guest.ts / bank.ts): the modules cannot load under Jest, and the app
// must not crash on a device without the config.

export const PLACEHOLDER_PROJECT_ID = 'techieman-placeholder';

/** The default Firebase app's project id, or null when Firebase is absent / uninitialised. */
export function getFirebaseProjectId(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { firebase } = require('@react-native-firebase/app') as {
      firebase: {
        app: () => { options?: { projectId?: string } };
      };
    };
    const projectId = firebase.app().options?.projectId;
    return typeof projectId === 'string' && projectId.length > 0 ? projectId : null;
  } catch {
    return null;
  }
}

/**
 * True only when a REAL Firebase project is configured (placeholder counts
 * as absent). Every Firebase call site must check this first; when false
 * the app stays in guest-only local mode and sync/auth are no-ops.
 */
export function isFirebaseConfigured(): boolean {
  const projectId = getFirebaseProjectId();
  return projectId !== null && projectId !== PLACEHOLDER_PROJECT_ID;
}
