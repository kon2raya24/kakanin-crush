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
  const row = (s) => Array(ok.h).fill('.'.repeat(ok.w)).map((r, y) => (y === 0 ? s.padEnd(ok.w, '.') : r));
  assert.ok(validateLevel({ ...ok, goals: [{ type: 'dahon' }] }).length, 'a dahon goal needs wraps');
  assert.ok(validateLevel({ ...ok, goals: [{ type: 'kahon' }] }).length, 'a kahon goal needs crates');
  assert.ok(validateLevel({ ...ok, goals: [{ type: 'langgam' }] }).length, 'a langgam goal needs ants');
  assert.ok(validateLevel({ ...ok, goals: [{ type: 'deliver', kind: 'gata', n: 3 }] }).length, 'a delivery needs ingredients');
  assert.ok(validateLevel({ ...ok, crates: row('4') }).length, 'crates have 1-3 hp');
  assert.ok(validateLevel({ ...ok, crates: row('1'), ants: row('a') }).length, 'a crate and ants on one cell');
  assert.ok(validateLevel({ ...ok, ingredients: { gata: 2, onBoard: 0 }, goals: [{ type: 'deliver', kind: 'gata', n: 2 }] }).length, 'ingredients need room on the board');
  assert.deepEqual(validateLevel({ ...ok, crates: row('2'), goals: [{ type: 'kahon' }] }), []);
  assert.deepEqual(validateLevel({ ...ok, ingredients: { gata: 2, onBoard: 1 }, goals: [{ type: 'deliver', kind: 'gata', n: 2 }] }), []);
});
