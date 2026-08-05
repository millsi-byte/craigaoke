import { useState } from 'react';
import { XIcon } from './icons.jsx';

// Freeform multi-tag entry with autocomplete against existing tags, to avoid
// near-duplicates (spec §8.2).
export default function TagInput({ value = [], suggestions = [], onChange }) {
  const [text, setText] = useState('');
  const add = (t) => {
    const tag = t.trim();
    if (tag && !value.includes(tag)) onChange(value.concat([tag]));
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
      <input
        className="input"
        value={text}
        placeholder="Add a tag, press Enter"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(text);
          }
        }}
      />
      {matches.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {matches.map((m) => (
            <button key={m} className="tag tag-outline" style={{ cursor: 'pointer', border: '1px solid var(--color-divider)', background: 'transparent' }} onClick={() => add(m)}>
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
