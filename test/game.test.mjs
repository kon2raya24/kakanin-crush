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

test('a board no shuffle can fix ends the level instead of leaving you stuck', () => {
  // a 2x2 bilao has no room for three in a row; two Sandoks side by side can still be swapped (a combo),
  // and after that nothing can ever move
  const g = setBoard(createGame(L({ w: 2, h: 2, kinds: ['puto', 'kutsinta', 'sapin', 'bibingka'], goals: [{ type: 'collect', kind: 'bibingka', n: 99 }] })), ['pk', 'bu']);
  g.spec[0] = SANDOK_H; g.spec[1] = SANDOK_V;
  const r = swap(g, 0, 1);
  assert.equal(r.ok, true);
  assert.ok(r.events.some((e) => e.type === 'shuffleFail'));
  assert.equal(g.phase, 'lost');
  assert.deepEqual(r.events.at(-1), { type: 'end', won: false, stars: 0, score: g.score });
});

test('a new special never replaces one already on the board', () => {
  const g = setBoard(createGame(L()), ['ppppk', 'kbumb', 'bumkb', 'umkbs', 'mkbsu']);
  for (let i = 0; i < 4; i++) g.spec[i] = SANDOK_V; // the whole run of four is already special
  const gr = findGroups(g)[0];
  assert.equal(_t.placeFor(g, gr, SANDOK_H, []), -1);
});

// ---------- phase 3: blockers, deliveries, boosters ----------
import { KAHON, LANGGAM, GATA, ASUKAL, useBooster } from '../src/game.mjs';
const BCH = { K: KAHON, A: LANGGAM, g: GATA, z: ASUKAL };
function setBlockers(g, rows) {
  rows.forEach((r, y) => [...r].forEach((c, x) => { const i = y * g.W + x; if (c in BCH) { g.cell[i] = BCH[c]; g.spec[i] = NONE; if (c === 'K' && !g.crate[i]) g.crate[i] = 1; } }));
  return g;
}

test('barriers split a column: pieces stack on a crate, and the cells under it refill from just below it', () => {
  const g = setBoard(createGame(L({ w: 3, h: 4 })), ['kbu', 'mbs', 'pus', 'bus']);
  setBlockers(g, ['...', 'K..', '...', '...']);
  g.cell[9] = EMPTY;
  assert.deepEqual(_t.gravity(g).map(([a, b]) => `${a}>${b}`), ['6>9']);
  assert.equal(g.cell[0], 1, 'the kutsinta above the crate stays put');
  const sp = _t.refill(g);
  assert.deepEqual(sp.map(([i, , n, top]) => [i, n, top]), [[6, 1, 2]]);
});

test('dahon: a wrapped piece cannot move or fall, and a match on it or beside it unwraps it', () => {
  const g = setBoard(createGame(L()), ['kppbu', 'pkbum', 'bumkb', 'umkbs', 'mkbsu']);
  g.wrap[3] = 1; // the bibingka at (3,0)
  assert.equal(swap(g, 3, 4).ok, false, 'a wrapped piece cannot be swapped');
  const r = swap(g, 0, 5); // puto at 0,1,2: cell 2 is beside the wrap
  const s = r.events.find((e) => e.type === 'step');
  assert.deepEqual(s.hits, [[3, 'wrap', 0]]);
  assert.equal(g.wrap[3], 0);
  const h = setBoard(createGame(L()), ['kppbu', 'pkbum', 'bumkb', 'umkbs', 'mkbsu']);
  h.wrap[1] = 1; // the middle puto of the coming match is wrapped
  const s2 = swap(h, 0, 5).events.find((e) => e.type === 'step');
  assert.ok(!s2.cleared.some(([i]) => i === 1), 'the wrapped puto is freed, not cleared');
  assert.ok(s2.hits.some(([i, w]) => i === 1 && w === 'wrap'));
  const f = setBoard(createGame(L({ w: 1, h: 3 })), ['p', 'k', 's']);
  f.wrap[1] = 1; f.cell[2] = EMPTY;
  _t.gravity(f);
  assert.equal(f.cell[1], 1, 'it does not fall'); assert.equal(f.cell[2], EMPTY);
});

test('kahon: each nearby clear takes one hp; at zero the crate is gone and counts for the goal', () => {
  const g = setBoard(createGame(L({ goals: [{ type: 'kahon' }], crates: ['.....', '..2..', '.....', '.....', '.....'] })), ['kppbu', 'pkbum', 'bumkb', 'umkbs', 'mkbsu']);
  setBlockers(g, ['.....', '..K..', '.....', '.....', '.....']); g.crate[7] = 2;
  assert.equal(g.goals[0].need, 1);
  const s = swap(g, 0, 5).events.find((e) => e.type === 'step');
  assert.deepEqual(s.hits.filter(([i]) => i === 7), [[7, 'crate', 1]]);
  assert.equal(g.cell[7], KAHON);
  assert.equal(swap(g, 7, 8).ok, false, 'a crate cannot be swapped');
  g.crate[7] = 1;
  const t2 = setBoard(createGame(L({ goals: [{ type: 'kahon' }], crates: ['.....', '..1..', '.....', '.....', '.....'] })), ['kppbu', 'pkbum', 'bumkb', 'umkbs', 'mkbsu']);
  setBlockers(t2, ['.....', '..K..', '.....', '.....', '.....']);
  swap(t2, 0, 5);
  assert.notEqual(t2.cell[7], KAHON); assert.equal(t2.goals[0].got, 1);
});

test('langgam: a nearby clear removes ants; a quiet turn lets them spread; ants everywhere lose the level', () => {
  const g = setBoard(createGame(L({ goals: [{ type: 'langgam' }], ants: ['.....', '..a..', '.....', '.....', '.....'] })), ['kppbu', 'pkbum', 'bumkb', 'umkbs', 'mkbsu']);
  setBlockers(g, ['.....', '..A..', '.....', '.....', '.....']);
  const s = swap(g, 0, 5).events.find((e) => e.type === 'step');
  assert.ok(s.hits.some(([i, w]) => i === 7 && w === 'ant'));
  assert.equal(g.goals[0].got, 1);
  const q = setBoard(createGame(L({ goals: [{ type: 'langgam' }], ants: ['....a', '.....', '.....', '.....', '.....'], moves: 5 })), ['kppbu', 'pkbum', 'bumkb', 'umkbs', 'mkbsu']);
  setBlockers(q, ['....A', '.....', '.....', '.....', '.....']);
  const before = [...q.cell].filter((c) => c === LANGGAM).length;
  const r = swap(q, 0, 5); // the match is far from the ant
  assert.ok(r.events.some((e) => e.type === 'ants'));
  assert.equal([...q.cell].filter((c) => c === LANGGAM).length, before + 1);
  const w = setBoard(createGame(L({ w: 2, h: 1, goals: [{ type: 'langgam' }], ants: ['a.'] })), ['pk']);
  setBlockers(w, ['A.']);
  const ev = []; _t.spreadAnts(w, ev);
  assert.equal(w.phase, 'lost'); assert.ok(ev.some((e) => e.type === 'antsWin'));
});

test('ingredients never match, survive blasts, and are delivered at the bottom for the goal', () => {
  const g = setBoard(createGame(L({ goals: [{ type: 'deliver', kind: 'gata', n: 1 }] })), ['kbumk', 'bumkb', 'umkbs', 'mkbsu', 'kumbs']);
  setBlockers(g, ['ggg..', '.....', '.....', '.....', '.....']);
  assert.equal(findGroups(g).length, 0, 'three gata in a row are not a match');
  const h = setBoard(createGame(L({ goals: [{ type: 'deliver', kind: 'gata', n: 1 }] })), ['kbumk', 'bumkb', 'pkpbu', 'kpukb', 'mkbsu']);
  setBlockers(h, ['.....', '.....', '...g.', '.....', '.....']);
  h.spec[12] = SANDOK_H; // the puto at (2,2) is a row Sandok: the match sets it off across row 2, gata and all
  const rb = swap(h, 11, 16); // the puto at (1,3) moves up: puto at 10, 11, 12
  assert.ok(rb.events.find((e) => e.type === 'step').fired.length === 1);
  assert.ok(h.cell.includes(GATA), 'the gata survives the blast (and has sunk since)');
  const d = setBoard(createGame(L({ w: 3, h: 4, goals: [{ type: 'deliver', kind: 'gata', n: 1 }] })), ['kbu', 'bpm', 'mps', 'ukp']);
  setBlockers(d, ['.g.', '...', '...', '...']);
  // swap (1,3)=k with (2,3)=p: column 1 below the gata reads p p p, so the gata falls to the bottom row and is delivered
  const r = swap(d, 10, 11);
  assert.ok(r.events.some((e) => e.type === 'step' && e.delivered && e.delivered.some(([, k]) => k === GATA)));
  assert.equal(d.goals[0].got, 1);
});

test('ingredients are heavy: after a turn each sinks a row, is delivered at the bottom, and stops on a barrier', () => {
  const G = () => setBoard(createGame(L({ goals: [{ type: 'deliver', kind: 'gata', n: 2 }] })), ['kbumk', 'bumkb', 'umkbs', 'mkbsu', 'kumbs']);
  let g = G(); setBlockers(g, ['.....', '..g..', '.....', '.....', '.....']);
  let ev = []; _t.sink(g, ev);
  assert.equal(g.cell[12], GATA, 'one row down'); assert.equal(g.cell[7], KAKANIN.indexOf('kutsinta'), 'the piece under it came up');
  assert.deepEqual(ev.find((e) => e.type === 'sink').moved, [[7, 12]]);
  g = G(); setBlockers(g, ['.....', '.....', '.....', '..g..', '.....']);
  ev = []; _t.sink(g, ev);
  assert.ok(ev.some((e) => e.type === 'step' && e.delivered.some(([i, k]) => i === 22 && k === GATA)), 'sinking into the bottom row delivers');
  assert.equal(g.goals[0].got, 1);
  g = G(); setBlockers(g, ['.....', '..g..', '..K..', '.....', '.....']);
  ev = []; _t.sink(g, ev);
  assert.equal(g.cell[7], GATA, 'a crate holds it up'); assert.equal(ev.length, 0);
  g = createGame(L({ w: 7, h: 7, seed: 4, ingredients: { gata: 2, onBoard: 1 }, goals: [{ type: 'deliver', kind: 'gata', n: 2 }] }));
  const r = swap(g, ...findMoves(g)[0]);
  assert.ok(r.events.some((e) => e.type === 'sink' || (e.type === 'step' && e.delivered.length)), 'a real turn sinks the gata');
});

test('ingredients spawn at a column top while more are owed', () => {
  const g = createGame(L({ w: 5, h: 5, ingredients: { gata: 2, onBoard: 1 }, goals: [{ type: 'deliver', kind: 'gata', n: 2 }] }));
  assert.equal([...g.cell].filter((c) => c === GATA).length, 1, 'one on the board to start');
  assert.ok([...g.cell].slice(0, 5).includes(GATA), 'in the top row');
});

test('boosters: Merienda, a Sandok in hand, the Siyanse and the Pamaypay; bad targets are refused', () => {
  let g = createGame(L({ w: 7, h: 7, seed: 9 }));
  const m0 = g.moves;
  assert.equal(useBooster(g, 'merienda').ok, true); assert.equal(g.moves, m0 + 5);
  assert.equal(useBooster(g, 'sandok', 24).ok, true); assert.ok([SANDOK_H, SANDOK_V].includes(g.spec[24]));
  const before = hashState(g), r = useBooster(g, 'siyanse', 10);
  assert.equal(r.ok, true); assert.ok(r.events.some((e) => e.type === 'step' && e.cleared.some(([i]) => i === 10)));
  assert.notEqual(hashState(g), before);
  assert.equal(g.moves, m0 + 5, 'boosters cost no move');
  assert.ok(useBooster(g, 'pamaypay').events.some((e) => e.type === 'shuffle'));
  for (const [k, t] of [['sandok', -1], ['sandok', 999], ['siyanse', NaN], ['nope', 1]]) assert.equal(useBooster(g, k, t).ok, false);
  g = setBoard(createGame(L()), ['kppbu', 'pkbum', 'bumkb', 'umkbs', 'mkbsu']); setBlockers(g, ['.....', '..K..', '.....', '.....', '.....']); g.crate[7] = 2;
  useBooster(g, 'siyanse', 7); assert.equal(g.crate[7], 1, 'the Siyanse takes a crate hp');
  g.phase = 'won'; assert.equal(useBooster(g, 'merienda').ok, false);
});

test('replays with every blocker stay exact', () => {
  const lv = L({ w: 8, h: 8, kinds: KAKANIN.slice(0, 5), moves: 30, seed: 4, wrap: ['........', '..w..w..', '........', '........', '........', '........', '........', '........'], crates: ['........', '........', '........', '...23...', '........', '........', '........', '........'], ants: ['a.......', '........', '........', '........', '........', '........', '........', '.......a'], ingredients: { gata: 3, onBoard: 1 }, goals: [{ type: 'deliver', kind: 'gata', n: 3 }, { type: 'kahon' }] });
  const play = () => { const g = createGame(lv); for (let k = 0; k < 25 && g.phase === 'play'; k++) { const mv = findMoves(g); if (!mv.length) break; swap(g, ...mv[k % mv.length]); } return hashState(g); };
  assert.equal(play(), play());
});
