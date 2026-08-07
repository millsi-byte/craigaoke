import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { XIcon, PlayIcon, PauseIcon } from '../components/icons.jsx';
import { isSectionHeader, lyricLines } from '../lib/songs.js';
import { acquireWakeLock, DEFAULT_LINES_PER_BEAT, pixelsPerSecond } from '../lib/tempo.js';

const LINE_PX = 52; // matches the 34px lyric type at 1.5 line-height
const READ_FRACTION = 0.4; // the read line sits 40% down the screen

// The teleprompter (spec §7.4): cook mode's hands-free pattern, repurposed —
// full screen, screen kept awake, a constant tempo-driven scroll, and both
// ways to pause. The nudge control self-calibrates linesPerBeat on exit, which
// is what makes one constant rate actually work (spec §7.2).
//
// The beat is shown, not heard: a single beat clock drives a silent 4-beat
// count-in and then keeps pulsing an on-screen marker in time with the BPM for
// the whole song, so there's always a beat to lock into — including coming off
// pause — without any metronome sound.
export default function PlayScreen({ song, onExit, onCalibrate }) {
  const bpm = song.bpm || 100; // Play always has a tempo; fall back so nothing dead-ends
  const [lpb, setLpb] = useState(song.linesPerBeat || DEFAULT_LINES_PER_BEAT);
  const [phase, setPhase] = useState('countin'); // countin | playing | paused | done
  const [count, setCount] = useState(0);
  const [pulse, setPulse] = useState(0); // bumped on every beat to re-trigger the flash

  const viewRef = useRef(null);
  const contentRef = useRef(null);
  const yRef = useRef(0);
  const maxYRef = useRef(0);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const lpbRef = useRef(lpb);
  lpbRef.current = lpb;
  const phaseRef = useRef('countin');
  phaseRef.current = phase;
  const beatTimerRef = useRef(0);
  const beatNumRef = useRef(0);

  const beatMs = 60000 / bpm;
  const pulseMs = Math.min(Math.round(beatMs * 0.8), 300);
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

  const stopBeatClock = () => {
    clearInterval(beatTimerRef.current);
    beatTimerRef.current = 0;
  };

  const tick = (ts) => {
    if (!lastTsRef.current) lastTsRef.current = ts;
    const dt = (ts - lastTsRef.current) / 1000;
    lastTsRef.current = ts;
    yRef.current += pixelsPerSecond(bpm, lpbRef.current, LINE_PX) * dt;
    if (yRef.current >= maxYRef.current) {
      yRef.current = maxYRef.current;
      apply();
      stopBeatClock();
      setPhase('done');
      phaseRef.current = 'done';
      return;
    }
    apply();
    rafRef.current = requestAnimationFrame(tick);
  };

  const beginScroll = () => {
    lastTsRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);
  };

  // One beat clock: four silent count-in beats (1-2-3-4 on screen), then it
  // keeps running so the pulse marker taps to the BPM for the whole song. Used
  // on first play and on every resume, so coming off pause is a visual count-in
  // with no sound.
  const startBeatClock = () => {
    stopBeatClock();
    cancelAnimationFrame(rafRef.current);
    beatNumRef.current = 0;
    setCount(0);
    setPhase('countin');
    phaseRef.current = 'countin';
    measure();
    const fire = () => {
      beatNumRef.current += 1;
      const n = beatNumRef.current;
      setPulse((p) => p + 1);
      if (n <= 4) setCount(n);
      if (n === 5) {
        setPhase('playing');
        phaseRef.current = 'playing';
        beginScroll();
      }
    };
    fire(); // first beat immediately
    beatTimerRef.current = setInterval(fire, beatMs);
  };

  useEffect(() => {
    startBeatClock();
    return () => {
      cancelAnimationFrame(rafRef.current);
      stopBeatClock();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pause = () => {
    if (phaseRef.current !== 'playing') return;
    cancelAnimationFrame(rafRef.current);
    stopBeatClock();
    setPhase('paused');
    phaseRef.current = 'paused';
  };
  const resume = () => startBeatClock();
  const restart = () => {
    yRef.current = 0;
    apply();
    startBeatClock();
  };

  const nudge = (delta) => setLpb((v) => Math.min(1, Math.max(0.02, v * (1 + delta))));

  return (
    <div className="play-root" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* One flash per beat: scale + fade of an accent square, zero corner
          radius to stay in the design system. Re-keyed by `pulse` each beat. */}
      <style>{`@keyframes craigBeat{0%{transform:scale(1.9);opacity:1}100%{transform:scale(1);opacity:.28}}`}</style>

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

        {/* the beat pulse — an accent square on the read line that flashes to the
            BPM the whole time you play, sitting in the left margin clear of the
            lyric text. */}
        {phase === 'playing' && (
          <div style={{ position: 'absolute', top: `${READ_FRACTION * 100}%`, left: 6, transform: 'translateY(-50%)', width: 14, height: 14, zIndex: 3, pointerEvents: 'none' }}>
            <div key={pulse} style={{ width: '100%', height: '100%', background: 'var(--color-accent)', transformOrigin: 'center', animation: `craigBeat ${pulseMs}ms ease-out both` }} />
          </div>
        )}

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

        {/* count-in overlay — the number pulses on each silent beat */}
        {phase === 'countin' && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 4, background: 'rgba(23,21,15,0.72)' }}>
            <div key={pulse} style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 96, color: 'var(--color-accent)', fontVariantNumeric: 'tabular-nums', transformOrigin: 'center', animation: `craigBeat ${pulseMs}ms ease-out both` }}>
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
