/**
 * Firebase web configuration and the admin allowlist.
 *
 * These values are PUBLIC identifiers, not secrets. They are compiled into admindash.js and
 * visible to anyone who loads the page — which is fine and by design. What protects the data is
 * firestore.rules, which refuses every request whose auth UID is not on the allowlist there.
 *
 * Hard-coded rather than read from `VITE_`-prefixed env vars on purpose: an absent env var
 * produces a build that fails at runtime in a way nothing catches at build time. That exact
 * failure mode already cost this project once, with VITE_CONTACT_URL and a missing
 * .env.production.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyBMIDZfE0ko2Z7BKoTMNS4KeEfFxjUmx60',
  // Pinned deliberately. The Content-Security-Policy in firebase.json allows exactly this host
  // in frame-src for the signInWithPopup auth iframe. Change one and you must change the other,
  // or sign-in breaks with a CSP error that looks nothing like an auth error.
  authDomain: 'creativoatwork-54e65.firebaseapp.com',
  projectId: 'creativoatwork-54e65',
  storageBucket: 'creativoatwork-54e65.firebasestorage.app',
  messagingSenderId: '296799029021',
  appId: '1:296799029021:web:a1335ba62a710499ab43f4',
} as const;

/**
 * Emails permitted to use the dashboard.
 *
 * This is a CONVENIENCE, NOT THE ACCESS CONTROL. It stops an accidental wrong-account session
 * and nothing more — anyone signed in to any Google account could call the Firestore REST API
 * directly and this array would never run. The real gate is the UID allowlist in
 * firestore.rules. Adding an email here without adding the matching UID there grants nothing.
 */
export const ADMIN_EMAILS: readonly string[] = [
  'creativoatwork@gmail.com',
  'simone@creativoatwork.com',
  // Present only in an emulator build (`npm run build:e2e`). A production bundle drops this
  // branch entirely — and even if it did not, an email without a matching UID in
  // firestore.rules grants precisely nothing.
  ...(import.meta.env.VITE_EMULATOR === '1' ? ['e2e@creativoatwork.test'] : []),
];

export const COLLECTION = 'projects';
