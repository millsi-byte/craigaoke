import { initialsOf } from '../lib/store.js';

// Account, attribution credit, and the honest note about how the friend group
// is managed (spec §3, §7.1).
export default function SettingsScreen({ mode, user, songCount, allowlist, onSignOut }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <header style={{ padding: '14px 16px', borderBottom: '2px solid var(--color-divider)' }}>
        <h1 style={{ margin: 0, fontSize: 24, letterSpacing: '-0.01em' }}>Settings</h1>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '18px 16px 40px 16px' }}>
        <Section title="Account">
          {mode === 'demo' ? (
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)' }}>
              Running in demo mode — no sign-in, sample songs, changes reset on refresh. Add a Firebase config to switch it on for real.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', background: 'var(--color-accent)', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 13 }}>
                  {initialsOf(user && user.name)}
                </span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{user && user.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{user && user.email}</div>
                </div>
              </div>
              <button className="btn btn-secondary" onClick={onSignOut} style={{ minHeight: 44, padding: '0 16px', marginTop: 14, fontSize: 13 }}>SIGN OUT</button>
            </>
          )}
          <p style={{ margin: '14px 0 0 0', fontSize: 13, color: 'var(--color-neutral-600)' }}>{songCount} songs in your library.</p>
        </Section>

        <Section title="The friend group">
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)' }}>
            Everyone with their email on the list gets their own library, and can browse and copy from the others. The list is edited in the Firebase console — add a friend’s Gmail, send them the link, and they’re in the moment they sign in.
          </p>
          {Array.isArray(allowlist) && allowlist.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {allowlist.map((e) => <span key={e} className="tag tag-neutral">{e}</span>)}
            </div>
          )}
        </Section>

        <Section title="Tempo data">
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)' }}>
            Automatic tempos come from{' '}
            <a href="https://getsongbpm.com" target="_blank" rel="noreferrer">GetSongBPM.com</a>. You can always set or tap a tempo yourself.
          </p>
        </Section>

        <Section title="About">
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)' }}>
            Craigaoke — your own lyrics, scrolling in time. Lyrics you save are your personal copy, for your own use.
          </p>
        </Section>
      </main>
    </div>
  );
}

const Section = ({ title, children }) => (
  <section style={{ marginBottom: 24 }}>
    <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 600, marginBottom: 10 }}>{title}</div>
    <div style={{ border: '1px solid var(--color-divider)', padding: 16 }}>{children}</div>
  </section>
);
