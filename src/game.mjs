// The rules of Kakanin Crush: a pure, seeded match-3. createGame lays a level's board; swap (Task 2)
// plays one move and returns the events the view animates. The same level, seed and moves always give
// the same game. Integers only; randomness only from g.rs.
import { next } from './rng.mjs';

export const KAKANIN = ['puto', 'kutsinta', 'sapin', 'bibingka', 'ube', 'suman'];
export const BILAO = 6; // the colourless Bilao ng Lahat
export const EMPTY = -1;
export const NONE = 0, SANDOK_H = 1, SANDOK_V = 2, KALDERO = 3, LAHAT = 4;
export const POINTS = { piece: 60, fired: 120, latik: 100, ubos: 300 };

export const rand = (g) => { const [s, v] = next(g.rs); g.rs = s; return v; };
export const clone = (g) => structuredClone(g);

export function createGame(level, seed = level.seed) {
  const W = level.w, H = level.h, N = W * H;
  const mask = new Uint8Array(N), latik = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    mask[i] = level.mask ? (level.mask[y][x] === '#' ? 1 : 0) : 1;
    if (level.latik && mask[i]) { const c = level.latik[y][x]; if (c >= '1' && c <= '9') latik[i] = Number(c); }
  }
  const latikTotal = latik.reduce((a, b) => a + b, 0);
  const g = {
    id: level.id, W, H, mask, latik, rs: seed >>> 0,
    kinds: level.kinds.map((k) => KAKANIN.indexOf(k)),
    cell: new Int8Array(N).fill(EMPTY), spec: new Uint8Array(N),
    moves: level.moves, score: 0, stars: level.stars.slice(), won: 0, phase: 'play', turn: 0,
    goals: level.goals.map((q) => (q.type === 'collect' ? { type: 'collect', kind: KAKANIN.indexOf(q.kind), need: q.n, got: 0 }
      : q.type === 'latik' ? { type: 'latik', need: latikTotal, got: 0 } : { type: 'score', need: q.n, got: 0 })),
  };
  for (let i = 0; i < N; i++) if (mask[i]) g.cell[i] = pickKind(g, i);
  if (!findMoves(g).length) shuffle(g);
  return g;
}

// Would kind k at cell i line up three or more with what is already on the board?
function wouldRun(g, i, k) {
  const { W, H } = g, x = i % W, y = (i / W) | 0;
  const at = (xx, yy) => (xx >= 0 && yy >= 0 && xx < W && yy < H && g.mask[yy * W + xx] ? g.cell[yy * W + xx] : EMPTY);
  let h = 1; for (let d = 1; at(x - d, y) === k; d++) h++; for (let d = 1; at(x + d, y) === k; d++) h++;
  let v = 1; for (let d = 1; at(x, y - d) === k; d++) v++; for (let d = 1; at(x, y + d) === k; d++) v++;
  return h >= 3 || v >= 3;
}
const runAt = (g, i) => g.cell[i] >= 0 && g.cell[i] < BILAO && wouldRun(g, i, g.cell[i]);

// A kakanin for cell i that makes no match with its neighbours (any, if none can avoid it).
function pickKind(g, i) {
  const ok = g.kinds.filter((k) => !wouldRun(g, i, k));
  const from = ok.length ? ok : g.kinds;
  return from[Math.floor(rand(g) * from.length)];
}

function runs(g) {
  const { W, H } = g, out = [];
  const k = (x, y) => (g.mask[y * W + x] ? g.cell[y * W + x] : EMPTY);
  const real = (c) => c >= 0 && c !== BILAO;
  for (let y = 0; y < H; y++) for (let x = 0; x < W;) {
    const c = k(x, y); let e = x + 1;
    if (real(c)) while (e < W && k(e, y) === c) e++;
    if (real(c) && e - x >= 3) out.push({ dir: 'h', cells: Array.from({ length: e - x }, (_, d) => y * W + x + d) });
    x = e;
  }
  for (let x = 0; x < W; x++) for (let y = 0; y < H;) {
    const c = k(x, y); let e = y + 1;
    if (real(c)) while (e < H && k(x, e) === c) e++;
    if (real(c) && e - y >= 3) out.push({ dir: 'v', cells: Array.from({ length: e - y }, (_, d) => (y + d) * W + x) });
    y = e;
  }
  return out;
}

// Runs that share a cell are one group (an L, a T, a plus).
export function findGroups(g) {
  const groups = [];
  for (const r of runs(g)) {
    const hit = groups.filter((gr) => r.cells.some((c) => gr.cells.has(c)));
    const into = hit[0] || { cells: new Set(), runs: [] };
    if (!hit.length) groups.push(into);
    for (const other of hit.slice(1)) { other.cells.forEach((c) => into.cells.add(c)); into.runs.push(...other.runs); groups.splice(groups.indexOf(other), 1); }
    r.cells.forEach((c) => into.cells.add(c)); into.runs.push(r);
  }
  return groups;
}

export function adjacent(g, a, b) {
  const N = g.W * g.H;
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= N || b >= N) return false;
  return (Math.abs(a - b) === 1 && ((a / g.W) | 0) === ((b / g.W) | 0)) || Math.abs(a - b) === g.W;
}
const movable = (g, i) => g.mask[i] === 1 && g.cell[i] !== EMPTY;
function exchange(g, a, b) {
  [g.cell[a], g.cell[b]] = [g.cell[b], g.cell[a]];
  [g.spec[a], g.spec[b]] = [g.spec[b], g.spec[a]];
}
const isCombo = (g, a, b) => g.spec[a] === LAHAT || g.spec[b] === LAHAT || (g.spec[a] !== NONE && g.spec[b] !== NONE);

export function findMoves(g) {
  const out = [], { W, H } = g;
  for (let i = 0; i < W * H; i++) {
    if (!movable(g, i)) continue;
    for (const j of [i % W < W - 1 ? i + 1 : -1, i + W < W * H ? i + W : -1]) {
      if (j < 0 || !movable(g, j)) continue;
      let ok = isCombo(g, i, j);
      if (!ok) { exchange(g, i, j); ok = runAt(g, i) || runAt(g, j); exchange(g, i, j); }
      if (ok) out.push([i, j]);
    }
  }
  return out;
}
export const hint = (g) => findMoves(g)[0] || null;

// No move left: Lola mixes the plain pieces until the board is fair again.
function shuffle(g) {
  const slots = [];
  for (let j = 0; j < g.cell.length; j++) if (g.mask[j] && g.cell[j] >= 0 && g.cell[j] < BILAO && g.spec[j] === NONE) slots.push(j);
  const kinds = slots.map((j) => g.cell[j]);
  for (let tries = 0; tries < 100; tries++) {
    for (let k = kinds.length - 1; k > 0; k--) { const r = Math.floor(rand(g) * (k + 1)); [kinds[k], kinds[r]] = [kinds[r], kinds[k]]; }
    slots.forEach((j, n) => { g.cell[j] = kinds[n]; });
    if (!findGroups(g).length && findMoves(g).length) return;
  }
  for (let tries = 0; tries < 100; tries++) {
    for (const j of slots) g.cell[j] = EMPTY;
    for (const j of slots) g.cell[j] = pickKind(g, j);
    if (findMoves(g).length) return;
  }
}

export const hashState = (g) => JSON.stringify([Array.from(g.cell), Array.from(g.spec), Array.from(g.latik), g.score, g.moves, g.rs, g.phase, g.goals.map((q) => q.got)]);

export const _t = { wouldRun, shuffle, pickKind };
