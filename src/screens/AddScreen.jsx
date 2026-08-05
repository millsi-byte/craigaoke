import { useState } from 'react';
import { SearchIcon, ClipboardIcon, ExternalIcon } from '../components/icons.jsx';
import { AI_PROMPT, importFromUrl, looksLikeUrl, parseAiJson } from '../lib/importer.js';
import { emptySong } from '../lib/songs.js';

const sectionLabel = { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 600 };
const card = { border: '1px solid var(--color-divider)', padding: 16, marginTop: 16 };

// The three ways in (spec §5) plus type-it-yourself. Every path ends on the
// review screen, so this screen only ever produces a draft.
export default function AddScreen({ onDraft, onBlank }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [copied, setCopied] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiError, setAiError] = useState('');

  const runUrl = async (value) => {
    setUrlError('');
    setBusy(true);
    const res = await importFromUrl(value);
    setBusy(false);
    if (res.error) setUrlError(res.error);
    else onDraft(res.song, 'Review import');
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (looksLikeUrl(text)) {
        setUrl(text.trim());
        runUrl(text.trim());
      } else {
        setUrlError('The clipboard doesn’t have a web address in it.');
      }
    } catch {
      setUrlError('Couldn’t read the clipboard — paste the link into the box instead.');
    }
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT);
    } catch { /* label still confirms intent */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runAi = () => {
    setAiError('');
    const res = parseAiJson(aiText);
    if (res.error) setAiError(res.error);
    else onDraft(res.song, 'Review import');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <header style={{ padding: '14px 16px', borderBottom: '2px solid var(--color-divider)' }}>
        <h1 style={{ margin: 0, fontSize: 24, letterSpacing: '-0.01em' }}>Add a song</h1>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '4px 16px 32px 16px' }}>
        {/* 1 — find it on the web */}
        <div style={card}>
          <div style={sectionLabel}>1 · Find it</div>
          <p style={{ margin: '8px 0 12px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>
            Search opens in a new tab (lyrics sites can’t be shown inside the app). Copy the link you want, then paste it back here.
          </p>
          <a className="btn btn-secondary" href="https://www.google.com/search?q=lyrics" target="_blank" rel="noreferrer" style={{ minHeight: 46, padding: '0 16px', textDecoration: 'none', display: 'inline-flex' }}>
            SEARCH THE WEB <ExternalIcon />
          </a>
        </div>

        {/* 2 — paste the link */}
        <div style={card}>
          <div style={sectionLabel}>2 · Paste the link</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://genius.com/…" style={{ flex: '1 1 160px' }} />
            <button className="btn btn-secondary" onClick={paste} style={{ minHeight: 46, padding: '0 14px', fontSize: 12 }}>
              <ClipboardIcon /> PASTE
            </button>
          </div>
          <button className="btn btn-primary" onClick={() => runUrl(url)} disabled={!looksLikeUrl(url) || busy} style={{ minHeight: 46, padding: '0 18px', marginTop: 10 }}>
            {busy ? 'READING…' : 'IMPORT'}
          </button>
          <p style={{ margin: '10px 0 0 0', fontSize: 12, color: 'var(--color-neutral-500)' }}>Reads Genius and AZLyrics pages directly.</p>
          {urlError && <p style={{ margin: '10px 0 0 0', fontSize: 13, color: 'var(--color-accent-700)' }}>{urlError}</p>}
        </div>

        {/* 3 — AI round-trip */}
        <div style={card}>
          <div style={sectionLabel}>3 · Or use any AI chat</div>
          <p style={{ margin: '8px 0 12px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>
            For anything else — a site we can’t read, or lyrics from memory. Copy the prompt into any Claude chat, paste its reply back.
          </p>
          <button className="btn btn-secondary" onClick={copyPrompt} style={{ minHeight: 44, padding: '0 16px', fontSize: 12 }}>
            {copied ? 'COPIED ✓' : 'COPY PROMPT'}
          </button>
          <textarea className="input" value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="Paste the AI’s JSON reply here" style={{ marginTop: 12, minHeight: 120, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
          <button className="btn btn-primary" onClick={runAi} disabled={!aiText.trim()} style={{ minHeight: 46, padding: '0 18px', marginTop: 10 }}>
            ADD FROM JSON
          </button>
          {aiError && <p style={{ margin: '10px 0 0 0', fontSize: 13, color: 'var(--color-accent-700)' }}>{aiError}</p>}
        </div>

        {/* 4 — type it */}
        <button className="btn btn-ghost" onClick={() => onBlank(emptySong())} style={{ minHeight: 48, marginTop: 20 }}>
          + TYPE IT IN MYSELF
        </button>
      </main>
    </div>
  );
}
