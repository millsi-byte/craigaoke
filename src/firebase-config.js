// The Firebase web config. Filled in from the Firebase console
// (Project settings → Your apps → the </> icon).
//
// These values are NOT secrets — access is enforced by firestore.rules. They're
// meant to live in the repo. Do NOT paste the raw console snippet here: the app
// needs FIREBASE_CONFIG *exported* as an object; it calls initializeApp itself
// in src/lib/firebase.js. Leaving this null runs the app in demo mode.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAd4RsUDrxvc4aKZRxXKJ6assbFAhzjn8Y',
  authDomain: 'craigaoke.firebaseapp.com',
  projectId: 'craigaoke',
  storageBucket: 'craigaoke.firebasestorage.app',
  messagingSenderId: '251812051773',
  appId: '1:251812051773:web:dc2e0be56bc046a4fca354',
};

// The Cloudflare Worker URL (worker/lyrics-import-worker.js), e.g.
// 'https://craigaoke-import.something.workers.dev'. Without it, URL import
// falls back to the AI paste path — everything else works.
export const IMPORT_PROXY_URL = 'https://craigaoke.millsi.workers.dev';
