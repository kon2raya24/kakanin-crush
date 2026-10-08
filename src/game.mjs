// The rules of Kakanin Crush: a pure, seeded match-3. createGame lays a level's board; swap (Task 2)
// plays one move and returns the events the view animates. The same level, seed and moves always give
// the same game. Integers only; randomness only from g.rs.
import { next } from './rng.mjs';

export const KAKANIN = ['puto', 'kutsinta', 'sapin', 'bibingka', 'ube', 'suman'];
export const BILAO = 6; // the colourless Bilao ng Lahat
export const EMPTY = -1;
export const NONE = 0, SANDOK_H = 1, SANDOK_V = 2, KALDERO = 3, LAHAT = 4;
// the campaign's other cells: ingredients to bring down to Lola, and the blockers
export const GATA = 7, ASUKAL = 8, KAHON = 9, LANGGAM = 10;
export const INGREDIENT = { gata: GATA, asukal: ASUKAL };
export const POINTS = { piece: 60, fired: 120, latik: 100, ubos: 300, hit: 100, deliver: 1000 };
const isKakanin = (c) => c >= 0 && c < BILAO;
const isIngredient = (c) => c === GATA || c === ASUKAL;

export const rand = (g) => { const [s, v] = next(g.rs); g.rs = s; return v; };
export const clone = (g) => structuredClone(g);

export function createGame(level, seed = level.seed) {
  const W = level.w, H = level.h, N = W * H;
  const mask = new Uint8Array(N), latik = new Uint8Array(N), wrap = new Uint8Array(N), crate = new Uint8Array(N), ant = new Uint8Array(N);
  const at = (rows, y, x) => (rows && rows[y] ? rows[y][x] : '.');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    mask[i] = level.mask ? (level.mask[y][x] === '#' ? 1 : 0) : 1;
    if (!mask[i]) continue;
    const l = at(level.latik, y, x); if (l >= '1' && l <= '9') latik[i] = Number(l);
    if (at(level.wrap, y, x) === 'w') wrap[i] = 1;
    const c = at(level.crates, y, x); if (c >= '1' && c <= '3') crate[i] = Number(c);
    if (at(level.ants, y, x) === 'a') ant[i] = 1;
  }
  const count = (a) => a.reduce((s, v) => s + (v ? 1 : 0), 0);
  const ing = level.ingredients || {};
  const g = {
    id: level.id, W, H, mask, latik, wrap, crate, rs: seed >>> 0,
    kinds: level.kinds.map((k) => KAKANIN.indexOf(k)),
    cell: new Int8Array(N).fill(EMPTY), spec: new Uint8Array(N),
    moves: level.moves, score: 0, stars: level.stars.slice(), won: 0, phase: 'play', turn: 0,
    owed: { [GATA]: ing.gata || 0, [ASUKAL]: ing.asukal || 0 }, onBoard: ing.onBoard || 0, antHit: false,
    goals: level.goals.map((q) => {
      if (q.type === 'collect') return { type: 'collect', kind: KAKANIN.indexOf(q.kind), need: q.n, got: 0 };
      if (q.type === 'latik') return { type: 'latik', need: latik.reduce((a, b) => a + b, 0), got: 0 };
      if (q.type === 'dahon') return { type: 'dahon', need: count(wrap), got: 0 };
      if (q.type === 'kahon') return { type: 'kahon', need: count(crate), got: 0 };
      if (q.type === 'langgam') return { type: 'langgam', need: count(ant), got: 0, left: count(ant) };
      if (q.type === 'deliver') return { type: 'deliver', kind: INGREDIENT[q.kind], need: q.n, got: 0 };
      return { type: 'score', need: q.n, got: 0 };
    }),
  };
  for (let i = 0; i < N; i++) {
    if (!mask[i]) continue;
    g.cell[i] = crate[i] ? KAHON : ant[i] ? LANGGAM : pickKind(g, i);
  }
  // the first ingredients wait in the top row
  for (let k = 0; k < g.onBoard; k++) {
    const kind = nextIngredient(g);
    if (kind < 0) break;
    const tops = [];
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) { const i = y * W + x; if (mask[i]) { if (isKakanin(g.cell[i]) && !wrap[i]) tops.push(i); break; } }
    if (!tops.length) break;
    const i = tops[Math.floor(rand(g) * tops.length)];
    g.cell[i] = kind; g.owed[kind]--;
  }
  if (!findMoves(g).length) shuffle(g);
  return g;
}
// which ingredient is owed next (gata first), or -1
function nextIngredient(g) { return g.owed[GATA] > 0 ? GATA : g.owed[ASUKAL] > 0 ? ASUKAL : -1; }
const onBoardIngredients = (g) => { let n = 0; for (const c of g.cell) if (isIngredient(c)) n++; return n; };

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
  const real = isKakanin; // only kakanin match: not the Bilao, ingredients or blockers
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
const movable = (g, i) => g.mask[i] === 1 && g.cell[i] !== EMPTY && g.cell[i] < KAHON && !g.wrap[i];
// a cell pieces can't fall through: a crate, ants, or a piece wrapped in dahon
const barrier = (g, i) => g.cell[i] === KAHON || g.cell[i] === LANGGAM || g.wrap[i] === 1;
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
  for (let j = 0; j < g.cell.length; j++) if (g.mask[j] && isKakanin(g.cell[j]) && g.spec[j] === NONE && !g.wrap[j]) slots.push(j);
  const kinds = slots.map((j) => g.cell[j]);
  for (let tries = 0; tries < 100; tries++) {
    for (let k = kinds.length - 1; k > 0; k--) { const r = Math.floor(rand(g) * (k + 1)); [kinds[k], kinds[r]] = [kinds[r], kinds[k]]; }
    slots.forEach((j, n) => { g.cell[j] = kinds[n]; });
    if (!findGroups(g).length && findMoves(g).length) return true;
  }
  for (let tries = 0; tries < 100; tries++) {
    for (const j of slots) g.cell[j] = EMPTY;
    for (const j of slots) g.cell[j] = pickKind(g, j);
    if (findMoves(g).length) return true;
  }
  return false;
}

export const hashState = (g) => JSON.stringify([Array.from(g.cell), Array.from(g.spec), Array.from(g.latik), Array.from(g.wrap || []), Array.from(g.crate || []), g.score, g.moves, g.rs, g.phase, g.goals.map((q) => q.got)]);

// ---------- a move ----------
// Each column falls in segments: holes are passed through, but a barrier (a crate, ants, a wrapped
// piece) holds up what is above it, and the cells under it fill from just below it.
function segments(g, x) {
  const { W, H } = g, out = []; let seg = [];
  for (let y = H - 1; y >= 0; y--) {
    const i = y * W + x;
    if (!g.mask[i]) continue;
    if (barrier(g, i)) { if (seg.length) out.push(seg); seg = []; continue; }
    seg.push(y);
  }
  if (seg.length) out.push(seg);
  return out; // bottom segment first; each lists its rows bottom-up
}
function gravity(g) {
  const { W } = g, falls = [];
  for (let x = 0; x < W; x++) for (const seg of segments(g, x)) {
    let w = 0;
    for (const y of seg) {
      const i = y * W + x;
      if (g.cell[i] === EMPTY) continue;
      const to = seg[w++] * W + x;
      if (to !== i) { g.cell[to] = g.cell[i]; g.spec[to] = g.spec[i]; g.cell[i] = EMPTY; g.spec[i] = NONE; falls.push([i, to]); }
    }
  }
  return falls;
}

function refill(g) {
  const { W, H } = g, spawns = [];
  for (let x = 0; x < W; x++) {
    const segs = segments(g, x);
    segs.forEach((seg, k) => {
      let n = 0;
      const top = seg[seg.length - 1], boardTop = k === segs.length - 1;
      for (const y of seg) {
        const i = y * W + x;
        if (g.cell[i] !== EMPTY) continue;
        // an owed ingredient may come in at the very top of the board
        let kind = -1;
        if (boardTop && y === top && onBoardIngredients(g) < g.onBoard) { const want = nextIngredient(g); if (want >= 0 && (rand(g) < 0.4 || onBoardIngredients(g) === 0)) { kind = want; g.owed[want]--; } }
        g.cell[i] = kind >= 0 ? kind : pickKind(g, i);
        spawns.push([i, g.cell[i], ++n, top]);
      }
    });
  }
  return spawns;
}

// Ingredients that reach the bottom cell of their column are delivered to Lola.
function deliver(g) {
  const { W, H } = g, out = [];
  for (let x = 0; x < W; x++) for (let y = H - 1; y >= 0; y--) {
    const i = y * W + x;
    if (!g.mask[i]) continue;
    if (isIngredient(g.cell[i])) {
      out.push([i, g.cell[i]]);
      for (const q of g.goals) if (q.type === 'deliver' && q.kind === g.cell[i]) q.got++;
      g.cell[i] = EMPTY; g.spec[i] = NONE;
    }
    break; // only the column's lowest cell
  }
  return out;
}

function refreshGoals(g) {
  const left = g.latik.reduce((a, b) => a + b, 0);
  let wraps = 0, crates = 0, ants = 0;
  for (let i = 0; i < g.cell.length; i++) { if (g.wrap[i]) wraps++; if (g.cell[i] === KAHON) crates++; if (g.cell[i] === LANGGAM) ants++; }
  for (const q of g.goals) {
    if (q.type === 'latik') q.got = q.need - left;
    if (q.type === 'score') q.got = Math.min(q.need, g.score);
    if (q.type === 'dahon') q.got = q.need - wraps;
    if (q.type === 'kahon') q.got = q.need - crates;
    if (q.type === 'langgam') { q.left = ants; q.got = ants === 0 ? q.need : Math.max(0, Math.min(q.need - 1, q.need - ants)); }
  }
}
export const goalsMet = (g) => g.goals.every((q) => q.got >= q.need);

// Clear the start cells and everything the specials among them set off; keep is the cells becoming specials.
// Blockers aren't cleared, they're hit (once a step): a match on or beside a wrapped piece frees it, a
// crate loses an hp, ants are swept off. Ingredients are never cleared.
function explode(g, start, keep) {
  const seen = new Set(), q = [...start], fired = [], struck = new Set();
  while (q.length) {
    const i = q.shift();
    if (seen.has(i) || keep.has(i) || !g.mask[i] || g.cell[i] === EMPTY) continue;
    const c = g.cell[i];
    if (c === KAHON || c === LANGGAM || g.wrap[i]) { struck.add(i); continue; }
    if (isIngredient(c)) continue;
    seen.add(i);
    if (g.spec[i] !== NONE) { fired.push([i, g.spec[i]]); q.push(...blast(g, i, g.spec[i])); }
  }
  const { W, H } = g;
  for (const i of seen) {
    const x = i % W, y = (i / W) | 0;
    for (const [xx, yy] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const j = yy * W + xx;
      if (g.mask[j] && !keep.has(j) && (g.cell[j] === KAHON || g.cell[j] === LANGGAM || g.wrap[j])) struck.add(j);
    }
  }
  const cleared = [], latik = [], hits = [];
  for (const i of seen) {
    cleared.push([i, g.cell[i], g.spec[i]]);
    for (const goal of g.goals) if (goal.type === 'collect' && goal.kind === g.cell[i]) goal.got++;
    if (g.latik[i]) { g.latik[i]--; latik.push([i, g.latik[i]]); }
    g.cell[i] = EMPTY; g.spec[i] = NONE;
  }
  for (const j of struck) {
    if (g.wrap[j]) { g.wrap[j] = 0; hits.push([j, 'wrap', 0]); }
    else if (g.cell[j] === KAHON) { g.crate[j] = Math.max(0, g.crate[j] - 1); if (!g.crate[j]) g.cell[j] = EMPTY; hits.push([j, 'crate', g.crate[j]]); }
    else if (g.cell[j] === LANGGAM) { g.cell[j] = EMPTY; g.antHit = true; hits.push([j, 'ant', 0]); }
  }
  return { cleared, fired, latik, hits };
}

// Resolve the board until nothing matches. first: cells to clear in step 1 (a combo); prefer: where specials go.
function settle(g, ev, prefer = [], first = null) {
  for (let step = 1; step < 80; step++) {
    let start; const made = [];
    if (step === 1 && first) start = first;
    else {
      const groups = findGroups(g);
      if (!groups.length) break;
      start = [];
      for (const gr of groups) {
        start.push(...gr.cells);
        const sp = specialFor(gr);
        if (sp !== NONE) { const at = placeFor(g, gr, sp, prefer); if (at >= 0) made.push([at, sp === LAHAT ? BILAO : g.cell[at], sp]); }
      }
    }
    const keep = new Set(made.map((m) => m[0]));
    const out = explode(g, start, keep);
    for (const [i, k, sp] of made) { g.cell[i] = k; g.spec[i] = sp; if (g.latik[i]) { g.latik[i]--; out.latik.push([i, g.latik[i]]); } }
    const falls = gravity(g), delivered = deliver(g);
    if (delivered.length) falls.push(...gravity(g)); // what was above a delivered ingredient falls into its place
    const points = out.cleared.length * POINTS.piece * step + out.fired.length * POINTS.fired + out.latik.length * POINTS.latik + out.hits.length * POINTS.hit + delivered.length * POINTS.deliver;
    g.score += points;
    const spawns = refill(g);
    ev.push({ type: 'step', step, ...out, made, falls, spawns, delivered, points });
    prefer = [];
  }
  refreshGoals(g);
}

export function swap(g, a, b) {
  const ev = [];
  if (g.phase !== 'play' || !adjacent(g, a, b) || !movable(g, a) || !movable(g, b)) return { ok: false, events: ev };
  const combo = isCombo(g, a, b);
  exchange(g, a, b);
  if (!combo && !findGroups(g).length) { exchange(g, a, b); ev.push({ type: 'bounce', a, b }); return { ok: false, events: ev }; }
  g.moves--; g.turn++; g.antHit = false;
  ev.push({ type: 'swap', a, b });
  settle(g, ev, [b, a], combo ? comboCells(g, a, b, ev) : null);
  after(g, ev);
  return { ok: true, events: ev };
}

function after(g, ev, { turn = true } = {}) {
  if (turn) sink(g, ev);
  if (goalsMet(g)) { ubos(g, ev); return; }
  if (turn && !g.antHit && g.cell.includes(LANGGAM)) { spreadAnts(g, ev); if (g.phase !== 'play') return; refreshGoals(g); }
  if (g.moves <= 0) { g.phase = 'lost'; ev.push({ type: 'end', won: false, stars: 0, score: g.score }); return; }
  if (!findMoves(g).length) {
    if (shuffle(g)) ev.push({ type: 'shuffle', cell: Array.from(g.cell), spec: Array.from(g.spec) });
    else { g.phase = 'lost'; ev.push({ type: 'shuffleFail' }, { type: 'end', won: false, stars: 0, score: g.score }); } // nothing can be moved: the level ends, never a soft-lock
  }
}


// Lola's ingredients are heavy: after every turn each one sinks a row, trading places with the plain piece
// under it (holes are skipped; a barrier holds it up). One that reaches the bottom is delivered, and any
// match the risen piece makes plays out.
function sink(g, ev) {
  const { W, H } = g, moved = [];
  for (let y = H - 2; y >= 0; y--) for (let x = 0; x < W; x++) { // bottom-up, so each moves once
    const i = y * W + x;
    if (!g.mask[i] || !isIngredient(g.cell[i])) continue;
    let j = i + W; while (j < W * H && !g.mask[j]) j += W;
    if (j >= W * H || !movable(g, j) || isIngredient(g.cell[j])) continue;
    exchange(g, i, j); moved.push([i, j]);
  }
  if (!moved.length) return;
  ev.push({ type: 'sink', moved });
  const bottom = moved.some(([, j]) => { let k = j + W; while (k < W * H && !g.mask[k]) k += W; return k >= W * H; });
  settle(g, ev, [], bottom ? [] : null); // an empty first step is how a delivery with no match plays out
}

// A quiet turn (no ant swept off): one ant walks onto a neighbouring plain piece. If ants are all that is
// left to move, they've taken the bilao.
function spreadAnts(g, ev) {
  const { W, H } = g, pairs = [];
  for (let i = 0; i < g.cell.length; i++) {
    if (g.cell[i] !== LANGGAM) continue;
    const x = i % W, y = (i / W) | 0;
    for (const [xx, yy] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const j = yy * W + xx;
      if (g.mask[j] && isKakanin(g.cell[j]) && g.spec[j] === NONE && !g.wrap[j]) pairs.push([i, j]);
    }
  }
  if (pairs.length) {
    const [from, to] = pairs[Math.floor(rand(g) * pairs.length)];
    g.cell[to] = LANGGAM; g.spec[to] = NONE;
    ev.push({ type: 'ants', from, to });
  }
  let free = 0; for (let i = 0; i < g.cell.length; i++) if (movable(g, i)) free++;
  if (!free) { g.phase = 'lost'; ev.push({ type: 'antsWin' }, { type: 'end', won: false, stars: 0, score: g.score }); }
}

// Boosters: help that costs no move. pamaypay (a fresh shuffle), sandok (a Sandok on the piece at target),
// merienda (+5 moves), siyanse (clear target as a blast would). Bad targets are refused, never thrown on.
export function useBooster(g, kind, target) {
  const ev = [], fail = { ok: false, events: [] };
  if (g.phase !== 'play') return fail;
  const ok = Number.isInteger(target) && target >= 0 && target < g.cell.length && g.mask[target] === 1;
  if (kind === 'merienda') { g.moves += 5; ev.push({ type: 'boost', kind }); }
  else if (kind === 'pamaypay') {
    if (!shuffle(g)) return fail;
    ev.push({ type: 'boost', kind }, { type: 'shuffle', cell: Array.from(g.cell), spec: Array.from(g.spec) });
  } else if (kind === 'sandok') {
    if (!ok || !isKakanin(g.cell[target]) || g.spec[target] !== NONE || g.wrap[target]) return fail;
    g.spec[target] = rand(g) < 0.5 ? SANDOK_H : SANDOK_V;
    ev.push({ type: 'boost', kind, i: target, spec: g.spec[target] });
  } else if (kind === 'siyanse') {
    if (!ok || g.cell[target] === EMPTY || isIngredient(g.cell[target])) return fail;
    ev.push({ type: 'boost', kind, i: target });
    settle(g, ev, [], [target]);
    after(g, ev, { turn: false });
  } else return fail;
  return { ok: true, events: ev };
}

// ---------- specials ----------
function specialFor(gr) {
  const long = Math.max(...gr.runs.map((r) => r.cells.length));
  if (long >= 5) return LAHAT;
  const hasH = gr.runs.some((r) => r.dir === 'h'), hasV = gr.runs.some((r) => r.dir === 'v');
  if (hasH && hasV) return KALDERO;
  if (long === 4) return gr.runs.find((r) => r.cells.length === 4).dir === 'h' ? SANDOK_H : SANDOK_V;
  return NONE;
}

function placeFor(g, gr, sp, prefer) {
  if (sp === KALDERO) {
    const h = new Set(gr.runs.filter((r) => r.dir === 'h').flatMap((r) => r.cells));
    for (const r of gr.runs) if (r.dir === 'v') for (const c of r.cells) if (h.has(c) && g.spec[c] === NONE && !g.wrap[c]) return c;
  }
  const free = (c) => g.spec[c] === NONE && !g.wrap[c];
  for (const c of prefer) if (gr.cells.has(c) && free(c)) return c;
  const long = gr.runs.reduce((a, r) => (r.cells.length > a.cells.length ? r : a));
  for (const c of [long.cells[1], ...long.cells]) if (free(c)) return c;
  for (const c of gr.cells) if (free(c)) return c;
  return -1; // every cell already holds a special: make none rather than replace one
}

function commonKind(g) {
  const n = new Array(BILAO).fill(0);
  for (let j = 0; j < g.cell.length; j++) if (g.mask[j] && g.cell[j] >= 0 && g.cell[j] < BILAO) n[g.cell[j]]++;
  let best = 0; for (let k = 1; k < BILAO; k++) if (n[k] > n[best]) best = k;
  return best;
}

// The cells a special sets off.
function blast(g, i, sp) {
  const { W, H } = g, x = i % W, y = (i / W) | 0, out = [];
  const add = (xx, yy) => { if (xx >= 0 && yy >= 0 && xx < W && yy < H && g.mask[yy * W + xx]) out.push(yy * W + xx); };
  if (sp === SANDOK_H) for (let xx = 0; xx < W; xx++) add(xx, y);
  else if (sp === SANDOK_V) for (let yy = 0; yy < H; yy++) add(x, yy);
  else if (sp === KALDERO) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) add(x + dx, y + dy);
  else if (sp === LAHAT) { const k = commonKind(g); for (let j = 0; j < g.cell.length; j++) if (g.mask[j] && g.cell[j] === k) out.push(j); }
  return out;
}

// A swap of two specials, or of a Bilao ng Lahat with anything. After the exchange the dragged piece is at b.
function comboCells(g, a, b, ev) {
  const sB = g.spec[b], sA = g.spec[a];
  const { W, H } = g, x = b % W, y = (b / W) | 0, cells = [a, b];
  const rect = (x0, y0, x1, y1) => { for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H && g.mask[yy * W + xx]) cells.push(yy * W + xx); };
  ev.push({ type: 'combo', a, b, specs: [sB, sA] });
  if (sA === LAHAT && sB === LAHAT) { g.spec[a] = g.spec[b] = NONE; rect(0, 0, W - 1, H - 1); return cells; }
  if (sA === LAHAT || sB === LAHAT) {
    const lahat = sA === LAHAT ? a : b, other = lahat === a ? b : a, k = g.cell[other], sp = g.spec[other];
    g.spec[lahat] = NONE;
    for (let j = 0; j < g.cell.length; j++) if (g.mask[j] && g.cell[j] === k) {
      if (sp !== NONE) g.spec[j] = sp === KALDERO ? KALDERO : rand(g) < 0.5 ? SANDOK_H : SANDOK_V;
      cells.push(j);
    }
    return cells;
  }
  const sandoks = [sA, sB].filter((s) => s === SANDOK_H || s === SANDOK_V).length;
  g.spec[a] = g.spec[b] = NONE;
  if (sandoks === 2) { rect(0, y, W - 1, y); rect(x, 0, x, H - 1); }
  else if (sandoks === 1) { rect(0, y - 1, W - 1, y + 1); rect(x - 1, 0, x + 1, H - 1); }
  else rect(x - 2, y - 2, x + 2, y + 2);
  return cells;
}

// Ubos-Benta! Every move left turns a plain kakanin into a Sandok, and they all go off.
function ubos(g, ev) {
  ev.push({ type: 'ubos', moves: g.moves });
  const made = [];
  while (g.moves > 0) {
    const plain = [];
    for (let j = 0; j < g.cell.length; j++) if (g.mask[j] && isKakanin(g.cell[j]) && g.spec[j] === NONE && !g.wrap[j]) plain.push(j);
    if (!plain.length) break;
    const i = plain[Math.floor(rand(g) * plain.length)];
    g.spec[i] = rand(g) < 0.5 ? SANDOK_H : SANDOK_V;
    g.moves--; g.score += POINTS.ubos;
    made.push([i, g.cell[i], g.spec[i]]);
  }
  ev.push({ type: 'ubosMake', made });
  for (let round = 0; round < 10; round++) {
    const live = [];
    for (let j = 0; j < g.cell.length; j++) if (g.mask[j] && g.spec[j] !== NONE) live.push(j);
    if (!live.length) break;
    settle(g, ev, [], live);
  }
  g.won = g.score >= g.stars[2] ? 3 : g.score >= g.stars[1] ? 2 : 1;
  g.phase = 'won';
  ev.push({ type: 'end', won: true, stars: g.won, score: g.score });
}

export const _t = { wouldRun, shuffle, pickKind, gravity, refill, placeFor, spreadAnts, deliver, sink };
