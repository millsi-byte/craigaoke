# Craigaoke

A personal lyrics library with a tempo-driven auto-scrolling teleprompter, for guitar players who know the chords and forget the words. Set a tempo, hit play, keep both hands on the guitar.

Built as a $0-to-run PWA: Firebase free tier, Cloudflare Workers free tier, GetSongBPM free tier. No paid APIs, no credit card.

- **[spec.md](spec.md)** — the full specification (data model, security, import, the play view).
- **[design-system/](design-system/)** — the Modernist design system this is built on.

---

## Try it right now (no setup)

```
npm install
npm run dev
```

Open the address it prints (best viewed at phone width in your browser's device toolbar). With no Firebase config it runs in **demo mode**: sample songs, no sign-in, changes reset on refresh. Two songs have a tempo set, so you can open one → **PLAY** and watch the count-in and scroll. This is what you show someone to explain the app.

---

## Getting it live — the non-developer path

Nothing here needs a terminal beyond the first `npm install`. Three free accounts, in order of how much they matter.

### Step 1 — Firebase (required: this is the app's home + database)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**. Name it `craigaoke`. Decline Google Analytics.
2. **Add a web app**: Project settings (gear) → *Your apps* → the `</>` icon. Copy the `firebaseConfig` block it shows you.
3. Paste it into **`src/firebase-config.js`**, replacing the `null`. (These values aren't secrets — access is controlled by the rules file.)
4. **Enable the database**: Build → Firestore Database → *Create database* → production mode.
5. **Turn on Google sign-in**: Build → Authentication → *Get started* → Sign-in method → Google → Enable.
6. **Add the friend group**: in Firestore, create a collection `config`, document id `allowlist`, with one field `emails` (type *array*) holding each person's Gmail address, lowercase. Craig's, yours, whoever. That list *is* the join process — anyone whose email is on it gets their own library the moment they sign in.

That's enough to run the whole app for real (typing/pasting lyrics by hand). The next two steps just make capture and tempo automatic — do them whenever.

### Step 2 — Cloudflare (optional: reads lyrics pages for you)

Browsers can't fetch other sites' pages from a phone, so a tiny free helper does it.

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) (no card for the Workers free tier).
2. **Workers & Pages → Create → Create Worker → Deploy** the sample, then **Edit code**, paste in the contents of **`worker/lyrics-import-worker.js`**, and **Deploy**.
3. Copy the worker's URL (like `https://craigaoke-import.you.workers.dev`) into `IMPORT_PROXY_URL` in `src/firebase-config.js`.

Without this, URL import just says "use the AI paste path instead" — everything else works.

### Step 3 — GetSongBPM (optional: automatic tempos)

1. Register free (email only) at [getsongbpm.com/api](https://getsongbpm.com/api).
2. In the Cloudflare worker: Settings → Variables → **Add variable** → name `GETSONGBPM_KEY`, paste your key, click **Encrypt**, Save.
3. Their free tier requires a visible credit link back to them — it's already in the app (Settings, and next to the tempo control). Leave it in.

### Step 4 — Publish

This repo already publishes itself when code lands on `main` (see `.github/workflows/` once set up), exactly like your recipe app:

1. Firebase console → Project settings → **Service accounts** → *Generate new private key*.
2. In the GitHub repo → Settings → **Secrets and variables → Actions** → paste it as a secret named `FIREBASE_SERVICE_ACCOUNT_CRAIGAOKE`.
3. Push to `main`. It builds and deploys to `https://craigaoke.web.app`.

To publish by hand instead: `npm run build && firebase deploy` (one-time: `npm i -g firebase-tools`, `firebase login`, `firebase init hosting` pointed at `dist`, and deploy the rules with `firebase deploy --only firestore:rules`).

Craig opens `craigaoke.web.app` on his phone → **Add to Home Screen** → it behaves like an app. No app store.

---

## What's built

Everything in the spec's library and play slices (build order §12, steps 1–7): sign-in with the email allowlist, the library (search, tags, favorites, browse-by-artist), manual add/edit, all three import paths (URL via the worker, AI round-trip, Android share), the tempo controls (manual / tap / GetSongBPM lookup), and the full teleprompter — count-in, tempo-driven scroll, tap-or-button pause, self-calibrating speed nudge, and Screen Wake Lock. The cross-library EVERYONE search and copy-in are wired end to end.

Still to come (spec §12 step 8): a proper app icon (the icons in `public/icons/` are placeholders from the recipe app), and export/import backup.

## Stack

React + Vite PWA · Firebase Hosting + Firestore + Google sign-in · one Cloudflare Worker · all free tier.
