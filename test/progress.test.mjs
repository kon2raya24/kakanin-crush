import test from 'node:test';
import assert from 'node:assert/strict';
import { KEY, fresh, load, save, record, isUnlocked, totalStars, townOpen, starsToOpen, grant, BOOSTERS } from '../src/progress.mjs';
import { TOWNS, LEVELS } from '../src/levels.mjs';

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

const clearTown = (d, t, stars = 3) => { for (const id of TOWNS[t].levels) d = record(d, id, stars, 1000); return d; };
test('town gates: the previous finale cleared plus 12 stars per town', () => {
  let d = fresh();
  assert.ok(townOpen(d, 0)); assert.ok(!townOpen(d, 1));
  const first2 = LEVELS.findIndex((l) => l.id === TOWNS[1].levels[0]);
  assert.ok(!isUnlocked(d, first2), 'a closed town keeps its first level shut');
  for (const id of TOWNS[0].levels.slice(0, 14)) d = record(d, id, 3, 1000);
  assert.ok(!townOpen(d, 1), 'stars alone are not enough: the finale must be cleared');
  d = record(d, TOWNS[0].levels[14], 1, 1000);
  assert.ok(townOpen(d, 1) && isUnlocked(d, first2) && !isUnlocked(d, first2 + 1));
  const e = clearTown(fresh(), 0, 1); // 15 stars and San Roque's finale
  assert.ok(townOpen(e, 1)); assert.equal(starsToOpen(e, 1), 0);
  const h = clearTown(e, 1, 0); // town 2 played but not cleared
  assert.ok(!townOpen(h, 2)); assert.equal(starsToOpen(h, 2), 24 - 15);
  assert.ok(townOpen(clearTown(e, 1, 1), 2), '30 stars and the market finale');
});

test('a booster for every 10 stars, in turn, at most 3 of each, each threshold paid once', () => {
  let d = clearTown(fresh(), 0, 2); // 30 stars
  let r = grant(d); d = r.data;
  assert.deepEqual(r.given, BOOSTERS.slice(0, 3)); assert.equal(d.granted, 3);
  assert.deepEqual(grant(d).given, [], 'paid once');
  d = { ...d, boosters: { ...d.boosters, merienda: 3 }, granted: 3 };
  d = record(d, TOWNS[1].levels[0], 3, 1000); d = record(d, TOWNS[1].levels[1], 3, 1000); d = record(d, TOWNS[1].levels[2], 3, 1000); d = record(d, TOWNS[1].levels[3], 3, 1000); // 42
  r = grant(d);
  assert.deepEqual(r.given, ['siyanse']); assert.equal(r.data.granted, 4);
  const full = { ...fresh(), stars: d.stars, boosters: { pamaypay: 3, sandok: 3, merienda: 3, siyanse: 3 }, granted: 0 };
  r = grant(full); assert.deepEqual(r.given, []); assert.equal(r.data.granted, 4, 'a full kind still uses up its threshold');
});
