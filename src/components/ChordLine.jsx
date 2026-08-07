import { chordColumns } from '../lib/chords.js';

// Renders one lyric line with chords sitting above the words. Each word is its
// own column (chord on top, word below) so the line still wraps naturally — no
// monospace. Words without a chord keep an empty chord row so baselines line up.
export default function ChordLine({ line, chordStyle, wordStyle }) {
  const cols = chordColumns(line);
  return (
    <span>
      {cols.map((c, i) =>
        c.space ? (
          <span key={i}> </span>
        ) : (
          <span key={i} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', verticalAlign: 'bottom' }}>
            <span style={{ ...chordStyle, whiteSpace: 'pre' }}>{c.chord || ' '}</span>
            <span style={wordStyle}>{c.word || ' '}</span>
          </span>
        )
      )}
    </span>
  );
}
