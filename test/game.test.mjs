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
