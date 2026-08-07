import { useEffect, useState } from 'react';
import { fetchArtistImage } from '../lib/importer.js';

// A band photo for a song/artist card. Images come from Deezer (via the Worker)
// and are hotlinked from their CDN — nothing is stored on our side. Each artist
// is fetched at most once: an in-memory promise cache dedupes concurrent rows,
// and localStorage persists the URL (and misses) across sessions. Falls back to
// the artist's initials in a plain block, in keeping with the design system.
const mem = new Map(); // normalized name -> Promise<url|null>
const keyFor = (name) => (name || '').trim().toLowerCase();

function load(name) {
  const key = keyFor(name);
  if (!key) return Promise.resolve(null);
  if (mem.has(key)) return mem.get(key);

  const lsKey = 'craigaoke.bandimg.' + key;
  try {
    const cached = JSON.parse(localStorage.getItem(lsKey) || 'null');
    if (cached && typeof cached.url !== 'undefined') {
      const p = Promise.resolve(cached.url);
      mem.set(key, p);
      return p;
    }
  } catch { /* private mode / bad JSON */ }

  const p = fetchArtistImage(name).then((url) => {
    try { localStorage.setItem(lsKey, JSON.stringify({ url: url || null })); } catch { /* */ }
    return url || null;
  });
  mem.set(key, p);
  return p;
}

const initials = (name) => (name || '?').trim().slice(0, 2).toUpperCase();

export default function BandThumb({ artist, size = 52, fill = false }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    load(artist).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [artist]);

  const box = fill
    ? { width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', background: 'var(--color-divider)', display: 'grid', placeItems: 'center' }
    : { flex: 'none', width: size, height: size, overflow: 'hidden', background: 'var(--color-divider)', display: 'grid', placeItems: 'center' };
  if (url) {
    return (
      <div style={box}>
        <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    );
  }
  return (
    <div style={{ ...box, color: 'var(--color-neutral-600)', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: fill ? 30 : Math.round(size * 0.32) }}>
      {initials(artist)}
    </div>
  );
}
