// node tools/balance.mjs [runs=40] [levelId]: per level, both bots — the casual (human-like) win rate the
// difficulty curve is tuned on, and the strong bot's win rate (fairness) — with suggested stars:
// 2 at the casual bot's median winning score, 3 at the strong bot's 75th percentile.
import { LEVELS, BANDS } from '../src/levels.mjs';
import { playLevel } from '../src/bot.mjs';

const runs = Number(process.argv[2] || 40), only = process.argv[3];
const pct = (sc, p) => (sc.length ? sc[Math.min(sc.length - 1, Math.floor(p * sc.length))] : 0);
for (const [k, lv] of LEVELS.entries()) {
  if (only && lv.id !== only) continue;
  const cas = Array.from({ length: runs }, (_, s) => playLevel(lv, 1000 + s * 7, { casual: true }));
  const str = Array.from({ length: runs }, (_, s) => playLevel(lv, 1000 + s * 7));
  const cw = cas.filter((r) => r.won), sw = str.filter((r) => r.won);
  const csc = cw.map((r) => r.score).sort((a, b) => a - b), ssc = sw.map((r) => r.score).sort((a, b) => a - b);
  const spare = (w) => (w.reduce((a, r) => a + r.movesLeft, 0) / Math.max(1, w.length)).toFixed(1);
  const [lo, hi] = BANDS[k], cr = cw.length / runs;
  console.log(`${lv.id} ${lv.name.padEnd(22)} moves ${String(lv.moves).padStart(2)}  casual ${(cr * 100).toFixed(0).padStart(3)}% [${lo * 100}-${hi * 100}]${cr < lo ? ' LOW ' : cr > hi ? ' HIGH' : '     '} spare ${spare(cw)}  strong ${(sw.length / runs * 100).toFixed(0).padStart(3)}% spare ${spare(sw)}  → stars [1, ${Math.round(pct(csc, 0.5) / 100) * 100}, ${Math.round(pct(ssc, 0.75) / 100) * 100}]`);
}
