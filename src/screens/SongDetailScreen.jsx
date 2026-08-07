import { useRef, useState } from 'react';
import { BackIcon, HeartIcon, PlayIcon, ExternalIcon, MetronomeIcon } from '../components/icons.jsx';
import { isSectionHeader, lyricLines, lyricLineCount } from '../lib/songs.js';
import { lineHasChords } from '../lib/chords.js';
import ChordLine from '../components/ChordLine.jsx';
import { bpmFromTaps, clampBpm } from '../lib/tempo.js';
import { lookupBpm } from '../lib/importer.js';
import { siteOf } from '../lib/importer.js';
import { initialsOf } from '../lib/store.js';

function TempoPanel({ song, onChange }) {
  const taps = useRef([]);
  const [tapBpm, setTapBpm] = useState(null);
  const [looking, setLooking] = useState(false);
  const [lookMsg, setLookMsg] = useState('');

  const tap = () => {
    const now = performance.now();
    taps.current = taps.current.filter((t) => now - t < 3000).concat([now]);
    const b = bpmFromTaps(taps.current);
    if (b) {
      setTapBpm(b);
      onChange({ bpm: b, bpmSource: 'tap' });
    }
  };

  const runLookup = async () => {
    setLookMsg('');
    setLooking(true);
    const res = await lookupBpm(song.artist, song.title);
    setLooking(false);
    if (res.error) setLookMsg(res.error);
    else {
      // Store the looked-up tempo as the published reference, and offer it as
      // the play tempo too (a suggestion he can then adjust).
      onChange({ bpm: res.bpm, bpmSource: 'getsongbpm', publishedBpm: res.bpm });
      setLookMsg(`Found ${res.bpm} BPM — adjust if it doesn’t match how you play it.`);
    }
  };

  return (
    <div style={{ border: '1px solid var(--color-divider)', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <MetronomeIcon />
        <input
          className="input"
          inputMode="numeric"
          value={song.bpm || ''}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            onChange(Number.isFinite(n) ? { bpm: clampBpm(n), bpmSource: 'manual' } : { bpm: null, bpmSource: null });
          }}
          placeholder="BPM"
          style={{ width: 90, textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: 18 }}
        />
        <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>BPM</span>
        <button className="btn btn-secondary" onClick={tap} style={{ minHeight: 44, padding: '0 16px', marginLeft: 'auto' }}>
          TAP{tapBpm ? ` · ${tapBpm}` : ''}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={runLookup} disabled={looking || !song.artist || !song.title} style={{ minHeight: 38, fontSize: 12 }}>
          {looking ? 'LOOKING UP…' : 'LOOK UP TEMPO'}
        </button>
        <span style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>
          via <a href="https://getsongbpm.com" target="_blank" rel="noreferrer">GetSongBPM</a>
        </span>
      </div>
      {lookMsg && <p style={{ margin: '8px 0 0 0', fontSize: 12, color: 'var(--color-neutral-700)' }}>{lookMsg}</p>}
      {song.publishedBpm && song.publishedBpm !== song.bpm && (
        <p style={{ margin: '8px 0 0 0', fontSize: 12, color: 'var(--color-neutral-600)' }}>
          Published tempo <strong>{song.publishedBpm} BPM</strong>
          {song.bpm ? <> · you play it at <strong>{song.bpm} BPM</strong></> : null}
        </p>
      )}
    </div>
  );
}

export default function SongDetailScreen({ song, onBack, onPlay, onEdit, onDelete, onFavorite, onPatch, owner, onAddToLibrary }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const lineCount = lyricLineCount(song.lyrics);
  // Read-only preview of someone else's song (browse-only until copied, §10.2):
  // no editing, favoriting, tempo or play — just read it and add it.
  const readOnly = !!onAddToLibrary;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '2px solid var(--color-divider)' }}>
        <button onClick={onBack} aria-label="Back" style={{ width: 44, height: 44, border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'inherit' }}>
          <BackIcon />
        </button>
        <div style={{ flex: 1 }} />
        {!readOnly && (
          <>
            <button onClick={() => onFavorite(song.id)} aria-label="Favorite" style={{ width: 44, height: 44, border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: song.favorite ? 'var(--color-accent)' : 'var(--color-neutral-500)' }}>
              <HeartIcon filled={song.favorite} />
            </button>
            <button className="btn btn-ghost" onClick={() => onEdit(song)} style={{ minHeight: 40, fontSize: 12 }}>EDIT</button>
          </>
        )}
      </header>

      <main style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '18px 18px 40px 18px' }}>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.02em' }}>{song.title}</h1>
        <div style={{ fontSize: 16, color: 'var(--color-neutral-700)', marginTop: 4 }}>{song.artist || 'Unknown artist'}</div>
        {song.copiedFrom && !readOnly && (
          <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginTop: 6 }}>
            Copied from {song.copiedFrom.displayName}’s library — this is your own copy now.
          </div>
        )}
        {readOnly && owner && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: 'var(--color-neutral-700)' }}>
            <span style={{ flex: 'none', width: 22, height: 22, display: 'grid', placeItems: 'center', background: owner.color || 'var(--color-neutral-500)', color: 'var(--color-bg)', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 10 }}>
              {initialsOf(owner.name)}
            </span>
            In {owner.name}’s library — add it to make it your own.
          </div>
        )}

        {(song.tags || []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {song.tags.map((t) => <span key={t} className="tag tag-accent">{t}</span>)}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          {readOnly ? (
            <button className="btn btn-primary" onClick={onAddToLibrary} style={{ width: '100%', minHeight: 60, fontSize: 18, justifyContent: 'flex-start', gap: 12, padding: '0 22px' }}>
              + ADD TO MY LIBRARY
            </button>
          ) : (
            <>
              <TempoPanel song={song} onChange={(patch) => onPatch(song.id, patch)} />
              <button className="btn btn-primary" onClick={() => onPlay(song.id)} style={{ width: '100%', minHeight: 60, marginTop: 12, fontSize: 18, justifyContent: 'flex-start', gap: 12, padding: '0 22px' }}>
                <PlayIcon size={20} /> PLAY {song.bpm ? `· ${song.bpm} BPM` : '· SET A TEMPO'}
              </button>
            </>
          )}
        </div>

        <div style={{ height: 2, background: 'var(--color-divider)', margin: '24px 0 20px 0' }} />

        <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', fontWeight: 600, marginBottom: 12 }}>
          Lyrics · {lineCount} lines
        </div>
        <div style={{ fontSize: 16, lineHeight: 1.7 }}>
          {lyricLines(song.lyrics).map((line, i) =>
            lineHasChords(line) ? (
              <div key={i} style={{ margin: '6px 0' }}>
                <ChordLine
                  line={line}
                  chordStyle={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent)', lineHeight: 1.1 }}
                  wordStyle={{ lineHeight: 1.2 }}
                />
              </div>
            ) : isSectionHeader(line) ? (
              <div key={i} style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', fontWeight: 600, margin: '16px 0 6px 0' }}>
                {line.replace(/^[[(]|[\])]$/g, '')}
              </div>
            ) : line.trim() === '' ? (
              <div key={i} style={{ height: 12 }} />
            ) : (
              <div key={i}>{line}</div>
            )
          )}
        </div>

        {(song.links || []).length > 0 && (
          <>
            <div style={{ height: 2, background: 'var(--color-divider)', margin: '24px 0 16px 0' }} />
            <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', fontWeight: 600, marginBottom: 10 }}>
              Links
            </div>
            {song.links.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--color-divider)', textDecoration: 'none', color: 'inherit' }}>
                {l.label && <span className="tag tag-neutral">{l.label}</span>}
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{siteOf(l.url) || l.url}</span>
                <ExternalIcon />
              </a>
            ))}
          </>
        )}

        {song.sourceUrl && (
          <div style={{ marginTop: 20, fontSize: 12, color: 'var(--color-neutral-500)' }}>
            Source: <a href={song.sourceUrl} target="_blank" rel="noreferrer">{song.sourceSite || siteOf(song.sourceUrl)}</a>
          </div>
        )}

        {!readOnly && (
          <div style={{ marginTop: 32 }}>
            {confirmDel ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 14 }}>Delete this song?</span>
                <button className="btn btn-primary" onClick={() => onDelete(song.id)} style={{ minHeight: 40, padding: '0 16px', fontSize: 12 }}>DELETE</button>
                <button className="btn btn-ghost" onClick={() => setConfirmDel(false)} style={{ minHeight: 40, fontSize: 12 }}>KEEP</button>
              </div>
            ) : (
              <button className="btn btn-ghost" onClick={() => setConfirmDel(true)} style={{ minHeight: 40, fontSize: 12, color: 'var(--color-neutral-600)' }}>
                DELETE SONG
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
