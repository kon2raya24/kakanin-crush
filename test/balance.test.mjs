// Balance, measured the way a person meets the game. The casual bot sees only the match its swap makes
// (no cascades, no refills) and picks among its best three, like someone scanning the board; the bands
// (levels.mjs BANDS) are its win rates and make a real difficulty curve. The strong bot (it sees the refills) must
// still win nearly every time, so skill always beats a level, and 3 stars must be reachable — checked on
// seeds the star thresholds were not tuned on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, BANDS } from '../src/levels.mjs';
import { playLevel } from '../src/bot.mjs';

const RUNS = 40;
const rate = (runs) => runs.filter((r) => r.won).length / runs.length;

for (const [k, lv] of LEVELS.entries()) {
  test(`${lv.id} ${lv.name}: a challenge for a person, fair for skill, 3 stars possible`, () => {
    const casual = rate(Array.from({ length: RUNS }, (_, s) => playLevel(lv, 1000 + s * 7, { casual: true })));
    const [lo, hi] = BANDS[k];
    assert.ok(casual >= lo && casual <= hi, `casual win rate ${casual} not in [${lo}, ${hi}]`);
    const strong = Array.from({ length: RUNS }, (_, s) => playLevel(lv, 5000 + s * 7));
    assert.ok(rate(strong) >= 0.8, `strong win rate ${rate(strong)} under 0.8`);
    assert.ok(strong.some((r) => r.stars === 3), 'no strong run got 3 stars on fresh seeds');
  });
}
