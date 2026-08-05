// Firebase init. With no config in firebase-config.js every export is null and
// the app runs in demo mode (see store.js).
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../firebase-config.js';

export const firebaseEnabled = !!FIREBASE_CONFIG;

export let auth = null;
export let db = null;
export let googleProvider = null;

if (firebaseEnabled) {
  // Safari (especially installed home-screen apps) blocks the sign-in redirect
  // when the auth domain differs from the page's domain. Firebase Hosting
  // serves the auth helper on every hosting domain, so use the current one and
  // keep the whole flow same-origin.
  const config = { ...FIREBASE_CONFIG };
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h.endsWith('.web.app') || h.endsWith('.firebaseapp.com')) config.authDomain = h;
  }
  const app = initializeApp(config);
  auth = getAuth(app);
  // Offline persistence: the library stays readable with no signal, and writes
  // queue until the connection returns.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  googleProvider = new GoogleAuthProvider();
}
