// Every town's levels, in campaign order, with the difficulty curve and level validation.
// Each town lives in src/towns/<id>.mjs as { TOWN, LEVELS, BANDS? }.
import { KAKANIN } from './game.mjs';
import * as sanRoque from './towns/san-roque.mjs';

const TOWN_FILES = [sanRoque];
export const TOWNS = TOWN_FILES.map((t) => ({ ...t.TOWN, levels: t.LEVELS.map((l) => l.id) }));
export const LEVELS = TOWN_FILES.flatMap((t) => t.LEVELS.map((l) => ({ ...l, town: t.TOWN.id })));
// The casual (human-like) bot's target win rate for each level. San Roque has its own; later towns follow
// one curve: each starts a little easier than the last one ended and climbs, each a touch harder.
export const BANDS = TOWN_FILES.flatMap((t) => t.BANDS || t.LEVELS.map((_, j) => { const lo = 0.62 - (0.30 * j) / 14 - 0.02 * (t.TOWN.n - 2); return [Math.round(lo * 100) / 100, Math.round((lo + 0.2) * 100) / 100]; }));
// the town a level belongs to
export const townOf = (id) => TOWNS.find((t) => t.levels.includes(id));

export function validateLevel(lv) {
  const bad = [];
  const rows = (r, what) => {
    if (!Array.isArray(r) || r.length !== lv.h || r.some((s) => typeof s !== 'string' || s.length !== lv.w)) bad.push(`${what} must be ${lv.h} strings of ${lv.w}`);
  };
  if (!(lv.w >= 5 && lv.w <= 9 && lv.h >= 5 && lv.h <= 9)) bad.push('size 5..9');
  if (lv.mask) rows(lv.mask, 'mask');
  if (lv.latik) rows(lv.latik, 'latik');
  if (!Array.isArray(lv.kinds) || lv.kinds.length < 4 || lv.kinds.length > 6 || lv.kinds.some((k) => !KAKANIN.includes(k))) bad.push('kinds: 4..6 known kakanin');
  if (!(lv.moves > 0)) bad.push('moves');
  if (!Array.isArray(lv.stars) || lv.stars.length !== 3 || !(lv.stars[0] <= lv.stars[1] && lv.stars[1] < lv.stars[2])) bad.push('stars ascending');
  if (!Array.isArray(lv.goals) || !lv.goals.length) bad.push('goals');
  for (const q of lv.goals || []) {
    if (q.type === 'collect' && (!lv.kinds?.includes(q.kind) || !(q.n > 0))) bad.push(`collect ${q.kind}`);
    if (q.type === 'score' && !(q.n > 0)) bad.push('score n');
    if (q.type === 'latik' && !(lv.latik && lv.latik.join('').match(/[1-9]/))) bad.push('latik goal without latik');
    if (!['collect', 'score', 'latik', 'dahon', 'kahon', 'langgam', 'deliver'].includes(q.type)) bad.push(`goal type ${q.type}`);
  }
  if (lv.latik && lv.mask && lv.latik.some((r, y) => [...r].some((c, x) => c !== '.' && lv.mask[y]?.[x] !== '#'))) bad.push('latik on a hole');
  // the campaign's blockers and ingredients
  for (const f of ['wrap', 'crates', 'ants']) if (lv[f]) rows(lv[f], f);
  const has = (f, re) => !!(lv[f] && lv[f].join('').match(re));
  if (lv.wrap && lv.wrap.join('').match(/[^.w]/)) bad.push("wrap: '.' or 'w'");
  if (lv.crates && lv.crates.join('').match(/[^.123]/)) bad.push('crates: 1-3 hp');
  if (lv.ants && lv.ants.join('').match(/[^.a]/)) bad.push("ants: '.' or 'a'");
  const cellOf = (f, y, x) => (lv[f] && lv[f][y] ? lv[f][y][x] : '.');
  for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
    const on = ['wrap', 'crates', 'ants'].filter((f) => cellOf(f, y, x) !== '.');
    if (on.length > 1) bad.push(`${on.join(' and ')} on one cell (${x},${y})`);
    if (on.length && lv.mask && lv.mask[y]?.[x] !== '#') bad.push(`${on[0]} on a hole (${x},${y})`);
  }
  for (const q of lv.goals || []) {
    if (q.type === 'dahon' && !has('wrap', /w/)) bad.push('a dahon goal without wraps');
    if (q.type === 'kahon' && !has('crates', /[1-3]/)) bad.push('a kahon goal without crates');
    if (q.type === 'langgam' && !has('ants', /a/)) bad.push('a langgam goal without ants');
    if (q.type === 'deliver' && !(lv.ingredients && lv.ingredients[q.kind] >= q.n && q.n > 0)) bad.push(`deliver ${q.kind}: not enough ingredients`);
  }
  if (lv.ingredients && !(lv.ingredients.onBoard >= 1 && lv.ingredients.onBoard <= 3)) bad.push('ingredients: onBoard 1-3');
  const cells = lv.mask ? lv.mask.join('').split('').filter((c) => c === '#').length : lv.w * lv.h;
  if (cells < 25) bad.push('too few cells');
  return bad;
}
