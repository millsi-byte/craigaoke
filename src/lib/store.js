// The data layer, one interface with two backends:
//  - demo mode (no Firebase config): seed songs in memory, no sign-in, edits
//    reset on refresh — used for design review and trying the app.
//  - cloud mode: Google sign-in gated by the email allowlist, each person's
//    library live-synced from /users/{uid}/songs, EVERYONE search spanning the
//    group via a collectionGroup query (spec §2, §3, §10).
import { useEffect, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { SEED_SONGS } from '../data/seed.js';
import { auth, db, firebaseEnabled, googleProvider } from './firebase.js';
import { copyForLibrary } from './songs.js';

// One stable color per person, distinct from each other and from the red
// accent, white text readable on all — reused from the grocery attribution.
export const MEMBER_COLORS = ['#0f766e', '#4338ca', '#15803d', '#b45309', '#be185d', '#475569'];
export const colorForEmail = (email) => {
  let h = 0;
  for (const ch of email || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MEMBER_COLORS[h % MEMBER_COLORS.length];
};
export const initialsOf = (nameOrEmail) =>
  (nameOrEmail || '?').trim().slice(0, 2).toUpperCase();

const friendlyAuthError = (e) => {
  const code = (e && e.code) || '';
  if (code === 'auth/operation-not-allowed')
    return 'Google sign-in isn’t enabled yet (Firebase console → Authentication → Sign-in method → Google).';
  if (code === 'auth/unauthorized-domain')
    return 'This web address isn’t on the sign-in allowlist (Firebase console → Authentication → Settings → Authorized domains).';
  if (code === 'auth/popup-blocked')
    return 'The sign-in window was blocked — allow pop-ups for this site and try again.';
  return 'Sign-in failed' + (code ? ' (' + code + ')' : '') + '. Try again, or send Claude this exact message.';
};

// ─── Demo mode ───
// A couple of "friend" songs live only in the EVERYONE results, so the
// cross-library search and copy-in are visible without any setup.
const DEMO_FRIEND = { uid: 'demo-friend', name: 'Dave', email: 'dave@example.com' };
const DEMO_FRIEND_SONGS = [
  {
    ...copyForLibrary(
      {
        id: 'friend_reptilia',
        ownerUid: DEMO_FRIEND.uid,
        title: 'Reptilia',
        artist: 'The Strokes',
        bpm: 158,
        bpmSource: 'manual',
        lyrics:
          '[Verse 1]\nHe seemed impressed by the way you came in\n\n(demo lyrics)',
        links: [],
      },
      DEMO_FRIEND.name
    ),
    id: 'friend_reptilia',
    ownerUid: DEMO_FRIEND.uid,
  },
];

function useDemoStore() {
  const [songs, setSongs] = useState(SEED_SONGS);
  const [customTags, setCustomTags] = useState([]);

  const api = {
    signIn: () => {},
    signOutUser: () => {},
    addSong: (s) => setSongs((list) => list.concat([{ ...s, createdAt: Date.now(), ownerUid: 'demo' }])),
    updateSong: (id, patch) => setSongs((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    deleteSong: (id) => setSongs((list) => list.filter((s) => s.id !== id)),
    toggleFavorite: (id) =>
      setSongs((list) => list.map((s) => (s.id === id ? { ...s, favorite: !s.favorite } : s))),
    addCustomTag: (t) => setCustomTags((c) => (c.includes(t) ? c : c.concat([t]))),
    copyIn: (song, fromName) => {
      const copy = { ...copyForLibrary(song, fromName), createdAt: Date.now(), ownerUid: 'demo' };
      setSongs((list) => list.concat([copy]));
      return copy;
    },
    // EVERYONE scope: my library plus the demo friend's, each tagged with owner.
    loadEveryone: async () =>
      songs
        .map((s) => ({ song: s, owner: { uid: 'demo', name: 'You', mine: true } }))
        .concat(
          DEMO_FRIEND_SONGS.filter((f) => !songs.some((s) => s.copiedFrom && s.copiedFrom.songId === f.id)).map((s) => ({
            song: s,
            owner: { uid: DEMO_FRIEND.uid, name: DEMO_FRIEND.name, email: DEMO_FRIEND.email, mine: false },
          }))
        ),
  };

  return {
    mode: 'demo',
    authStep: 'ok',
    user: { uid: 'demo', name: 'You', email: null },
    songs,
    customTags,
    allowlist: null,
    api,
  };
}

// ─── Cloud mode ───
function useCloudStore() {
  const [user, setUser] = useState(undefined); // undefined = auth still resolving
  const [authError, setAuthError] = useState('');
  const [allowlist, setAllowlist] = useState(undefined); // undefined loading, null unreadable
  const [songs, setSongs] = useState(null);
  const [profileWritten, setProfileWritten] = useState(false);

  useEffect(() => {
    getRedirectResult(auth).catch((e) => setAuthError(friendlyAuthError(e)));
  }, []);
  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u || null)), []);

  const email = user && (user.email || '').toLowerCase();

  // The allowlist is readable by any verified user, so the rejection screen can
  // name which address signed in.
  useEffect(() => {
    if (!user) {
      setAllowlist(undefined);
      return;
    }
    getDoc(doc(db, 'config', 'allowlist'))
      .then((snap) => setAllowlist(snap.exists() ? (snap.data().emails || []).map((e) => e.toLowerCase()) : []))
      .catch(() => setAllowlist(null));
  }, [user]);

  const allowed = !!email && Array.isArray(allowlist) && allowlist.includes(email);

  // My library.
  useEffect(() => {
    if (!allowed) {
      setSongs(null);
      return undefined;
    }
    return onSnapshot(
      collection(db, 'users', user.uid, 'songs'),
      (qs) =>
        setSongs(
          qs.docs
            .map((d) => ({ ...d.data(), id: d.id, ownerUid: user.uid }))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        ),
      () => setSongs([])
    );
  }, [allowed, user]);

  // Record my profile (email, name, color) so EVERYONE results can attribute
  // songs without a per-song lookup.
  useEffect(() => {
    if (!allowed || profileWritten) return;
    setDoc(
      doc(db, 'users', user.uid),
      {
        email,
        displayName: user.displayName || email,
        initials: initialsOf(user.displayName || email),
        color: colorForEmail(email),
        updatedAt: Date.now(),
      },
      { merge: true }
    )
      .then(() => setProfileWritten(true))
      .catch(() => {});
  }, [allowed, profileWritten, user, email]);

  let authStep;
  if (user === undefined || (user && allowlist === undefined)) authStep = 'loading';
  else if (!user) authStep = 'signedOut';
  else if (allowlist === null) authStep = 'error';
  else if (!allowed) authStep = 'notAllowed';
  else if (songs === null) authStep = 'loading';
  else authStep = 'ok';

  const stamp = (s) => ({ ...s, updatedAt: Date.now() });
  const myCol = () => collection(db, 'users', user.uid, 'songs');

  const api = {
    signIn: async () => {
      setAuthError('');
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (e1) {
        const code = (e1 && e1.code) || '';
        if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request' || code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, googleProvider).catch((e2) => setAuthError(friendlyAuthError(e2)));
        } else if (code !== 'auth/popup-closed-by-user') {
          setAuthError(friendlyAuthError(e1));
        }
      }
    },
    signOutUser: () => signOut(auth),
    addSong: (s) => {
      const { id, ...data } = s;
      return setDoc(doc(myCol(), id), stamp({ ...data, ownerUid: user.uid, createdAt: Date.now() }));
    },
    updateSong: (id, patch) => updateDoc(doc(myCol(), id), stamp(patch)),
    deleteSong: (id) => deleteDoc(doc(myCol(), id)),
    toggleFavorite: (id) => {
      const cur = (songs || []).find((s) => s.id === id);
      return updateDoc(doc(myCol(), id), { favorite: !(cur && cur.favorite) });
    },
    addCustomTag: () => {}, // tags live on songs; cloud mode derives the set from them
    copyIn: async (song, fromName) => {
      const copy = copyForLibrary(song, fromName);
      const { id, ...data } = copy;
      await setDoc(doc(myCol(), id), stamp({ ...data, ownerUid: user.uid, createdAt: Date.now() }));
      return copy;
    },
    // EVERYONE scope (spec §10.1): one collection-group read across the group,
    // each song tagged with its owner's profile for attribution.
    loadEveryone: async () => {
      const [snap, profiles] = await Promise.all([
        getDocs(collectionGroup(db, 'songs')),
        getDocs(collection(db, 'users')),
      ]);
      const byUid = {};
      profiles.forEach((d) => (byUid[d.id] = d.data()));
      return snap.docs.map((d) => {
        const s = { ...d.data(), id: d.id };
        const owner = byUid[s.ownerUid] || {};
        return {
          song: s,
          owner: {
            uid: s.ownerUid,
            name: owner.displayName || owner.email || 'A friend',
            email: owner.email,
            color: owner.color || colorForEmail(owner.email || s.ownerUid),
            mine: s.ownerUid === user.uid,
          },
        };
      });
    },
  };

  return {
    mode: 'cloud',
    authStep,
    authError,
    user: user ? { uid: user.uid, name: user.displayName || user.email || 'You', email: user.email } : null,
    songs: songs || [],
    customTags: [],
    allowlist,
    api,
  };
}

// Emulator sign-in hook for the automated walkthrough; never active in prod.
if (firebaseEnabled && typeof window !== 'undefined') {
  window.__craigaokeGoogle = GoogleAuthProvider;
}

export const useAppStore = firebaseEnabled ? useCloudStore : useDemoStore;
