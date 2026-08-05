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
  const blocks = [...html.matchAll(/<div[^>]+data-lyrics-container=["']true["'][^>]*>([\s\S]*?)<\/div>\s*(?=<div|<\/div>|$)/gi)];
  if (!blocks.length) return null;
  return blocks.map(([, inner]) => toText(inner)).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
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
  if (!artist || !title) return json({ error: 'need-artist-and-title' }, origin, 400);
  const url =
    'https://api.getsong.co/search/?api_key=' +
    encodeURIComponent(key) +
    '&type=both&lookup=' +
    encodeURIComponent('song:' + title + ' artist:' + artist);
  try {
    const res = await fetch(url, { cf: { cacheTtl: 86400 } });
    if (!res.ok) return json({ error: 'lookup-' + res.status }, origin);
    const data = await res.json();
    const hit = Array.isArray(data.search) ? data.search[0] : null;
    if (!hit || !hit.tempo) return json({ bpm: null }, origin);
    return json(
      { bpm: Math.round(Number(hit.tempo)) || null, durationSec: Number(hit.duration) || null },
      origin
    );
  } catch {
    return json({ error: 'lookup-failed' }, origin);
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
    return importLyrics(url.searchParams.get('url') || '', origin);
  },
};
