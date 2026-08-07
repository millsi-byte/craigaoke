import { useState } from 'react';
import { BackIcon, XIcon, ExternalIcon } from '../components/icons.jsx';
import TagInput from '../components/TagInput.jsx';
import { LINK_LABELS } from '../lib/songs.js';

const looksLikeUrlSafe = (s) => /^https?:\/\/\S+$/i.test((s || '').trim());

const field = { marginTop: 18 };
const labelStyle = { display: 'block', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', fontWeight: 600, marginBottom: 6 };

// One screen for manual add, edit, and import review — every path lands here
// before anything is saved (spec §5.2).
export default function EditScreen({ initial, tagSuggestions = [], title, onSave, onCancel }) {
  const [song, setSong] = useState(initial);
  const set = (patch) => setSong((s) => ({ ...s, ...patch }));
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');

  const addLink = () => {
    const url = linkUrl.trim();
    if (!looksLikeUrlSafe(url)) return;
    set({ links: (song.links || []).concat([{ url, label: linkLabel || null }]) });
    setLinkUrl('');
    setLinkLabel('');
  };

  const canSave = song.title.trim() && song.lyrics.trim();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '2px solid var(--color-divider)' }}>
        <button onClick={onCancel} aria-label="Cancel" style={{ width: 44, height: 44, border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'inherit' }}>
          <BackIcon />
        </button>
        <div style={{ flex: 1, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>{title}</div>
        <button className="btn btn-primary" disabled={!canSave} onClick={() => onSave(song)} style={{ minHeight: 40, padding: '0 16px', fontSize: 13 }}>
          SAVE
        </button>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '4px 16px 32px 16px' }}>
        <div style={field}>
          <label style={labelStyle}>Title</label>
          <input className="input" value={song.title} onChange={(e) => set({ title: e.target.value })} placeholder="Song title" />
        </div>

        <div style={field}>
          <label style={labelStyle}>Artist</label>
          <input className="input" value={song.artist} onChange={(e) => set({ artist: e.target.value })} placeholder="Performing artist" />
        </div>

        <div style={field}>
          <label style={labelStyle}>Tempo (BPM) — optional, set it now or in Play</label>
          <input
            className="input"
            inputMode="numeric"
            value={song.bpm || ''}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              set({ bpm: Number.isFinite(n) ? n : null, bpmSource: Number.isFinite(n) ? 'manual' : null });
            }}
            placeholder="e.g. 120"
          />
        </div>

        <div style={field}>
          <label style={labelStyle}>Lyrics — keep [Section] headers on their own lines</label>
          <textarea
            className="input"
            value={song.lyrics}
            onChange={(e) => set({ lyrics: e.target.value })}
            placeholder={'[Verse 1]\n[G]First line of [D]lyrics\nSecond line'}
            style={{ minHeight: 240, resize: 'vertical', lineHeight: 1.6, fontFamily: 'var(--font-body)' }}
          />
          <p style={{ margin: '6px 0 0 0', fontSize: 12, color: 'var(--color-neutral-500)' }}>
            Optional chords: put them inline like <code>[G]</code> right before the word — they show above the lyrics. Leave them out for lyrics only.
          </p>
        </div>

        <div style={field}>
          <label style={labelStyle}>Tags</label>
          <TagInput value={song.tags || []} suggestions={tagSuggestions} onChange={(tags) => set({ tags })} />
        </div>

        <div style={field}>
          <label style={labelStyle}>Reference links — videos, tabs, anything worth keeping</label>
          {(song.links || []).map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--color-divider)' }}>
              {l.label && <span className="tag tag-neutral">{l.label}</span>}
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--color-neutral-700)' }}>{l.url}</span>
              <button onClick={() => set({ links: song.links.filter((_, j) => j !== i) })} aria-label="Remove link" style={{ width: 36, height: 36, border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--color-neutral-500)', display: 'grid', placeItems: 'center' }}>
                <XIcon size={14} />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <input className="input" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" style={{ flex: '1 1 160px' }} />
            <select className="input" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} style={{ flex: '0 0 auto', minWidth: 110 }}>
              <option value="">Label…</option>
              {LINK_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <button className="btn btn-secondary" onClick={addLink} disabled={!looksLikeUrlSafe(linkUrl)} style={{ minHeight: 44, padding: '0 14px', fontSize: 12 }}>
              ADD LINK
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
