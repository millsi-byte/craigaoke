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
  // Use the configured authDomain (…firebaseapp.com). Its /__/auth/handler is the
  // redirect URI Google pre-approves when Google sign-in is enabled, so the OAuth
  // flow is accepted. An earlier build rewrote authDomain to the current .web.app
  // host to keep sign-in same-origin, but that host's handler is NOT on the OAuth
  // client's authorized redirect URIs, so Google rejected sign-in with
  // redirect_uri_mismatch. Popup sign-in (tried first in store.js) handles the
  // cross-domain case; the redirect fallback lands on the pre-approved handler.
  const app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  // Offline persistence: the library stays readable with no signal, and writes
  // queue until the connection returns.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  googleProvider = new GoogleAuthProvider();
}
