// Tempo maths and the metronome, for the play view (spec §7).

export const clampBpm = (n) => Math.min(240, Math.max(40, Math.round(n)));

// Tap tempo: BPM from the mean gap over recent taps, discarding a stale run.
export function bpmFromTaps(times) {
  const t = times.filter((_, i) => i === 0 || times[i] - times[i - 1] < 2000);
  const recent = t.slice(-8);
  if (recent.length < 2) return null;
  const gaps = recent.slice(1).map((x, i) => x - recent[i]);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return clampBpm(60000 / mean);
}

// The number BPM alone can't give you (spec §7.2): pixels per second.
export const pixelsPerSecond = (bpm, linesPerBeat, lineHeightPx) =>
  (lineHeightPx * linesPerBeat * bpm) / 60;

export const DEFAULT_LINES_PER_BEAT = 0.125; // ~one line per two 4/4 bars

// If a lookup gave a duration, we can calibrate near-exactly for free.
export function linesPerBeatFromDuration(lineCount, durationSec, bpm) {
  if (!lineCount || !durationSec || !bpm) return null;
  const beats = (durationSec / 60) * bpm;
  const v = lineCount / beats;
  return Number.isFinite(v) && v > 0 ? Math.min(1, Math.max(0.02, v)) : null;
}

// A short click via Web Audio — no files, works offline. Returns a Promise
// that resolves after the count-in so the caller can start scrolling.
export function countIn(bpm, beats, onBeat) {
  return new Promise((resolve) => {
    let ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      // No audio (rare) — still give the visual count so timing is preserved.
      let i = 0;
      const iv = setInterval(() => {
        i += 1;
        if (onBeat) onBeat(i);
        if (i >= beats) {
          clearInterval(iv);
          resolve();
        }
      }, (60 / bpm) * 1000);
      return;
    }
    const spb = 60 / bpm;
    const t0 = ctx.currentTime + 0.1;
    for (let i = 0; i < beats; i += 1) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = t0 + i * spb;
      osc.frequency.value = i === 0 ? 1500 : 1000; // first beat accented
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.5, at + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.06);
      if (onBeat) setTimeout(() => onBeat(i + 1), (at - ctx.currentTime) * 1000);
    }
    setTimeout(() => {
      ctx.close().catch(() => {});
      resolve();
    }, (beats * spb + 0.15) * 1000);
  });
}

// Screen Wake Lock (spec §7.4): keep the screen on while playing. Lifted from
// the recipe app's cook mode — acquire, re-acquire on visibilitychange,
// release on exit.
export function acquireWakeLock() {
  let lock = null;
  let gone = false;
  const acquire = async () => {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') {
        lock = await navigator.wakeLock.request('screen');
      }
    } catch { /* unsupported or denied */ }
  };
  const onVis = () => {
    if (!gone && document.visibilityState === 'visible') acquire();
  };
  acquire();
  document.addEventListener('visibilitychange', onVis);
  return () => {
    gone = true;
    document.removeEventListener('visibilitychange', onVis);
    if (lock) lock.release().catch(() => {});
  };
}
