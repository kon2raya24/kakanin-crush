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

test('booster counts load cleaned (0..3 of the four kinds), and a phase-2 save without them loads unchanged', () => {
  const old = { v: 1, stars: { 'sr-01': 3 }, best: { 'sr-01': 9000 }, muted: true, calm: false, hints: ['swap'] };
  const d = load(mem({ [KEY]: JSON.stringify(old) }));
  assert.equal(d.stars['sr-01'], 3); assert.equal(d.muted, true); assert.deepEqual(d.boosters, {}); assert.equal(d.granted, 0);
  const e = load(mem({ [KEY]: JSON.stringify({ ...old, boosters: { sandok: 9, merienda: 2, pamaypay: -1, siyanse: 'x', bomba: 3 }, granted: 4.7 }) }));
  assert.deepEqual(e.boosters, { sandok: 3, merienda: 2 }); assert.equal(e.granted, 4);
});
