// Sound for Kakanin Crush: real recorded sounds (Kenney, CC0, in assets/sfx) layered with a musical voice
// made in code — an FM marimba on a pentatonic scale, like a kulintang — through a small room reverb and
// a limiter. It plays the view's beats (see view3d.play), so every sound lands with its animation:
// - pops: up to six soft drops per cascade step, staggered and pitch-varied, with a marimba note per
//   kakanin that climbs a step with every cascade, and casino chips clinking from the second step up
// - specials: a shimmer when one is made; a knife-swish for a Sandok, a pot clang for a Kaldero, a glass
//   arpeggio for the Bilao ng Lahat
// - a card-slide swap, a soft "tsk", a card shuffle, coins for goals and for Ubos-Benta, pizzicato jingles
//   for winning and losing. Nothing plays until start() runs from a user gesture.
const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];
const deg = (d, base = 72) => NOTE(base + PENTA[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5));
const LOOP = [0, 2, 4, 2, 5, 4, 2, -1, 3, 4, 5, 7, 5, 4, 2, -1];
// the samples, by name: [file base, how many variants]
const SAMPLES = {
  pop: ['pop', 4], select: ['select', 3], click: ['click', 3], tsk: ['tsk', 0], special: ['special', 3], glass: ['glass', 6],
  start: ['start', 0], swap: ['swap', 4], chips: ['chips', 6], handle: ['handle', 3], shuffle: ['shuffle', 0],
  kaldero: ['kaldero', 3, 0], latik: ['latik', 3, 0], sandok: ['sandok', 3], coin: ['coin', 2], win: ['win', 0], lose: ['lose', 0], star3: ['star3', 0], go: ['go', 0],
};

export function createAudio({ base = 'assets/sfx/' } = {}) {
  let ctx = null, master = null, sfx = null, synth = null, bus = null, verb = null, noise = null;
  let muted = false, playing = false, step = 0, nextAt = 0;
  const buffers = new Map(), stats = { plays: 0, fails: 0, loaded: 0 }, burst = { t: -1, n: 0 };

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -12; lim.knee.value = 6; lim.ratio.value = 14; lim.attack.value = 0.002; lim.release.value = 0.18;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(lim).connect(ctx.destination);
    // a small room: a generated impulse, sent from the synth (more) and the samples (a touch)
    verb = ctx.createConvolver(); verb.buffer = impulse(1.2); const wet = ctx.createGain(); wet.gain.value = 0.32; verb.connect(wet).connect(master);
    sfx = ctx.createGain(); sfx.connect(master); const sSend = ctx.createGain(); sSend.gain.value = 0.12; sfx.connect(sSend).connect(verb);
    synth = ctx.createGain(); synth.gain.value = 0.9; synth.connect(master); const ySend = ctx.createGain(); ySend.gain.value = 0.5; synth.connect(ySend).connect(verb);
    bus = ctx.createGain(); bus.gain.value = 0; bus.connect(master); const mSend = ctx.createGain(); mSend.gain.value = 0.4; bus.connect(mSend).connect(verb);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setInterval(schedule, 60);
    loadAll();
  }
  function impulse(sec) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3; }
    return b;
  }
  async function loadAll() {
    const files = [];
    for (const [file, n, from = 1] of Object.values(SAMPLES)) if (!n) files.push(file); else for (let k = from; k < from + n; k++) files.push(file + k);
    await Promise.all(files.map(async (f) => {
      try { const res = await fetch(`${base}${f}.mp3`); if (!res.ok) throw new Error(res.status); buffers.set(f, await ctx.decodeAudioData(await res.arrayBuffer())); stats.loaded++; }
      catch { stats.fails++; } // that sound falls back to the synth layer alone
    }));
  }
  // play a sample by name (a random variant), with a gain, a playback rate and a delay
  function play(name, { gain = 0.6, rate = 1, at = 0, vary = 0.06 } = {}) {
    if (!ctx || muted) return;
    const [file, n, from = 1] = SAMPLES[name] || [name, 0];
    const key = n ? file + (from + Math.floor(Math.random() * n)) : file, buf = buffers.get(key);
    if (!buf) return;
    const t = ctx.currentTime + at, s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = buf; s.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * vary);
    g.gain.value = gain; s.connect(g).connect(sfx); s.start(t);
    stats.plays++;
  }
  // a soft FM marimba (a kulintang-like bar): bright attack, warm decay
  function marimba(freq, at = 0, gain = 0.06, dur = 0.45, out = synth) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + at, car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = freq; mod.frequency.value = freq * 4.0;
    mg.gain.setValueAtTime(freq * 2.2, t); mg.gain.exponentialRampToValueAtTime(freq * 0.05, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    mod.connect(mg).connect(car.frequency); car.connect(g).connect(out);
    car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
    const p = ctx.createOscillator(), pg = ctx.createGain(); p.frequency.value = freq * 2.76; // the gong's metallic partial
    pg.gain.setValueAtTime(gain * 0.18, t); pg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.4); p.connect(pg).connect(out); p.start(t); p.stop(t + dur);
  }
  function tone(freq, dur, type = 'sine', gain = 0.05, at = 0, bend = 0, out = synth) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  function sweep(dur, from, to, gain, at = 0, type = 'bandpass') {
    if (!ctx || muted) return;
    const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = type; f.Q.value = 1.2; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  // ---------- the music: a kulintang-and-rondalla loop with a soft shaker ----------
  function schedule() {
    if (!ctx || !playing || muted) return;
    const e8 = 60 / 104 / 2;
    if (nextAt < ctx.currentTime) nextAt = ctx.currentTime + 0.05;
    while (nextAt < ctx.currentTime + 0.25) {
      const at = nextAt - ctx.currentTime, s = step % 16, d = LOOP[s];
      if (d >= 0) marimba(deg(d), at, 0.035, 0.5, bus);
      if (s % 4 === 0) tone(NOTE(s % 8 ? 55 : 48), 0.5, 'triangle', 0.05, at, 0, bus);
      if (s % 2 === 1) tone(deg((d >= 0 ? d : 2) + 5, 72), 0.07, 'square', 0.006, at, 0, bus);
      // the shaker: a short burst of high noise on every eighth, accented on the off-beat
      { const t = ctx.currentTime + at, n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noise; f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(s % 2 ? 0.02 : 0.009, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); n.connect(f).connect(g).connect(bus); n.start(t, Math.random()); n.stop(t + 0.06); }
      nextAt += e8; step++;
    }
  }

  return {
    start,
    stats: () => ({ ...stats }),
    setMuted(m) {
      muted = m;
      if (!master) return;
      master.gain.value = m ? 0 : 0.8;
      bus.gain.setTargetAtTime(playing && !m ? 0.9 : 0, ctx.currentTime, 0.1); // unmuting brings the music back
    },
    music(on) { playing = on; if (bus) bus.gain.setTargetAtTime(on && !muted ? 0.9 : 0, ctx.currentTime, 0.2); },
    event(b) {
      if (!ctx || muted) return;
      switch (b.type) {
        case 'select': play('select', { gain: 0.35 }); break;
        case 'click': play('click', { gain: 0.4 }); break;
        case 'go': play('start', { gain: 0.5 }); marimba(deg(0), 0.05); marimba(deg(2), 0.15); marimba(deg(4), 0.25); break;
        case 'tsk': case 'bounce': play('tsk', { gain: 0.35 }); tone(180, 0.12, 'triangle', 0.03, 0.05, 0.8); break;
        case 'swap': play('swap', { gain: 0.5 }); break;
        case 'pop': {
          const up = Math.min(b.step - 1, 9), n = Math.min(6, b.cleared.length);
          for (let k = 0; k < n; k++) play('pop', { gain: 0.42, rate: 0.95 + up * 0.04, at: k * 0.025, vary: 0.12 });
          const kinds = [...new Set(b.cleared.map((c) => c[1]).filter((c) => c >= 0 && c < 6))].slice(0, 3);
          kinds.forEach((kind, k) => marimba(deg(kind + up, 72), k * 0.04, 0.07));
          if (b.step >= 2) play('chips', { gain: Math.min(0.7, 0.3 + b.step * 0.08), rate: 0.9 + up * 0.05 });
          if (b.latik.length) play('latik', { gain: 0.5, rate: 0.9 });
          if (b.made.length) { play('special', { gain: 0.5 }); play('glass', { gain: 0.35, at: 0.06 }); marimba(deg(9, 72), 0.08, 0.06, 0.8); }
          break;
        }
        case 'land': if (b.count) tone(90 + Math.random() * 20, 0.09, 'sine', 0.05); break;
        case 'fire': {
          // specials that go off together (a Bilao turning a whole kind into Sandoks) stay a few voices:
          // samples for the first three in a 40 ms burst, one low thump, softer as the burst grows
          const now = ctx.currentTime;
          if (now - burst.t > 0.04) { burst.t = now; burst.n = 0; }
          if (++burst.n > 3) break;
          const soft = 1 / Math.sqrt(burst.n), first = burst.n === 1;
          if (b.spec === 1 || b.spec === 2) { play('sandok', { gain: 0.6 * soft }); sweep(0.35, 600, 5000, 0.12 * soft); }
          else if (b.spec === 3) { play('kaldero', { gain: 0.55 * soft }); if (first) tone(70, 0.35, 'sine', 0.18, 0, 0.55); }
          else if (b.spec === 4) { for (let k = 0; k < 6; k++) play('glass', { gain: 0.35 * soft, rate: 1 + k * 0.12, at: k * 0.05, vary: 0 }); if (first) for (let k = 0; k < 8; k++) marimba(deg(k + 3, 72), k * 0.04, 0.05, 0.5); }
          break;
        }
        case 'combo': play('kaldero', { gain: 0.6, rate: 0.8 }); play('sandok', { gain: 0.5, at: 0.05 }); tone(110, 0.6, 'sine', 0.18, 0, 0.4); break;
        case 'shuffle': play('shuffle', { gain: 0.6 }); break;
        case 'goal': play('coin', { gain: 0.3, rate: 1.1 }); break;
        case 'star': marimba(deg(4 + b.n * 2, 79), 0, 0.08, 0.7); play('glass', { gain: 0.4, rate: 1 + b.n * 0.15, vary: 0 }); play('coin', { gain: 0.35, rate: 1 + b.n * 0.1, at: 0.05 }); break;
        case 'ubos': for (let k = 0; k < 3; k++) play('handle', { gain: 0.45, at: k * 0.12 }); play('coin', { gain: 0.5, at: 0.3 }); for (let k = 0; k < 6; k++) marimba(deg(k, 79), 0.1 + k * 0.06, 0.05); break;
        case 'end':
          if (b.won) { play('win', { gain: 0.7, vary: 0 }); if (b.stars === 3) play('star3', { gain: 0.6, at: 1.0, vary: 0 }); }
          else play('lose', { gain: 0.6, vary: 0 });
          break;
        default: break;
      }
    },
  };
}
