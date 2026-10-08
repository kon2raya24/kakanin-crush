# Kakanin Crush — Phase 1: Engine and San Roque — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable, deployed first town of Kakanin Crush. It has:
- a pure seeded match-3 engine (specials, combos, latik, Ubos-Benta, shuffle)
- the 15 San Roque levels, each checked by a bot
- the approved 3D stall scene with real 3D kakanin
- a Hollow Blocks-style HUD
- phone and desktop input
- sound and saves
- a 2D fallback

**Architecture:**
- **Rules:** `src/game.mjs` is the only rules code: plain data in, events out, with no DOM or three.js.
- **3D view:** `src/view3d.mjs` draws the state and animates the events. `src/kakanin3d.mjs` builds the pieces; `src/stall3d.mjs` builds the scene. Both are ported from the approved prototype in `.superpowers/brainstorm/98650-1791430228/content/k3d9.js`, reusing Hollow Blocks' `tex.mjs`, `post.mjs` and vendor three.js unchanged.
- **Page:** `src/main.mjs` wires screens, input, HUD, audio and saving.
- **Bot:** `src/bot.mjs` plays levels for balance tests.

**Tech Stack:**
- plain ES modules with no build step; three.js r186 vendored from Hollow Blocks
- `node --test` for unit tests; headless Chrome via `tools/cdp.mjs` for browser checks
- Vercel for hosting

**Spec:** `docs/superpowers/specs/2026-10-08-kakanin-crush-design.md`

## Global Constraints

- **Repo:** `/private/var/www/others/kakanin-crush`.
  - Commits use the machine's global git identity; never set `user.name`/`user.email`.
  - Every commit message ends with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **No build step, no npm dependencies:** native ES modules; three.js comes from `../hollow-blocks/src/vendor/` copies.
- **Rules:** `game.mjs` is integer-only and deterministic. Randomness only through `g.rs` (the mulberry32 state number). No `Math.random`, no time.
- **Kakanin ids:** `KAKANIN = ['puto','kutsinta','sapin','bibingka','ube','suman']` (indices 0–5). `BILAO = 6` is the colourless Bilao ng Lahat.
- **Specials:** `NONE=0, SANDOK_H=1, SANDOK_V=2, KALDERO=3, LAHAT=4`. A horizontal match of 4 makes `SANDOK_H`, which clears its **row**.
- **UI text** is Taglish, as in Hollow Blocks; the font is `Baloo 2` plus `Barlow Condensed` for HUD numbers.
- **Saving:** `localStorage` key `kakanin.v1`, every access wrapped in try/catch. Test mode (`?test=1`) never reads or writes it.
- **Service worker:** `sw.js` `VERSION` starts at `kakanin-v1` and is bumped on every later change.
- **Assets:** CC0 files copied from `../hollow-blocks/assets/env/` (about 2 MB). No Mixamo in phase 1.
- **Lola:** absent from the 3D scene in phase 1; she speaks through the DOM speech bubble only.
- **Publishing:** the Vercel deploy, GitHub repo and Pages are allowed (the same series flow the user approved for every game). The portfolio is NOT touched.

## Review Focus

These failure modes are implied by the spec but untested by any unit test. Each has its check in the task that owns it:

1. **Input during a cascade.** Taps and drags while the board animates must be ignored, never queued into a second swap. Checked in Task 12 (`tools/check.mjs` "rapid input").
2. **A corrupt or foreign save** (bad JSON, wrong types, a level id that no longer exists) must load as a fresh or cleaned save, never crash. Checked in Task 7.
3. **Phone portrait.** On a 390×844 screen the bilao must fill at least 85% of the width, with the HUD strip above it, and nothing overlapping the board. Checked in Task 12.
4. **No WebGL, or `?flat=1`.** The game must still be fully playable in the 2D fallback. Checked in Task 12.
5. **A resize or rotation mid-cascade** must leave the 3D board matching the rules' state once the animation ends. Checked in Task 12 (a resize during play, then compare `view.dump()` with the game).

---

## File Structure

```
kakanin-crush/
  index.html            page, HUD and screens markup + CSS (Hollow Blocks style)
  manifest.webmanifest  PWA
  sw.js                 offline cache (VERSION kakanin-v1)
  vercel.json           security headers (copied from hollow-blocks)
  README.md, LICENSE
  icons/                icon-192.png, icon-512.png, apple-touch-icon.png
  og.jpg                share image
  assets/env/           CC0 sky, backdrop, scanned textures, props (from hollow-blocks)
  src/
    rng.mjs             mulberry32 step over a plain number
    game.mjs            the rules
    levels.mjs          San Roque's 15 levels + validateLevel
    bot.mjs             move chooser + playLevel
    progress.mjs        saves
    kakanin3d.mjs       3D pieces and special marks
    stall3d.mjs         the fiesta-street stall scene
    view3d.mjs          board view, animation, picking, icons
    render2d.mjs        2D fallback with the same interface
    audio.mjs           synthesized sound
    main.mjs            page wiring
    tex.mjs, post.mjs   copied from hollow-blocks (import paths unchanged: ./vendor/...)
    vendor/             three.module.min.js, three-extra.min.js, three-fx.min.js, three-mocap.min.js, THREE-LICENSE
  test/
    game.test.mjs, levels.test.mjs, balance.test.mjs, progress.test.mjs, pwa.test.mjs
  tools/
    cdp.mjs             headless Chrome driver (copied from bakbakan)
    balance.mjs         per-level bot report
    check.mjs           browser checks + screenshots into .scratch/
```

`.gitignore` already has `.superpowers/`. Task 1 adds `.scratch/` and `.vercel`.

---

### Task 1: The board: creation, runs, groups, moves

**Files:**
- Create: `src/rng.mjs`, `src/game.mjs`, `test/game.test.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Produces:
  - `next(s: number) → [s2: number, v: number in [0,1)]`
  - `createGame(level, seed?) → g`, where
    `g = { id, W, H, mask: Uint8Array, latik: Uint8Array, cell: Int8Array, spec: Uint8Array, rs, kinds: number[], moves, score, stars: [n,n,n], won: 0..3, phase: 'play'|'won'|'lost', turn, goals: [{type,kind?,need,got}] }`
  - `findGroups(g) → [{cells: Set<number>, runs: [{dir:'h'|'v', cells: number[]}]}]`
  - `findMoves(g) → [[a,b], ...]` with `b = a+1` or `a+W`
  - `adjacent(g,a,b) → boolean`
  - `clone(g)`
  - `hashState(g) → string`
  - the constants listed in Global Constraints
  - `_t.wouldRun(g,i,k)` for tests
- A **level** is `{ id, name, w, h, mask?: string[] ('#' cell, '.' hole), latik?: string[] ('.' or '1'-'9'), kinds: string[], moves, goals: [{type:'collect',kind,n}|{type:'latik'}|{type:'score',n}], stars: [s1,s2,s3], seed, tip? }`.

- [ ] **Step 1: Write the failing tests** in `test/game.test.mjs`:

```js
// Rules tests. Boards are written as strings: p k s b u m are the six kakanin, * a Bilao ng Lahat, . a hole.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, findGroups, findMoves, adjacent, hashState, clone, KAKANIN, BILAO, EMPTY, NONE, LAHAT, _t } from '../src/game.mjs';

export const L = (o = {}) => ({ id: 't', name: 'T', w: 5, h: 5, kinds: [...KAKANIN], moves: 10, goals: [{ type: 'score', n: 1e9 }], stars: [1, 2, 3], seed: 1, ...o });
const CH = { p: 0, k: 1, s: 2, b: 3, u: 4, m: 5, '*': BILAO };
export function setBoard(g, rows) {
  rows.forEach((r, y) => [...r].forEach((c, x) => {
    const i = y * g.W + x;
    if (c === '.') { g.mask[i] = 0; g.cell[i] = EMPTY; g.spec[i] = NONE; return; }
    g.mask[i] = 1; g.cell[i] = CH[c]; g.spec[i] = c === '*' ? LAHAT : NONE;
  }));
  return g;
}

test('a new board has no matches, has a move, and is the same for the same seed', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const lv = L({ w: 9, h: 9, kinds: KAKANIN.slice(0, 4), seed });
    const g = createGame(lv);
    assert.equal(findGroups(g).length, 0, `seed ${seed} starts with a match`);
    assert.ok(findMoves(g).length > 0, `seed ${seed} has no move`);
    assert.equal(hashState(createGame(lv)), hashState(g));
    for (let i = 0; i < 81; i++) assert.ok(g.kinds.includes(g.cell[i]));
  }
});

test('holes stay empty and never join a run', () => {
  const g = createGame(L({ w: 5, h: 3, mask: ['##.##', '#####', '#####'] }));
  assert.equal(g.mask[2], 0); assert.equal(g.cell[2], EMPTY);
  setBoard(g, ['pp.pp', 'ksbum', 'sbumk']);
  assert.equal(findGroups(g).length, 0);
});

test('runs of three or more join into groups; an L is one group', () => {
  const g = setBoard(createGame(L()), ['pppkb', 'ksupm', 'bspum', 'mbskk', 'kbmub']);
  const gs = findGroups(g);
  assert.equal(gs.length, 1);
  assert.deepEqual([...gs[0].cells].sort((a, b) => a - b), [0, 1, 2]);
  setBoard(g, ['pkbum', 'pubkm', 'pppks', 'kbmus', 'bmkub']);
  const l = findGroups(g);
  assert.equal(l.length, 1);
  assert.equal(l[0].cells.size, 5);
  assert.deepEqual(l[0].runs.map((r) => r.dir).sort(), ['h', 'v']);
});

test('moves: only swaps that make a match, or involve a Bilao ng Lahat', () => {
  const g = setBoard(createGame(L({ w: 4, h: 3 })), ['pkpp', 'kbku', 'ubmk']);
  const mv = findMoves(g).map(([a, b]) => `${a}-${b}`);
  assert.ok(mv.includes('0-1'), 'p<->k at the start of the top row makes ppp');
  assert.ok(!mv.includes('8-9'));
  setBoard(g, ['pkbu', 'kbuk', 'u*mk']);
  assert.ok(findMoves(g).some(([a, b]) => a === 9 || b === 9), 'the Bilao swaps with anything');
});

test('adjacency never wraps a row', () => {
  const g = createGame(L());
  assert.ok(adjacent(g, 0, 1)); assert.ok(adjacent(g, 0, 5));
  assert.ok(!adjacent(g, 4, 5)); assert.ok(!adjacent(g, 0, 6)); assert.ok(!adjacent(g, 0, -5));
});

test('wouldRun sees runs through a cell from both sides, never across a hole', () => {
  const g = setBoard(createGame(L()), ['pp.kp', 'kbumk', 'bumkb', 'umkbs', 'mkbsu']);
  assert.ok(!_t.wouldRun(g, 3, 0), 'the hole at 2 breaks the line');
  g.mask[2] = 1; g.cell[2] = 0;
  assert.ok(_t.wouldRun(g, 3, 0), 'p p p, then p: a run');
  assert.ok(_t.wouldRun(g, 2, 0));
  assert.ok(!_t.wouldRun(g, 2, 1));
});

test('clone is independent', () => {
  const g = createGame(L()); const c = clone(g);
  c.cell[0] = 5; c.goals[0].got = 9;
  assert.notEqual(g.cell[0] === 5 && g.goals[0].got === 9, true);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `cd /private/var/www/others/kakanin-crush && node --test test/game.test.mjs`
Expected: FAIL: `Cannot find module '../src/game.mjs'`.

- [ ] **Step 3: Write `src/rng.mjs`**

```js
// Seeded PRNG (mulberry32) over a plain number, so a game state can be cloned, hashed and replayed.
export function next(s) {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [s, ((t ^ (t >>> 14)) >>> 0) / 4294967296];
}
```

- [ ] **Step 4: Write `src/game.mjs` (board part)**

```js
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
```

- [ ] **Step 5: Add `.scratch/` and `.vercel` to `.gitignore`**

```
.superpowers/
.scratch/
.vercel
```

- [ ] **Step 6: Run the tests**

Run: `node --test test/game.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 7: Commit**

```bash
git add .gitignore src/rng.mjs src/game.mjs test/game.test.mjs
git commit -m "Rules: the board, runs, groups and moves

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: A move: swap, clear, fall, refill, score, goals, win and lose

**Files:**
- Modify: `src/game.mjs` (append functions; extend `_t`)
- Test: `test/game.test.mjs` (append)

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `swap(g, a, b) → { ok: boolean, events: Event[] }`
  - `goalsMet(g)`
  - `_t.refill(g)`, `_t.gravity(g)`
- **Events** (the view and audio rely on these exact shapes):
  - `{type:'bounce', a, b}`: an invalid swap; nothing changed.
  - `{type:'swap', a, b}`: the pieces at a and b were exchanged.
  - `{type:'step', step, cleared:[[i,kind,spec]], fired:[[i,spec]], latik:[[i,left]], made:[[i,kind,spec]], falls:[[from,to]], spawns:[[i,kind,n]], points}`: one cascade step. In `spawns`, `n` is 1 for the lowest new piece in its column.
  - `{type:'end', won, stars, score}`

- [ ] **Step 1: Append the failing tests**

```js
import { swap, goalsMet, POINTS } from '../src/game.mjs';
const noRun = (g) => findGroups(g).length === 0;
const full = (g) => g.cell.every((c, i) => !g.mask[i] || c !== EMPTY);

test('an invalid swap bounces and costs nothing', () => {
  const g = setBoard(createGame(L()), ['pkbum', 'kbump', 'bumpk', 'umpkb', 'mpkbu']);
  const before = hashState(g);
  const r = swap(g, 0, 1);
  assert.equal(r.ok, false);
  assert.deepEqual(r.events, [{ type: 'bounce', a: 0, b: 1 }]);
  assert.equal(hashState(g), before);
  for (const bad of [[0, 2], [0, 6], [4, 5], [-1, 0], [0, 99], [NaN, 1], ['0', 1]]) assert.equal(swap(g, ...bad).ok, false);
});

test('a match of three clears, falls, refills, scores and counts toward the goal', () => {
  const g = setBoard(createGame(L({ goals: [{ type: 'collect', kind: 'puto', n: 3 }, { type: 'score', n: 1e9 }] })), ['kppbu', 'pkbum', 'bumkb', 'umkbs', 'mkbsu']);
  const r = swap(g, 0, 5); // the puto at 5 moves up to 0: three puto in row 0
  assert.equal(r.ok, true);
  assert.equal(r.events[0].type, 'swap');
  const step = r.events.find((e) => e.type === 'step');
  assert.deepEqual(step.cleared.map((c) => c[0]).sort((a, b) => a - b), [0, 1, 2]);
  assert.equal(step.points, 3 * POINTS.piece);
  assert.equal(g.moves, 9);
  assert.ok(g.goals[0].got >= 3);
  assert.ok(noRun(g) && full(g));
});

test('falls keep column order and pass through holes; refills never make a match by themselves', () => {
  const g = setBoard(createGame(L({ w: 3, h: 4, mask: ['###', '#.#', '###', '###'] })), ['kbu', 'm.s', 'ppp', 'bus']);
  g.cell[6] = g.cell[7] = g.cell[8] = EMPTY;
  const falls = _t.gravity(g).map(([a, b]) => `${a}>${b}`).sort();
  assert.deepEqual(falls, ['0>3', '1>7', '2>5', '3>6', '5>8'].sort());
  assert.equal(g.cell[7], 3, 'the bibingka fell through the hole to row 2');
  const h = setBoard(createGame(L({ w: 3, h: 1, kinds: ['puto', 'kutsinta', 'sapin', 'bibingka'] })), ['ppk']);
  for (let s = 1; s < 60; s++) { h.rs = s; h.cell[2] = EMPTY; _t.refill(h); assert.notEqual(h.cell[2], 0); }
});

test('the game is won when the goals are met and lost when the moves run out', () => {
  const g = setBoard(createGame(L({ moves: 1, goals: [{ type: 'collect', kind: 'puto', n: 3 }] })), ['kppbu', 'pkbum', 'bumkb', 'umkbs', 'mkbsu']);
  const r = swap(g, 0, 5);
  assert.equal(g.phase, 'won');
  assert.ok(goalsMet(g));
  assert.equal(r.events.at(-1).type, 'end');
  assert.equal(r.events.at(-1).won, true);
  const h = setBoard(createGame(L({ moves: 1, goals: [{ type: 'collect', kind: 'puto', n: 99 }] })), ['kppbu', 'pkbum', 'bumkb', 'umkbs', 'mkbsu']);
  swap(h, 0, 5);
  assert.equal(h.phase, 'lost');
  assert.equal(swap(h, 1, 2).ok, false, 'no moves after the end');
});

test('replays are exact: same seed and moves give the same state', () => {
  const play = () => { const g = createGame(L({ w: 8, h: 8, kinds: KAKANIN.slice(0, 5), moves: 40, seed: 7 })); for (let k = 0; k < 30 && g.phase === 'play'; k++) swap(g, ...findMoves(g)[0]); return hashState(g); };
  assert.equal(play(), play());
});

test('after any move the board is full and still', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const g = createGame(L({ w: 9, h: 9, kinds: KAKANIN.slice(0, 5), moves: 40, seed }));
    for (let k = 0; k < 25 && g.phase === 'play'; k++) {
      const mv = findMoves(g);
      swap(g, ...mv[(seed * 7 + k) % mv.length]);
      assert.ok(noRun(g) && full(g), `seed ${seed} move ${k}`);
    }
  }
});
```

**Why those falls** (W=3, H=4; cell 4 is a hole; row 2 was cleared). Column 0 holds cells 0,3,6,9 = k, m, —, b: b stays, m 3→6, k 0→3. Column 1 holds 1,7,10 = b, —, u: b 1→7, falling past the hole. Column 2 holds 2,5,8,11 = u, s, —, s: s 5→8, u 2→5.

- [ ] **Step 2: Run to see the new tests fail**

Run: `node --test test/game.test.mjs`
Expected: FAIL: `swap is not a function` (or not exported).

- [ ] **Step 3: Append the move code to `src/game.mjs`**

```js
// ---------- a move ----------
function gravity(g) {
  const { W, H } = g, falls = [];
  for (let x = 0; x < W; x++) {
    const rows = []; for (let y = H - 1; y >= 0; y--) if (g.mask[y * W + x]) rows.push(y);
    let w = 0;
    for (const y of rows) {
      const i = y * W + x;
      if (g.cell[i] === EMPTY) continue;
      const to = rows[w++] * W + x;
      if (to !== i) { g.cell[to] = g.cell[i]; g.spec[to] = g.spec[i]; g.cell[i] = EMPTY; g.spec[i] = NONE; falls.push([i, to]); }
    }
  }
  return falls;
}

function refill(g) {
  const { W, H } = g, spawns = [];
  for (let x = 0; x < W; x++) {
    let n = 0;
    for (let y = H - 1; y >= 0; y--) { const i = y * W + x; if (g.mask[i] && g.cell[i] === EMPTY) { g.cell[i] = pickKind(g, i); spawns.push([i, g.cell[i], ++n]); } }
  }
  return spawns;
}

function refreshGoals(g) {
  const left = g.latik.reduce((a, b) => a + b, 0);
  for (const q of g.goals) { if (q.type === 'latik') q.got = q.need - left; if (q.type === 'score') q.got = Math.min(q.need, g.score); }
}
export const goalsMet = (g) => g.goals.every((q) => q.got >= q.need);

// Clear the start cells and everything the specials among them set off; keep is the cells becoming specials.
function explode(g, start, keep) {
  const seen = new Set(), q = [...start], fired = [];
  while (q.length) {
    const i = q.shift();
    if (seen.has(i) || keep.has(i) || !g.mask[i] || g.cell[i] === EMPTY) continue;
    seen.add(i);
    if (g.spec[i] !== NONE) { fired.push([i, g.spec[i]]); q.push(...blast(g, i, g.spec[i])); }
  }
  const cleared = [], latik = [];
  for (const i of seen) {
    cleared.push([i, g.cell[i], g.spec[i]]);
    for (const goal of g.goals) if (goal.type === 'collect' && goal.kind === g.cell[i]) goal.got++;
    if (g.latik[i]) { g.latik[i]--; latik.push([i, g.latik[i]]); }
    g.cell[i] = EMPTY; g.spec[i] = NONE;
  }
  return { cleared, fired, latik };
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
        if (sp !== NONE) { const at = placeFor(g, gr, sp, prefer); made.push([at, sp === LAHAT ? BILAO : g.cell[at], sp]); }
      }
    }
    const keep = new Set(made.map((m) => m[0]));
    const out = explode(g, start, keep);
    for (const [i, k, sp] of made) { g.cell[i] = k; g.spec[i] = sp; if (g.latik[i]) { g.latik[i]--; out.latik.push([i, g.latik[i]]); } }
    const points = out.cleared.length * POINTS.piece * step + out.fired.length * POINTS.fired + out.latik.length * POINTS.latik;
    g.score += points;
    const falls = gravity(g), spawns = refill(g);
    ev.push({ type: 'step', step, ...out, made, falls, spawns, points });
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
  g.moves--; g.turn++;
  ev.push({ type: 'swap', a, b });
  settle(g, ev, [b, a], combo ? comboCells(g, a, b, ev) : null);
  after(g, ev);
  return { ok: true, events: ev };
}

function after(g, ev) {
  if (goalsMet(g)) { ubos(g, ev); return; }
  if (g.moves <= 0) { g.phase = 'lost'; ev.push({ type: 'end', won: false, stars: 0, score: g.score }); return; }
  if (!findMoves(g).length) { shuffle(g); ev.push({ type: 'shuffle', cell: Array.from(g.cell), spec: Array.from(g.spec) }); }
}
```

And replace the `_t` line at the bottom with:

```js
export const _t = { wouldRun, shuffle, pickKind, gravity, refill };
```

Task 3 supplies `specialFor`, `placeFor`, `blast`, `comboCells`, and Task 4 supplies `ubos`. So that this task's tests run on their own, add these temporary minimal versions now. They are **replaced** in Tasks 3 and 4:

```js
function specialFor() { return NONE; }
function placeFor(g, gr) { return [...gr.cells][0]; }
function blast() { return []; }
function comboCells(g, a, b) { return [a, b]; }
function ubos(g, ev) { g.won = g.score >= g.stars[2] ? 3 : g.score >= g.stars[1] ? 2 : 1; g.phase = 'won'; ev.push({ type: 'end', won: true, stars: g.won, score: g.score }); }
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/game.test.mjs`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/game.mjs test/game.test.mjs
git commit -m "Rules: a move clears, falls, refills, scores, and ends the level

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Specials and combos

**Files:**
- Modify: `src/game.mjs` (replace the temporary `specialFor`, `placeFor`, `blast`, `comboCells`)
- Test: `test/game.test.mjs` (append)

**Interfaces:**
- Produces: a new event `{type:'combo', a, b, specs:[specAtB, specAtA]}`, emitted before step 1 of a special-with-special or Bilao swap.
- Special rules (from the spec):
  - 4 in a line → SANDOK (H if the line is horizontal), clears that row or column.
  - L/T → KALDERO, 3×3.
  - 5 in a line → LAHAT (cell kind BILAO). When set off by a blast it clears the most common kakanin (ties go to the lowest id).
  - **Placement:** the swapped cell if it's in the group; a KALDERO goes at the corner where its runs cross; otherwise the run's second cell.
  - **Combos** are centred on b (where the dragged piece lands):
    - SANDOK+SANDOK: a cross
    - SANDOK+KALDERO: 3 rows and 3 columns
    - KALDERO+KALDERO: 5×5
    - LAHAT+normal kind k: every k
    - LAHAT+special of kind k: every k becomes that special (SANDOK orientation by `rand`), then all fire
    - LAHAT+LAHAT: the whole board

- [ ] **Step 1: Append the failing tests**

```js
import { SANDOK_H, SANDOK_V, KALDERO } from '../src/game.mjs';
const stepOf = (r, n = 1) => r.events.filter((e) => e.type === 'step')[n - 1];
function triggerSpecial(g, i) {
  for (const [a, b] of findMoves(g)) {
    const t = clone(g), r = swap(t, a, b);
    const s = r.events.find((e) => e.type === 'step');
    if (s && s.fired.some(([j]) => j === i)) return { r, s, a, b };
  }
  return null;
}
const sorted = (a) => [...a].sort((x, y) => x - y);

test('four in a row makes a Sandok where you swapped; a row Sandok clears its row', () => {
  const g = setBoard(createGame(L({ w: 6, h: 5 })), ['kpppbu', 'pkbumk', 'bumkbs', 'umkbsu', 'mkbsum']);
  const s = stepOf(swap(g, 0, 6)); // the puto at 6 moves up to 0: four puto in row 0
  assert.deepEqual(s.made, [[0, 0, SANDOK_H]]);
  assert.equal(s.cleared.length, 3);
  const h = setBoard(createGame(L({ w: 6, h: 5 })), ['kbumkb', 'bumkbs', 'pkpbum', 'kpukbs', 'mkbsum']);
  h.spec[14] = SANDOK_H; // the puto at (2,2)
  const s2 = stepOf(swap(h, 13, 19)); // the puto at (1,3) moves up to (1,2): puto at 12,13,14
  assert.deepEqual(s2.fired, [[14, SANDOK_H]]);
  assert.deepEqual(sorted(s2.cleared.map((c) => c[0])), [12, 13, 14, 15, 16, 17]);
});

test('four in a column makes a column Sandok', () => {
  const g = setBoard(createGame(L({ w: 5, h: 6 })), ['pkbum', 'pubkm', 'kpmus', 'pmkub', 'bkusm', 'mbkus']);
  // column 0 reads p p k p; the puto at (1,2) moves left into (0,2): column 0 = p p p p
  const s = stepOf(swap(g, 10, 11));
  assert.deepEqual(s.made, [[10, 0, SANDOK_V]]);
});

test('an L makes a Kaldero at the corner; a Kaldero bursts 3x3', () => {
  const g = setBoard(createGame(L()), ['pkbum', 'pubkm', 'kppsb', 'pbmus', 'bmkub']);
  const s = stepOf(swap(g, 10, 15)); // column 0 rows 0-2 and row 2 cols 0-2 become puto: an L cornered at 10
  assert.deepEqual(s.made, [[10, 0, KALDERO]]);
  assert.equal(s.cleared.length, 4);
  const h = createGame(L({ w: 7, h: 7, kinds: KAKANIN.slice(0, 4), seed: 3 }));
  h.spec[24] = KALDERO; // the middle cell (3,3)
  const t = triggerSpecial(h, 24);
  assert.ok(t, 'some move sets the Kaldero off');
  // every cell of the 3x3 is cleared, or became a new special made by the triggering match
  for (const i of [16, 17, 18, 23, 24, 25, 30, 31, 32]) assert.ok(t.s.cleared.some((c) => c[0] === i) || t.s.made.some((m) => m[0] === i), `cell ${i}`);
});

test('five in a row makes a Bilao ng Lahat; swapped with a kakanin it clears every one of that kind', () => {
  const g = setBoard(createGame(L({ w: 6, h: 4 })), ['ppkppb', 'kbpumk', 'bumkbs', 'umkbsu']);
  const s = stepOf(swap(g, 2, 8)); // the puto at (2,1) moves up: five puto in row 0
  assert.deepEqual(s.made, [[2, BILAO, LAHAT]]);
  const h = setBoard(createGame(L({ w: 5, h: 3 })), ['k*bum', 'bkmuk', 'umkbs']);
  const kut = [...h.cell].map((c, i) => (c === 1 ? i : -1)).filter((i) => i >= 0);
  const r = swap(h, 1, 0); // drag the Bilao onto the kutsinta
  assert.equal(r.ok, true);
  assert.equal(r.events.find((e) => e.type === 'combo').type, 'combo');
  const cleared = stepOf(r).cleared.map((c) => c[0]);
  for (const i of kut) assert.ok(cleared.includes(i === 0 ? 1 : i) || cleared.includes(i), `kutsinta at ${i}`);
});

test('combos: Sandok+Sandok is a cross, Kaldero+Kaldero 5x5, Bilao+Bilao the whole board, Bilao+Sandok turns a kind into Sandoks', () => {
  const base = () => createGame(L({ w: 7, h: 7, kinds: KAKANIN.slice(0, 5), seed: 11 }));
  let g = base(); g.spec[24] = SANDOK_H; g.spec[25] = SANDOK_V;
  let s = stepOf(swap(g, 25, 24)); // the dragged Sandok lands on 24 = (3,3)
  for (let k = 0; k < 7; k++) { assert.ok(s.cleared.some((c) => c[0] === 21 + k), `row cell ${k}`); assert.ok(s.cleared.some((c) => c[0] === 3 + 7 * k), `col cell ${k}`); }
  g = base(); g.spec[24] = KALDERO; g.spec[25] = KALDERO;
  s = stepOf(swap(g, 25, 24));
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) assert.ok(s.cleared.some((c) => c[0] === 24 + dy * 7 + dx));
  g = base(); g.cell[24] = BILAO; g.spec[24] = LAHAT; g.cell[25] = BILAO; g.spec[25] = LAHAT;
  s = stepOf(swap(g, 25, 24));
  assert.equal(s.cleared.length, 49);
  g = base(); const k = g.cell[25]; g.spec[25] = SANDOK_H; g.cell[24] = BILAO; g.spec[24] = LAHAT;
  const before = [...g.cell].filter((c) => c === k).length;
  s = stepOf(swap(g, 24, 25));
  assert.ok(s.fired.length >= before, 'every piece of that kind went off as a Sandok');
});
```

`triggerSpecial` finds a real move that sets a given special off, so tests never hand-place a trigger. The hand-built boards above are checked by running them (see the plan's verification note).

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/game.test.mjs`
Expected: FAIL. `made` is `[]` (`specialFor` still returns NONE).

- [ ] **Step 3: Replace the temporary functions in `src/game.mjs`**

```js
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
    for (const r of gr.runs) if (r.dir === 'v') for (const c of r.cells) if (h.has(c) && g.spec[c] === NONE) return c;
  }
  for (const c of prefer) if (gr.cells.has(c) && g.spec[c] === NONE) return c;
  const long = gr.runs.reduce((a, r) => (r.cells.length > a.cells.length ? r : a));
  for (const c of [long.cells[1], ...long.cells]) if (g.spec[c] === NONE) return c;
  return long.cells[1];
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
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/game.test.mjs`
Expected: PASS, 18 tests. If a hand-built board fails, print it with
`console.log([...g.cell].join(''))` and fix the **board**, not the rules. The rules above match the spec.

- [ ] **Step 5: Commit**

```bash
git add src/game.mjs test/game.test.mjs
git commit -m "Rules: Sandok, Kaldero, Bilao ng Lahat and their combos

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Latik, Ubos-Benta, shuffle, hint

**Files:**
- Modify: `src/game.mjs` (replace the temporary `ubos`)
- Test: `test/game.test.mjs` (append)

**Interfaces:**
- Produces:
  - `{type:'ubos', moves}` and `{type:'ubosMake', made:[[i,kind,spec]]}`: Ubos-Benta, followed by its `step` events and `{type:'end', won:true, stars, score}`
  - `{type:'shuffle', cell:number[], spec:number[]}`
  - `hint(g)` (already exported in Task 1)

- [ ] **Step 1: Append the failing tests**

```js
import { hint } from '../src/game.mjs';

test('a match on latik cleans one layer; the latik goal counts layers', () => {
  const lv = L({ latik: ['..2..', '.....', '.....', '.....', '.....'], goals: [{ type: 'latik' }] });
  const g = setBoard(createGame(lv), ['kppbu', 'pkbum', 'bumkb', 'umkbs', 'mkbsu']);
  assert.equal(g.goals[0].need, 2);
  const s = stepOf(swap(g, 0, 5)); // puto at 0,1,2: cell 2 has latik 2
  assert.deepEqual(s.latik, [[2, 1]]);
  assert.equal(g.goals[0].got, 1);
  assert.equal(g.latik[2], 1);
});

test('Ubos-Benta: leftover moves become Sandoks that go off, then the stars are counted', () => {
  const g = setBoard(createGame(L({ moves: 6, stars: [1, 900, 1e9], goals: [{ type: 'collect', kind: 'puto', n: 3 }] })), ['kppbu', 'pkbum', 'bumkb', 'umkbs', 'mkbsu']);
  const r = swap(g, 0, 5);
  const u = r.events.find((e) => e.type === 'ubosMake');
  assert.equal(u.made.length, 5);
  assert.ok(u.made.every(([, , sp]) => sp === SANDOK_H || sp === SANDOK_V));
  assert.equal(g.moves, 0);
  assert.equal(g.phase, 'won');
  assert.equal(r.events.at(-1).type, 'end');
  assert.equal(g.won, g.score >= 900 ? 2 : 1);
  assert.ok(!g.spec.some((s) => s === SANDOK_H || s === SANDOK_V), 'every Sandok went off');
});

test('a board with no move is shuffled into a fair one, keeping its kakanin', () => {
  const g = setBoard(createGame(L({ w: 4, h: 4, kinds: ['puto', 'kutsinta', 'sapin', 'bibingka'] })), ['pkpk', 'sbsb', 'pkpk', 'sbsb']);
  assert.equal(findMoves(g).length, 0);
  const before = [...g.cell].sort().join('');
  _t.shuffle(g);
  assert.ok(findMoves(g).length > 0);
  assert.equal(findGroups(g).length, 0);
  assert.equal([...g.cell].sort().join(''), before);
});

test('hint is a real move, or null on a still board', () => {
  const g = createGame(L({ w: 7, h: 7, seed: 5 }));
  const h = hint(g);
  assert.ok(h && swap(clone(g), ...h).ok);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/game.test.mjs`
Expected: FAIL in the Ubos-Benta test (no `ubosMake` event).

- [ ] **Step 3: Replace the temporary `ubos` in `src/game.mjs`**

```js
// Ubos-Benta! Every move left turns a plain kakanin into a Sandok, and they all go off.
function ubos(g, ev) {
  ev.push({ type: 'ubos', moves: g.moves });
  const made = [];
  while (g.moves > 0) {
    const plain = [];
    for (let j = 0; j < g.cell.length; j++) if (g.mask[j] && g.cell[j] >= 0 && g.cell[j] < BILAO && g.spec[j] === NONE) plain.push(j);
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
```

(The rounds loop sets off specials a cascade creates during Ubos-Benta too, so the finished board holds none.)

- [ ] **Step 4: Run the tests**

Run: `node --test test/game.test.mjs`
Expected: PASS, 22 tests.

- [ ] **Step 5: Commit**

```bash
git add src/game.mjs test/game.test.mjs
git commit -m "Rules: latik, Ubos-Benta, shuffle and hints

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: San Roque's 15 levels

**Files:**
- Create: `src/levels.mjs`, `test/levels.test.mjs`

**Interfaces:**
- Consumes: `createGame`, `findGroups`, `findMoves`, `KAKANIN` from Task 1.
- Produces:
  - `TOWN = { id:'san-roque', name:'San Roque', time:'golden' }`
  - `LEVELS: Level[15]`, with ids `'sr-01'` … `'sr-15'`
  - `validateLevel(level) → string[]`: the problems found, an empty list when the level is fine

- [ ] **Step 1: Write the failing test** `test/levels.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, TOWN, validateLevel } from '../src/levels.mjs';
import { createGame, findGroups, findMoves } from '../src/game.mjs';

test('San Roque has 15 valid levels with unique ids', () => {
  assert.equal(TOWN.name, 'San Roque');
  assert.equal(LEVELS.length, 15);
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, 15);
  for (const lv of LEVELS) assert.deepEqual(validateLevel(lv), [], lv.id);
});

test('every level starts still and playable for many seeds', () => {
  for (const lv of LEVELS) for (let s = 1; s <= 20; s++) {
    const g = createGame(lv, s);
    assert.equal(findGroups(g).length, 0, `${lv.id} seed ${s}`);
    assert.ok(findMoves(g).length > 0, `${lv.id} seed ${s}`);
  }
});

test('validateLevel catches broken data', () => {
  const ok = LEVELS[0];
  assert.ok(validateLevel({ ...ok, kinds: ['puto', 'adobo'] }).length);
  assert.ok(validateLevel({ ...ok, stars: [3, 2, 1] }).length);
  assert.ok(validateLevel({ ...ok, mask: ['###'] }).length);
  assert.ok(validateLevel({ ...ok, goals: [{ type: 'collect', kind: 'suman', n: 5 }], kinds: ['puto', 'kutsinta', 'sapin', 'bibingka'] }).length);
  assert.ok(validateLevel({ ...ok, goals: [{ type: 'latik' }] }).length, 'a latik goal needs latik');
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test test/levels.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/levels.mjs`**

The star thresholds and move counts below are starting values; Task 6 calibrates them with the bot and edits this file.

```js
// Town 1, San Roque: a sari-sari street at golden hour. 15 levels that teach the game: plain collecting,
// then specials, then latik (the town's new blocker), then everything together. Each level is data; the
// rules (game.mjs) build the board from it. Masks: '#' a cell, '.' a hole. Latik: '1'-'9' layers.
import { KAKANIN } from './game.mjs';

export const TOWN = { id: 'san-roque', name: 'San Roque', time: 'golden' };

const K4 = ['puto', 'kutsinta', 'sapin', 'bibingka'];
const K5 = [...K4, 'ube'];
const K6 = [...K5, 'suman'];
const BILAO9 = ['..#####..', '.#######.', '#########', '#########', '#########', '#########', '#########', '.#######.', '..#####..'];
const RING9 = ['#########', '#########', '##.....##', '##.....##', '##.....##', '##.....##', '##.....##', '#########', '#########'];
const HOLE9 = ['#########', '#########', '#########', '###...###', '###...###', '###...###', '#########', '#########', '#########'];
const lat = (rows) => rows;

export const LEVELS = [
  { id: 'sr-01', name: 'Unang Benta', w: 7, h: 7, kinds: K4, moves: 18, goals: [{ type: 'collect', kind: 'puto', n: 12 }], stars: [1, 2600, 4200], seed: 101,
    tip: 'Ipagpalit ang dalawang magkatabi para makabuo ng tatlo!' },
  { id: 'sr-02', name: 'Merienda ng Barangay', w: 7, h: 7, kinds: K4, moves: 20, goals: [{ type: 'collect', kind: 'kutsinta', n: 15 }, { type: 'collect', kind: 'sapin', n: 10 }], stars: [1, 3600, 5600], seed: 102,
    tip: 'Apat na magkakasunod: may Sandok ka! Isang buong hanay ang malilinis.' },
  { id: 'sr-03', name: 'Puntos para kay Lola', w: 8, h: 8, kinds: K5, moves: 20, goals: [{ type: 'score', n: 5000 }], stars: [1, 6500, 9000], seed: 103,
    tip: 'Hugis L o T: Kaldero! Sasabog ang paligid nito.' },
  { id: 'sr-04', name: 'Bibingka sa Hapon', w: 8, h: 8, kinds: K5, moves: 22, goals: [{ type: 'collect', kind: 'bibingka', n: 22 }], stars: [1, 5200, 7800], seed: 104,
    tip: 'Limang magkakasunod: Bilao ng Lahat! Ipalit sa kahit ano.' },
  { id: 'sr-05', name: 'Latik sa Bilao', w: 8, h: 8, kinds: K5, moves: 22, goals: [{ type: 'latik' }], stars: [1, 6000, 9000], seed: 105,
    latik: lat(['........', '........', '..1111..', '..1111..', '..1111..', '..1111..', '........', '........']),
    tip: 'May latik na dumikit! Bumuo ng tugma sa ibabaw nito para linisin.' },
  { id: 'sr-06', name: 'Bilog na Bilao', w: 9, h: 9, mask: BILAO9, kinds: K5, moves: 24, goals: [{ type: 'collect', kind: 'ube', n: 20 }, { type: 'collect', kind: 'puto', n: 20 }], stars: [1, 7000, 10500], seed: 106 },
  { id: 'sr-07', name: 'Hanay ng Latik', w: 9, h: 9, kinds: K5, moves: 24, goals: [{ type: 'latik' }], stars: [1, 8000, 12000], seed: 107,
    latik: lat(['.........', '.........', '111111111', '.........', '111111111', '.........', '111111111', '.........', '.........']) },
  { id: 'sr-08', name: 'Butas sa Gitna', w: 9, h: 9, mask: HOLE9, kinds: K6, moves: 26, goals: [{ type: 'collect', kind: 'suman', n: 18 }], stars: [1, 7000, 11000], seed: 108,
    tip: 'Dumating na ang suman! Anim na kakanin na ang nasa bilao.' },
  { id: 'sr-09', name: 'Makapal na Latik', w: 9, h: 9, kinds: K5, moves: 26, goals: [{ type: 'latik' }], stars: [1, 9000, 13000], seed: 109,
    latik: lat(['22.....22', '22.....22', '.........', '.........', '.........', '.........', '.........', '22.....22', '22.....22']),
    tip: 'Dalawang patong ng latik: dalawang beses itong lilinisin.' },
  { id: 'sr-10', name: 'Pista ng Puntos', w: 9, h: 9, kinds: K6, moves: 25, goals: [{ type: 'score', n: 15000 }], stars: [1, 19000, 24000], seed: 110 },
  { id: 'sr-11', name: 'Bilao na may Latik', w: 9, h: 9, mask: BILAO9, kinds: K6, moves: 28, goals: [{ type: 'latik' }, { type: 'collect', kind: 'sapin', n: 18 }], stars: [1, 10000, 15000], seed: 111,
    latik: lat(['.........', '.........', '..11111..', '..12221..', '..12221..', '..12221..', '..11111..', '.........', '.........']) },
  { id: 'sr-12', name: 'Paikot', w: 9, h: 9, mask: RING9, kinds: K5, moves: 26, goals: [{ type: 'collect', kind: 'kutsinta', n: 28 }], stars: [1, 6500, 9500], seed: 112 },
  { id: 'sr-13', name: 'Latik Kahit Saan', w: 9, h: 9, kinds: K6, moves: 30, goals: [{ type: 'latik' }], stars: [1, 13000, 19000], seed: 113,
    latik: lat(['.........', '.2222222.', '.2.....2.', '.2.111.2.', '.2.111.2.', '.2.111.2.', '.2.....2.', '.2222222.', '.........']) },
  { id: 'sr-14', name: 'Dalawang Order', w: 9, h: 9, kinds: K6, moves: 24, goals: [{ type: 'collect', kind: 'bibingka', n: 24 }, { type: 'collect', kind: 'ube', n: 24 }], stars: [1, 9000, 13500], seed: 114 },
  { id: 'sr-15', name: 'Pista ng San Roque', w: 9, h: 9, mask: BILAO9, kinds: K6, moves: 30, goals: [{ type: 'latik' }, { type: 'collect', kind: 'puto', n: 25 }, { type: 'collect', kind: 'suman', n: 20 }], stars: [1, 14000, 20000], seed: 115,
    latik: lat(['.........', '.........', '.........', '.111111..', '.122221..', '.111111..', '.........', '.........', '.........']),
    tip: 'Ang huling bilao ng San Roque! Ipakita kay Lola ang galing mo.' },
];

export function validateLevel(lv) {
  const bad = [];
  const rows = (r, what) => {
    if (!Array.isArray(r) || r.length !== lv.h || r.some((s) => typeof s !== 'string' || s.length !== lv.w)) bad.push(`${what} must be ${lv.h} strings of ${lv.w}`);
  };
  if (!(lv.w >= 5 && lv.w <= 9 && lv.h >= 5 && lv.h <= 9)) bad.push('size 5..9');
  if (lv.mask) rows(lv.mask, 'mask');
  if (lv.latik) rows(lv.latik, 'latik');
  if (!Array.isArray(lv.kinds) || lv.kinds.length < 4 || lv.kinds.length > 6 || lv.kinds.some((k) => !KAKANIN.includes(k))) bad.push('kinds: 4..6 known kakanin');
  if (!(lv.moves > 0)) bad.push('moves');
  if (!Array.isArray(lv.stars) || lv.stars.length !== 3 || !(lv.stars[0] <= lv.stars[1] && lv.stars[1] < lv.stars[2])) bad.push('stars ascending');
  if (!Array.isArray(lv.goals) || !lv.goals.length) bad.push('goals');
  for (const q of lv.goals || []) {
    if (q.type === 'collect' && (!lv.kinds?.includes(q.kind) || !(q.n > 0))) bad.push(`collect ${q.kind}`);
    if (q.type === 'score' && !(q.n > 0)) bad.push('score n');
    if (q.type === 'latik' && !(lv.latik && lv.latik.join('').match(/[1-9]/))) bad.push('latik goal without latik');
    if (!['collect', 'score', 'latik'].includes(q.type)) bad.push(`goal type ${q.type}`);
  }
  if (lv.latik && lv.mask && lv.latik.some((r, y) => [...r].some((c, x) => c !== '.' && lv.mask[y]?.[x] !== '#'))) bad.push('latik on a hole');
  const cells = lv.mask ? lv.mask.join('').split('').filter((c) => c === '#').length : lv.w * lv.h;
  if (cells < 25) bad.push('too few cells');
  return bad;
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/levels.test.mjs`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/levels.mjs test/levels.test.mjs
git commit -m "San Roque: the 15 levels of town 1, and level validation

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The bot, balance and calibrated levels

**Files:**
- Create: `src/bot.mjs`, `tools/balance.mjs`, `test/balance.test.mjs`
- Modify: `src/levels.mjs` (moves and star numbers only, per the calibration step)

**Interfaces:**
- Consumes: `createGame`, `swap`, `findMoves`, `clone`, `goalsMet`, `SANDOK_H`…`LAHAT` from Tasks 1–4; `LEVELS` from Task 5.
- Produces:
  - `chooseMove(g) → [a,b] | null`
  - `playLevel(level, seed) → { won: boolean, stars: 0..3, score, movesLeft }`
- The bot clones the state, so it sees the real refills. That makes it a little better than a person. It's documented as a known bias, and the targets account for it.

- [ ] **Step 1: Write the failing test** `test/balance.test.mjs`

```js
// Balance floors from the bot. It sees real refills, so it plays a little better than a person;
// the bands below are set with that in mind (spec: early levels near-certain, the town's end harder).
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels.mjs';
import { playLevel } from '../src/bot.mjs';

const RUNS = 12;
const band = (n) => (n <= 5 ? [0.9, 1] : n <= 10 ? [0.75, 1] : [0.5, 0.95]);

for (const [k, lv] of LEVELS.entries()) {
  test(`${lv.id} ${lv.name}: win rate in band, 3 stars reachable`, () => {
    const runs = Array.from({ length: RUNS }, (_, s) => playLevel(lv, 1000 + s * 7));
    const rate = runs.filter((r) => r.won).length / RUNS;
    const [lo, hi] = band(k + 1);
    assert.ok(rate >= lo && rate <= hi, `win rate ${rate} not in [${lo}, ${hi}]`);
    assert.ok(runs.some((r) => r.stars === 3), 'no run got 3 stars');
  });
}
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test test/balance.test.mjs`
Expected: FAIL, `../src/bot.mjs` not found.

- [ ] **Step 3: Write `src/bot.mjs`**

```js
// A decent player for the balance tests and the title demo: it tries every legal swap on a copy of the
// game and keeps the one that helps the goals most. It sees the real refills (the copy carries the RNG),
// so it plays a little better than a person; the balance bands allow for that.
import { createGame, swap, findMoves, clone, NONE, BILAO } from './game.mjs';

function value(g) {
  if (g.phase === 'won') return 1e9 + g.score;
  let v = 0;
  for (const q of g.goals) v += (Math.min(q.got, q.need) / q.need) * 10000;
  v += g.score / 20;
  for (let i = 0; i < g.spec.length; i++) if (g.spec[i] !== NONE) v += g.cell[i] === BILAO ? 900 : 400;
  return v;
}

export function chooseMove(g) {
  let best = null, bv = -Infinity;
  for (const [a, b] of findMoves(g)) {
    const t = clone(g);
    if (!swap(t, a, b).ok) continue;
    const v = value(t);
    if (v > bv) { bv = v; best = [a, b]; }
  }
  return best;
}

export function playLevel(level, seed = level.seed) {
  const g = createGame(level, seed);
  let movesLeft = 0; // counted when the order is done, before Ubos-Benta spends them
  for (let guard = 0; guard < 500 && g.phase === 'play'; guard++) {
    const mv = chooseMove(g);
    if (!mv) break;
    const u = swap(g, ...mv).events.find((e) => e.type === 'ubos');
    if (u) movesLeft = u.moves;
  }
  return { won: g.phase === 'won', stars: g.won, score: g.score, movesLeft };
}
```

- [ ] **Step 4: Write `tools/balance.mjs`**

```js
// node tools/balance.mjs [runs=40] [levelId]: per level, the bot's win rate, star spread and score
// percentiles, with suggested star thresholds (2 stars ≈ the median winning score, 3 ≈ the 80th).
import { LEVELS } from '../src/levels.mjs';
import { playLevel } from '../src/bot.mjs';

const runs = Number(process.argv[2] || 40), only = process.argv[3];
for (const lv of LEVELS) {
  if (only && lv.id !== only) continue;
  const t0 = performance.now();
  const rs = Array.from({ length: runs }, (_, s) => playLevel(lv, 1000 + s * 7));
  const wins = rs.filter((r) => r.won), sc = wins.map((r) => r.score).sort((a, b) => a - b);
  const pct = (p) => (sc.length ? sc[Math.min(sc.length - 1, Math.floor(p * sc.length))] : 0);
  const stars = [0, 1, 2, 3].map((n) => rs.filter((r) => r.stars === n).length);
  console.log(`${lv.id} ${lv.name.padEnd(22)} win ${(wins.length / runs * 100).toFixed(0).padStart(3)}%  stars ${stars.join('/')}  moves left avg ${(wins.reduce((a, r) => a + r.movesLeft, 0) / Math.max(1, wins.length)).toFixed(1)}  score p50 ${pct(0.5)} p80 ${pct(0.8)}  → stars [1, ${Math.round(pct(0.5) / 100) * 100}, ${Math.round(pct(0.8) / 100) * 100}]  (${((performance.now() - t0) / runs).toFixed(0)} ms/run)`);
}
```

- [ ] **Step 5: Calibrate the levels**

Run: `node tools/balance.mjs 40`

For each level, compare the win rate with the band: levels 1–5 at 90–100%, 6–10 at 75–100%, 11–15 at 50–95% (aim for 60–85% in that last group). Then change **only that level's `moves`**:
- If the win rate is above the band (only possible for 11–15), lower `moves` by 2.
- If it's below the band, raise `moves` by 2.
- Re-run that one level with `node tools/balance.mjs 40 sr-NN` until it's inside.

Then set each level's `stars` to the suggested `[1, p50, p80]` the tool prints, rounded to hundreds. 3 stars must stay reachable: the tool's star spread must show at least one 3.

Record the final table in the commit message.

- [ ] **Step 6: Run the tests**

Run: `node --test test/`
Expected: PASS: 22 game + 3 levels + 15 balance. The balance file takes under 60 s; if it's slower, set `RUNS = 8`.

- [ ] **Step 7: Commit**

```bash
git add src/bot.mjs tools/balance.mjs test/balance.test.mjs src/levels.mjs
git commit -m "Bot and balance: every San Roque level checked and calibrated

<paste the final balance table here>

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Saves

**Files:**
- Create: `src/progress.mjs`, `test/progress.test.mjs`

**Interfaces:**
- Consumes: `LEVELS` (ids, order).
- Produces:
  - `KEY = 'kakanin.v1'`
  - `fresh() → Save`
  - `load(storage) → Save`
  - `save(storage, data) → void`
  - `record(data, id, stars, score) → Save` (a new object; it never lowers stars or best)
  - `isUnlocked(data, index) → boolean`
  - `totalStars(data) → number`
- `Save = { v: 1, stars: { [levelId]: 0..3 }, best: { [levelId]: number }, muted: boolean, calm: boolean, hints: string[] }`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEY, fresh, load, save, record, isUnlocked, totalStars } from '../src/progress.mjs';
import { LEVELS } from '../src/levels.mjs';

const mem = (init = {}) => { const m = { ...init }; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };
const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };

test('a missing, corrupt or foreign save loads as fresh or cleaned', () => {
  assert.deepEqual(load(mem()), fresh());
  assert.deepEqual(load(mem({ [KEY]: '{oops' })), fresh());
  assert.deepEqual(load(broken), fresh());
  const odd = load(mem({ [KEY]: JSON.stringify({ v: 1, stars: { 'sr-01': 3, 'sr-02': 9, 'old-level': 2, 'sr-03': 'x' }, best: { 'sr-01': -5, 'sr-02': 1200 }, muted: 'yes', hints: [1, 'tap'] }) }));
  assert.deepEqual(odd.stars, { 'sr-01': 3, 'sr-02': 3 });
  assert.deepEqual(odd.best, { 'sr-02': 1200 });
  assert.equal(odd.muted, false);
  assert.deepEqual(odd.hints, ['tap']);
});

test('record keeps the best, unlocks the next level, and saving survives a broken storage', () => {
  let d = fresh();
  assert.ok(isUnlocked(d, 0)); assert.ok(!isUnlocked(d, 1));
  d = record(d, 'sr-01', 2, 3000);
  d = record(d, 'sr-01', 1, 2000);
  assert.equal(d.stars['sr-01'], 2); assert.equal(d.best['sr-01'], 3000);
  assert.ok(isUnlocked(d, 1));
  assert.equal(totalStars(d), 2);
  const s = mem(); save(s, d); assert.deepEqual(load(s), d);
  assert.doesNotThrow(() => save(broken, d));
  assert.equal(LEVELS[1].id, 'sr-02');
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test test/progress.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/progress.mjs`**

```js
// Saves: stars and best scores per level, sound and motion settings, hints already shown. Everything in
// one localStorage entry; every access is guarded, and anything odd in it is dropped, not trusted.
import { LEVELS } from './levels.mjs';

export const KEY = 'kakanin.v1';
const IDS = new Set(LEVELS.map((l) => l.id));
export const fresh = () => ({ v: 1, stars: {}, best: {}, muted: false, calm: false, hints: [] });

function clean(v) {
  const d = fresh();
  if (!v || typeof v !== 'object') return d;
  for (const [id, n] of Object.entries(v.stars || {})) if (IDS.has(id) && Number.isFinite(n) && n > 0) d.stars[id] = Math.min(3, Math.floor(n));
  for (const [id, n] of Object.entries(v.best || {})) if (IDS.has(id) && Number.isFinite(n) && n > 0) d.best[id] = Math.floor(n);
  d.muted = v.muted === true; d.calm = v.calm === true;
  if (Array.isArray(v.hints)) d.hints = v.hints.filter((h) => typeof h === 'string').slice(0, 50);
  return d;
}

export function load(storage) { try { return clean(JSON.parse(storage.getItem(KEY))); } catch { return fresh(); } }
export function save(storage, data) { try { storage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable: play on */ } }
export function record(data, id, stars, score) {
  return { ...data, stars: { ...data.stars, [id]: Math.max(data.stars[id] || 0, stars) }, best: { ...data.best, [id]: Math.max(data.best[id] || 0, score) } };
}
export const isUnlocked = (data, index) => index === 0 || (data.stars[LEVELS[index - 1]?.id] || 0) > 0;
export const totalStars = (data) => Object.values(data.stars).reduce((a, b) => a + b, 0);
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/progress.test.mjs`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/progress.mjs test/progress.test.mjs
git commit -m "Saves: stars, bests and settings, safe against broken storage

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: The 3D kakanin and the stall scene

**Files:**
- Create: `src/vendor/*` (copied), `src/tex.mjs`, `src/post.mjs` (copied unchanged), `assets/env/*` (copied), `src/kakanin3d.mjs`, `src/stall3d.mjs`, `test/syntax.test.mjs`

**Interfaces:**
- Produces:
  - `kakanin3d.mjs`:
    - `makePiece(kind: 0..6, spec: 0..4) → THREE.Group`, about one cell (1.0) wide, base at y=0. It clones a cached template, sharing geometry and materials.
    - `KCOLOR: string[7]`: a hex colour per kind (index 6 = Bilao), used for particles and the 2D fallback.
    - `MATS`: the shared materials, including `latik`, `leaf`, `weave`, `wood`.
  - `stall3d.mjs`:
    - `buildStall(scene, { base = 'assets/env/', size = 9 }) → { update(t), bilaoRadius, sun }`.
    - It adds the lights, sky, road, houses, stall, banderitas and bulbs, side trays, counter, bilao and table, plus the props (async).
    - The board's cells sit on y=0 around the origin; the bilao top is at y=0.

- [ ] **Step 1: Copy the reused files**

```bash
mkdir -p src/vendor assets/env/sky assets/env/tex assets/env/props tools
H=../hollow-blocks
cp $H/src/vendor/three.module.min.js $H/src/vendor/three-extra.min.js $H/src/vendor/three-fx.min.js $H/src/vendor/three-mocap.min.js $H/src/vendor/THREE-LICENSE src/vendor/
cp $H/src/tex.mjs $H/src/post.mjs src/
cp $H/assets/env/sky/kloppenheim_06_puresky.hdr $H/assets/env/sky/bd_golden.jpg assets/env/sky/
for t in asphalt_02 rusty_corrugated_iron; do cp $H/assets/env/tex/${t}_diff.jpg $H/assets/env/tex/${t}_nor.jpg assets/env/tex/; done
for p in plastic_monobloc_chair_01 plastic_crate_02 small_lpg_tank Barrel_01 wooden_bucket_02; do cp $H/assets/env/props/$p.glb assets/env/props/; done
cp ../bakbakan/tools/cdp.mjs tools/
du -sh assets/env
```

Expected: about 2.0M. `tex.mjs` and `post.mjs` import `./vendor/...`, which matches `src/vendor/`.

- [ ] **Step 2: Write the failing syntax test** `test/syntax.test.mjs`

```js
// Browser-only modules can't run under node, but they must at least parse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('every source module parses', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kc-syntax-'));
  for (const f of readdirSync(new URL('../src', import.meta.url)).filter((f) => f.endsWith('.mjs'))) {
    const p = join(dir, f); writeFileSync(p, readFileSync(new URL(`../src/${f}`, import.meta.url)));
    assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', p]), f);
  }
  for (const f of ['kakanin3d.mjs', 'stall3d.mjs']) assert.ok(readdirSync(new URL('../src', import.meta.url)).includes(f), `${f} exists`);
});
```

Run: `node --test test/syntax.test.mjs`. Expected: FAIL, `kakanin3d.mjs exists`.

- [ ] **Step 3: Write `src/kakanin3d.mjs`**

Port lines 27–100 of the prototype (`.superpowers/brainstorm/98650-1791430228/content/k3d9.js`): the textures, the `M` materials and the six `make*` functions. Change the imports to `./vendor/three.module.min.js`, `./vendor/three-extra.min.js` and `./tex.mjs`. Rename `M` to `MATS`.

Make these refinements the spec asks for:
- `makeUbe` becomes a **llanera** shape: an oval with fluted sides.
- Add the special marks and the Bilao ng Lahat piece.
- Add a template cache.

The whole file:

```js
// The six kakanin as physically based 3D models (ported from the approved look prototype), the marks
// that make a piece a special, and the Bilao ng Lahat. Templates are built once; every board piece is
// a clone that shares their geometry and materials.
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/three-extra.min.js';
import { rng, noise, fbm, paint } from './tex.mjs';

export const KCOLOR = ['#f4ecdc', '#c0561e', '#8a44b8', '#f0b13c', '#6b2f96', '#3f8a3a', '#ffd23f'];
const S = 128;
const tex = (fn, strength = 3) => paint(S, S, fn, { strength });
const lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
const r0 = rng(7), pores = noise(S, S, 2, r0), soft = fbm(S, S, 32, 3, r0);
const putoT = tex((x, y) => { const i = y * S + x, k = 0.94 + (soft[i] - 0.5) * 0.08 - (pores[i] > 0.8 ? 0.12 : 0); return [252 * k, 247 * k, 232 * k, -(pores[i] > 0.8 ? 1 : 0) + soft[i] * 0.3]; }, 2.5);
const kutsT = tex((x, y) => { const i = y * S + x, k = 0.85 + (soft[i] - 0.5) * 0.25; return [196 * k, 92 * k, 36 * k, soft[i] * 0.4]; }, 1.5);
const ubeT = tex((x, y) => { const u = x / S - 0.5, v = y / S - 0.5, a = Math.atan2(v, u), r = Math.hypot(u, v), sw = Math.sin(a * 2 + r * 28); const k = 0.8 + sw * 0.12 + (soft[y * S + x] - 0.5) * 0.15; return [118 * k, 52 * k, 160 * k, sw * 0.3]; }, 2);
const leafT = tex((x, y) => { const vein = Math.abs(Math.sin((y / S) * Math.PI * 22)) > 0.94 ? 1 : 0, k = 0.8 + (soft[y * S + x] - 0.5) * 0.3 - vein * 0.12; return [72 * k, 140 * k, 58 * k, vein * 0.6 + soft[y * S + x] * 0.2]; }, 3);
const bibT = tex((x, y) => { const i = y * S + x, char = soft[i] > 0.66 ? (soft[i] - 0.66) * 3 : 0, k = 1 - char * 0.6; return [240 * k, 176 * k - char * 30, 72 * k, (pores[i] - 0.5) * 0.4]; }, 2.5);
const weaveT = (() => { const f = noise(128, 128, 3, rng(12)); return paint(128, 128, (x, y) => { const over = ((x >> 3) + (y >> 3)) % 2, band = over ? Math.sin(((x % 8) / 8) * Math.PI) : Math.sin(((y % 8) / 8) * Math.PI), k = 0.6 + band * 0.4 + (f[y * 128 + x] - 0.5) * 0.1; return [206 * k, 160 * k, 96 * k, band]; }, { repeat: [22, 22], strength: 3 }); })();
const woodT = (() => { const f = fbm(256, 64, 16, 3, rng(9)); return paint(256, 64, (x, y) => { const g = Math.sin(y * 0.35 + x * 0.02 + f[y * 256 + x] * 5) * 0.5 + 0.5, k = 0.72 + g * 0.1 + (f[y * 256 + x] - 0.5) * 0.12; return [132 * k, 88 * k, 50 * k, g * 0.5]; }, { strength: 1.2 }); })();

export const MATS = {
  puto: new THREE.MeshPhysicalMaterial({ map: putoT.map, normalMap: putoT.normalMap, roughness: 0.75, sheen: 0.4, sheenColor: new THREE.Color('#fff8e8'), sheenRoughness: 0.7, color: '#ece4d2' }),
  cheese: new THREE.MeshPhysicalMaterial({ color: '#f5c242', roughness: 0.45, clearcoat: 0.4 }),
  kuts: new THREE.MeshPhysicalMaterial({ map: kutsT.map, normalMap: kutsT.normalMap, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
  coco: new THREE.MeshStandardMaterial({ color: '#fbf8f0', roughness: 0.8 }),
  ube: new THREE.MeshPhysicalMaterial({ map: ubeT.map, normalMap: ubeT.normalMap, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12 }),
  leaf: new THREE.MeshPhysicalMaterial({ map: leafT.map, normalMap: leafT.normalMap, roughness: 0.35, clearcoat: 0.6, side: THREE.DoubleSide }),
  bib: new THREE.MeshStandardMaterial({ map: bibT.map, normalMap: bibT.normalMap, roughness: 0.7 }),
  egg: new THREE.MeshPhysicalMaterial({ color: '#e4582f', roughness: 0.3, clearcoat: 0.5 }),
  kesong: new THREE.MeshStandardMaterial({ color: '#f6f2e6', roughness: 0.6 }),
  layer: ['#7a3aa8', '#f2c230', '#f7f0e2'].map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 })),
  latikBits: new THREE.MeshStandardMaterial({ color: '#8a4a1c', roughness: 0.6 }),
  latik: new THREE.MeshPhysicalMaterial({ color: '#7a3e14', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.92 }),
  tie: new THREE.MeshStandardMaterial({ color: '#d8b77a', roughness: 0.8 }),
  weave: new THREE.MeshStandardMaterial({ map: weaveT.map, normalMap: weaveT.normalMap, roughness: 0.85, side: THREE.DoubleSide }),
  wood: new THREE.MeshStandardMaterial({ map: woodT.map, normalMap: woodT.normalMap, roughness: 0.6 }),
  ladle: new THREE.MeshPhysicalMaterial({ color: '#b07a3e', roughness: 0.4, clearcoat: 0.5 }),
  pot: new THREE.MeshStandardMaterial({ color: '#3a3a40', roughness: 0.3, metalness: 0.85 }),
  glow: new THREE.MeshBasicMaterial({ color: '#ffe98a', transparent: true, opacity: 0.55, depthWrite: false }),
};
const M = MATS;

function makePuto() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lathe([[0, 0], [0.36, 0], [0.4, 0.06], [0.4, 0.14], [0.36, 0.28], [0.26, 0.38], [0.12, 0.43], [0, 0.44]]), M.puto));
  const ch = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.05, 0.12, 2, 0.015), M.cheese); ch.position.y = 0.45; ch.rotation.y = 0.4; g.add(ch);
  return g;
}
function makeKutsinta() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lathe([[0, 0], [0.36, 0], [0.42, 0.06], [0.42, 0.2], [0.36, 0.28], [0.22, 0.27], [0.12, 0.22], [0, 0.21]]), M.kuts));
  const r = rng(5), shred = new THREE.BoxGeometry(0.1, 0.012, 0.018);
  for (let k = 0; k < 14; k++) { const s = new THREE.Mesh(shred, M.coco); const a = r() * 6.28, d = r() * 0.22; s.position.set(Math.cos(a) * d, 0.27 + r() * 0.02, Math.sin(a) * d); s.rotation.set(r(), r() * 3, r()); g.add(s); }
  return g;
}
function makeSapin() {
  const g = new THREE.Group();
  M.layer.forEach((m, i) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.15, 0.66, 3, 0.05), m); b.position.y = 0.075 + (2 - i) * 0.14; g.add(b); });
  const r = rng(8), crumb = new THREE.DodecahedronGeometry(0.03);
  for (let k = 0; k < 16; k++) { const c = new THREE.Mesh(crumb, M.latikBits); c.position.set((r() - 0.5) * 0.5, 0.43, (r() - 0.5) * 0.5); g.add(c); }
  g.rotation.y = 0.2;
  return g;
}
function makeBibingka() {
  const g = new THREE.Group();
  const leaf = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.02, 40), M.leaf); leaf.position.y = 0.01; g.add(leaf);
  g.add(new THREE.Mesh(lathe([[0, 0.02], [0.36, 0.02], [0.39, 0.06], [0.39, 0.15], [0.34, 0.2], [0, 0.21]]), M.bib));
  const egg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 24, 1, false, 0, Math.PI), M.egg); egg.position.set(0.06, 0.22, -0.04); egg.rotation.y = 0.6; g.add(egg);
  const k = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.04, 0.1, 2, 0.01), M.kesong); k.position.set(-0.13, 0.22, 0.1); g.add(k);
  return g;
}
// ube halaya in its llanera: an oval with fluted sides and a glossy swirled top
function makeUbe() {
  const g = new THREE.Group();
  const geo = lathe([[0, 0], [0.4, 0], [0.42, 0.04], [0.4, 0.22], [0.34, 0.27], [0, 0.29]], 48);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z); const f = 1 + Math.sin(a * 16) * 0.035 * Math.min(1, p.getY(i) * 6); p.setX(i, Math.cos(a) * r * f * 1.12); p.setZ(i, Math.sin(a) * r * f * 0.88); }
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, M.ube));
  return g;
}
function makeSuman() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.5, 8, 24), M.leaf); body.rotation.z = Math.PI / 2; body.position.y = 0.18; g.add(body);
  for (const x of [-0.16, 0.16]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.018, 8, 32), M.tie); t.rotation.y = Math.PI / 2; t.position.set(x, 0.18, 0); g.add(t); }
  g.rotation.y = -0.6;
  return g;
}
// the Bilao ng Lahat: a little glowing bilao holding a bit of every kakanin
function makeLahat() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lathe([[0, 0], [0.38, 0], [0.44, 0.1], [0.42, 0.12], [0.36, 0.04], [0, 0.04]]), M.weave));
  const dot = new THREE.SphereGeometry(0.075, 16, 12);
  KCOLOR.slice(0, 6).forEach((c, k) => { const m = new THREE.Mesh(dot, new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 1 })); const a = (k / 6) * Math.PI * 2; m.position.set(Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.2); g.add(m); });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 40), M.glow); ring.rotation.x = Math.PI / 2; ring.position.y = 0.12; ring.name = 'glow'; g.add(ring);
  return g;
}
// a sandok (wooden ladle) laid across: along x for a row Sandok, along z for a column one
function makeSandok(spec) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.8, 10), M.ladle); handle.rotation.z = Math.PI / 2; g.add(handle);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.ladle); bowl.rotation.z = Math.PI; bowl.position.x = 0.42; g.add(bowl);
  g.position.y = 0.5; if (spec === 2) g.rotation.y = Math.PI / 2;
  return g;
}
function makeLid() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.04, 32), M.pot));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), M.pot); knob.position.y = 0.05; g.add(knob);
  g.position.y = 0.5;
  return g;
}

const MAKERS = [makePuto, makeKutsinta, makeSapin, makeBibingka, makeUbe, makeSuman];
const templates = new Map();
function shadowed(o) { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }
export function makePiece(kind, spec = 0) {
  const key = `${kind}:${spec}`;
  if (!templates.has(key)) {
    let t;
    if (kind === 6) t = makeLahat();
    else { t = new THREE.Group(); t.add(MAKERS[kind]()); if (spec === 1 || spec === 2) t.add(makeSandok(spec)); if (spec === 3) t.add(makeLid()); }
    templates.set(key, shadowed(t));
  }
  const p = templates.get(key).clone();
  p.userData = { kind, spec };
  return p;
}
export const lathe2 = lathe; // for the stall's trays and bilao
```

- [ ] **Step 4: Write `src/stall3d.mjs`**

Port lines 102–106 (the table and bilao) and lines 122–178 (the street) of the prototype. Make these changes:
- Size everything for a 9×9 board: bilao radius 6.2, table 18×13, posts at x=±8.8, tolda 18 wide, side trays at x=±8.4.
- Load files from `base`.
- Return `update`.

The whole file:

```js
// Lola Pacing's kakanin stall on a fiesta street at golden hour, around the board: a photographed sky
// for light, a backdrop, a road and painted houses with iron roofs, the stall's bamboo posts, striped
// tolda and sign, banderitas and bulbs, trays of kakanin for sale, and real props. Ported from the
// approved look prototype. The board's cells sit on y = 0 around the origin.
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/three-mocap.min.js';
import { HDRLoader } from './vendor/three-fx.min.js';
import { facade, sign, rattan } from './tex.mjs';
import { makePiece, MATS, lathe2 } from './kakanin3d.mjs';

const shadow = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

export function buildStall(scene, renderer, { base = 'assets/env/' } = {}) {
  scene.background = new THREE.Color('#e9b98a');
  scene.fog = new THREE.Fog('#e6b88c', 30, 80);
  scene.add(new THREE.HemisphereLight('#ffe6c4', '#6a4a30', 0.6));
  const sun = new THREE.DirectionalLight('#ffbf80', 3.0);
  sun.position.set(-8, 10, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 16, bottom: -16, far: 70 }); sun.shadow.bias = -0.0005; sun.shadow.radius = 4;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#a8c8ff', 0.8); rim.position.set(7, 5, -7); scene.add(rim);

  const pmrem = new THREE.PMREMGenerator(renderer);
  new HDRLoader().loadAsync(base + 'sky/kloppenheim_06_puresky.hdr').then((t) => { t.mapping = THREE.EquirectangularReflectionMapping; scene.environment = pmrem.fromEquirectangular(t).texture; scene.environmentRotation = new THREE.Euler(0, 2.2, 0); scene.environmentIntensity = 0.9; t.dispose(); }).catch(() => { /* the lights alone */ });
  const tl = new THREE.TextureLoader();
  const scan = (id, rep) => { const d = tl.load(`${base}tex/${id}_diff.jpg`), n = tl.load(`${base}tex/${id}_nor.jpg`); d.colorSpace = THREE.SRGBColorSpace; for (const t of [d, n]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; } return { map: d, normalMap: n }; };
  { const t = tl.load(base + 'sky/bd_golden.jpg'); t.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 50, 48, 1, true, Math.PI * 0.62, Math.PI * 0.76), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false }));
    sky.position.set(0, 14, 4); scene.add(sky); }

  // the table and Lola's big bilao
  const table = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 13), MATS.wood); table.position.y = -0.3; table.receiveShadow = true; scene.add(table);
  const bilaoRadius = 6.2;
  const bilao = new THREE.Mesh(lathe2([[0, 0], [bilaoRadius, 0], [bilaoRadius + 0.3, 0.3], [bilaoRadius + 0.36, 0.38], [bilaoRadius + 0.22, 0.36], [bilaoRadius - 0.05, 0.08], [0, 0.08]], 120), MATS.weave);
  bilao.position.y = -0.1; shadow(bilao); scene.add(bilao);
  const front = new THREE.Mesh(new THREE.BoxGeometry(18, 1.6, 0.2), MATS.wood); front.position.set(0, -1.3, 6.5); shadow(front); scene.add(front);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(110, 70), new THREE.MeshStandardMaterial({ ...scan('asphalt_02', [22, 14]), roughness: 0.95, color: '#b9ada0' }));
  road.rotation.x = -Math.PI / 2; road.position.y = -1.6; road.receiveShadow = true; scene.add(road);
  const roofScan = scan('rusty_corrugated_iron', [4, 1]);
  const COLORS = ['#e8d3a8', '#cfe0d2', '#f0c6b0', '#d9cfe8', '#f3e6b8'];
  for (let k = 0; k < 8; k++) {
    const w = 5.6 + (k % 3) * 0.6, h = 6.4 + (k % 2) * 2.2, x = -24 + k * 6.6, z = -15.5 - (k % 2) * 1.2;
    const f = facade(1000 + k * 77, w, h, COLORS[k % 5], { shop: k === 3, lit: 0.45 });
    const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4), [0, 1, 2, 3, 4, 5].map((i) => (i === 4 ? new THREE.MeshStandardMaterial({ map: f.map, normalMap: f.normalMap, roughness: 0.9 }) : new THREE.MeshStandardMaterial({ color: COLORS[k % 5], roughness: 0.95 }))));
    house.position.set(x, -1.6 + h / 2, z); shadow(house); scene.add(house);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.08, 4.6), new THREE.MeshStandardMaterial({ ...roofScan, metalness: 0.6, roughness: 0.6 }));
    roof.position.set(x, -1.6 + h + 0.25, z + 0.2); roof.rotation.x = 0.18; shadow(roof); scene.add(roof);
  }
  // the stall
  const bamboo = rattan(5), bambooM = new THREE.MeshStandardMaterial({ map: bamboo.map, normalMap: bamboo.normalMap, roughness: 0.55 });
  for (const x of [-8.8, 8.8]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 8.2, 12), bambooM); p.position.set(x, 2.5, -6); shadow(p); scene.add(p); }
  const stripes = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 16; const x = c.getContext('2d'); for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#fff4e0' : '#d8342c'; x.fillRect(i * 16, 0, 16, 16); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const tolda = new THREE.Mesh(new THREE.PlaneGeometry(18.5, 3.6, 24, 4), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.8, side: THREE.DoubleSide }));
  { const p = tolda.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / 18.5) * Math.PI * 9) * 0.06); p.needsUpdate = true; tolda.geometry.computeVertexNormals(); }
  tolda.position.set(0, 6.6, -4.8); tolda.rotation.x = -1.2; shadow(tolda); scene.add(tolda);
  const signTex = sign([['KAKANIN NI LOLA PACING', 30], ['puto · kutsinta · sapin-sapin · bibingka · ube · suman', 12, 700]], '#2a6f3a', '#fff4d6', { w: 1024, h: 160 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(10, 1.5, 0.12), [0, 1, 2, 3, 4, 5].map((i) => (i === 4 ? new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6 }) : new THREE.MeshStandardMaterial({ color: '#7a4a22' }))));
  board.position.set(0, 4.2, -6.1); shadow(board); scene.add(board);
  const flagCols = ['#e8384f', '#ffd23f', '#2f6fd6', '#2fb36b', '#ff8ad6'], bulbs = [];
  for (const [z, y0, sag] of [[-7.5, 7.2, 0.5], [-11, 8.2, 0.8]]) for (let k = 0; k < 30; k++) {
    const x = -15 + k * 1.04, y = y0 - Math.sin((k / 29) * Math.PI) * sag;
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 3), new THREE.MeshStandardMaterial({ color: flagCols[k % 5], roughness: 0.7, side: THREE.DoubleSide }));
    f.position.set(x, y - 0.24, z); f.rotation.set(Math.PI, 0, 0); f.scale.z = 0.05; f.castShadow = true; scene.add(f);
    if (k % 2 === 0) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: '#fff0c0', emissive: '#ffcf70', emissiveIntensity: 4 })); b.position.set(x + 0.5, y + 0.05, z + 0.1); scene.add(b); bulbs.push(b); }
  }
  // trays of kakanin for sale beside the board
  for (const [x, z, kind, n] of [[-8.4, 2.6, 5, 5], [8.4, 2.6, 0, 6], [-8.4, -2.6, 1, 6], [8.4, -2.6, 4, 3]]) {
    const tray = new THREE.Mesh(lathe2([[0, 0], [1.1, 0], [1.2, 0.12], [1.13, 0.12], [1.05, 0.03], [0, 0.03]], 48), MATS.weave); tray.position.set(x, -0.08, z); shadow(tray); scene.add(tray);
    for (let k = 0; k < n; k++) { const p = makePiece(kind, 0); const a = (k / n) * Math.PI * 2; p.position.set(x + Math.cos(a) * (k ? 0.55 : 0), -0.05, z + Math.sin(a) * (k ? 0.55 : 0)); p.scale.setScalar(0.85); scene.add(p); }
  }
  // real props from the street
  const gl = new GLTFLoader();
  for (const [id, x, z, ry] of [['plastic_monobloc_chair_01', -11.5, 5, 0.6], ['plastic_monobloc_chair_01', 11.8, 4, -0.5], ['plastic_crate_02', 10.6, -1, 0.3], ['small_lpg_tank', -10.8, -2, 0], ['Barrel_01', 13.5, -6, 0.4], ['wooden_bucket_02', -12.8, -4.8, 0]]) {
    gl.loadAsync(`${base}props/${id}.glb`).then((g) => { const o = g.scene; o.scale.setScalar(2.2); o.position.set(x, -1.6, z); o.rotation.y = ry; shadow(o); scene.add(o); }).catch(() => { /* fine without */ });
  }
  return { bilaoRadius, sun, update(t) { for (const b of bulbs) b.material.emissiveIntensity = 3 + Math.sin(t * 3 + b.id) * 1; } };
}
```

- [ ] **Step 5: Run the syntax test**

Run: `node --test test/syntax.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/vendor src/tex.mjs src/post.mjs src/kakanin3d.mjs src/stall3d.mjs assets tools/cdp.mjs test/syntax.test.mjs
git commit -m "The 3D kakanin, their special marks, and Lola's stall on a fiesta street

Ported from the approved look prototype, on Hollow Blocks' tex, post and three.js r186.
Assets are CC0 scans from Poly Haven (about 2 MB).

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: The board view: pieces, animation, picking, camera, icons

**Files:**
- Create: `src/view3d.mjs`

**Interfaces:**
- Consumes:
  - from `game.mjs`: `EMPTY`, `BILAO`, `NONE`, `SANDOK_H`, `SANDOK_V`, `KALDERO`, `LAHAT` and the Task 2–4 event shapes
  - `makePiece`, `MATS`, `KCOLOR` (Task 8)
  - `buildStall` (Task 8)
  - `createPost` (copied)
- Produces `createView(canvas, { gfx, reduced, speed }) → View`, with these members:
  - `setGame(g)`: build the board for a fresh state.
  - `play(events, g) → Promise<void>`: animate a swap's events; resolves when the board is still and matches `g`.
  - `pick(clientX, clientY) → cell | -1`
  - `select(i | -1)`, `showHint([a,b] | null)`
  - `update(dt)`, `resize()`
  - `busy() → boolean`
  - `icons() → { [kind]: dataURL }`
  - `dump() → { kinds: number[], specs: number[] }` for tests
  - `onCallout(fn(text, step))`
  - `level` (the post quality level)
- The 2D fallback (Task 11) implements the same interface.

- [ ] **Step 1: Write `src/view3d.mjs`**

```js
// The 3D bilao for Kakanin Crush. It draws the rules' state (game.mjs) and plays their events as
// animations; it never changes the state. After every move it checks itself against the state and
// rebuilds any cell that differs, so a dropped frame or a resize mid-cascade can never leave it wrong.
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/three-extra.min.js';
import { EMPTY, BILAO, NONE, SANDOK_H, SANDOK_V, KALDERO, LAHAT } from './game.mjs';
import { makePiece, MATS, KCOLOR } from './kakanin3d.mjs';
import { buildStall } from './stall3d.mjs';
import { createPost } from './post.mjs';

export const CELL = 1.0;
const CALLOUTS = ['', '', 'Sarap!', 'Linamnam!', 'Panalo!', 'Ubos-Benta!'];
const ease = { out: (t) => 1 - (1 - t) ** 3, in: (t) => t * t, back: (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; } };

export function createView(canvas, { gfx = null, reduced = () => false, speed = 1, base = 'assets/env/' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const low = /Android|iPhone|iPad/.test(navigator.userAgent) || (navigator.hardwareConcurrency || 8) <= 4;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.5 : 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 160);
  const stall = buildStall(scene, renderer, { base });
  const fixed = gfx !== null && gfx !== '' && gfx !== undefined;
  const post = createPost(renderer, scene, camera, { level: fixed ? +gfx : low ? 1 : 2, auto: !fixed });
  post.setStage('golden');

  const boardG = new THREE.Group(); scene.add(boardG);
  let g = null, W = 0, H = 0, meshes = [], latikM = [], selected = -1, hintPair = null, callout = () => {}, t = 0;
  const tweens = [];
  const k = () => (reduced() ? 0.5 : 1) / speed;
  const tween = (dur, fn) => new Promise((res) => { if (dur <= 0) { fn(1); res(); return; } tweens.push({ t: 0, dur, fn, res }); });
  const cellPos = (i, y = 0.04) => new THREE.Vector3(((i % W) - (W - 1) / 2) * CELL, y, (((i / W) | 0) - (H - 1) / 2) * CELL);

  // the selection ring and the hint glow
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: '#fff3a0' })); ring.rotation.x = Math.PI / 2; ring.visible = false; scene.add(ring);
  const hintM = new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0, depthWrite: false });
  const hintTiles = [0, 1].map(() => { const m = new THREE.Mesh(new RoundedBoxGeometry(CELL * 0.92, 0.01, CELL * 0.92, 2, 0.004), hintM); m.visible = false; scene.add(m); return m; });

  // crumbs: one instanced mesh, recycled
  const MAXC = 400, crumbGeo = new THREE.DodecahedronGeometry(0.05), crumbMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  const crumbs = new THREE.InstancedMesh(crumbGeo, crumbMat, MAXC); crumbs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); crumbs.count = 0; scene.add(crumbs);
  const parts = []; const dummy = new THREE.Object3D(), col = new THREE.Color();
  function burst(p, kind, n = 10) {
    for (let q = 0; q < n && parts.length < MAXC; q++) parts.push({ p: p.clone().add(new THREE.Vector3(0, 0.3, 0)), v: new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4), life: 0.7, c: KCOLOR[kind] || '#ffffff' });
  }
  const flashM = new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0, depthWrite: false });
  function beam(i, sp) {
    const geo = sp === SANDOK_H ? new THREE.BoxGeometry(W * CELL, 0.05, 0.5) : sp === SANDOK_V ? new THREE.BoxGeometry(0.5, 0.05, H * CELL) : new THREE.BoxGeometry(3 * CELL, 0.05, 3 * CELL);
    const m = new THREE.Mesh(geo, flashM.clone()); const p = cellPos(i, 0.3);
    if (sp === SANDOK_H) p.x = 0; if (sp === SANDOK_V) p.z = 0;
    m.position.copy(p); scene.add(m);
    return tween(0.3 * k(), (u) => { m.material.opacity = 0.8 * (1 - u); if (u >= 1) { scene.remove(m); geo.dispose(); m.material.dispose(); } });
  }

  function clearBoard() {
    for (const o of [...boardG.children]) { boardG.remove(o); o.traverse((m) => { if (m.isMesh && m.userData.own) m.geometry.dispose(); }); }
    meshes = []; latikM = [];
  }
  function place(i) {
    if (meshes[i]) { boardG.remove(meshes[i]); meshes[i] = null; }
    if (!g.mask[i] || g.cell[i] === EMPTY) return;
    const m = makePiece(g.cell[i], g.cell[i] === BILAO ? 0 : g.spec[i]);
    m.position.copy(cellPos(i)); m.userData.phase = Math.random() * 6; boardG.add(m); meshes[i] = m;
  }
  function placeLatik(i) {
    if (latikM[i]) { boardG.remove(latikM[i]); latikM[i] = null; }
    const n = g.latik[i]; if (!n) return;
    const m = new THREE.Mesh(new RoundedBoxGeometry(CELL * 0.94, 0.03 + n * 0.03, CELL * 0.94, 2, 0.012), MATS.latik);
    m.userData.own = true; m.position.copy(cellPos(i, 0.03)); m.receiveShadow = true; boardG.add(m); latikM[i] = m;
  }
  function setGame(game) {
    g = game; W = g.W; H = g.H; clearBoard();
    const mat = new THREE.Mesh(new RoundedBoxGeometry(W * CELL + 0.25, 0.04, H * CELL + 0.25, 2, 0.02), MATS.leaf); mat.userData.own = true; mat.position.y = 0; mat.receiveShadow = true; boardG.add(mat);
    const tileM = [new THREE.MeshStandardMaterial({ color: '#4a9440', roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: '#3d8236', roughness: 0.5 })];
    const tileGeo = new RoundedBoxGeometry(CELL - 0.06, 0.03, CELL - 0.06, 2, 0.01);
    for (let i = 0; i < W * H; i++) {
      if (!g.mask[i]) continue;
      const tile = new THREE.Mesh(tileGeo, tileM[((i % W) + ((i / W) | 0)) % 2]); tile.position.copy(cellPos(i, 0.02)); tile.receiveShadow = true; boardG.add(tile);
    }
    mat.visible = true;
    for (let i = 0; i < W * H; i++) { placeLatik(i); place(i); }
    fit();
  }

  // ---------- events ----------
  async function play(events, game) {
    g = game;
    for (const e of events) {
      if (e.type === 'swap' || e.type === 'bounce') {
        const A = meshes[e.a], B = meshes[e.b], pa = cellPos(e.a), pb = cellPos(e.b);
        await tween(0.16 * k(), (u) => { const s = ease.out(u); if (A) A.position.lerpVectors(pa, pb, s); if (B) B.position.lerpVectors(pb, pa, s); });
        if (e.type === 'bounce') await tween(0.16 * k(), (u) => { const s = ease.out(u); if (A) A.position.lerpVectors(pb, pa, s); if (B) B.position.lerpVectors(pa, pb, s); });
        else [meshes[e.a], meshes[e.b]] = [meshes[e.b], meshes[e.a]];
      } else if (e.type === 'step') {
        if (CALLOUTS[Math.min(e.step, 5)]) callout(CALLOUTS[Math.min(e.step, 5)], e.step);
        await Promise.all(e.fired.map(([i, sp]) => beam(i, sp)));
        const gone = e.cleared.map(([i, kind]) => { const m = meshes[i]; meshes[i] = null; burst(cellPos(i), kind); return m; }).filter(Boolean);
        await tween(0.2 * k(), (u) => { for (const m of gone) m.scale.setScalar(u < 0.3 ? 1 + u : Math.max(0.001, 1.3 * (1 - (u - 0.3) / 0.7))); });
        for (const m of gone) boardG.remove(m);
        for (const [i] of e.latik) placeLatik(i);
        for (const [i] of e.made) { place(i); const m = meshes[i]; if (m) { m.scale.setScalar(0.01); tween(0.25 * k(), (u) => m.scale.setScalar(Math.max(0.01, ease.back(u)))); } }
        // falls and new pieces drop together
        const moving = [];
        for (const [from, to] of e.falls) { const m = meshes[from]; meshes[from] = null; meshes[to] = m; if (m) moving.push([m, m.position.clone(), cellPos(to)]); }
        for (const [i, kind, n] of e.spawns) {
          const m = makePiece(kind, 0); m.userData.phase = Math.random() * 6; boardG.add(m); meshes[i] = m;
          const end = cellPos(i), start = end.clone(); start.z = -((H - 1) / 2) * CELL - n * CELL; start.y = 1.2; m.position.copy(start); moving.push([m, start, end]);
        }
        const far = Math.max(1, ...moving.map(([, a, b]) => a.distanceTo(b)));
        await tween((0.12 + far * 0.05) * k(), (u) => { const s = ease.in(u); for (const [m, a, b] of moving) m.position.lerpVectors(a, b, s); });
      } else if (e.type === 'ubosMake') {
        callout('Ubos-Benta!', 5);
        for (const [i] of e.made) { place(i); }
        await tween(0.35 * k(), () => {});
      } else if (e.type === 'shuffle') {
        await tween(0.25 * k(), (u) => { for (const m of meshes) if (m) m.scale.setScalar(Math.max(0.01, 1 - u)); });
        for (let i = 0; i < W * H; i++) place(i);
      }
    }
    sync();
  }
  // the board must match the rules exactly when everything is still
  function sync() {
    for (let i = 0; i < W * H; i++) {
      const m = meshes[i], want = g.mask[i] && g.cell[i] !== EMPTY;
      const kindOk = m && want && m.userData.kind === g.cell[i] && (g.cell[i] === BILAO || m.userData.spec === g.spec[i]);
      if ((want && !kindOk) || (!want && m)) place(i);
      if (meshes[i]) { meshes[i].position.copy(cellPos(i)); meshes[i].scale.setScalar(1); }
      if ((latikM[i] ? 1 : 0) !== (g.latik[i] ? 1 : 0)) placeLatik(i);
    }
  }

  // ---------- camera: frame the bilao for the screen, the street above ----------
  const target = new THREE.Vector3(0, 0, -0.8), dir = new THREE.Vector3(0, 8.6, 10.6).normalize();
  function fit() {
    const aspect = camera.aspect, v = THREE.MathUtils.degToRad(camera.fov), h = 2 * Math.atan(Math.tan(v / 2) * aspect);
    const halfW = (Math.max(W, 7) * CELL) / 2 + 0.9, halfH = (Math.max(H, 7) * CELL) / 2 + 1.2;
    const dist = Math.max(halfW / Math.tan(h / 2), (halfH / Math.tan(v / 2)) * 1.25);
    // portrait phones: the HUD strip takes the top, so look a little higher and come a little closer
    const portrait = aspect < 0.9;
    target.set(0, 0, portrait ? -1.6 : -0.8);
    camera.position.copy(target).addScaledVector(dir, dist * (portrait ? 1.02 : 1));
    camera.lookAt(target);
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); post.resize(); fit();
  }

  // ---------- picking ----------
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  function pick(cx, cy) {
    if (!g) return -1;
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    const x = Math.round(hit.x / CELL + (W - 1) / 2), y = Math.round(hit.z / CELL + (H - 1) / 2);
    if (x < 0 || y < 0 || x >= W || y >= H) return -1;
    const i = y * W + x;
    return g.mask[i] ? i : -1;
  }

  // ---------- frame ----------
  function update(dt) {
    t += dt;
    for (let q = tweens.length - 1; q >= 0; q--) { const w = tweens[q]; w.t += dt; const u = Math.min(1, w.t / w.dur); w.fn(u); if (u >= 1) { tweens.splice(q, 1); w.res(); } }
    // idle life: a bob; the kutsinta wobbles like jelly; the Bilao glows
    if (!reduced()) for (const m of meshes) if (m && !tweens.length) {
      const ph = m.userData.phase, kind = m.userData.kind;
      m.position.y = 0.04 + Math.sin(t * 1.6 + ph) * 0.012;
      if (kind === 1) m.scale.set(1 + Math.sin(t * 5 + ph) * 0.015, 1 - Math.sin(t * 5 + ph) * 0.02, 1 + Math.sin(t * 5 + ph) * 0.015);
      if (kind === BILAO) m.rotation.y = t * 0.8;
    }
    ring.visible = selected >= 0; if (selected >= 0) { ring.position.copy(cellPos(selected, 0.08)); ring.scale.setScalar(1 + Math.sin(t * 8) * 0.04); }
    hintM.opacity = hintPair ? 0.25 + Math.sin(t * 5) * 0.2 : 0;
    // crumbs
    let n = 0;
    for (let q = parts.length - 1; q >= 0; q--) {
      const p = parts[q]; p.life -= dt; if (p.life <= 0) { parts.splice(q, 1); continue; }
      p.v.y -= 9 * dt; p.p.addScaledVector(p.v, dt); if (p.p.y < 0.05) { p.p.y = 0.05; p.v.multiplyScalar(0.4); }
      dummy.position.copy(p.p); dummy.scale.setScalar(Math.min(1, p.life * 2)); dummy.rotation.set(p.life * 9, p.life * 7, 0); dummy.updateMatrix();
      crumbs.setMatrixAt(n, dummy.matrix); crumbs.setColorAt(n, col.set(p.c)); n++;
    }
    crumbs.count = n; crumbs.instanceMatrix.needsUpdate = true; if (crumbs.instanceColor) crumbs.instanceColor.needsUpdate = true;
    stall.update(t);
    post.render(dt);
  }

  // ---------- icons for the HUD: each kakanin rendered once ----------
  function icons() {
    const out = {}, size = 128, rt = new THREE.WebGLRenderTarget(size, size, { colorSpace: THREE.SRGBColorSpace });
    const s2 = new THREE.Scene(); s2.environment = scene.environment;
    s2.add(new THREE.HemisphereLight('#fff6e8', '#7a5a40', 1.4)); const l = new THREE.DirectionalLight('#ffffff', 2.4); l.position.set(-2, 4, 3); s2.add(l);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20); cam.position.set(0, 1.5, 1.9); cam.lookAt(0, 0.18, 0);
    const px = new Uint8Array(size * size * 4), cv = document.createElement('canvas'); cv.width = cv.height = size; const ctx = cv.getContext('2d');
    for (let kind = 0; kind <= 6; kind++) {
      const p = makePiece(kind, 0); s2.add(p);
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(s2, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
      const img = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
      ctx.putImageData(img, 0, 0); out[kind] = cv.toDataURL('image/png');
      s2.remove(p);
    }
    renderer.setRenderTarget(null); rt.dispose();
    return out;
  }

  return {
    setGame, play, pick, update, resize, icons,
    select(i) { selected = i; },
    showHint(pair) { hintPair = pair; hintTiles.forEach((m, q) => { m.visible = !!pair; if (pair) m.position.copy(cellPos(pair[q], 0.05)); }); },
    busy: () => tweens.length > 0,
    dump: () => ({ kinds: meshes.map((m) => (m ? m.userData.kind : EMPTY)), specs: meshes.map((m) => (m ? m.userData.spec : NONE)) }),
    onCallout(fn) { callout = fn; },
    get level() { return post.level; },
    setSpeed(s) { speed = s; },
    renderer,
  };
}
```

- [ ] **Step 2: Run the syntax test**

Run: `node --test test/syntax.test.mjs`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/view3d.mjs
git commit -m "The board view: 3D pieces, swaps, pops, falls, specials, picking, camera fit and HUD icons

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

(The view is checked in the browser in Tasks 11 and 12; it can't run under node.)

---

### Task 10: Sound

**Files:**
- Create: `src/audio.mjs`

**Interfaces:**
- Consumes: the event shapes.
- Produces: `createAudio() → { start(), setMuted(b), event(e), music(on) }`.
  - `start()` must be called from a user gesture.
  - `event` takes the rules' events, plus these view-only ones: `{type:'select'}`, `{type:'tsk'}`, `{type:'goal'}`.

- [ ] **Step 1: Write `src/audio.mjs`**

```js
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
```

- [ ] **Step 2: Run the syntax test**

Run: `node --test test/syntax.test.mjs`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/audio.mjs
git commit -m "Sound: kakanin crunches that climb with cascades, special whooshes, a kulintang loop, a banda win

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: The page: HUD, screens, input, loop, 2D fallback

**Files:**
- Create: `index.html`, `src/main.mjs`, `src/render2d.mjs`, `vercel.json`

**Interfaces:**
- Consumes:
  - `createGame`, `swap`, `hint`, `adjacent`, `KAKANIN`, `BILAO` (game)
  - `LEVELS`, `TOWN` (levels)
  - `chooseMove` (bot)
  - `load`, `save`, `record`, `isUnlocked`, `totalStars` (progress)
  - `createView` (view3d)
  - `createFlat` (render2d)
  - `createAudio` (audio)
- Produces:
  - **URL switches:** `?test=1` (no storage, exposes `window.__kc`), `?level=sr-NN`, `?bot` (autoplay), `?fast=N` (animation speed), `?seed=N`, `?gfx=0|1|2`, `?flat=1`.
  - **`window.__kc`** (test mode only): `{ game, view, mode, start(levelIndex), swap(a,b), moves(), LEVELS, busy() }`.

- [ ] **Step 1: Write `src/render2d.mjs`** (the fallback, with the same interface as the view)

```js
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
    async play(events, game) { g = game; for (const e of events) if (e.type === 'step' && e.step >= 2) callout(['', '', 'Sarap!', 'Linamnam!', 'Panalo!', 'Ubos-Benta!'][Math.min(e.step, 5)], e.step); busyT = 0.25; await new Promise((r) => setTimeout(r, 250)); },
    pick(cx, cy) { if (!g) return -1; const { r, cell, ox, oy } = geom(); const x = Math.floor((cx - r.left - ox) / cell), y = Math.floor((cy - r.top - oy) / cell); if (x < 0 || y < 0 || x >= g.W || y >= g.H) return -1; const i = y * g.W + x; return g.mask[i] ? i : -1; },
    select(i) { selected = i; }, showHint(p) { hintPair = p; },
    update(dt) { busyT = Math.max(0, busyT - dt); draw(); },
    resize, busy: () => busyT > 0,
    icons() { const out = {}; for (let k = 0; k <= 6; k++) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = KCOLOR[k]; x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.fill(); out[k] = c.toDataURL(); } return out; },
    dump: () => ({ kinds: Array.from(g.cell), specs: Array.from(g.spec) }),
    onCallout(fn) { callout = fn; }, level: 0, setSpeed() {},
  };
}
```

- [ ] **Step 2: Write `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Kakanin Crush</title>
<meta name="description" content="Match-3, Pinoy style, in 3D: swap puto, kutsinta, sapin-sapin, bibingka, ube halaya and suman on Lola Pacing's bilao at a fiesta stall. Make a Sandok, a Kaldero, a Bilao ng Lahat, clean the latik, and sell out with an Ubos-Benta!">
<meta property="og:title" content="Kakanin Crush: Ubos-Benta!">
<meta property="og:description" content="Match the kakanin on Lola's bilao. Sandok, Kaldero, Bilao ng Lahat — and an Ubos-Benta to finish.">
<meta property="og:image" content="https://kakanin-crush.vercel.app/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#2a1a12">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Kakanin Crush">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Barlow+Condensed:ital,wght@0,700;0,800;1,800;1,900&display=swap" rel="stylesheet">
<style>
:root { --ink: #fff8e1; --muted: #e8d8c8; --gold: #ffd23f; --line: #d8c9a0; --dark: #120d14; --wood: #d9a15c; --woodedge: #8a5526; --orange: #c8501f; color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; overflow: hidden; background: #2a1a12; color: var(--ink); font: 16px/1.4 "Baloo 2", system-ui, sans-serif; }
[hidden] { display: none !important; }
.stage { position: fixed; inset: 0; touch-action: none; user-select: none; -webkit-user-select: none; }
#view { display: block; width: 100%; height: 100%; }
#hud { position: absolute; inset: 0; pointer-events: none; }
.hud-top { position: absolute; top: max(10px, env(safe-area-inset-top)); left: 12px; right: 12px; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.chip { background: linear-gradient(180deg, rgba(34,24,42,.88), rgba(14,10,18,.88)); border: 2px solid var(--line); box-shadow: 0 0 0 2px var(--dark), 0 6px 14px rgba(0,0,0,.4); padding: 4px 16px 3px; clip-path: polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%); min-width: 96px; }
.hud-top .chip:last-child { clip-path: polygon(10px 0, 100% 0, 100% 100%, 0 100%); text-align: right; }
.chip.mid { clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 100%, 0 100%); text-align: center; }
.chip small { display: block; font: italic 800 11px/1.1 "Barlow Condensed", sans-serif; letter-spacing: .18em; color: var(--muted); text-transform: uppercase; }
.chip b { font: italic 900 26px/1.05 "Barlow Condensed", sans-serif; background: linear-gradient(180deg, #fffbe0, #ffd23f 50%, #e8741c); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; white-space: nowrap; }
.chip.mid b { font-size: 22px; letter-spacing: .06em; }
.chip.mid em { display: block; font: italic 800 13px/1.1 "Barlow Condensed", sans-serif; letter-spacing: .08em; color: #9ad7ff; }
#h-best b { background: linear-gradient(180deg, #fff0fa, #ff8ae2 55%, #c0308a); -webkit-background-clip: text; background-clip: text; }
/* the signboards */
.signs { position: absolute; display: flex; gap: 10px; }
.sign { background: var(--wood); border: 4px solid var(--woodedge); border-radius: 6px; box-shadow: 0 8px 16px #0006; padding: 6px 10px 8px; color: #3a2210; min-width: 132px; }
.sign h4 { margin: 0 0 6px; text-align: center; font: italic 800 18px/1.3 "Barlow Condensed", sans-serif; letter-spacing: .06em; color: #fff2c8; background: var(--orange); border-radius: 4px; text-shadow: 0 2px 0 #7a2a0c; }
.goal { display: flex; align-items: center; gap: 6px; font: 800 18px/1.1 "Barlow Condensed", sans-serif; }
.goal img { width: 36px; height: 36px; }
.goal.done { opacity: .55; text-decoration: line-through; }
.goal.pop { animation: pop .35s cubic-bezier(.2,1.6,.4,1); }
@keyframes pop { from { transform: scale(1.35); } }
#h-moves { text-align: center; font: italic 900 40px/1 "Barlow Condensed", sans-serif; }
#h-moves.low { color: #c0182e; }
.meter { height: 12px; background: var(--woodedge); border-radius: 6px; overflow: hidden; position: relative; }
.meter i { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, #ffd23f, #ff9f43); border-radius: 6px; }
.meter s { position: absolute; top: -3px; width: 2px; height: 18px; background: #3a2210; }
.stars { text-align: center; color: var(--orange); font-size: 22px; letter-spacing: 4px; }
/* desktop: signboards left and right of the stall; phone portrait: a strip above the board */
@media (min-aspect-ratio: 9/10) {
  #signs-l { left: 2vw; top: 22vh; flex-direction: column; }
  #signs-r { right: 2vw; top: 22vh; flex-direction: column; }
}
@media (max-aspect-ratio: 9/10) {
  .signs { top: calc(max(10px, env(safe-area-inset-top)) + 60px); }
  #signs-l { left: 8px; } #signs-r { right: 8px; }
  .sign { min-width: 0; padding: 3px 6px 5px; } .sign h4 { font-size: 13px; margin-bottom: 3px; }
  .goal { font-size: 15px; } .goal img { width: 26px; height: 26px; }
  #h-moves { font-size: 28px; }
  #sign-stars { display: none; }
}
#callout { position: absolute; left: 50%; top: 38%; transform: translate(-50%, -50%); font: italic 900 clamp(40px, 9vw, 86px)/1 "Barlow Condensed", sans-serif; letter-spacing: .04em; color: #fff4c8; -webkit-text-stroke: 3px #7a2a0c; text-shadow: 0 6px 0 #7a2a0c, 0 0 30px rgba(255,200,80,.6); pointer-events: none; white-space: nowrap; }
#callout.go { animation: call .9s ease-out forwards; }
@keyframes call { 0% { transform: translate(-50%, -50%) scale(.4); opacity: 0; } 20% { transform: translate(-50%, -50%) scale(1.12); opacity: 1; } 70% { opacity: 1; } 100% { transform: translate(-50%, -70%) scale(1); opacity: 0; } }
#bubble { position: absolute; left: 3vw; bottom: 5vh; max-width: min(320px, 70vw); background: #fff; color: #222; border: 2px solid #222; border-radius: 14px; padding: 6px 14px; font: italic 800 15px/1.3 "Baloo 2", sans-serif; }
#bubble b { color: #c8501f; font-style: normal; }
.corner { position: absolute; right: 12px; bottom: max(12px, env(safe-area-inset-bottom)); pointer-events: auto; display: flex; gap: 6px; }
button { font: inherit; font-weight: 800; color: var(--ink); background: linear-gradient(180deg, #4a3428, #2a1a12); border: 2px solid var(--line); border-radius: 10px; padding: 8px 18px; cursor: pointer; min-height: 44px; }
button:focus-visible { outline: 3px solid #ff8ae2; outline-offset: 2px; }
button.primary { background: linear-gradient(180deg, #ffe680, #ffb02e); color: #3a1a08; border-color: #fff4c8; box-shadow: 0 4px 0 #a8641c; }
.corner button { min-height: 36px; padding: 2px 12px; font-size: 14px; background: rgba(20,14,24,.6); }
.screen { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: safe center; gap: 12px; padding: 20px; text-align: center; background: radial-gradient(ellipse at 50% 30%, rgba(42,26,18,.55), rgba(18,10,8,.88)); overflow-y: auto; }
.logo { margin: 0; font: italic 900 clamp(52px, 13vw, 96px)/.9 "Barlow Condensed", sans-serif; letter-spacing: .02em; background: linear-gradient(180deg, #fffbe0, #ffd23f 45%, #e8741c); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 6px 0 #7a2a0c); }
.logo small { display: block; font-size: .32em; letter-spacing: .2em; -webkit-text-fill-color: #ff8ae2; }
.tag { margin: 0; color: var(--muted); max-width: 30em; }
h2 { margin: 0; font: italic 900 clamp(30px, 7vw, 48px)/1 "Barlow Condensed", sans-serif; color: var(--gold); letter-spacing: .03em; }
.grid { display: grid; grid-template-columns: repeat(5, 64px); gap: 10px; }
.lvl { width: 64px; height: 64px; padding: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; font: italic 900 24px/1 "Barlow Condensed", sans-serif; }
.lvl small { font-size: 12px; color: var(--gold); letter-spacing: 1px; }
.lvl:disabled { opacity: .4; cursor: default; }
.row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.big-stars { font-size: 48px; color: var(--gold); letter-spacing: 8px; text-shadow: 0 4px 0 #7a2a0c; }
.help { position: absolute; bottom: 4px; left: 0; right: 0; text-align: center; font-size: 12px; color: var(--muted); pointer-events: auto; }
.help a { color: var(--gold); }
#toast { position: absolute; left: 50%; bottom: 14%; transform: translateX(-50%); background: rgba(18,10,8,.94); border: 2px solid var(--gold); border-radius: 12px; padding: 6px 14px; font-weight: 700; font-size: 14px; pointer-events: none; max-width: 90%; text-align: center; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
</style>
</head>
<body>
<main class="stage" id="stage">
  <canvas id="view" aria-label="Lola Pacing's bilao of kakanin at a fiesta stall"></canvas>
  <div id="hud" hidden>
    <div class="hud-top">
      <div class="chip" id="h-score"><small>Puntos</small><b>0</b></div>
      <div class="chip mid" id="h-level"><b>SAN ROQUE 1</b><em>Unang Benta</em></div>
      <div class="chip" id="h-best"><small>Best</small><b>0</b></div>
    </div>
    <div class="signs" id="signs-l">
      <div class="sign"><h4>KAILANGAN</h4><div id="h-goals"></div></div>
      <div class="sign"><h4>GALAW</h4><div id="h-moves">0</div></div>
    </div>
    <div class="signs" id="signs-r">
      <div class="sign" id="sign-stars"><h4>BITUIN</h4><div class="stars" id="h-stars">☆☆☆</div><div class="meter"><i id="h-meter"></i><s id="h-s2"></s><s id="h-s3"></s></div></div>
    </div>
    <div id="callout"></div>
    <div id="bubble" hidden></div>
    <div class="corner"><button type="button" id="hint-btn" aria-label="Show a hint">💡</button><button type="button" id="pause-btn" aria-label="Pause">❚❚ Hinto</button></div>
  </div>
  <div id="toast" role="status" hidden></div>

  <section class="screen" id="title">
    <h1 class="logo">KAKANIN<br>CRUSH<small>UBOS-BENTA!</small></h1>
    <p class="tag">Tulungan si Lola Pacing na maubos ang paninda! Ipagpalit ang magkatabing kakanin para makabuo ng tatlo o higit pa.</p>
    <div class="row"><button type="button" class="primary" id="play">Laro na! · Play</button><button type="button" class="sound" id="sound"></button></div>
    <p class="tag" id="title-stars"></p>
  </section>

  <section class="screen" id="levels" hidden>
    <h2>San Roque</h2>
    <p class="tag">Sari-sari street, golden hour · <span id="town-stars"></span></p>
    <div class="grid" id="grid"></div>
    <div class="row"><button type="button" class="menu">Menu</button></div>
  </section>

  <section class="screen" id="intro" hidden>
    <h2 id="intro-name"></h2>
    <p class="tag" id="intro-goals"></p>
    <p id="intro-tip" class="tag"></p>
    <div class="row"><button type="button" class="primary" id="go">Simulan! · Start</button><button type="button" class="to-levels">Bumalik</button></div>
  </section>

  <section class="screen" id="pause" hidden>
    <h2>Hinto</h2>
    <div class="row"><button type="button" class="primary" id="resume">Tuloy · Resume</button><button type="button" id="restart">Ulitin</button><button type="button" class="to-levels">Mga Antas</button><button type="button" class="sound"></button></div>
  </section>

  <section class="screen" id="result" hidden>
    <h2 id="result-title"></h2>
    <div class="big-stars" id="result-stars"></div>
    <p class="tag" id="result-score"></p>
    <p class="tag" id="result-lola"></p>
    <div class="row"><button type="button" class="primary" id="next">Susunod ▶</button><button type="button" id="again">Ulitin</button><button type="button" class="to-levels">Mga Antas</button></div>
  </section>
  <p class="help" id="help">A match-3 by <a href="https://kon2raya.netlify.app" target="_blank" rel="noopener">Lemmuel Turaya</a> · <a href="https://tambayan-arcade.vercel.app/">More games</a> · <a href="https://tambayan-arcade.vercel.app/#support">☕ Support</a></p>
</main>
<script type="module" src="src/main.mjs"></script>
</body>
</html>
```

- [ ] **Step 3: Write `src/main.mjs`**

```js
// The page: screens, the HUD, input (drag, tap-tap, keys), the loop, sound and saves. The rules live in
// game.mjs and only change through swap(); the view animates their events and ignores input until the
// board is still again.
import { createGame, swap, hint, adjacent, findMoves, KAKANIN } from './game.mjs';
import { LEVELS, TOWN } from './levels.mjs';
import { chooseMove } from './bot.mjs';
import { load, save, record, isUnlocked, totalStars, fresh } from './progress.mjs';
import { createAudio } from './audio.mjs';

const Q = new URLSearchParams(location.search);
const TEST = Q.get('test') === '1', BOT = Q.has('bot'), FAST = Number(Q.get('fast')) || 1;
const store = TEST ? null : (() => { try { return window.localStorage; } catch { return null; } })();
let data = store ? load(store) : fresh();
const persist = () => { if (store) save(store, data); };
const $ = (id) => document.getElementById(id);
const reduced = () => data.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
const A = createAudio(); A.setMuted(data.muted);
const LOLA = {
  win: ['Ayan! Ubos ang paninda!', 'Galing mo, apo!', 'Busog ang barangay!'],
  lose: ['Hay naku, may natira pa. Ulitin natin!', 'Konti na lang, apo!', 'Bukas, mauubos din \'yan.'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ---------- the view: 3D, or the flat fallback ----------
let view;
async function makeView() {
  const canvas = $('view');
  const want3d = Q.get('flat') !== '1' && (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
  if (want3d) {
    try { const { createView } = await import('./view3d.mjs'); view = createView(canvas, { gfx: Q.get('gfx'), reduced, speed: FAST }); }
    catch (err) { console.warn('3D view failed, using the flat board', err); view = null; }
  }
  if (!view) { const { createFlat } = await import('./render2d.mjs'); const c2 = canvas.cloneNode(); canvas.replaceWith(c2); view = createFlat(c2); document.body.classList.add('flat'); }
  view.onCallout((text, step) => { const c = $('callout'); c.textContent = text; c.classList.remove('go'); void c.offsetWidth; c.classList.add('go'); });
  addEventListener('resize', () => view.resize());
  view.resize();
}

// ---------- state ----------
let mode = 'title', game = null, levelIx = 0, sel = -1, idle = 0, icons = {}, busy = false;
const SCREENS = ['title', 'levels', 'intro', 'pause', 'result'];
function show(name) {
  for (const id of SCREENS) $(id).hidden = id !== name;
  $('hud').hidden = !(name === null || name === 'pause');
  $('help').hidden = name === null;
  const first = name && ($(name).querySelector('button.primary') || $(name).querySelector('button'));
  if (first) first.focus({ preventScroll: true });
}
function toast(text, ms = 2600) { const t = $('toast'); t.textContent = text; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, ms); }
function hintOnce(id, text) { if (data.hints.includes(id)) return; data.hints.push(id); persist(); toast(text, 3600); }
function say(text) { const b = $('bubble'); b.innerHTML = '<b>Lola:</b> '; b.append(text); b.hidden = false; clearTimeout(say.t); say.t = setTimeout(() => { b.hidden = true; }, 3800); }

// ---------- HUD ----------
const goalText = (q) => (q.type === 'collect' ? `${KAKANIN[q.kind]}` : q.type === 'latik' ? 'latik' : 'puntos');
function drawGoals() {
  const box = $('h-goals'); box.replaceChildren();
  for (const q of game.goals) {
    const row = document.createElement('div'); row.className = 'goal' + (q.got >= q.need ? ' done' : '');
    if (q.type === 'collect' && icons[q.kind]) { const im = new Image(); im.src = icons[q.kind]; im.alt = KAKANIN[q.kind]; row.append(im); }
    const left = Math.max(0, q.need - q.got);
    row.append(q.type === 'score' ? `${Math.min(q.got, q.need)} / ${q.need}` : q.type === 'latik' ? `latik × ${left}` : `× ${left}`);
    box.append(row);
  }
}
function hud(prev) {
  const lv = LEVELS[levelIx];
  $('h-score').querySelector('b').textContent = game.score.toLocaleString('en-PH');
  $('h-best').querySelector('b').textContent = Math.max(data.best[lv.id] || 0, game.score).toLocaleString('en-PH');
  $('h-level').querySelector('b').textContent = `${TOWN.name.toUpperCase()} ${levelIx + 1}`;
  $('h-level').querySelector('em').textContent = lv.name;
  $('h-moves').textContent = game.moves; $('h-moves').classList.toggle('low', game.moves <= 5);
  const top = lv.stars[2] * 1.1; $('h-meter').style.width = `${Math.min(100, (game.score / top) * 100)}%`;
  $('h-s2').style.left = `${(lv.stars[1] / top) * 100}%`; $('h-s3').style.left = `${(lv.stars[2] / top) * 100}%`;
  const s = game.score >= lv.stars[2] ? 3 : game.score >= lv.stars[1] ? 2 : game.goals.every((q) => q.got >= q.need) ? 1 : 0;
  $('h-stars').textContent = '★'.repeat(s) + '☆'.repeat(3 - s);
  drawGoals();
  if (prev) game.goals.forEach((q, n) => { if (q.got !== prev[n]) { const el = $('h-goals').children[n]; el?.classList.add('pop'); A.event({ type: 'goal' }); } });
}

// ---------- flow ----------
function titleScreen() { mode = 'title'; game = null; $('title-stars').textContent = totalStars(data) ? `★ ${totalStars(data)} / ${LEVELS.length * 3}` : ''; show('title'); demo(); }
function levelsScreen() {
  mode = 'levels'; game = null;
  const grid = $('grid'); grid.replaceChildren();
  LEVELS.forEach((lv, k) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lvl'; b.disabled = !isUnlocked(data, k);
    b.innerHTML = `${k + 1}<small>${'★'.repeat(data.stars[lv.id] || 0)}</small>`; b.setAttribute('aria-label', `Level ${k + 1}, ${lv.name}`);
    b.onclick = () => intro(k); grid.append(b);
  });
  $('town-stars').textContent = `★ ${totalStars(data)} / ${LEVELS.length * 3}`;
  show('levels');
}
function intro(k) {
  levelIx = k; const lv = LEVELS[k]; mode = 'intro';
  $('intro-name').textContent = `${k + 1}. ${lv.name}`;
  $('intro-goals').textContent = 'Kailangan: ' + lv.goals.map((q) => (q.type === 'collect' ? `${q.n} ${q.kind}` : q.type === 'latik' ? 'linisin ang lahat ng latik' : `${q.n.toLocaleString('en-PH')} puntos`)).join(' · ') + ` — sa ${lv.moves} galaw`;
  $('intro-tip').textContent = lv.tip ? `Lola: "${lv.tip}"` : '';
  show('intro');
}
function start(k = levelIx) {
  levelIx = k; A.start(); A.music(true);
  const lv = LEVELS[k], seed = Q.get('seed') ? Number(Q.get('seed')) : (lv.seed * 7919 + Math.floor(Math.random() * 1e6)) >>> 0;
  game = createGame(lv, seed); sel = -1; idle = 0; busy = false;
  view.setGame(game); view.select(-1); view.showHint(null);
  mode = 'play'; show(null); hud();
  if (lv.tip) say(lv.tip);
  hintOnce('swap', 'I-drag ang kakanin papunta sa katabi, o i-tap ang dalawa.');
}
async function doSwap(a, b) {
  if (mode !== 'play' || busy || view.busy() || !adjacent(game, a, b)) return;
  busy = true; sel = -1; view.select(-1); view.showHint(null); idle = 0;
  const prev = game.goals.map((q) => q.got);
  const r = swap(game, a, b);
  for (const e of r.events) A.event(e);
  if (!r.ok) A.event({ type: 'tsk' });
  await view.play(r.events, game);
  hud(prev);
  busy = false;
  const end = r.events.find((e) => e.type === 'end');
  if (end) finish(end);
  else if (r.events.some((e) => e.type === 'shuffle')) say('Ayusin natin!');
  else if (r.events.some((e) => e.type === 'step' && e.made.length)) hintOnce('special', 'May espesyal ka! Gamitin sa tugma para sumabog.');
}
function finish(end) {
  const lv = LEVELS[levelIx];
  if (end.won) { data = record(data, lv.id, end.stars, end.score); persist(); }
  A.music(false);
  setTimeout(() => {
    mode = 'result';
    $('result-title').textContent = end.won ? 'Ubos ang paninda!' : 'May natira pa…';
    $('result-stars').textContent = end.won ? '★'.repeat(end.stars) + '☆'.repeat(3 - end.stars) : '';
    $('result-score').textContent = `${end.score.toLocaleString('en-PH')} puntos · best ${(data.best[lv.id] || end.score).toLocaleString('en-PH')}`;
    $('result-lola').textContent = `Lola: "${pick(end.won ? LOLA.win : LOLA.lose)}"`;
    $('next').hidden = !end.won || levelIx >= LEVELS.length - 1;
    show('result');
  }, 700 / FAST);
}
function pause() { if (mode === 'play') { mode = 'pause'; show('pause'); } }
function resume() { if (mode === 'pause') { mode = 'play'; show(null); } }

// ---------- input: drag a kakanin to a neighbour, or tap one then the other; keys move a cursor ----------
let down = null;
const stage = $('stage');
stage.addEventListener('pointerdown', (e) => {
  if (mode !== 'play' || busy || view.busy() || e.target.closest('button')) return;
  A.start();
  const i = view.pick(e.clientX, e.clientY); if (i < 0) return;
  down = { i, x: e.clientX, y: e.clientY, moved: false };
});
stage.addEventListener('pointermove', (e) => {
  if (!down || down.moved) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (Math.hypot(dx, dy) < 22) return;
  down.moved = true;
  const W = game.W, j = Math.abs(dx) > Math.abs(dy) ? down.i + Math.sign(dx) : down.i + Math.sign(dy) * W;
  if (adjacent(game, down.i, j)) doSwap(down.i, j);
});
stage.addEventListener('pointerup', () => {
  if (!down) return;
  const { i, moved } = down; down = null;
  if (moved || mode !== 'play') return;
  if (sel >= 0 && adjacent(game, sel, i)) { doSwap(sel, i); return; }
  sel = sel === i ? -1 : i; view.select(sel); A.event({ type: 'select' });
});
stage.addEventListener('pointercancel', () => { down = null; });
let cursor = -1;
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (mode === 'play') pause(); else if (mode === 'pause') resume(); return; }
  if (mode !== 'play' || !game) return;
  const W = game.W, H = game.H, d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -W, ArrowDown: W }[e.key];
  if (d !== undefined) {
    e.preventDefault();
    if (cursor < 0) cursor = Math.floor(H / 2) * W + Math.floor(W / 2);
    const to = cursor + d;
    if (!adjacent(game, cursor, to)) return;
    if (sel >= 0) { doSwap(sel, to); cursor = to; return; }
    cursor = to; view.select(cursor);
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault(); if (cursor < 0) return;
    sel = sel === cursor ? -1 : cursor; view.select(sel >= 0 ? sel : cursor); A.event({ type: 'select' });
  }
});

// ---------- buttons ----------
function labels() { for (const b of document.querySelectorAll('.sound')) b.textContent = data.muted ? '🔇' : '🔊'; }
for (const b of document.querySelectorAll('.sound')) b.onclick = () => { A.start(); data.muted = !data.muted; A.setMuted(data.muted); persist(); labels(); };
labels();
$('play').onclick = () => { A.start(); levelsScreen(); };
$('go').onclick = () => start(levelIx);
$('resume').onclick = resume;
$('restart').onclick = () => start(levelIx);
$('again').onclick = () => start(levelIx);
$('next').onclick = () => intro(levelIx + 1);
$('pause-btn').onclick = pause;
$('hint-btn').onclick = () => { if (mode === 'play' && game) view.showHint(hint(game)); };
for (const b of document.querySelectorAll('.to-levels')) b.onclick = levelsScreen;
for (const b of document.querySelectorAll('.menu')) b.onclick = titleScreen;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------- the title demo: the bot plays level 1 behind the title ----------
let demoT = 0;
function demo() { const g2 = createGame(LEVELS[0], (Math.random() * 1e9) >>> 0); game = g2; view.setGame(g2); }
async function demoMove() {
  if (!game || busy || view.busy()) return;
  if (game.phase !== 'play') { demo(); return; }
  const mv = chooseMove(game); if (!mv) { demo(); return; }
  busy = true; const r = swap(game, ...mv); await view.play(r.events, game); busy = false;
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000) * (mode === 'title' ? 1 : 1); last = now;
  if (mode === 'title' && (demoT += dt) > 1.2) { demoT = 0; demoMove(); }
  if (mode === 'play' && BOT && !busy && !view.busy() && game.phase === 'play') { const mv = chooseMove(game); if (mv) doSwap(...mv); }
  if (mode === 'play' && !busy && !view.busy() && game.phase === 'play' && (idle += dt) > 6) { view.showHint(hint(game)); idle = -999; }
  view.update(dt);
  requestAnimationFrame(frame);
}

await makeView();
icons = view.icons();
if ('serviceWorker' in navigator && !TEST) navigator.serviceWorker.register('sw.js').catch(() => { /* online only */ });
const startAt = Q.get('level') ? LEVELS.findIndex((l) => l.id === Q.get('level')) : -1;
if (startAt >= 0) start(startAt); else titleScreen();
requestAnimationFrame(frame);
if (TEST) window.__kc = { get game() { return game; }, get mode() { return mode; }, get view() { return view; }, start, swap: doSwap, moves: () => findMoves(game), LEVELS, busy: () => busy || view.busy() };
```

- [ ] **Step 4: Copy `vercel.json`**

```bash
cp ../hollow-blocks/vercel.json .
```

- [ ] **Step 5: Smoke-test in the browser**

```bash
python3 -m http.server 5520 --bind 127.0.0.1 >/dev/null 2>&1 &
```

Write `.scratch/smoke.mjs`:

```js
import { writeFileSync } from 'node:fs';
import { openChrome, sleep } from '../tools/cdp.mjs';
const page = await openChrome(9520);
await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: "window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message)));addEventListener('unhandledrejection',e=>__errs.push('rej '+String(e.reason)));" });
await page.viewport(1280, 760);
await page.load('http://127.0.0.1:5520/?test=1&level=sr-01&bot&fast=3');
await sleep(12000);
const r = await page.cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync('.scratch/smoke.png', Buffer.from(r.data, 'base64'));
console.log(await page.evaluate('JSON.stringify({ mode: __kc.mode, phase: __kc.game?.phase, score: __kc.game?.score, moves: __kc.game?.moves, errs: __errs })'));
await page.close().catch(() => {});
```

Run: `node .scratch/smoke.mjs`
Expected: `errs: []`, a `score > 0`, `moves` below 18 (or mode `result`). Look at `.scratch/smoke.png`: the stall and street, the bilao with 3D kakanin, the HUD chips and signboards. Fix anything broken before committing.

- [ ] **Step 6: Commit**

```bash
git add index.html src/main.mjs src/render2d.mjs vercel.json
git commit -m "The page: Hollow Blocks-style HUD and signboards, drag/tap/keys input, level select, results, the 2D fallback

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Browser checks (desktop, phone, input, fallback, resize)

**Files:**
- Create: `tools/check.mjs`

**Interfaces:**
- Consumes: `window.__kc` (Task 11), and the `view.dump()` and `pick()` members.
- Run: `node tools/check.mjs [port|url]`. Every check prints `ok`/`FAIL`, and screenshots go to `.scratch/check-*.png`. The script exits non-zero if any check fails.

- [ ] **Step 1: Write `tools/check.mjs`**

```js
// node tools/check.mjs [port | url]: Kakanin Crush in headless Chrome — desktop and phone, drag and tap,
// rapid input during a cascade, the flat fallback, a resize mid-cascade, and no page errors.
import { openChrome, sleep } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const arg = process.argv[2] || '5520';
const BASE = arg.startsWith('http') ? arg.replace(/\/?$/, '/') : `http://127.0.0.1:${arg}/`;
mkdirSync('.scratch', { recursive: true });
const page = await openChrome(9600 + Math.floor(Math.random() * 90));
await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: "window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message)));addEventListener('unhandledrejection',e=>__errs.push('rej '+String(e.reason)));" });
const E = (js) => page.evaluate(js);
const until = async (js, ms = 20000) => { for (let t = 0; t < ms; t += 200) { if (await E(js)) return true; await sleep(200); } return false; };
const shot = async (name) => { const r = await page.cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(`.scratch/check-${name}.png`, Buffer.from(r.data, 'base64')); };
const fails = [];
const check = (ok, what) => { console.log(ok ? 'ok  ' : 'FAIL', what); if (!ok) fails.push(what); };
const mouse = async (type, x, y) => page.cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
// screen point of a cell, found by scanning with the view's own picking
const cellPoint = (i) => E(`(() => { const c = document.querySelector('canvas'), r = c.getBoundingClientRect(); for (let y = r.top; y < r.bottom; y += 6) for (let x = r.left; x < r.right; x += 6) if (__kc.view.pick(x, y) === ${i}) return [x + 3, y + 3]; return null; })()`);
const matches = () => E(`JSON.stringify(__kc.view.dump().kinds) === JSON.stringify(Array.from(__kc.game.cell).map((c, i) => __kc.game.mask[i] ? c : -1))`);

// 1. desktop title, then a level
await page.viewport(1280, 760);
await page.load(`${BASE}?test=1`);
await until('!!window.__kc'); await sleep(2500); await shot('title');
check(await E('__kc.mode') === 'title', 'title screen');
await page.load(`${BASE}?test=1&level=sr-01&seed=4`);
await until('window.__kc && __kc.mode === "play"'); await sleep(1500); await shot('desktop-play');
// 2. drag a real move
const [a, b] = JSON.parse(await E('JSON.stringify(__kc.moves()[0])'));
const pa = await cellPoint(a), pb = await cellPoint(b);
check(pa && pb, 'cells can be picked on screen');
const before = await E('__kc.game.moves');
await mouse('mousePressed', ...pa); await mouse('mouseMoved', (pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2); await mouse('mouseMoved', ...pb); await mouse('mouseReleased', ...pb);
await until('!__kc.busy()', 8000);
check(await E('__kc.game.moves') === before - 1, 'drag swaps and costs one move');
check(await matches(), 'the 3D board matches the rules after the move');
// 3. tap-tap
const [c, d] = JSON.parse(await E('JSON.stringify(__kc.moves()[0])'));
const pc = await cellPoint(c), pd = await cellPoint(d);
await mouse('mousePressed', ...pc); await mouse('mouseReleased', ...pc); await mouse('mousePressed', ...pd); await mouse('mouseReleased', ...pd);
await until('!__kc.busy()', 8000);
check(await E('__kc.game.moves') === before - 2, 'tap one, tap its neighbour: a swap');
// 4. rapid input while the board animates: only one swap counts
const [e2, f2] = JSON.parse(await E('JSON.stringify(__kc.moves()[0])'));
const pe = await cellPoint(e2), pf = await cellPoint(f2), m0 = await E('__kc.game.moves');
await mouse('mousePressed', ...pe); await mouse('mouseMoved', ...pf); await mouse('mouseReleased', ...pf);
for (let k = 0; k < 6; k++) { await mouse('mousePressed', ...pe); await mouse('mouseMoved', ...pf); await mouse('mouseReleased', ...pf); }
await until('!__kc.busy()', 8000);
check((await E('__kc.game.moves')) >= m0 - 2, 'taps during a cascade are ignored, not queued');
check(await matches(), 'still in sync after rapid input');
// 5. a resize mid-cascade
const [g2, h2] = JSON.parse(await E('JSON.stringify(__kc.moves()[0])'));
await E(`__kc.swap(${g2}, ${h2})`); await sleep(120); await page.viewport(900, 700); await sleep(200); await page.viewport(1280, 760);
await until('!__kc.busy()', 8000);
check(await matches(), 'a resize during a cascade leaves the board right');
// 6. the bot finishes a level and the result screen shows
await page.load(`${BASE}?test=1&level=sr-01&bot&fast=4&seed=2`);
check(await until('__kc.mode === "result"', 90000), 'the bot finishes level 1');
await shot('result');
// 7. phone portrait: the bilao fills the width, the HUD strip above it
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
await page.load(`${BASE}?test=1&level=sr-06&seed=3`);
await until('window.__kc && __kc.mode === "play"'); await sleep(1500); await shot('phone-play');
const span = JSON.parse(await E(`JSON.stringify((() => { const g = __kc.game, cols = []; for (let x = 0; x < innerWidth; x += 3) { const i = __kc.view.pick(x, innerHeight * 0.62); if (i >= 0) cols.push(x); } return [cols[0], cols.at(-1)]; })())`));
check(span[1] - span[0] >= 390 * 0.85 - 40, `the board spans the phone's width (${span[1] - span[0]}px of 390)`);
const signBottom = await E(`Math.max(...[...document.querySelectorAll('.sign')].map((s) => s.getBoundingClientRect().bottom))`);
const boardTop = await E(`(() => { for (let y = 0; y < innerHeight; y += 3) if (__kc.view.pick(innerWidth / 2, y) >= 0) return y; return 9999; })()`);
check(signBottom <= boardTop + 4, `the signboards sit above the board (${signBottom} ≤ ${boardTop})`);
// 8. the flat fallback is playable
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 760, deviceScaleFactor: 1, mobile: false });
await page.load(`${BASE}?test=1&level=sr-01&flat=1&bot&fast=4&seed=5`);
check(await until('__kc.mode === "result"', 60000), 'the flat fallback plays a level through');
await shot('flat');
check((await E('JSON.stringify(__errs)')) === '[]', `no page errors ${await E('JSON.stringify(__errs)')}`);
await page.close().catch(() => {});
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall ok');
process.exit(fails.length ? 1 : 0);
```

- [ ] **Step 2: Run it**

Run: `python3 -m http.server 5520 --bind 127.0.0.1 >/dev/null 2>&1 & sleep 1; node tools/check.mjs`
Expected: every line `ok`, then `all ok`.

**If the phone width check fails:** in `view3d.mjs` `fit()`, change the portrait multiplier `dist * (portrait ? 1.02 : 1)` to `0.92`, and re-run.

**If the signboards overlap the board:** in `index.html`, increase the portrait `.signs` `top` offset, or lower the portrait camera `target.z` (`-1.6`) toward `-2.2`, which raises the board on screen. Then re-run.

- [ ] **Step 3: Look at every screenshot**

Open `.scratch/check-title.png`, `check-desktop-play.png`, `check-result.png`, `check-phone-play.png` and `check-flat.png`, and confirm each:
- The stall scene matches the approved prototype's look.
- The kakanin read clearly.
- The HUD chips and signboards are legible, and nothing overlaps.
- The phone layout has the strip above a full-width bilao.

Fix anything ugly before committing.

- [ ] **Step 4: Run all unit tests**

Run: `node --test test/`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add tools/check.mjs
git commit -m "Browser checks: drag, tap, rapid input, resize mid-cascade, phone layout, flat fallback

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: PWA, icons, share image, README

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/*`, `og.jpg`, `README.md`, `LICENSE`, `test/pwa.test.mjs`

- [ ] **Step 1: Write the failing test** `test/pwa.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

test('every module, vendor file, env asset and icon is precached, and every precached file exists', () => {
  for (const f of readdirSync(new URL('../src', import.meta.url)).filter((f) => f.endsWith('.mjs'))) assert.ok(assets.includes(`src/${f}`), `src/${f}`);
  for (const f of readdirSync(new URL('../src/vendor', import.meta.url)).filter((f) => f.endsWith('.js'))) assert.ok(assets.includes(`src/vendor/${f}`), `src/vendor/${f}`);
  for (const d of ['sky', 'tex', 'props']) for (const f of readdirSync(new URL(`../assets/env/${d}`, import.meta.url))) assert.ok(assets.includes(`assets/env/${d}/${f}`), `assets/env/${d}/${f}`);
  const manifest = JSON.parse(readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  for (const i of manifest.icons) assert.ok(assets.includes(i.src), i.src);
  for (const a of assets.filter((x) => x !== './')) assert.ok(existsSync(new URL(`../${a}`, import.meta.url)), `${a} missing`);
});
```

- [ ] **Step 2: Write `sw.js`**

```js
// Offline play: the game's files are cached on install and served cache-first; the webfont is cached
// the first time it loads. Bump VERSION whenever a file changes so players get the update.
const VERSION = 'kakanin-v1';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'src/main.mjs', 'src/game.mjs', 'src/rng.mjs', 'src/levels.mjs', 'src/bot.mjs', 'src/progress.mjs', 'src/audio.mjs',
  'src/view3d.mjs', 'src/kakanin3d.mjs', 'src/stall3d.mjs', 'src/render2d.mjs', 'src/tex.mjs', 'src/post.mjs',
  'src/vendor/three.module.min.js', 'src/vendor/three-extra.min.js', 'src/vendor/three-fx.min.js', 'src/vendor/three-mocap.min.js',
  'assets/env/sky/kloppenheim_06_puresky.hdr', 'assets/env/sky/bd_golden.jpg',
  'assets/env/tex/asphalt_02_diff.jpg', 'assets/env/tex/asphalt_02_nor.jpg', 'assets/env/tex/rusty_corrugated_iron_diff.jpg', 'assets/env/tex/rusty_corrugated_iron_nor.jpg',
  'assets/env/props/plastic_monobloc_chair_01.glb', 'assets/env/props/plastic_crate_02.glb', 'assets/env/props/small_lpg_tank.glb', 'assets/env/props/Barrel_01.glb', 'assets/env/props/wooden_bucket_02.glb',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !font) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: url.origin === location.origin });
    if (hit) return hit;
    try { const res = await fetch(e.request); if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone()); return res; }
    catch { return (await cache.match('index.html')) || Response.error(); }
  }));
});
```

- [ ] **Step 3: Write `manifest.webmanifest`**

```json
{
  "name": "Kakanin Crush: Ubos-Benta!",
  "short_name": "Kakanin Crush",
  "description": "Match-3, Pinoy style, in 3D: swap the kakanin on Lola Pacing's bilao.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#2a1a12",
  "theme_color": "#2a1a12",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 4: Make the icons and share image from the game itself**

Write `.scratch/art.mjs`. It renders a sapin-sapin, puto and ube on a bilao for the icon, and captures gameplay for `og.jpg`:

```js
import { writeFileSync } from 'node:fs';
import { openChrome, sleep } from '../tools/cdp.mjs';
const page = await openChrome(9530);
await page.viewport(1200, 630);
await page.load('http://127.0.0.1:5520/?test=1&level=sr-06&bot&fast=1&seed=9');
await sleep(9000);
let r = await page.cdp('Page.captureScreenshot', { format: 'jpeg', quality: 86 }); writeFileSync('og.jpg', Buffer.from(r.data, 'base64'));
await page.viewport(512, 512);
await page.load('http://127.0.0.1:5520/?test=1&level=sr-01&seed=3');
await sleep(3000);
await page.evaluate("document.getElementById('hud').hidden = true; document.getElementById('help').hidden = true; true");
r = await page.cdp('Page.captureScreenshot', { format: 'png', clip: { x: 56, y: 96, width: 400, height: 400, scale: 512 / 400 } }); writeFileSync('icons/icon-512.png', Buffer.from(r.data, 'base64'));
await page.close().catch(() => {});
```

Run:

```bash
mkdir -p icons && node .scratch/art.mjs && sips -z 192 192 icons/icon-512.png --out icons/icon-192.png && sips -z 180 180 icons/icon-512.png --out icons/apple-touch-icon.png
```

Look at `icons/icon-512.png` and `og.jpg`. The icon must show kakanin clearly; adjust the clip rectangle until it does.

- [ ] **Step 5: Write `README.md` and `LICENSE`**

```bash
cp ../hollow-blocks/LICENSE .
```

`README.md`:

```markdown
# Kakanin Crush

**Ubos-Benta!** Match-3, Pinoy style, in 3D. Swap puto, kutsinta, sapin-sapin, bibingka, ube halaya and suman on Lola Pacing's bilao at her fiesta stall, and sell out before your moves run out.

**Play:** https://kakanin-crush.vercel.app

## How to play

- **Drag** a kakanin onto a neighbour, or **tap** one and then the other, to swap them. On a keyboard: arrows move, Space picks up, arrows swap.
- Line up 3 or more of the same to clear them. A swap that matches nothing slides back and costs nothing.
- **Sandok** (4 in a line) clears a whole row or column. **Kaldero** (an L or T) bursts the 3×3 around it. **Bilao ng Lahat** (5 in a line) clears every kakanin of the kind you swap it with.
- Swap two specials together for a combo, up to two Bilao ng Lahat clearing the whole board.
- **Latik** sticks under some kakanin: match on top to clean it.
- Finish the order with moves to spare and Lola calls an **Ubos-Benta**: every move left becomes a Sandok.

## San Roque

The first town has 15 levels on a sari-sari street at golden hour. More towns, Lola's orders, the daily bilao, endless and Karera modes come in the next phases (see `docs/superpowers/specs/`).

## Run locally

python3 -m http.server 8000

Tests (Node 20+): `node --test test/`. They cover the rules, the levels (and their balance by a bot), saves and the offline cache. `node tools/check.mjs` runs the browser checks.

Made by [Lemmuel Turaya](https://kon2raya.netlify.app). The 3D street uses CC0 scans from Poly Haven; everything else is drawn and synthesized in code.

## License

MIT
```

- [ ] **Step 6: Run the tests**

Run: `node --test test/`
Expected: all pass, including `pwa.test.mjs`.

- [ ] **Step 7: Commit**

```bash
git add manifest.webmanifest sw.js icons og.jpg README.md LICENSE test/pwa.test.mjs
git commit -m "Offline play, icons, share image, README

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Ship: GitHub, Pages, Vercel, Tambayan, memory

**Files:**
- Modify: `../tambayan/games.json`, add `../tambayan/thumbs/kakanin-crush.webp`
- Create: the memory note update at `/Users/kon2raya/.claude/projects/-private-var-www-others/memory/kakanin-crush-game.md`

- [ ] **Step 1: GitHub repo and Pages**

```bash
gh repo create kon2raya24/kakanin-crush --public --description "Kakanin Crush: match-3, Pinoy style, in 3D. Ubos-Benta!" --homepage "https://kakanin-crush.vercel.app"
git remote add origin https://github.com/kon2raya24/kakanin-crush.git
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -u origin main
gh api -X POST repos/kon2raya24/kakanin-crush/pages -f "source[branch]=main" -f "source[path]=/"
```

If GitHub is unreachable (curl exit 35 has happened on this network), retry later and continue with Vercel.

- [ ] **Step 2: Vercel**

```bash
npx --yes vercel@latest deploy --prod --yes
```

Expected: `Aliased https://kakanin-crush.vercel.app`. If the name is taken, add a free name with `npx vercel domains add <name>.vercel.app kakanin-crush` (a plain alias is SSO-protected) and use it everywhere below.

- [ ] **Step 3: Check live**

```bash
node tools/check.mjs https://kakanin-crush.vercel.app/
curl -s -o /dev/null -w "%{http_code}\n" https://kakanin-crush.vercel.app/assets/env/sky/bd_golden.jpg
```

Expected: `all ok` and `200`. Headless Chrome on this network can be slow to reach Vercel. If only timing checks fail, re-run once and compare with the local run before calling it a site problem.

- [ ] **Step 4: List it in Tambayan**

Make the thumbnail from `.scratch/check-desktop-play.png`:

```bash
sips -c 450 800 .scratch/check-desktop-play.png --out .scratch/thumb.png && cwebp -quiet -q 82 .scratch/thumb.png -o ../tambayan/thumbs/kakanin-crush.webp
```

Add this entry **first** in `../tambayan/games.json`'s `games` array:

```json
{
  "id": "kakanin-crush",
  "title": "Kakanin Crush",
  "tagline": "Match-3, Pinoy style, in 3D",
  "description": "Swap puto, kutsinta, sapin-sapin, bibingka, ube halaya and suman on Lola Pacing's bilao at a fiesta stall. Make a Sandok, a Kaldero, a Bilao ng Lahat, clean the latik, and sell out with an Ubos-Benta.",
  "genre": "Puzzle",
  "tags": ["Match-3", "Classic", "3D"],
  "url": "https://kakanin-crush.vercel.app/",
  "mirror": "https://kon2raya24.github.io/kakanin-crush/",
  "repo": "https://github.com/kon2raya24/kakanin-crush",
  "thumb": "thumbs/kakanin-crush.webp",
  "controls": "Touch · Mouse · Keyboard",
  "status": "live",
  "added": "2026-10-08"
}
```

Then:

```bash
cd ../tambayan && node --test test/*.test.mjs && git add games.json thumbs/kakanin-crush.webp && git commit -m "Add Kakanin Crush

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" && git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -q origin main && npx --yes vercel@latest deploy --prod --yes
curl -s https://tambayan-arcade.vercel.app/games.json | grep -c kakanin-crush
```

Expected: tests pass, and `1`.

- [ ] **Step 5: Update the memory note** `kakanin-crush-game.md`. Add:
  - the live URLs
  - test hooks (`?test=1&level&bot&fast&seed&gfx&flat`, `window.__kc`)
  - the check commands
  - the sw VERSION
  - the final balance table summary
  - "phase 2 next: Mixamo Lola (needs the user's go-ahead)"

- [ ] **Step 6: Tick every checkbox in this plan, then commit and push**

```bash
git add docs/superpowers/plans/2026-10-08-kakanin-crush-phase1.md && git commit -m "Phase 1 plan: done

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" && git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -q origin main
```

---

## After this phase

The user plays San Roque on a phone and a desktop and gives feedback. Phase 2's plan (Mixamo Lola, juice, results screen polish) is written from that feedback.
