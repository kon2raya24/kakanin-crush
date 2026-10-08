// Synthesized sound: a soft crunch per kakanin (pitched by kind) that climbs a step with every cascade,
// whooshes for the specials, a "tsk" for a swap that doesn't match, a rondalla-and-kulintang loop, a
// banda flourish for a win. A limiter on the master keeps big cascades from clipping.
const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];
const deg = (d, base = 72) => NOTE(base + PENTA[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5));
const LOOP = [0, 2, 4, 2, 5, 4, 2, -1, 3, 4, 5, 7, 5, 4, 2, -1];

export function createAudio() {
  let ctx = null, master = null, sfx = null, bus = null, noise = null, muted = false, playing = false, step = 0, nextAt = 0;
  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -10; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(lim).connect(ctx.destination);
    sfx = ctx.createGain(); sfx.connect(master);
    bus = ctx.createGain(); bus.gain.value = 0; bus.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setInterval(schedule, 60);
  }
  function tone(freq, dur, type = 'triangle', gain = 0.05, when = 0, bend = 0, out = sfx) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(dur, freq, gain, when = 0, type = 'bandpass', to = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  const gong = (f, when, gain = 0.04) => { tone(f, 0.45, 'sine', gain, when, 0, bus); tone(f * 2.76, 0.15, 'sine', gain * 0.3, when, 0, bus); };
  function schedule() {
    if (!ctx || !playing || muted) return;
    const e8 = 60 / 104 / 2;
    if (nextAt < ctx.currentTime) nextAt = ctx.currentTime + 0.05;
    while (nextAt < ctx.currentTime + 0.25) {
      const when = nextAt - ctx.currentTime, s = step % 16, d = LOOP[s];
      if (d >= 0) gong(deg(d), when);
      if (s % 4 === 0) tone(NOTE(s % 8 ? 55 : 48), 0.5, 'triangle', 0.05, when, 0, bus); // a bajo-style bass
      if (s % 2 === 1) tone(deg((d >= 0 ? d : 2) + 5, 72), 0.08, 'square', 0.008, when, 0, bus); // rondalla plucks
      nextAt += e8; step++;
    }
  }
  return {
    start,
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.7; },
    music(on) { playing = on; if (bus) bus.gain.setTargetAtTime(on && !muted ? 0.9 : 0, ctx.currentTime, 0.2); },
    event(e) {
      if (!ctx || muted) return;
      switch (e.type) {
        case 'select': tone(660, 0.05, 'sine', 0.03); break;
        case 'tsk': case 'bounce': tone(220, 0.06, 'square', 0.03); tone(180, 0.08, 'square', 0.03, 0.07); break;
        case 'swap': hiss(0.12, 1800, 0.03); break;
        case 'step': {
          const up = Math.min(e.step - 1, 8);
          e.cleared.slice(0, 6).forEach(([, kind], n) => tone(deg(kind + up, 74), 0.12, 'triangle', 0.045, n * 0.02));
          hiss(0.15, 900 + kind0(e) * 200, 0.05);
          for (const [, sp] of e.fired) { if (sp === 3) { hiss(0.4, 2500, 0.2, 0, 'lowpass', 200); tone(70, 0.3, 'sine', 0.15, 0, 0.6); } else hiss(0.35, 600, 0.12, 0, 'bandpass', 4000); }
          for (const m of e.made) tone(deg(7, 79), 0.25, 'sine', 0.05, 0.05, 1.5);
          break;
        }
        case 'combo': hiss(0.6, 4000, 0.18, 0, 'lowpass', 300); tone(110, 0.5, 'sawtooth', 0.05, 0, 2); break;
        case 'shuffle': for (let n = 0; n < 6; n++) hiss(0.05, 3000, 0.04, n * 0.05); break;
        case 'ubos': [0, 2, 4, 5, 7, 9].forEach((d, n) => tone(deg(d, 79), 0.12, 'square', 0.035, n * 0.07)); break;
        case 'goal': tone(deg(9, 84), 0.15, 'sine', 0.05); break;
        case 'end': if (e.won) [[72, 0.15], [76, 0.15], [79, 0.15], [84, 0.4]].reduce((w, [n, d]) => { tone(NOTE(n), d + 0.05, 'square', 0.045, w); tone(NOTE(n - 12), d + 0.05, 'triangle', 0.05, w); return w + d; }, 0);
          else [67, 64, 60].forEach((n, i) => tone(NOTE(n), 0.35, 'triangle', 0.06, i * 0.25)); break;
        default: break;
      }
    },
  };
}
const kind0 = (e) => (e.cleared[0] ? e.cleared[0][1] : 0);
