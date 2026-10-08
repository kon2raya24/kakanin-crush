// node tools/calibrate.mjs <levelId…>: tune each level against both bots and write the result back into
// its town file (src/towns/*.mjs, one level per line).
// - moves move one at a time toward the middle of the level's casual band (levels.mjs BANDS)
// - if moves alone can't get there (10..40), collect and score goals are scaled instead
// - the strong bot must still win >=80% on 150 fresh seeds; if it doesn't, moves go up while the casual
//   rate allows, else the level is reported for a redesign
// - stars become [1, casual median winning score, strong 75th percentile]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { playLevel } from '../src/bot.mjs';

const ids = process.argv.slice(2);
const pct = (sc, p) => (sc.length ? sc[Math.min(sc.length - 1, Math.floor(p * sc.length))] : 0);
const file = (id) => readdirSync('src/towns').map((f) => `src/towns/${f}`).find((f) => readFileSync(f, 'utf8').includes(`id: '${id}'`));
const lineRe = (id) => new RegExp(`(  \\{ id: '${id}'[^\\n]*)`);

const { LEVELS, BANDS } = await import('../src/levels.mjs'); // bands only: they never change here
async function fresh(id) {
  // the town file itself is imported fresh each time (levels.mjs would hand back its cached copy)
  const mod = await import(`../${file(id)}?t=${Date.now()}${Math.random()}`);
  return { lv: mod.LEVELS.find((l) => l.id === id), band: BANDS[LEVELS.findIndex((l) => l.id === id)] };
}
const MIN = 10, MAX = 40;
const rate = (lv, from, n, o) => { const rs = Array.from({ length: n }, (_, s) => playLevel(lv, from + s * 7, o)); return { r: rs.filter((x) => x.won).length / n, rs }; };

for (const id of ids) {
  const f = file(id);
  const edit = (fn) => writeFileSync(f, readFileSync(f, 'utf8').replace(lineRe(id), (l) => fn(l)));
  let note = 'NOT SETTLED after 40 rounds';
  for (let it = 0; it < 40; it++) {
    const { lv, band: [lo, hi] } = await fresh(id);
    const c = rate(lv, 1000, 40, { casual: true }).r;
    const mid = (lo + hi) / 2;
    if (c < lo || c > hi) {
      // big misses take bigger steps; at the end of the moves range the goal counts move instead
      const step = Math.max(1, Math.round(Math.abs(c - mid) * lv.moves)), down = c > hi;
      const moves = Math.min(MAX, Math.max(MIN, lv.moves + (down ? -step : step)));
      if (moves !== lv.moves) edit((l) => l.replace(/moves: \d+/, `moves: ${moves}`));
      else if (/type: '(?:collect|score)'/.test(readFileSync(f, 'utf8').match(lineRe(id))[1])) edit((l) => l.replace(/(type: '(?:collect|score)'[^}]*n: )(\d+)/g, (_, a, n) => `${a}${down ? Math.round(Number(n) * 1.12) : Math.max(3, Math.round(Number(n) * 0.9))}`));
      else { note = `REDESIGN: casual ${c} outside [${lo}-${hi}] at ${lv.moves} moves, nothing left to tune`; break; }
      continue;
    }
    const s = rate(lv, 5000, 150).r;
    if (s >= 0.8) { note = `casual ${c} [${lo}-${hi}] strong ${s.toFixed(2)} moves ${lv.moves}`; break; }
    if (c + 0.05 <= hi && lv.moves < MAX) { edit((l) => l.replace(/moves: \d+/, `moves: ${lv.moves + 1}`)); continue; }
    note = `REDESIGN: strong ${s.toFixed(2)} < 0.8 with casual ${c} at the top of [${lo}-${hi}]`; break;
  }
  // stars from both bots
  const { lv } = await fresh(id);
  const cw = rate(lv, 1000, 40, { casual: true }).rs.filter((x) => x.won).map((x) => x.score).sort((a, b) => a - b);
  const sw = rate(lv, 1000, 40).rs.filter((x) => x.won).map((x) => x.score).sort((a, b) => a - b);
  let s2 = Math.round(pct(cw, 0.5) / 100) * 100, s3 = Math.round(pct(sw, 0.75) / 100) * 100;
  if (s3 <= s2) s3 = s2 + 500;
  edit((l) => l.replace(/stars: \[[^\]]*\]/, `stars: [1, ${s2}, ${s3}]`));
  console.log(id, note, `stars [1, ${s2}, ${s3}]`);
}
