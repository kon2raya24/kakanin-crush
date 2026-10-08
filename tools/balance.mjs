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
