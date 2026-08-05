import { useMemo, useState } from 'react';
import { artistCounts } from '../lib/songs.js';

// Browse-by-artist: count chips from your own library, most-songs-first,
// capped and expandable — the recipe app's Discover mechanic pointed at your
// data (spec §8.3). Artist is a first-class dimension, one per song.
export default function ArtistsScreen({ songs, onPick }) {
  const [expanded, setExpanded] = useState(false);
  const counts = useMemo(() => artistCounts(songs), [songs]);
  const shown = expanded ? counts : counts.slice(0, 12);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <header style={{ padding: '14px 16px', borderBottom: '2px solid var(--color-divider)' }}>
        <h1 style={{ margin: 0, fontSize: 24, letterSpacing: '-0.01em' }}>Artists</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--color-neutral-600)' }}>
          {counts.length} in your library
        </p>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {counts.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--color-neutral-600)', fontSize: 15 }}>
            Add a song and its artist shows up here.
          </div>
        ) : (
          <>
            {shown.map(({ value, count }) => (
              <button
                key={value}
                onClick={() => onPick(value)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 16px', border: 0, borderBottom: '1px solid var(--color-divider)', background: 'transparent', cursor: 'pointer', color: 'inherit', textAlign: 'left' }}
              >
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17 }}>{value}</span>
                <span style={{ fontSize: 13, color: 'var(--color-neutral-500)', fontVariantNumeric: 'tabular-nums' }}>
                  {count} {count === 1 ? 'song' : 'songs'}
                </span>
              </button>
            ))}
            {counts.length > 12 && (
              <button className="btn btn-ghost" onClick={() => setExpanded((v) => !v)} style={{ margin: 16, minHeight: 40 }}>
                {expanded ? 'SHOW FEWER' : `SHOW ALL ${counts.length}`}
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
