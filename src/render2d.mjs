// The 2D fallback (no WebGL, or ?flat=1): the same board as flat glossy discs on a woven tray. It has the
// view's interface, plays events as quick fades, and checks itself against the state after each move.
import { EMPTY, BILAO, SANDOK_H, SANDOK_V, KALDERO, LAHAT, KAKANIN } from './game.mjs';
import { KCOLOR } from './kakanin3d.mjs';

const LABEL = ['P', 'K', 'S', 'B', 'U', 'Su', '★'];

export function createFlat(canvas) {
  const ctx = canvas.getContext('2d');
  let g = null, selected = -1, hintPair = null, busyT = 0, callout = () => {};
  const geom = () => { const r = canvas.getBoundingClientRect(), size = Math.min(r.width, r.height) * 0.92, cell = size / Math.max(g.W, g.H); return { r, cell, ox: (r.width - cell * g.W) / 2, oy: (r.height - cell * g.H) / 2 + r.height * 0.04 }; };
  function resize() { const dpr = Math.min(devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect(); canvas.width = r.width * dpr; canvas.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function draw() {
    if (!g) return;
    const { r, cell, ox, oy } = geom();
    ctx.fillStyle = '#3a2418'; ctx.fillRect(0, 0, r.width, r.height);
    ctx.fillStyle = '#c99a5a'; ctx.beginPath(); ctx.arc(r.width / 2, oy + (cell * g.H) / 2, (cell * Math.max(g.W, g.H)) * 0.74, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < g.W * g.H; i++) {
      if (!g.mask[i]) continue;
      const x = ox + (i % g.W) * cell, y = oy + ((i / g.W) | 0) * cell;
      ctx.fillStyle = ((i % g.W) + ((i / g.W) | 0)) % 2 ? '#3d8236' : '#4a9440'; ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      if (g.latik[i]) { ctx.fillStyle = `rgba(122,62,20,${0.45 + g.latik[i] * 0.2})`; ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4); }
      const k = g.cell[i]; if (k === EMPTY) continue;
      const grd = ctx.createRadialGradient(x + cell * 0.38, y + cell * 0.35, cell * 0.05, x + cell / 2, y + cell / 2, cell * 0.42);
      grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.25, KCOLOR[k]); grd.addColorStop(1, '#00000055');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, cell * 0.38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = k === 0 || k === 6 ? '#3a2418' : '#fff8e1'; ctx.font = `800 ${cell * 0.26}px "Baloo 2", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(LABEL[k], x + cell / 2, y + cell / 2 + 1);
      const sp = g.spec[i];
      if (sp === SANDOK_H || sp === SANDOK_V) { ctx.strokeStyle = '#b07a3e'; ctx.lineWidth = 3; ctx.beginPath(); if (sp === SANDOK_H) { ctx.moveTo(x + 6, y + cell / 2); ctx.lineTo(x + cell - 6, y + cell / 2); } else { ctx.moveTo(x + cell / 2, y + 6); ctx.lineTo(x + cell / 2, y + cell - 6); } ctx.stroke(); }
      if (sp === KALDERO) { ctx.strokeStyle = '#3a3a40'; ctx.lineWidth = 3; ctx.strokeRect(x + 5, y + 5, cell - 10, cell - 10); }
      if (sp === LAHAT || k === BILAO) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, cell * 0.44, 0, Math.PI * 2); ctx.stroke(); }
      if (i === selected || (hintPair && hintPair.includes(i))) { ctx.strokeStyle = '#fff3a0'; ctx.lineWidth = 3; ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4); }
    }
  }
  return {
    setGame(game) { g = game; resize(); },
    // the same beats as the 3D view, in order, without animation
    async play(events, game, onBeat = () => {}) {
      g = game;
      for (const e of events) {
        if (e.type !== 'step') { onBeat(e); continue; }
        if (e.step >= 2) callout(['', '', 'Sarap!', 'Linamnam!', 'Panalo!', 'Ubos-Benta!'][Math.min(e.step, 5)], e.step);
        for (const [i, sp] of e.fired) onBeat({ type: 'fire', i, spec: sp });
        onBeat({ type: 'pop', step: e.step, cleared: e.cleared, latik: e.latik, made: e.made });
        onBeat({ type: 'land', count: e.falls.length + e.spawns.length });
      }
      busyT = 0.25; await new Promise((r) => setTimeout(r, 250));
    },
    pick(cx, cy) { if (!g) return -1; const { r, cell, ox, oy } = geom(); const x = Math.floor((cx - r.left - ox) / cell), y = Math.floor((cy - r.top - oy) / cell); if (x < 0 || y < 0 || x >= g.W || y >= g.H) return -1; const i = y * g.W + x; return g.mask[i] ? i : -1; },
    select(i) { selected = i; }, showHint(p) { hintPair = p; },
    update(dt) { busyT = Math.max(0, busyT - dt); draw(); },
    resize, busy: () => busyT > 0,
    icons() { const out = {}; for (let k = 0; k <= 6; k++) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = KCOLOR[k]; x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.fill(); out[k] = c.toDataURL(); } return out; },
    dump: () => ({ kinds: Array.from(g.cell), specs: Array.from(g.spec) }),
    onCallout(fn) { callout = fn; }, level: 0, setSpeed() {},
  };
}
