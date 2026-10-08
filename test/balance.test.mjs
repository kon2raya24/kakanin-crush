// Balance floors from the bot. It sees real refills, so it plays a little better than a person;
// the bands below are set with that in mind (spec: early levels near-certain, the town's end harder).
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels.mjs';
import { playLevel } from '../src/bot.mjs';

const RUNS = 40; // the same runs as tools/balance.mjs; each takes milliseconds
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
