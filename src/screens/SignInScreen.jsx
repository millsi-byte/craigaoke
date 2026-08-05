// Sign-in and the allowlist-rejection screen (spec §3). Rejection names the
// address that signed in, since a friend with several Google accounts needs to
// know which one is on the list.
export default function SignInScreen({ authStep, authError, user, allowlist, onSignIn, onSignOut }) {
  const notAllowed = authStep === 'notAllowed';
  const errored = authStep === 'error';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 24px', gap: 20 }}>
      <div>
        <div style={{ fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 600 }}>
          Craigaoke
        </div>
        <h1 style={{ margin: '8px 0 0 0', fontSize: 34, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          Lyrics that scroll<br />in time with the song.
        </h1>
        <p style={{ margin: '16px 0 0 0', fontSize: 15, color: 'var(--color-neutral-700)', maxWidth: 380 }}>
          Your own songbook, hands-free. Set a tempo, hit play, keep both hands on the guitar.
        </p>
      </div>

      {notAllowed ? (
        <div style={{ borderTop: '2px solid var(--color-divider)', paddingTop: 20 }}>
          <p style={{ margin: 0, fontSize: 15 }}>
            You’re signed in as <strong>{user && user.email}</strong> — that address isn’t on the list yet.
          </p>
          <p style={{ margin: '8px 0 16px 0', fontSize: 13, color: 'var(--color-neutral-600)' }}>
            Ask whoever set up Craigaoke to add it, or sign in with a different Google account.
          </p>
          <button className="btn btn-secondary" onClick={onSignOut} style={{ minHeight: 48, padding: '0 18px' }}>
            USE A DIFFERENT ACCOUNT
          </button>
        </div>
      ) : errored ? (
        <div style={{ borderTop: '2px solid var(--color-divider)', paddingTop: 20 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-accent-700)' }}>
            Couldn’t read the member list. Check the Firestore rules are deployed, then try again.
          </p>
          <button className="btn btn-secondary" onClick={onSignOut} style={{ minHeight: 48, padding: '0 18px', marginTop: 14 }}>
            SIGN OUT
          </button>
        </div>
      ) : (
        <div>
          <button className="btn btn-primary" onClick={onSignIn} style={{ minHeight: 52, padding: '0 20px', fontSize: 15 }}>
            SIGN IN WITH GOOGLE
          </button>
          {authError && <p style={{ margin: '12px 0 0 0', fontSize: 13, color: 'var(--color-accent-700)', maxWidth: 380 }}>{authError}</p>}
        </div>
      )}
    </div>
  );
}
