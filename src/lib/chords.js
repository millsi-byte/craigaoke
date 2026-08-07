import { isSectionHeader } from './songs.js';

// Chords can be written two ways, both opt-in and stored in the lyrics string
// (no new field):
//   1. Inline, ChordPro-style:  [G]Sheets of [D]empty canvas
//   2. A chord line above a lyric line (the Ultimate-Guitar layout):
//          G            C
//          Sheets of empty canvas
// Lyrics-only songs are unaffected. Section headers use whole-line brackets
// ([Chorus]); inline chords sit within a lyric line.
const TOKEN_RE = /\[[^\]]+\]/;
const WHOLE_BRACKET = /^\s*[[(][^\])]+[\])]\s*$/;

// A single chord like G, Am, C#m7, Dsus4, F/A. Kept deliberately tight so a
// short lyric line (e.g. "Oh no") isn't mistaken for chords.
const CHORD_TOKEN = /^[A-G][#b]?(?:m|min|maj|dim|aug|sus|add|M)?[0-9]*(?:sus[0-9]?)?(?:add[0-9]+)?(?:\/[A-G][#b]?)?$/;

// A line that is only chords and spaces (the top line of the UG layout).
export function isChordLine(line) {
  const toks = (line || '').trim().split(/\s+/).filter(Boolean);
  if (!toks.length || toks.length > 12) return false;
  return toks.every((t) => CHORD_TOKEN.test(t));
}

// Group raw lines into render rows, pairing a chord line with the lyric under it.
export function lyricRows(lyrics) {
  const lines = (lyrics || '').split('\n');
  const rows = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const next = lines[i + 1];
    if (isChordLine(line) && next != null && next.trim() && !isSectionHeader(next) && !isChordLine(next) && !lineHasChords(next)) {
      rows.push({ type: 'pair', chords: line, lyric: next });
      i += 1; // consume the lyric line
    } else if (isChordLine(line)) {
      rows.push({ type: 'pair', chords: line, lyric: '' });
    } else if (lineHasChords(line)) {
      rows.push({ type: 'inline', line });
    } else if (isSectionHeader(line)) {
      rows.push({ type: 'section', line });
    } else if (line.trim() === '') {
      rows.push({ type: 'blank' });
    } else {
      rows.push({ type: 'lyric', line });
    }
  }
  return rows;
}

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
