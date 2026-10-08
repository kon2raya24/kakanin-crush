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
