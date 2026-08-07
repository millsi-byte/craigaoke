// Song helpers: search, tags, artist counts, and the lyric-line shaping the
// play view will read (spec §2, §8).

export const LINK_LABELS = ['Original', 'Cover', 'Tutorial', 'Tab', 'Other'];

export const newId = () =>
  'sg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const norm = (s) => (s || '').toLowerCase().trim();

// Section markers like [Chorus] are kept in storage — they're useful landmarks
// in the scroll — but rendered as headers, not sung lines.
export const isSectionHeader = (line) => /^\s*[[(].+[\])]\s*$/.test(line);

export const lyricLines = (lyrics) => (lyrics || '').split('\n');

export const lyricLineCount = (lyrics) =>
  lyricLines(lyrics).filter((l) => l.trim() && !isSectionHeader(l)).length;

export function matchesQuery(song, query) {
  const q = norm(query);
  if (!q) return true;
  return (
    norm(song.title).includes(q) ||
    norm(song.artist).includes(q) ||
    norm(song.lyrics).includes(q) ||
    (song.tags || []).some((t) => norm(t).includes(q))
  );
}

export function filterSongs(songs, { query = '', tags = [], favoritesOnly = false, artist = null } = {}) {
  return songs.filter((s) => {
    if (favoritesOnly && !s.favorite) return false;
    if (artist && norm(s.artist) !== norm(artist)) return false;
    if (tags.length && !tags.every((t) => (s.tags || []).includes(t))) return false;
    return matchesQuery(s, query);
  });
}

export const allTags = (songs) =>
  [...new Set(songs.flatMap((s) => s.tags || []))].sort((a, b) => a.localeCompare(b));

// Browse-by-artist: count real songs in the library, most first. Same mechanic
// as the recipe app's Discover chips, pointed at your own data (spec §8.3).
export function artistCounts(songs, cap = 40) {
  const counts = {};
  songs.forEach((s) => {
    const a = (s.artist || '').trim();
    if (a) counts[a] = (counts[a] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .slice(0, cap)
    .map(([value, count]) => ({ value, count }));
}

export const sortSongs = (songs, by = 'recent') =>
  [...songs].sort((a, b) =>
    by === 'az'
      ? (a.title || '').localeCompare(b.title || '')
      : by === 'artist'
        ? (a.artist || '').localeCompare(b.artist || '') || (a.title || '').localeCompare(b.title || '')
        : (b.createdAt || 0) - (a.createdAt || 0)
  );

// A blank song, so every creation path starts from the same shape.
export const emptySong = () => ({
  id: newId(),
  title: '',
  artist: '',
  lyrics: '',
  sourceUrl: null,
  sourceSite: null,
  bpm: null, // the tempo you play it at (preferred)
  bpmSource: null,
  publishedBpm: null, // the real looked-up tempo, for reference
  linesPerBeat: null,
  tags: [],
  favorite: false,
  links: [],
  notes: null,
  copiedFrom: null,
});

// Copy a friend's song into your own library: a snapshot, independent from the
// moment it's made (spec §10.3). Personal things don't come along — favorite,
// tags and the scroll calibration are yours to set on your own copy.
export const copyForLibrary = (song, fromDisplayName) => ({
  ...emptySong(),
  title: song.title,
  artist: song.artist,
  lyrics: song.lyrics,
  sourceUrl: song.sourceUrl || null,
  sourceSite: song.sourceSite || null,
  bpm: song.bpm || null,
  bpmSource: song.bpm ? song.bpmSource || null : null,
  publishedBpm: song.publishedBpm || null, // objective tempo travels with the copy
  links: (song.links || []).map((l) => ({ ...l })),
  copiedFrom: { uid: song.ownerUid, songId: song.id, displayName: fromDisplayName || 'a friend' },
});
