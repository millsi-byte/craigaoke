import { useState } from 'react';
import { XIcon } from './icons.jsx';

// Freeform multi-value entry (used for genres) with autocomplete against existing
// values, to avoid near-duplicates (spec §8.2). A pending typed value is
// committed on Enter, on the ADD button, and on blur — so tapping Save without
// pressing Enter still keeps what you typed.
export default function TagInput({ value = [], suggestions = [], onChange, placeholder = 'Add a genre' }) {
  const [text, setText] = useState('');
  const add = (t) => {
    const tag = (t || '').trim();
    if (tag && !value.some((v) => v.toLowerCase() === tag.toLowerCase())) onChange(value.concat([tag]));
    setText('');
  };
  const matches = text
    ? suggestions.filter((s) => !value.includes(s) && s.toLowerCase().includes(text.toLowerCase())).slice(0, 6)
    : [];

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: value.length ? 8 : 0 }}>
        {value.map((t) => (
          <span key={t} className="tag tag-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {t}
            <button
              onClick={() => onChange(value.filter((x) => x !== t))}
              aria-label={'Remove ' + t}
              style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'inherit', display: 'grid', placeItems: 'center', padding: 0 }}
            >
              <XIcon size={12} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => add(text)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(text);
            }
          }}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => add(text)}
          disabled={!text.trim()}
          style={{ minHeight: 44, padding: '0 16px', fontSize: 12 }}
        >
          ADD
        </button>
      </div>
      {matches.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {matches.map((m) => (
            <button
              key={m}
              className="tag tag-outline"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(m)}
              style={{ cursor: 'pointer', border: '1px solid var(--color-divider)', background: 'transparent' }}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
