// Optional inline chords in the lyrics string, ChordPro-style: [G]word. This is
// opt-in and lives in the lyrics text itself — no new field. Section headers use
// whole-line brackets ([Chorus]); inline chords sit within a lyric line, so a
// line "has chords" when it contains a [..] token but isn't a whole-line header.
// (Chords are checked before section headers so a chords-only line like
// "[G] [D]" isn't mistaken for a header.)
const TOKEN_RE = /\[[^\]]+\]/;
const WHOLE_BRACKET = /^\s*[[(][^\])]+[\])]\s*$/;

export const lineHasChords = (line) => TOKEN_RE.test(line) && !WHOLE_BRACKET.test(line);

export const stripChords = (line) => (line || '').replace(/\[[^\]]+\]/g, '');

// Split a lyric line into word columns, each carrying the chord (if any) that
// precedes it — so a chord renders above its word and the text still wraps.
// Returns items: { space: true } | { chord: string|null, word: string }.
export function chordColumns(line) {
  const cols = [];
  let pending = null;
  for (const tok of (line || '').split(/(\[[^\]]+\])/g)) {
    if (tok === '') continue;
    const cm = tok.match(/^\[([^\]]+)\]$/);
    if (cm) { pending = cm[1]; continue; }
    for (const w of tok.split(/(\s+)/)) {
      if (w === '') continue;
      if (/^\s+$/.test(w)) { cols.push({ space: true }); continue; }
      cols.push({ chord: pending, word: w });
      pending = null;
    }
  }
  if (pending) cols.push({ chord: pending, word: '' });
  return cols;
}
