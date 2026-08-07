// Cloudflare Worker (free tier) for Craigaoke. Two routes, both doing things
// a browser can't do from a phone:
//
//   GET /?url=<lyrics page url>        → { title, artist, lyrics, sourceSite }
//   GET /bpm?artist=<a>&title=<t>      → { bpm, durationSec }
//
// Deploy (no command line): dash.cloudflare.com → Workers & Pages → Create →
// Start from Hello World → paste this file over the sample → Deploy → copy the
// worker URL into IMPORT_PROXY_URL in src/firebase-config.js.
//
// The GetSongBPM key is set as a Worker secret (Settings → Variables →
// Add variable → Encrypt), never in the app bundle:  GETSONGBPM_KEY

const ALLOWED_ORIGINS = [
  'https://craigaoke.web.app',
  'https://craigaoke.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:4173',
];

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
});

const json = (body, origin, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });

// ── HTML helpers ──────────────────────────────────────────────────────────

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'", '#x2F': '/',
};

function decode(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (m, e) => {
    if (ENTITIES[e]) return ENTITIES[e];
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : m;
    }
    return m;
  });
}

// Tags out, <br> and block ends to newlines, runs of blank lines collapsed.
function toText(html) {
  return decode(
    html
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\/\s*(p|div|h[1-6])\s*>/gi, '\n')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const meta = (html, prop) => {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`,
    'i'
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
    'i'
  );
  const m = html.match(re) || html.match(alt);
  return m ? decode(m[1]) : null;
};

const pageTitle = (html) => {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decode(m[1]).trim() : '';
};

// ── Per-site extraction ───────────────────────────────────────────────────
// Lyrics sites publish no shared structured format (unlike schema.org/Recipe),
// so each host needs its own rule. Keep every site-specific assumption here.

function extractGenius(html) {
  // Genius wraps lyrics in one or more div[data-lyrics-container="true"], and
  // nests other <div>s inside (annotations, section wrappers). A non-greedy
  // "up to the first </div>" regex truncates at the first nested close and
  // drops most of the song, so track <div>/</div> depth to capture each whole
  // container.
  const results = [];
  const openRe = /<div[^>]*\bdata-lyrics-container=["']true["'][^>]*>/gi;
  let open;
  while ((open = openRe.exec(html)) !== null) {
    const start = openRe.lastIndex;
    const tagRe = /<(\/?)div\b[^>]*>/gi;
    tagRe.lastIndex = start;
    let depth = 1;
    let end = -1;
    let tag;
    while ((tag = tagRe.exec(html)) !== null) {
      if (tag[1] === '/') {
        if (--depth === 0) { end = tag.index; break; }
      } else {
        depth++;
      }
    }
    if (end === -1) end = html.length;
    results.push(html.slice(start, end));
    openRe.lastIndex = end;
  }
  if (!results.length) return null;
  return results.map(toText).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

function metaGenius(html) {
  // og:title is "Song by Artist".
  const og = meta(html, 'og:title');
  if (og && / by /.test(og)) {
    const i = og.lastIndexOf(' by ');
    return { title: og.slice(0, i).trim(), artist: og.slice(i + 4).trim() };
  }
  // Fallback: <title> is "Artist – Song Lyrics | Genius Lyrics".
  const t = pageTitle(html).replace(/\s*\|\s*Genius.*$/i, '');
  const m = t.match(/^(.*?)\s*[–—-]\s*(.*?)\s*Lyrics\s*$/i);
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { title: t, artist: '' };
}

function extractAzLyrics(html) {
  // The lyric div is unlabeled, but it always follows this usage comment.
  const marker = html.search(/<!--\s*Usage of azlyrics\.com content by any third-party/i);
  if (marker === -1) return null;
  const after = html.slice(marker);
  const open = after.search(/<div[^>]*>/i);
  if (open === -1) return null;
  const body = after.slice(open).replace(/^<div[^>]*>/i, '');
  const close = body.search(/<\/div>/i);
  return close === -1 ? null : toText(body.slice(0, close));
}

function metaAzLyrics(html) {
  // <title> is "Artist - Song Lyrics | AZLyrics.com".
  const t = pageTitle(html).replace(/\s*\|\s*AZLyrics.*$/i, '');
  const m = t.match(/^(.*?)\s*[-–]\s*(.*?)\s*Lyrics\s*$/i);
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { title: t, artist: '' };
}

const RULES = {
  'genius.com': { lyrics: extractGenius, meta: metaGenius, site: 'Genius' },
  'azlyrics.com': { lyrics: extractAzLyrics, meta: metaAzLyrics, site: 'AZLyrics' },
};

const ruleFor = (hostname) => {
  const host = hostname.replace(/^www\./, '');
  const key = Object.keys(RULES).find((k) => host === k || host.endsWith('.' + k));
  return key ? RULES[key] : null;
};

// ── Routes ────────────────────────────────────────────────────────────────

async function importLyrics(target, origin) {
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return json({ error: 'bad-url' }, origin, 400);
  }
  if (!/^https?:$/.test(parsed.protocol)) return json({ error: 'bad-url' }, origin, 400);

  const rule = ruleFor(parsed.hostname);
  if (!rule) return json({ error: 'unsupported-site', host: parsed.hostname }, origin);

  let res;
  try {
    res = await fetch(target, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      cf: { cacheTtl: 3600 },
    });
  } catch {
    return json({ error: 'fetch-failed' }, origin);
  }
  // Some sites (AZLyrics especially) block datacenter traffic. One attempt,
  // no retries, no pretending harder to be a browser — the app falls back to
  // the AI paste path, which always works.
  if (!res.ok) return json({ error: 'blocked-' + res.status }, origin);

  const html = await res.text();
  const lyrics = rule.lyrics(html);
  // A rule that silently returns nothing is worse than one that errors: treat
  // a suspiciously short extraction as a failed parse, not a short song.
  if (!lyrics || lyrics.split('\n').filter((l) => l.trim()).length < 4) {
    return json({ error: 'no-lyrics-found' }, origin);
  }
  const { title, artist } = rule.meta(html) || {};
  return json({ title: title || '', artist: artist || '', lyrics, sourceSite: rule.site }, origin);
}

async function lookupBpm(artist, title, origin, env) {
  const key = env && env.GETSONGBPM_KEY;
  if (!key) return json({ error: 'no-key' }, origin);
  // Trim and collapse whitespace: a stray space from a page parse is enough to
  // make GetSongBPM's exact-ish match miss.
  const a = (artist || '').replace(/\s+/g, ' ').trim();
  const t = (title || '').replace(/\s+/g, ' ').trim();
  if (!a || !t) return json({ error: 'need-artist-and-title' }, origin, 400);

  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const search = async (lookup) => {
    const url =
      'https://api.getsong.co/search/?api_key=' +
      encodeURIComponent(key) +
      '&type=both&lookup=' +
      encodeURIComponent(lookup);
    const res = await fetch(url, { cf: { cacheTtl: 86400 } });
    if (!res.ok) return { status: res.status, list: [] };
    const data = await res.json().catch(() => ({}));
    return { status: 200, list: Array.isArray(data.search) ? data.search : [] };
  };

  try {
    // Precise song+artist first; if that finds nothing, fall back to the title
    // alone and pick the result whose artist matches.
    let { status, list } = await search('song:' + t + ' artist:' + a);
    if (status !== 200) return json({ error: 'lookup-' + status }, origin);
    if (!list.length) ({ list } = await search(t));
    const withTempo = list.filter((h) => h && h.tempo);
    const hit =
      withTempo.find((h) => norm(h.artist && (h.artist.name || h.artist)) === norm(a)) ||
      withTempo[0];
    if (!hit) return json({ bpm: null }, origin);
    return json(
      { bpm: Math.round(Number(hit.tempo)) || null, durationSec: Number(hit.duration) || null },
      origin
    );
  } catch {
    return json({ error: 'lookup-failed' }, origin);
  }
}

// Weekly "songs you might like" (in-app Add screen): popular tracks by the
// artists already in the library, via Deezer's free, no-key API. Metadata only
// — titles and artists, never lyrics (that stays the user's own capture, §11).
async function suggest(artistsParam, origin) {
  const artists = (artistsParam || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (!artists.length) return json({ suggestions: [] }, origin);

  const out = [];
  const seen = new Set();
  for (const artist of artists) {
    try {
      const u =
        'https://api.deezer.com/search?limit=8&order=RANKING&q=' +
        encodeURIComponent('artist:"' + artist + '"');
      const res = await fetch(u, { cf: { cacheTtl: 86400 } });
      if (!res.ok) continue;
      const data = await res.json().catch(() => ({}));
      const tracks = Array.isArray(data.data) ? data.data : [];
      for (const tr of tracks) {
        const title = (tr && (tr.title_short || tr.title)) || '';
        const name = (tr && tr.artist && tr.artist.name) || artist;
        if (!title) continue;
        const key = (name + '|' + title).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ artist: name, title });
      }
    } catch {
      /* skip this artist, keep going */
    }
  }
  return json({ suggestions: out }, origin);
}

// Artist photo for the library/artist cards, via Deezer's free, no-key API.
// Returns a hotlinkable CDN image URL (no storage on our side, spec §1) or null.
async function artistImage(name, origin) {
  const q = (name || '').trim();
  if (!q) return json({ image: null }, origin);
  try {
    const u = 'https://api.deezer.com/search/artist?limit=1&q=' + encodeURIComponent(q);
    const res = await fetch(u, { cf: { cacheTtl: 604800 } });
    if (!res.ok) return json({ image: null }, origin);
    const data = await res.json().catch(() => ({}));
    const a = Array.isArray(data.data) ? data.data[0] : null;
    const image = a ? a.picture_medium || a.picture_big || a.picture || null : null;
    return json({ image }, origin);
  } catch {
    return json({ image: null }, origin);
  }
}

// A genre for the artist, so imports can auto-tag by genre. Deezer has no genre
// on the artist object, but its albums do: find the artist's top track, read
// that album's genre. Free, no key; null when unknown.
async function genre(name, origin) {
  const q = (name || '').trim();
  if (!q) return json({ genre: null }, origin);
  try {
    const s = await fetch(
      'https://api.deezer.com/search?limit=1&q=' + encodeURIComponent('artist:"' + q + '"'),
      { cf: { cacheTtl: 604800 } }
    );
    if (!s.ok) return json({ genre: null }, origin);
    const sd = await s.json().catch(() => ({}));
    const track = Array.isArray(sd.data) ? sd.data[0] : null;
    const albumId = track && track.album && track.album.id;
    if (!albumId) return json({ genre: null }, origin);
    const a = await fetch('https://api.deezer.com/album/' + albumId, { cf: { cacheTtl: 604800 } });
    if (!a.ok) return json({ genre: null }, origin);
    const ad = await a.json().catch(() => ({}));
    const g = ad && ad.genres && Array.isArray(ad.genres.data) && ad.genres.data[0] ? ad.genres.data[0].name : null;
    return json({ genre: g }, origin);
  } catch {
    return json({ genre: null }, origin);
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });

    const url = new URL(request.url);
    if (url.pathname === '/bpm') {
      return lookupBpm(url.searchParams.get('artist'), url.searchParams.get('title'), origin, env);
    }
    if (url.pathname === '/suggest') {
      return suggest(url.searchParams.get('artists') || '', origin);
    }
    if (url.pathname === '/artist-image') {
      return artistImage(url.searchParams.get('name') || '', origin);
    }
    if (url.pathname === '/genre') {
      return genre(url.searchParams.get('artist') || '', origin);
    }
    return importLyrics(url.searchParams.get('url') || '', origin);
  },
};
