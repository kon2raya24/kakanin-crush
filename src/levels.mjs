// Town 1, San Roque: a sari-sari street at golden hour. 15 levels that teach the game: plain collecting,
// then specials, then latik (the town's new blocker), then everything together. Each level is data; the
// rules (game.mjs) build the board from it. Masks: '#' a cell, '.' a hole. Latik: '1'-'9' layers.
import { KAKANIN } from './game.mjs';

export const TOWN = { id: 'san-roque', name: 'San Roque', time: 'golden' };

const K4 = ['puto', 'kutsinta', 'sapin', 'bibingka'];
const K5 = [...K4, 'ube'];
const K6 = [...K5, 'suman'];
const BILAO9 = ['..#####..', '.#######.', '#########', '#########', '#########', '#########', '#########', '.#######.', '..#####..'];
const RING9 = ['#########', '#########', '##.....##', '##.....##', '##.....##', '##.....##', '##.....##', '#########', '#########'];
const HOLE9 = ['#########', '#########', '#########', '###...###', '###...###', '###...###', '#########', '#########', '#########'];
const lat = (rows) => rows;

export const LEVELS = [
  { id: 'sr-01', name: 'Unang Benta', w: 7, h: 7, kinds: K4, moves: 10, goals: [{ type: 'collect', kind: 'puto', n: 15 }], stars: [1, 8300, 16600], seed: 101,
    tip: 'Ipagpalit ang dalawang magkatabi para makabuo ng tatlo!' },
  { id: 'sr-02', name: 'Merienda ng Barangay', w: 7, h: 7, kinds: K4, moves: 10, goals: [{ type: 'collect', kind: 'kutsinta', n: 15 }, { type: 'collect', kind: 'sapin', n: 10 }], stars: [1, 7900, 17800], seed: 102,
    tip: 'Apat na magkakasunod: may Sandok ka! Isang buong hanay ang malilinis.' },
  { id: 'sr-03', name: 'Puntos para kay Lola', w: 8, h: 8, kinds: K5, moves: 17, goals: [{ type: 'score', n: 5000 }], stars: [1, 10400, 16300], seed: 103,
    tip: 'Hugis L o T: Kaldero! Sasabog ang paligid nito.' },
  { id: 'sr-04', name: 'Bibingka sa Hapon', w: 8, h: 8, kinds: K5, moves: 17, goals: [{ type: 'collect', kind: 'bibingka', n: 22 }], stars: [1, 13700, 21200], seed: 104,
    tip: 'Limang magkakasunod: Bilao ng Lahat! Ipalit sa kahit ano.' },
  { id: 'sr-05', name: 'Latik sa Bilao', w: 8, h: 8, kinds: K5, moves: 15, goals: [{ type: 'latik' }], stars: [1, 12200, 18600], seed: 105,
    latik: lat(['........', '........', '..1111..', '..1111..', '..1111..', '..1111..', '........', '........']),
    tip: 'May latik na dumikit! Bumuo ng tugma sa ibabaw nito para linisin.' },
  { id: 'sr-06', name: 'Bilog na Bilao', w: 9, h: 9, mask: BILAO9, kinds: K5, moves: 16, goals: [{ type: 'collect', kind: 'ube', n: 20 }, { type: 'collect', kind: 'puto', n: 20 }], stars: [1, 11300, 23300], seed: 106 },
  { id: 'sr-07', name: 'Hanay ng Latik', w: 9, h: 9, kinds: K5, moves: 24, goals: [{ type: 'latik' }], stars: [1, 25000, 36200], seed: 107,
    latik: lat(['.........', '.........', '111111111', '.........', '111111111', '.........', '111111111', '.........', '.........']) },
  { id: 'sr-08', name: 'Butas sa Gitna', w: 9, h: 9, mask: HOLE9, kinds: [...K4, 'suman'], moves: 20, goals: [{ type: 'collect', kind: 'suman', n: 23 }], stars: [1, 10800, 20300], seed: 108,
    tip: 'Dumating na ang suman! Kunin ang lahat ng suman bago maubos ang galaw.' },
  { id: 'sr-09', name: 'Makapal na Latik', w: 9, h: 9, kinds: K5, moves: 27, goals: [{ type: 'latik' }], stars: [1, 25100, 43600], seed: 109,
    latik: lat(['.........', '.22...22.', '.22...22.', '.........', '.........', '.........', '.22...22.', '.22...22.', '.........']),
    tip: 'Dalawang patong ng latik: dalawang beses itong lilinisin.' },
  { id: 'sr-10', name: 'Pista ng Puntos', w: 9, h: 9, kinds: K6, moves: 29, goals: [{ type: 'score', n: 9000 }], stars: [1, 15000, 24400], seed: 110 },
  { id: 'sr-11', name: 'Bilao na may Latik', w: 9, h: 9, mask: BILAO9, kinds: K6, moves: 26, goals: [{ type: 'latik' }, { type: 'collect', kind: 'sapin', n: 18 }], stars: [1, 17300, 27200], seed: 111,
    latik: lat(['.........', '.........', '..11111..', '..12221..', '..12221..', '..12221..', '..11111..', '.........', '.........']) },
  { id: 'sr-12', name: 'Paikot', w: 9, h: 9, mask: RING9, kinds: K4, moves: 21, goals: [{ type: 'collect', kind: 'kutsinta', n: 27 }], stars: [1, 8200, 16100], seed: 112 },
  { id: 'sr-13', name: 'Latik Kahit Saan', w: 9, h: 9, kinds: K5, moves: 20, goals: [{ type: 'latik' }], stars: [1, 19200, 35100], seed: 113,
    latik: lat(['.........', '.1111111.', '.1.....1.', '.1.111.1.', '.1.111.1.', '.1.111.1.', '.1.....1.', '.1111111.', '.........']) },
  { id: 'sr-14', name: 'Dalawang Order', w: 9, h: 9, kinds: K6, moves: 28, goals: [{ type: 'collect', kind: 'bibingka', n: 24 }, { type: 'collect', kind: 'ube', n: 24 }], stars: [1, 16800, 26700], seed: 114 },
  { id: 'sr-15', name: 'Pista ng San Roque', w: 9, h: 9, mask: BILAO9, kinds: K6, moves: 28, goals: [{ type: 'latik' }, { type: 'collect', kind: 'puto', n: 25 }, { type: 'collect', kind: 'suman', n: 20 }], stars: [1, 17800, 27700], seed: 115,
    latik: lat(['.........', '.........', '.........', '.111111..', '.122221..', '.111111..', '.........', '.........', '.........']),
    tip: 'Ang huling bilao ng San Roque! Ipakita kay Lola ang galing mo.' },
];

// The difficulty curve: per level, the win rate a casual, human-like player (the casual bot) should have.
export const BANDS = [[0.8, 0.95], [0.65, 0.85], [0.65, 0.85], [0.5, 0.7], [0.5, 0.7], [0.5, 0.7], [0.4, 0.6], [0.4, 0.6], [0.4, 0.6], [0.4, 0.6], [0.3, 0.5], [0.3, 0.5], [0.3, 0.5], [0.3, 0.5], [0.25, 0.45]];

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
