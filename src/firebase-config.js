// Paste the Firebase web config here to switch the app from demo mode to the
// real thing. Firebase console → Project settings → Your apps → the </> icon.
//
// These values are NOT secrets — access is enforced by firestore.rules.
//
// Leave it as null and the app runs in demo mode: sample songs, no sign-in,
// changes reset on refresh. That's what makes it viewable before any setup.
export const FIREBASE_CONFIG = null;

// export const FIREBASE_CONFIG = {
//   apiKey: '...',
//   authDomain: 'craigaoke.firebaseapp.com',
//   projectId: 'craigaoke',
//   storageBucket: 'craigaoke.firebasestorage.app',
//   messagingSenderId: '...',
//   appId: '...',
// };

// The Cloudflare Worker URL (worker/lyrics-import-worker.js), e.g.
// 'https://craigaoke-import.something.workers.dev'. Without it, URL import
// falls back to the AI paste path — everything else works.
export const IMPORT_PROXY_URL = null;
