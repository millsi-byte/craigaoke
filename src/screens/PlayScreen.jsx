import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { XIcon, PlayIcon, PauseIcon } from '../components/icons.jsx';
import { isSectionHeader, lyricLines } from '../lib/songs.js';
import { acquireWakeLock, clampBpm, DEFAULT_LINES_PER_BEAT, pixelsPerSecond } from '../lib/tempo.js';

const LINE_PX = 52; // matches the 34px lyric type at 1.5 line-height
const READ_FRACTION = 0.4; // the read line sits 40% down the screen
const BPM_STEP = 2; // ± per tap

// The teleprompter (spec §7.4): full screen, screen kept awake, a tempo-driven
// scroll, and both ways to pause.
//
// Tempo is the single dial. Adjusting speed changes the BPM, which drives both
// the scroll and the on-screen beat pulse together. A live tempo is a session
// change until you tap SET AS DEFAULT, which saves it as the song's play tempo;
// a published (looked-up) tempo is shown alongside for reference. The beat is
// shown, not heard: a silent count-in on first play, then a marker that pulses
// to the BPM. Resuming from pause starts immediately — no count-in.
export default function PlayScreen({ song, onExit, onCalibrate }) {
  const [bpm, setBpm] = useState(clampBpm(song.bpm || 100)); // Play always has a tempo
  const [savedBpm, setSavedBpm] = useState(clampBpm(song.bpm || 100)); // the song's stored default
  const [phase, setPhase] = useState('countin'); // countin | playing | paused | done
  const [count, setCount] = useState(0);
  const [pulse, setPulse] = useState(0); // bumped on every beat to re-trigger the flash

  const lpb = song.linesPerBeat || DEFAULT_LINES_PER_BEAT; // lines-per-beat calibration (fixed here)

  const viewRef = useRef(null);
  const contentRef = useRef(null);
  const yRef = useRef(0);
  const maxYRef = useRef(0);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;
  const phaseRef = useRef('countin');
  phaseRef.current = phase;
  const countinRef = useRef(0);

  const beatMs = 60000 / bpm;
  const pulseMs = Math.min(Math.round(beatMs * 0.8), 300);
  const lines = lyricLines(song.lyrics);
  const changed = bpm !== savedBpm;

  // Keep the screen awake for the whole session.
  useEffect(() => acquireWakeLock(), []);

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
    yRef.current += pixelsPerSecond(bpmRef.current, lpb, LINE_PX) * dt; // live BPM
    if (yRef.current >= maxYRef.current) {
      yRef.current = maxYRef.current;
      apply();
      setPhase('done');
      phaseRef.current = 'done';
      return;
    }
    apply();
    rafRef.current = requestAnimationFrame(tick);
  };

  const beginScroll = () => {
    lastTsRef.current = 0;
    setPhase('playing');
    phaseRef.current = 'playing';
    rafRef.current = requestAnimationFrame(tick);
  };

  // Silent visual count-in: four beats at the current tempo (1-2-3-4 pulsing on
  // screen), then start scrolling. Used on first play only.
  const runCountIn = () => {
    clearInterval(countinRef.current);
    cancelAnimationFrame(rafRef.current);
    setCount(0);
    setPhase('countin');
    phaseRef.current = 'countin';
    measure();
    let n = 0;
    const fire = () => {
      n += 1;
      setPulse((p) => p + 1);
      if (n <= 4) setCount(n);
      if (n >= 5) {
        clearInterval(countinRef.current);
        countinRef.current = 0;
        beginScroll();
      }
    };
    fire(); // first beat immediately
    countinRef.current = setInterval(fire, 60000 / bpmRef.current);
  };

  useEffect(() => {
    runCountIn();
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(countinRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The beat marker pulses to the BPM the whole time you play; it restarts at
  // the new tempo whenever the BPM is nudged.
  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const iv = setInterval(() => setPulse((p) => p + 1), 60000 / bpm);
    return () => clearInterval(iv);
  }, [phase, bpm]);

  const pause = () => {
    if (phaseRef.current !== 'playing') return;
    cancelAnimationFrame(rafRef.current);
    setPhase('paused');
    phaseRef.current = 'paused';
  };
  // Resume picks up right where it left off — no count-in (tap and play).
  const resume = () => {
    if (phaseRef.current !== 'paused') return;
    beginScroll();
  };
  const restart = () => {
    yRef.current = 0;
    apply();
    runCountIn();
  };

  const nudge = (delta) => setBpm((v) => clampBpm(v + delta));
  const saveDefault = () => {
    if (onCalibrate) onCalibrate(song.id, { bpm, bpmSource: 'manual' });
    setSavedBpm(bpm);
  };

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
            BPM the whole time you play, in the left margin clear of the lyrics. */}
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
              <div style={{ fontSize: 13, color: 'rgba(243,242,242,0.6)', marginTop: 6 }}>Tap anywhere to resume</div>
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

      {/* bottom controls: reference tempo + save, then pause + tempo dial */}
      <div style={{ padding: '10px 16px calc(12px + env(safe-area-inset-bottom)) 16px', zIndex: 3 }}>
        {(changed || (song.publishedBpm && song.publishedBpm !== bpm)) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, marginBottom: 8 }}>
            {song.publishedBpm ? (
              <span style={{ fontSize: 12, color: 'rgba(243,242,242,0.55)' }}>Published {song.publishedBpm} BPM</span>
            ) : null}
            <div style={{ flex: 1 }} />
            {changed && (
              <button className="btn btn-secondary" onClick={saveDefault} style={{ minHeight: 40, padding: '0 16px', fontSize: 12, color: '#f3f2f2', borderColor: 'rgba(243,242,242,0.4)' }}>
                SET {bpm} AS DEFAULT
              </button>
            )}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => (phase === 'playing' ? pause() : resume())}
            aria-label={phase === 'playing' ? 'Pause' : 'Play'}
            style={{ width: 56, height: 56, border: 0, background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          >
            {phase === 'playing' ? <PauseIcon size={22} /> : <PlayIcon size={20} />}
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, letterSpacing: '0.1em', color: 'rgba(243,242,242,0.5)' }}>TEMPO</span>
          <button onClick={() => nudge(-BPM_STEP)} aria-label="Slower" style={{ width: 48, height: 48, border: '1px solid rgba(243,242,242,0.3)', background: 'transparent', color: '#f3f2f2', cursor: 'pointer', fontSize: 22, fontFamily: 'var(--font-heading)' }}>–</button>
          <span aria-live="polite" style={{ minWidth: 78, textAlign: 'center', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-heading)', color: '#f3f2f2', fontVariantNumeric: 'tabular-nums' }}>
            {bpm} BPM
          </span>
          <button onClick={() => nudge(BPM_STEP)} aria-label="Faster" style={{ width: 48, height: 48, border: '1px solid rgba(243,242,242,0.3)', background: 'transparent', color: '#f3f2f2', cursor: 'pointer', fontSize: 22, fontFamily: 'var(--font-heading)' }}>+</button>
        </div>
      </div>
    </div>
  );
}
