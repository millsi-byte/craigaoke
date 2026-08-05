import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { XIcon, PlayIcon, PauseIcon } from '../components/icons.jsx';
import { isSectionHeader, lyricLines } from '../lib/songs.js';
import { acquireWakeLock, countIn, DEFAULT_LINES_PER_BEAT, pixelsPerSecond } from '../lib/tempo.js';

const LINE_PX = 52; // matches the 34px lyric type at 1.5 line-height
const READ_FRACTION = 0.4; // the read line sits 40% down the screen

// The teleprompter (spec §7.4): cook mode's hands-free pattern, repurposed —
// full screen, screen kept awake, a constant tempo-driven scroll, and both
// ways to pause. The nudge control self-calibrates linesPerBeat on exit, which
// is what makes one constant rate actually work (spec §7.2).
export default function PlayScreen({ song, onExit, onCalibrate }) {
  const bpm = song.bpm || 100; // Play always has a tempo; fall back so nothing dead-ends
  const [lpb, setLpb] = useState(song.linesPerBeat || DEFAULT_LINES_PER_BEAT);
  const [phase, setPhase] = useState('countin'); // countin | playing | paused | done
  const [count, setCount] = useState(0);

  const viewRef = useRef(null);
  const contentRef = useRef(null);
  const yRef = useRef(0);
  const maxYRef = useRef(0);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const lpbRef = useRef(lpb);
  lpbRef.current = lpb;

  const lines = lyricLines(song.lyrics);

  // Keep the screen awake for the whole session.
  useEffect(() => acquireWakeLock(), []);

  // Save the calibrated speed back to the song on the way out.
  useEffect(
    () => () => {
      if (onCalibrate && Math.abs(lpbRef.current - (song.linesPerBeat || DEFAULT_LINES_PER_BEAT)) > 1e-4) {
        onCalibrate(song.id, lpbRef.current);
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const measure = () => {
    const view = viewRef.current;
    const content = contentRef.current;
    if (!view || !content) return;
    maxYRef.current = Math.max(0, content.scrollHeight - view.clientHeight * READ_FRACTION - LINE_PX);
  };
  useLayoutEffect(measure, []);

  const apply = () => {
    if (contentRef.current) contentRef.current.style.transform = `translate3d(0, ${-yRef.current}px, 0)`;
  };

  const tick = (ts) => {
    if (!lastTsRef.current) lastTsRef.current = ts;
    const dt = (ts - lastTsRef.current) / 1000;
    lastTsRef.current = ts;
    yRef.current += pixelsPerSecond(bpm, lpbRef.current, LINE_PX) * dt;
    if (yRef.current >= maxYRef.current) {
      yRef.current = maxYRef.current;
      apply();
      setPhase('done');
      return;
    }
    apply();
    rafRef.current = requestAnimationFrame(tick);
  };

  const startScrolling = () => {
    lastTsRef.current = 0;
    setPhase('playing');
    rafRef.current = requestAnimationFrame(tick);
  };

  // The count-in, before the first move and on every resume, so there's always
  // a beat to lock back into.
  const runCountIn = () => {
    setPhase('countin');
    setCount(0);
    measure();
    countIn(bpm, 4, (n) => setCount(n)).then(() => startScrolling());
  };
  useEffect(() => {
    runCountIn();
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pause = () => {
    if (phase !== 'playing') return;
    cancelAnimationFrame(rafRef.current);
    setPhase('paused');
  };
  const resume = () => runCountIn();
  const restart = () => {
    yRef.current = 0;
    apply();
    runCountIn();
  };

  const nudge = (delta) => setLpb((v) => Math.min(1, Math.max(0.02, v * (1 + delta))));

  return (
    <div className="play-root" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', zIndex: 3 }}>
        <button onClick={onExit} aria-label="Stop" style={{ width: 44, height: 44, border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#f3f2f2' }}>
          <XIcon size={22} />
        </button>
        <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {song.title}
        </div>
        <span style={{ fontSize: 12, color: 'rgba(243,242,242,0.6)', fontVariantNumeric: 'tabular-nums' }}>{bpm} BPM</span>
      </div>

      {/* the scrolling lyrics — the whole area is a tap-to-pause zone */}
      <div
        ref={viewRef}
        onClick={() => (phase === 'playing' ? pause() : phase === 'paused' ? resume() : null)}
        style={{ position: 'relative', flex: 1, overflow: 'hidden' }}
      >
        {/* the read line */}
        <div style={{ position: 'absolute', top: `${READ_FRACTION * 100}%`, left: 0, right: 0, height: 2, background: 'var(--color-accent)', zIndex: 2, opacity: 0.9 }} />

        <div
          ref={contentRef}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: `${READ_FRACTION * 100}%`, paddingBottom: '60vh', willChange: 'transform' }}
        >
          {lines.map((line, i) =>
            isSectionHeader(line) ? (
              <div key={i} style={{ height: LINE_PX, display: 'flex', alignItems: 'center', padding: '0 24px', fontSize: 15, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(243,242,242,0.4)', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
                {line.replace(/^[[(]|[\])]$/g, '')}
              </div>
            ) : (
              <div key={i} style={{ minHeight: LINE_PX, display: 'flex', alignItems: 'center', padding: '0 24px', fontSize: 34, lineHeight: 1.3, fontWeight: 600, fontFamily: 'var(--font-heading)', letterSpacing: '-0.01em' }}>
                {line}
              </div>
            )
          )}
        </div>

        {/* count-in overlay */}
        {phase === 'countin' && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 4, background: 'rgba(23,21,15,0.72)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 96, color: 'var(--color-accent)', fontVariantNumeric: 'tabular-nums' }}>
              {count || '·'}
            </div>
          </div>
        )}

        {/* paused overlay */}
        {phase === 'paused' && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 4, background: 'rgba(23,21,15,0.55)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20, letterSpacing: '0.1em' }}>PAUSED</div>
              <div style={{ fontSize: 13, color: 'rgba(243,242,242,0.6)', marginTop: 6 }}>Tap anywhere to count back in</div>
            </div>
          </div>
        )}

        {/* done overlay */}
        {phase === 'done' && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 4, background: 'rgba(23,21,15,0.7)' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={restart} style={{ minHeight: 52, padding: '0 22px', color: '#f3f2f2', borderColor: 'rgba(243,242,242,0.4)' }}>RESTART</button>
              <button className="btn btn-primary" onClick={onExit} style={{ minHeight: 52, padding: '0 22px' }}>DONE</button>
            </div>
          </div>
        )}
      </div>

      {/* bottom controls: persistent pause + speed nudge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px calc(12px + env(safe-area-inset-bottom)) 16px', zIndex: 3 }}>
        <button
          onClick={() => (phase === 'playing' ? pause() : resume())}
          aria-label={phase === 'playing' ? 'Pause' : 'Play'}
          style={{ width: 56, height: 56, border: 0, background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
        >
          {phase === 'playing' ? <PauseIcon size={22} /> : <PlayIcon size={20} />}
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, letterSpacing: '0.1em', color: 'rgba(243,242,242,0.5)' }}>SPEED</span>
        <button onClick={() => nudge(-0.04)} aria-label="Slower" style={{ width: 48, height: 48, border: '1px solid rgba(243,242,242,0.3)', background: 'transparent', color: '#f3f2f2', cursor: 'pointer', fontSize: 22, fontFamily: 'var(--font-heading)' }}>–</button>
        <button onClick={() => nudge(0.04)} aria-label="Faster" style={{ width: 48, height: 48, border: '1px solid rgba(243,242,242,0.3)', background: 'transparent', color: '#f3f2f2', cursor: 'pointer', fontSize: 22, fontFamily: 'var(--font-heading)' }}>+</button>
      </div>
    </div>
  );
}
