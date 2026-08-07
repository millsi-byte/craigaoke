import { useEffect, useMemo, useState } from 'react';
import { SearchIcon, HeartIcon, PlayIcon, ChevronDownIcon } from '../components/icons.jsx';
import BandThumb from '../components/BandThumb.jsx';
import { allTags, filterSongs, sortSongs, matchesQuery } from '../lib/songs.js';

const chip = (on) => ({
  flex: 'none',
  minHeight: 34,
  padding: '0 12px',
  border: on ? '1px solid var(--color-accent)' : '1px solid var(--color-divider)',
  background: on ? 'var(--color-accent)' : 'transparent',
  color: on ? 'var(--color-bg)' : 'var(--color-text)',
  cursor: 'pointer',
  fontFamily: 'var(--font-heading)',
  fontWeight: 600,
  fontSize: 12,
  letterSpacing: '0.04em',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});

function SongRow({ song, owner, onOpen, onPlay, onFavorite, onCopyIn }) {
  const foreign = owner && !owner.mine;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--color-divider)' }}>
      <button
        onClick={onOpen}
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', border: 0, background: 'transparent', cursor: 'pointer', padding: 0, color: 'inherit' }}
      >
        <BandThumb artist={song.artist} size={52} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {song.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {song.artist || 'Unknown artist'}
            </span>
            {song.bpm ? <span style={{ fontSize: 11, color: 'var(--color-neutral-500)', fontVariantNumeric: 'tabular-nums' }}>· {song.bpm} BPM</span> : null}
            {foreign ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>
                <span style={{ width: 8, height: 8, flex: 'none', background: owner.color || 'var(--color-neutral-500)' }} />
                {owner.name}
              </span>
            ) : null}
          </div>
        </div>
      </button>

      {foreign ? (
        <button className="btn btn-secondary" onClick={onCopyIn} style={{ minHeight: 38, padding: '0 12px', fontSize: 11, flex: 'none' }}>
          ADD TO MINE
        </button>
      ) : (
        <>
          <button
            onClick={onFavorite}
            aria-label={song.favorite ? 'Unfavorite' : 'Favorite'}
            style={{ width: 40, height: 40, border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: song.favorite ? 'var(--color-accent)' : 'var(--color-neutral-500)' }}
          >
            <HeartIcon filled={song.favorite} />
          </button>
          <button
            className="btn btn-primary"
            onClick={onPlay}
            aria-label="Play"
            style={{ width: 44, height: 44, padding: 0, display: 'grid', placeItems: 'center' }}
          >
            <PlayIcon size={14} />
          </button>
        </>
      )}
    </div>
  );
}

export default function LibraryScreen({ songs, onOpen, onPreview, onPlay, onFavorite, onCopyIn, artistFilter, onClearArtist }) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('mine'); // mine | everyone
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [activeTags, setActiveTags] = useState([]);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [everyone, setEveryone] = useState(null);
  const [loadingEveryone, setLoadingEveryone] = useState(false);

  useEffect(() => {
    if (scope !== 'everyone') return;
    setLoadingEveryone(true);
    onCopyIn.load().then((rows) => {
      setEveryone(rows);
      setLoadingEveryone(false);
    });
  }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps

  const tags = useMemo(() => allTags(songs), [songs]);

  const mineFiltered = useMemo(
    () => sortSongs(filterSongs(songs, { query, tags: activeTags, favoritesOnly, artist: artistFilter })),
    [songs, query, activeTags, favoritesOnly, artistFilter]
  );

  const everyoneFiltered = useMemo(() => {
    if (!everyone) return [];
    return everyone.filter(({ song }) => matchesQuery(song, query) && (!artistFilter || song.artist === artistFilter));
  }, [everyone, query, artistFilter]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <header style={{ padding: '14px 16px 12px 16px', borderBottom: '2px solid var(--color-divider)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: 24, letterSpacing: '-0.01em' }}>
            {artistFilter || 'Library'}
          </h1>
          {artistFilter && (
            <button className="btn btn-ghost" onClick={onClearArtist} style={{ minHeight: 32, fontSize: 12 }}>
              CLEAR
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--color-divider)', padding: '0 12px', marginTop: 12 }}>
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, artists, words…"
            style={{ flex: 1, minHeight: 44, border: 0, background: 'transparent', fontSize: 15, outline: 'none', color: 'inherit', fontFamily: 'var(--font-body)' }}
          />
        </div>

        <div className="chips" style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto' }}>
          <div style={{ display: 'inline-flex', border: '1px solid var(--color-divider)', flex: 'none' }}>
            <button style={{ ...chip(scope === 'mine'), border: 0 }} onClick={() => setScope('mine')}>MY LIBRARY</button>
            <button style={{ ...chip(scope === 'everyone'), border: 0, borderLeft: '1px solid var(--color-divider)' }} onClick={() => setScope('everyone')}>EVERYONE</button>
          </div>
          {scope === 'mine' && (
            <button style={chip(favoritesOnly)} onClick={() => setFavoritesOnly((v) => !v)}>
              <HeartIcon filled={favoritesOnly} size={13} /> FAVORITES
            </button>
          )}
          {scope === 'mine' && tags.length > 0 && (
            <button style={chip(tagsOpen || activeTags.length > 0)} onClick={() => setTagsOpen((v) => !v)}>
              GENRES{activeTags.length ? ` · ${activeTags.length}` : ''}
              <ChevronDownIcon size={13} style={{ transform: tagsOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
          )}
        </div>

        {scope === 'mine' && tagsOpen && tags.length > 0 && (
          <div className="chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {tags.map((t) => (
              <button key={t} style={chip(activeTags.includes(t))} onClick={() => setActiveTags((a) => (a.includes(t) ? a.filter((x) => x !== t) : a.concat([t])))}>
                {t}
              </button>
            ))}
          </div>
        )}
      </header>

      <main style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {scope === 'mine' ? (
          mineFiltered.length === 0 ? (
            <Empty text={songs.length ? 'No songs match.' : 'Your library is empty. Tap ADD to bring in a song.'} />
          ) : (
            mineFiltered.map((s) => (
              <SongRow key={s.id} song={s} owner={{ mine: true }} onOpen={() => onOpen(s.id)} onPlay={() => onPlay(s.id)} onFavorite={() => onFavorite(s.id)} />
            ))
          )
        ) : loadingEveryone ? (
          <Empty text="Loading everyone’s songs…" />
        ) : everyoneFiltered.length === 0 ? (
          <Empty text="Nothing found across the group." />
        ) : (
          everyoneFiltered.map(({ song, owner }) => (
            <SongRow
              key={owner.uid + '/' + song.id}
              song={song}
              owner={owner}
              onOpen={() => (owner.mine ? onOpen(song.id) : onPreview(song, owner))}
              onPlay={() => onPlay(song.id)}
              onFavorite={() => onFavorite(song.id)}
              onCopyIn={() => onCopyIn.copy(song, owner.name)}
            />
          ))
        )}
      </main>
    </div>
  );
}

const Empty = ({ text }) => (
  <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--color-neutral-600)', fontSize: 15 }}>{text}</div>
);
