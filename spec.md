# Craigaoke — Technical Specification

**App name:** Craigaoke (header/branding, PWA name, home-screen icon label).

**Purpose:** A personal lyrics library with a tempo-driven auto-scrolling teleprompter, for guitar players who know the chords and forget the words. Mobile-first PWA, used with a guitar in hand. Each person owns their own library; a small allowlisted friend group can browse each other's and copy songs across.

**Scope: lyrics only.** No chords, no tablature content, no transcription. A tab *link* is a link out (§9); pulling tab content into the app — parsing it, aligning it in monospace — is deliberately out of scope and must not creep back in.

**Hard constraint: $0 to run.** Firebase Spark plan, Cloudflare Workers free tier, GetSongBPM free tier. No paid APIs, no Blaze plan, no Cloud Functions, no Firebase Storage. If something can't be built free, cut it rather than introduce cost.

**Visual design:** the Modernist design system, in `design-system/` (`styles.css` + `readme.md`), used as-is. Zero corner radius, 2px dividers, single accent `#ec3013`, Archivo throughout, flush-left labels including inside buttons. Take every color, space, font and shadow from the CSS custom properties — never hard-code a hex or a px the tokens already carry. With lyrics-only scope there is no monospace/alignment problem, so the system applies with no exceptions.

---

## 1. Stack & hosting

- **Frontend:** React + Vite, static SPA, PWA-enabled (installable, offline read of cached songs).
- **Hosting:** Firebase Hosting (Spark).
- **Database:** Cloud Firestore (Spark), offline persistence on.
- **Auth:** Firebase Authentication, Google sign-in only.
- **Import proxy:** one Cloudflare Worker (free tier) with two routes — lyrics page extraction (§6) and the GetSongBPM lookup (§7.1). Both are third-party fetches a browser can't make directly.
- **Do NOT use:** Cloud Functions, Firebase Storage, any keyed paid API.
- **Data portability:** Settings → Export All (whole library as one JSON) / Import. This is the only backup path on the free tier.

Auth's job here is **identity and attribution**, not access control — no sensitive data, small trusted friend group. Rules still enforce "write only your own library," because that's a correctness property (nobody edits someone else's songs), not a security posture.

## 2. Data model (Firestore)

```
/config/allowlist                 { emails: ["craig@example.com", ...] }
/users/{uid}                      { email, displayName, initials, color, createdAt }
/users/{uid}/songs/{songId}       — one person's library
```

Each person's library is its own subcollection. This is the inverse of the recipe app's single shared pool, and it's the main structural difference: **write your own, read across the group.**

### Song document

```json
{
  "id": "auto",
  "ownerUid": "uid",
  "title": "string",
  "artist": "string",
  "lyrics": "string",
  "sourceUrl": "string|null",
  "sourceSite": "string|null",
  "bpm": 118,
  "bpmSource": "getsongbpm | tap | manual | null",
  "linesPerBeat": 0.125,
  "tags": ["string"],
  "favorite": false,
  "links": [{ "url": "string", "label": "Original | Cover | Tutorial | Tab | Other | null" }],
  "notes": "string|null",
  "copiedFrom": { "uid": "string", "songId": "string", "displayName": "string" } | null,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

- **`artist` is a required single string**, not a tag. Exactly one per song — that's what makes browse-by-artist (§8.3) a real dimension rather than a tag filter. It arrives automatically from the page parse or the AI JSON, and is always editable by hand (typed from memory, or fixing a parser that got a name wrong).
- **`lyrics` is one plain-text string**, `\n` between lines, a blank line between sections. Section headers (`[Chorus]`, `[Verse 2]`) are **kept** — they're useful landmarks in the scroll — and rendered dimmed and letter-spaced (`--color-neutral-600`), not as lyric lines. Storing a string rather than an array keeps hand-editing a plain textarea.
- **`ownerUid` is duplicated onto every song** so collection-group results (§10.1) can attribute and route back to their library without a second lookup.
- `linesPerBeat` is the scroll calibration (§7.3). Null until first play.
- `copiedFrom` is provenance only — the copy is fully independent from the moment it's made (§10.3).

## 3. Security rules

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function verified() {
      return request.auth != null && request.auth.token.email_verified == true;
    }

    // Allowlist by verified Google email — no UID exchange, no join code.
    function allowed() {
      return verified() && get(/databases/$(database)/documents/config/allowlist)
        .data.emails.hasAny([request.auth.token.email]);
    }

    match /config/allowlist {
      allow read: if verified();          // the app must read it to explain a rejection
      allow write: if false;              // edited in the Firebase console only
    }

    match /users/{uid} {
      allow read: if allowed();
      allow create, update: if allowed() && request.auth.uid == uid;
      allow delete: if false;
    }

    // Each person writes only their own library; the whole group can read.
    match /users/{uid}/songs/{songId} {
      allow read: if allowed();
      allow write: if allowed() && request.auth.uid == uid;
    }

    // Required separately for the collectionGroup('songs') query in §10.1 —
    // a subcollection rule does not cover collection-group reads.
    match /{path=**}/songs/{songId} {
      allow read: if allowed();
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Join flow:** add a friend's email to `/config/allowlist` in the Firebase console ahead of time, send them the link. They sign in with Google and their library exists immediately — no code, no UID copy-paste, nothing for anyone to do at the moment they join. Store emails **lowercased**; Google returns them lowercased and `hasAny` is exact-match.

Honest limit: this gates what happens *after* Google sign-in, not who can attempt it. A friend with several Google accounts needs to know which email is on the list — so the rejection screen says which email they signed in with, and offers a switch-account button.

## 4. Screens

Tab bar: **LIBRARY · ARTISTS · ADD · SETTINGS**. The tab bar is hidden in Play (§7.4).

| Screen | Contents |
| --- | --- |
| Sign in | Google button; on rejection, "You're signed in as `x@y.com` — that address isn't on the list" + switch account |
| Library | Search field, scope toggle (§10.1), favorites toggle, tag chips, song list |
| Artists | Count chips (§8.3) → per-artist song list |
| Song detail | Title/artist, tempo row, PLAY, lyrics, links shelf, tags, favorite, edit, delete, attribution if copied |
| Play | The teleprompter (§7.4) |
| Add | SEARCH THE WEB ↗ · PASTE FROM CLIPBOARD · URL field · AI round-trip · type it manually |
| Settings | Account, initials/color, export/import, GetSongBPM attribution link, allowlist (read-only view) |

## 5. Capture — the import paths

Three paths in, and only three. Everything else is a reference link (§9), not an import.

### 5.1 Search → clipboard

An in-app search box that opens `google.com/search?q=<artist song> lyrics` **in a new tab** (the SEARCH THE WEB ↗ pattern). It cannot be embedded — Google and the lyrics sites send frame-blocking headers, and no web app can work around that; only a native app could, which is a materially bigger project and out of scope.

The fast version within a web app: he searches in the new tab, copies the link, comes back, and taps **PASTE FROM CLIPBOARD**, which calls `navigator.clipboard.readText()` and drops the URL straight into the import field. One tap instead of a long-press paste gesture. Where the Clipboard API is unavailable or permission is refused, the field is still a normal text input — degrade silently, never block.

### 5.2 URL paste → parse (primary)

Paste (or share, or clipboard-fill) a lyrics URL → the Worker fetches and extracts (§6) → a preview screen showing title, artist and the first lines → ADD TO LIBRARY. **Every import lands on a review/edit screen before saving**, both paths, so a bad parse is fixed in place rather than saved wrong.

### 5.3 Android share target

`share_target` in the manifest, so Craigaoke appears in Android's share sheet — share a lyrics page from Chrome and it opens straight into the import preview, no clipboard step. Confirmed needed: the group is mixed Android/iPhone.

```json
"share_target": {
  "action": "/add",
  "method": "GET",
  "params": { "title": "title", "text": "text", "url": "url" }
}
```

The handler reads `url`, falling back to the first URL found in `text` (Android apps vary in which field carries the link). iOS does not support this for web apps — iPhone users get §5.1, which is why the clipboard path is not optional.

### 5.4 AI round-trip (universal fallback)

**COPY PROMPT** copies a fixed prompt; he pastes it into any Claude chat with the lyrics text (or a photo, or from memory); pastes the JSON back into a monospace textarea; the app strips ``` fences, validates, previews, saves. Zero API cost, works when everything else fails.

```json
{ "title": "string", "artist": "string", "lyrics": "line\nline\n\n[Chorus]\nline",
  "bpm": null, "tags": [], "links": [{ "url": "string", "label": "Original" }] }
```

Prompt rules: return only the JSON object, no commentary and no fences; `artist` is required and is the performing artist, not the songwriter; preserve line breaks exactly; blank line between sections; keep `[Section]` headers; **no chords or tab** — strip any chord lines; `bpm` null unless genuinely known. Validation errors are inline and specific: which field, what's wrong.

## 6. The Worker — lyrics extraction

`worker/lyrics-import-worker.js`, one Cloudflare Worker, two routes. Same shape as the recipe app's worker (origin allowlist, server-side fetch with a mobile Safari UA, `cf: { cacheTtl: 3600 }`, JSON back) with one real difference:

**Recipe sites publish `schema.org/Recipe`; lyrics sites publish nothing equivalent.** So instead of one universal parser there's a small per-host rule table. Confirmed targets: **Genius and AZLyrics**.

```js
const RULES = {
  'genius.com':   { lyrics: extractGenius,   meta: metaFromOgTitle },
  'azlyrics.com': { lyrics: extractAzLyrics, meta: metaFromAzTitle },
};
```

- **Genius** — lyric text lives in one or more `div[data-lyrics-container="true"]`. Concatenate them in document order, convert `<br>` to `\n`, strip remaining tags, decode entities, collapse 3+ blank lines to one. Title and artist come from `<meta property="og:title">`, whose content is `Song by Artist`; fall back to parsing `<title>` (`Artist – Song Lyrics | Genius`).
- **AZLyrics** — the lyric text sits in an unlabeled `<div>` immediately after a distinctive HTML comment about third-party usage; anchor on that comment, take the following div, same tag-stripping. Title and artist come from `<title>` (`Artist - Song Lyrics`) or the `<b>` tags in the page header.

Return shape: `{ title, artist, lyrics, sourceSite }` or `{ error: "..." }`. Unknown host, blocked fetch, or empty extraction → the app shows "Couldn't read this page" with a one-tap jump to the AI path (§5.4), pre-filled with the URL.

**Two things to expect and handle, not be surprised by:**
1. **AZLyrics blocks datacenter traffic.** Worker egress will sometimes get a 403 or a challenge page. Detect a non-200 or a body with no lyric container and fall through to §5.4 — don't retry, don't try to look like a browser beyond a plain UA header.
2. **Layouts change.** A per-host rule that silently returns empty is worse than one that errors, so treat "extracted fewer than 4 lines" as a failed parse, not a short song.

Selectors here are written against the sites as of this spec; confirm each against a live page before building the rule, and keep `RULES` the single place any of it lives.

## 7. Tempo and the teleprompter

### 7.1 Getting a BPM — three ways, all of them optional

1. **Automatic lookup (convenience).** GetSongBPM.com — free API, email-only registration, ~3,000 req/hour, song→BPM by artist and title. Called through the Worker's second route (a browser call to it will hit CORS, same wall as the lyrics pages). **It requires a visible attribution backlink**, which goes in Settings *and* beside the tempo field wherever a looked-up value is shown. That's a normal trade, like crediting an open source — but it is a build requirement, not a nicety.
2. **Tap tempo.** A TAP button; he taps along; BPM = `60000 / mean(intervals)` over the last 8 taps, discarding the run if a gap exceeds 2s, clamped to 40–240 and rounded. Live readout after the second tap.
3. **Manual entry.** A plain number field.

Do all three — not either/or. A looked-up studio tempo often won't match how he actually plays a song (cover, capo, personal preference), so **the lookup is a suggestion and the manual controls are the real mechanism.** A looked-up value is shown as a suggestion he accepts, never silently applied.

**Do not build against Spotify's audio-features endpoint** — deprecated for new apps since November 2024, it will 403, and every old tutorial still points at it. **AcousticBrainz** is public-domain but frozen since 2022 and ships as a static dump, not a live API — too heavy for this.

### 7.2 What BPM alone does *not* give you

BPM is beats per minute; scrolling needs pixels per second. Two songs at 120 BPM with different lyric density need different scroll speeds, so the mapping needs a second number:

```
pixelsPerSecond = lineHeightPx × linesPerBeat × bpm / 60
```

`linesPerBeat` is stored per song and self-calibrates:

- **Initial value:** if the BPM lookup returned a track duration, `linesPerBeat = lyricLineCount / (durationSec / 60 × bpm)` — near-exact, free, from data already fetched. Otherwise default to `0.125` (one line per two 4/4 bars), which is about right for a typical verse.
- **Then it learns.** The live nudge control (§7.4) writes back to `linesPerBeat` on exit. First play calibrates; every play after is right. This is what makes a single constant rate actually work in practice, and it's why the nudge is a required control rather than a nice-to-have.

A song with a real mid-song tempo change (slow verse into fast chorus) is **not** designed for. One constant rate plus the nudge is the v1 answer. Revisit only if it turns out to matter for songs he actually plays — don't build a tempo-map editor on speculation.

### 7.3 Count-in

Before anything moves: four metronome clicks at the set BPM, with a 1-2-3-4 count on screen, so he has a beat to lock into and a moment to set his hands. Clicks are generated with a Web Audio oscillator plus a short gain envelope — no audio files, no network, works offline. First beat accented.

### 7.4 The play view

Cook mode's hands-free pattern, repurposed. Full-screen, tab bar hidden, everything else gone.

- **Scroll:** a `requestAnimationFrame` loop advancing a `translate3d(0, -y, 0)` transform by `pixelsPerSecond × deltaTime`. Use a transform, not `scrollTop` — smoother, and it sidesteps scroll anchoring and momentum entirely.
- **Type:** large, flush left, high contrast. Section headers dimmed. A 2px accent rule across the screen marks the read line at ~40% height — the one piece of chrome, and it's the design system's own vocabulary.
- **Pause/stop — both mechanisms:** the entire lyric area is a tap-to-pause zone (findable with a guitar in hand, no aiming), **and** a small persistent pause control sits bottom-left so it's discoverable and there's something deliberate to hit. **Resuming replays the count-in** so he can lock back in. A STOP action exits to song detail.
- **Nudge:** −/+ speed controls, ±4% per tap, visible while playing, adjustable without stopping. Persists to `linesPerBeat` on exit (§7.2).
- **Wake Lock:** acquire on mount, re-acquire on `visibilitychange`, release on exit — lift `useWakeLock()` from the recipe app's `CookModeScreen.jsx` as-is. This is the whole point: hands are busy, the screen must not lock.
- **End of song:** scrolling stops at the last line and the view offers RESTART / DONE. It does not auto-exit.
- **Reference links are not shown here.** The play view stays minimal by design — the reason it exists is not touching the screen.

## 8. Library, search, organizing

### 8.1 Library view

Card/list of songs (title, artist, tags, favorite mark), instant client-side search across title, artist, lyrics and tags. No server search.

### 8.2 Tags and favorites

Freeform multi-tag, autocompleting against existing tags to avoid near-duplicates; multi-select AND filter chips. Favorites toggle. Both are personal and apply **only to songs in your own library** (§10.2).

### 8.3 Browse by artist

Reuse the recipe app's Discover mechanic (`mealdb.js:topByCount()` + the chip row in `AddScreen.jsx`), pointed at `song.artist` over his own library: count values, sort most-songs-first, cap the list, expandable. Simpler than the original — it counts his own data, queries nothing external. Tapping "Pearl Jam · 7" lists every Pearl Jam song in the library.

Artist is a browse dimension, not a filter chip alongside tags: one per song, always present, and it gets its own tab.

## 9. Reference links

Every song carries a **list** of outside links — the original on YouTube, a cover he likes, a lesson video teaching the guitar part, a tab site, anything worth keeping next to the lyrics.

- **Not an import source.** A video has no extractable lyrics text. Links ride along with a song captured via §5; they never create one.
- **A tab link is a link out**, not tab content coming in. See the scope note at the top.
- **Each link takes an optional label** from a short fixed list — Original · Cover · Tutorial · Tab · Other — rendered as a `.tag` chip beside it. A picker, not a text field, so it costs one tap on a phone. Unlabeled links display their domain.
- Surfaced on song detail as a shelf, below the lyrics. Never in the play view.

## 10. Multi-user

Multiple guitar friends, each with their own separate library. A song someone adds lands only in their library, never anyone else's.

### 10.1 Search scope toggle

An explicit **MY LIBRARY / EVERYONE** segmented control on the Library screen. "Everyone" runs `collectionGroup('songs')` across all allowlisted members (hence the rule in §3 and `ownerUid` in §2); "My Library" is the same search narrowed to his own. Results from someone else's library are marked with that person's colored initials.

### 10.2 Browse-only until copied

Seeing a friend's song is not using it. A friend's song shows a clear **ADD TO MY LIBRARY** action, and until he taps it the song is view-only — no favoriting, no tags, no tempo edits, no play calibration. All of those are things you do to your own copy. Someone else's library is effectively read-only right up to the moment he copies a song in.

### 10.3 Copy, not a live link

Adding a friend's song **copies it at that moment** — new doc in his library, independent from then on, `copiedFrom` recording provenance for display. Later edits by either person don't touch the other's copy.

This is the recipe app's grocery-list snapshot decision applied to a new problem, and for the same reason: a live link means "my friend edited their copy and mine silently changed," which is exactly the surprise the separate-libraries model exists to avoid. `linesPerBeat` does **not** copy across — his strumming isn't his friend's.

### 10.4 Attribution

Per-person color-coded initials, lifted from the grocery list's `initialsByUid` / `colorsByUid`. Used for "whose library is this song in" on Everyone-scope results and on `copiedFrom` provenance.

## 11. Sourcing boundary

Song lyrics are copyrighted creative text — unlike an ingredient list, which is a functional listing. That shapes what this is: **a personal library of things he found, for his own use**, the same thing people have always done with a notebook. Two consequences that are build decisions, not disclaimers:

- **No public database.** Read access spans a small allowlisted friend group and stops there. No public browse, no unauthenticated read, no crawlable index. Don't add one later without revisiting this.
- **No lyrics API to design around.** There is no free official lyrics-text API — Genius' API deliberately returns metadata and a link, never the lyrics. URL-paste-and-parse is the path; don't spend time looking for a cleaner one.

GetSongBPM's attribution backlink is a condition of using their free tier — ship it with the first build that calls the API, not later.

## 12. Build order

1. **Shell** — Vite + React, `design-system/styles.css` linked, tab bar, Google sign-in, allowlist gate, empty library.
2. **Library core** — manual add/edit, list, search, tags, favorites, artist browse. Everything downstream needs songs to exist.
3. **Play view** — manual BPM + tap tempo, count-in, scroll loop, pause/nudge, wake lock. This is the headline feature; get it working on a real phone with a real guitar before anything else is polished.
4. **Worker + URL import** — Genius and AZLyrics rules, preview/edit screen, clipboard button, Android share target.
5. **AI round-trip** — prompt, paste box, validation.
6. **GetSongBPM route** — lookup, suggestion UI, attribution link.
7. **Friend group** — scope toggle, collection-group query, copy-in, attribution initials.
8. **PWA polish** — manifest, icons, offline, export/import.

## 13. Quality bar

- Fast on iPhone Safari and Android Chrome; touch targets ≥ 44px; no horizontal scroll at any width.
- The play view must hold a steady scroll rate without jank on a mid-range phone — it's the one screen where frame drops are the product failing.
- Offline: own library readable from cache; writes queue and sync.
- Rules deny everything except allowlisted verified emails; rules file lives in the repo.
- README documents: Firebase setup, Google auth, editing the allowlist, Worker deployment, GetSongBPM registration, deploy.

## 14. Out of scope (v1)

- Chords, tablature content, transcription, monospace alignment of anything.
- Mid-song tempo maps (§7.2).
- Audio playback, audio sync, listening to the song to detect tempo.
- Native app store distribution (which is the only thing that would make in-app embedded search possible — §5.1).
- Public sharing of lyrics beyond the allowlisted group (§11).
- Any paid service or API key with a cost attached.

## 15. Still open

Nothing blocking. Two things to confirm against reality during build:

- The Genius and AZLyrics selectors in §6, against live pages, before writing the rules.
- The `0.125` default in §7.2 — one real song at a known tempo will tell you whether the starting guess is close enough that the first nudge is small.
