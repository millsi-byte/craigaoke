// The three ways a song gets in (spec §5). All of them end at the same place:
// a draft song on the review screen, never a silent save.
import { IMPORT_PROXY_URL } from '../firebase-config.js';
import { emptySong } from './songs.js';

export const SUPPORTED_SITES = ['genius.com', 'azlyrics.com'];

export const looksLikeUrl = (s) => /^https?:\/\/\S+$/i.test((s || '').trim());

export const siteOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

export const isSupportedSite = (url) => {
  const host = siteOf(url);
  return SUPPORTED_SITES.some((s) => host === s || host.endsWith('.' + s));
};

// Plain-language reasons. Every failure ends with the same escape hatch, so
// the message says what happened, not what went wrong internally.
const IMPORT_ERRORS = {
  'no-proxy': 'The lyrics fetcher isn’t set up yet (see the README). Use the AI paste path below.',
  'unsupported-site': 'Craigaoke can only read Genius and AZLyrics pages directly. Use the AI paste path below.',
  'no-lyrics-found': 'That page loaded, but no lyrics were found on it — the site may have changed its layout.',
  'need-artist-and-title': 'Add the artist and title first, then look up the tempo.',
};
const friendlyImportError = (code) =>
  IMPORT_ERRORS[code] ||
  (String(code).startsWith('blocked-')
    ? 'That site refused the request — it blocks automated readers. Use the AI paste path below.'
    : 'Couldn’t read that page. Use the AI paste path below.');

// Path B: URL → Worker → draft song.
export async function importFromUrl(url) {
  const clean = (url || '').trim();
  if (!looksLikeUrl(clean)) return { error: 'That doesn’t look like a web address.' };
  if (!IMPORT_PROXY_URL) return { error: friendlyImportError('no-proxy') };
  if (!isSupportedSite(clean)) return { error: friendlyImportError('unsupported-site') };

  let data;
  try {
    const res = await fetch(IMPORT_PROXY_URL + '?url=' + encodeURIComponent(clean));
    data = await res.json();
  } catch {
    return { error: 'Couldn’t reach the lyrics fetcher. Check the connection and try again.' };
  }
  if (data.error) return { error: friendlyImportError(data.error) };

  return {
    song: {
      ...emptySong(),
      title: data.title || '',
      artist: data.artist || '',
      lyrics: data.lyrics || '',
      sourceUrl: clean,
      sourceSite: data.sourceSite || siteOf(clean),
    },
  };
}

// Tempo lookup (spec §7.1) — a suggestion, never applied silently.
export async function lookupBpm(artist, title) {
  if (!IMPORT_PROXY_URL) return { error: friendlyImportError('no-proxy') };
  if (!artist || !title) return { error: friendlyImportError('need-artist-and-title') };
  try {
    const res = await fetch(
      IMPORT_PROXY_URL.replace(/\/$/, '') +
        '/bpm?artist=' + encodeURIComponent(artist) +
        '&title=' + encodeURIComponent(title)
    );
    const data = await res.json();
    if (data.error) return { error: 'Couldn’t look up a tempo — set it by hand or tap it in.' };
    if (!data.bpm) return { error: 'No tempo on file for that song — set it by hand or tap it in.' };
    return { bpm: data.bpm, durationSec: data.durationSec || null };
  } catch {
    return { error: 'Couldn’t reach the tempo lookup. Set it by hand or tap it in.' };
  }
}

// Path C: the universal fallback. Works with any AI chat, costs nothing.
export const AI_PROMPT = `You are helping me put song lyrics into my personal lyrics app.

I will give you a song (as text, a photo, or just its name). Reply with ONE JSON object and nothing else — no explanation, no markdown code fences.

Shape:
{
  "title": "the song title",
  "artist": "the performing artist, not the songwriter",
  "lyrics": "the full lyrics as one string",
  "bpm": null,
  "tags": [],
  "links": []
}

Rules:
- "artist" is required. If you genuinely don't know it, use "".
- "lyrics": keep the original line breaks. One blank line between sections.
- Keep section headers like [Verse 1] or [Chorus] on their own lines.
- Do NOT include chords or tablature — strip any chord lines out.
- "bpm": a number only if you actually know the song's tempo, otherwise null.
- Use plain straight double quotes (") throughout — never curly/smart quotes
  (“ ” ‘ ’). No trailing commas. The reply must be JSON a strict parser accepts.
- Return the JSON object on its own. No fences, no commentary.

The song is: `;

// What AI chats actually return isn't always strict JSON: phones and chat UIs
// auto-"curl" straight quotes into “smart” ones, and models sometimes leave a
// trailing comma. Try strict first (never touch already-valid JSON), then apply
// the smallest safe repairs and try once more.
function relaxedJsonParse(body) {
  try {
    return JSON.parse(body);
  } catch {
    /* fall through to repair */
  }
  const repaired = body
    // curly / typographic double quotes → straight "
    .replace(/[“”„‟″‶]/g, '"')
    // curly single quotes / apostrophes → straight ' (safe inside JSON strings)
    .replace(/[‘’‚‛′‵]/g, "'")
    // trailing comma before a closing } or ]
    .replace(/,(\s*[}\]])/g, '$1');
  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

// Accepts what an AI chat actually returns — fenced or not, with or without
// surrounding chatter.
export function parseAiJson(text) {
  const raw = (text || '').trim();
  if (!raw) return { error: 'Paste the JSON the AI gave you.' };

  let body = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  if (body[0] !== '{') {
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start === -1 || end <= start) return { error: 'That doesn’t contain a JSON object.' };
    body = body.slice(start, end + 1);
  }

  const data = relaxedJsonParse(body);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { error: 'That isn’t valid JSON — copy the AI’s whole reply and try again.' };
  }

  if (!data.title || typeof data.title !== 'string') return { error: 'The JSON has no "title".' };
  if (typeof data.artist !== 'string') return { error: 'The JSON has no "artist" — every song needs one.' };
  if (!data.lyrics || typeof data.lyrics !== 'string') return { error: 'The JSON has no "lyrics".' };

  const links = Array.isArray(data.links)
    ? data.links
        .map((l) => (typeof l === 'string' ? { url: l, label: null } : l))
        .filter((l) => l && typeof l.url === 'string' && looksLikeUrl(l.url))
        .map((l) => ({ url: l.url.trim(), label: typeof l.label === 'string' ? l.label : null }))
    : [];

  return {
    song: {
      ...emptySong(),
      title: data.title.trim(),
      artist: data.artist.trim(),
      lyrics: data.lyrics.replace(/\r/g, '').trim(),
      bpm: Number.isFinite(data.bpm) ? Math.round(data.bpm) : null,
      bpmSource: Number.isFinite(data.bpm) ? 'manual' : null,
      tags: Array.isArray(data.tags) ? data.tags.filter((t) => typeof t === 'string') : [],
      links,
    },
  };
}

// Android share sheet (spec §5.3): apps disagree about which field carries the
// link, so check `url` first and then dig a URL out of `text`.
export function sharedUrlFromLocation(search) {
  const p = new URLSearchParams(search || '');
  const direct = p.get('url');
  if (direct && looksLikeUrl(direct)) return direct.trim();
  const text = p.get('text') || '';
  const found = text.match(/https?:\/\/\S+/);
  return found ? found[0] : null;
}
