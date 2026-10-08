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
  { id: 'sr-01', name: 'Unang Benta', w: 7, h: 7, kinds: K4, moves: 18, goals: [{ type: 'collect', kind: 'puto', n: 12 }], stars: [1, 2600, 4200], seed: 101,
    tip: 'Ipagpalit ang dalawang magkatabi para makabuo ng tatlo!' },
  { id: 'sr-02', name: 'Merienda ng Barangay', w: 7, h: 7, kinds: K4, moves: 20, goals: [{ type: 'collect', kind: 'kutsinta', n: 15 }, { type: 'collect', kind: 'sapin', n: 10 }], stars: [1, 3600, 5600], seed: 102,
    tip: 'Apat na magkakasunod: may Sandok ka! Isang buong hanay ang malilinis.' },
  { id: 'sr-03', name: 'Puntos para kay Lola', w: 8, h: 8, kinds: K5, moves: 20, goals: [{ type: 'score', n: 5000 }], stars: [1, 6500, 9000], seed: 103,
    tip: 'Hugis L o T: Kaldero! Sasabog ang paligid nito.' },
  { id: 'sr-04', name: 'Bibingka sa Hapon', w: 8, h: 8, kinds: K5, moves: 22, goals: [{ type: 'collect', kind: 'bibingka', n: 22 }], stars: [1, 5200, 7800], seed: 104,
    tip: 'Limang magkakasunod: Bilao ng Lahat! Ipalit sa kahit ano.' },
  { id: 'sr-05', name: 'Latik sa Bilao', w: 8, h: 8, kinds: K5, moves: 22, goals: [{ type: 'latik' }], stars: [1, 6000, 9000], seed: 105,
    latik: lat(['........', '........', '..1111..', '..1111..', '..1111..', '..1111..', '........', '........']),
    tip: 'May latik na dumikit! Bumuo ng tugma sa ibabaw nito para linisin.' },
  { id: 'sr-06', name: 'Bilog na Bilao', w: 9, h: 9, mask: BILAO9, kinds: K5, moves: 24, goals: [{ type: 'collect', kind: 'ube', n: 20 }, { type: 'collect', kind: 'puto', n: 20 }], stars: [1, 7000, 10500], seed: 106 },
  { id: 'sr-07', name: 'Hanay ng Latik', w: 9, h: 9, kinds: K5, moves: 24, goals: [{ type: 'latik' }], stars: [1, 8000, 12000], seed: 107,
    latik: lat(['.........', '.........', '111111111', '.........', '111111111', '.........', '111111111', '.........', '.........']) },
  { id: 'sr-08', name: 'Butas sa Gitna', w: 9, h: 9, mask: HOLE9, kinds: K6, moves: 26, goals: [{ type: 'collect', kind: 'suman', n: 18 }], stars: [1, 7000, 11000], seed: 108,
    tip: 'Dumating na ang suman! Anim na kakanin na ang nasa bilao.' },
  { id: 'sr-09', name: 'Makapal na Latik', w: 9, h: 9, kinds: K5, moves: 26, goals: [{ type: 'latik' }], stars: [1, 9000, 13000], seed: 109,
    latik: lat(['22.....22', '22.....22', '.........', '.........', '.........', '.........', '.........', '22.....22', '22.....22']),
    tip: 'Dalawang patong ng latik: dalawang beses itong lilinisin.' },
  { id: 'sr-10', name: 'Pista ng Puntos', w: 9, h: 9, kinds: K6, moves: 25, goals: [{ type: 'score', n: 15000 }], stars: [1, 19000, 24000], seed: 110 },
  { id: 'sr-11', name: 'Bilao na may Latik', w: 9, h: 9, mask: BILAO9, kinds: K6, moves: 28, goals: [{ type: 'latik' }, { type: 'collect', kind: 'sapin', n: 18 }], stars: [1, 10000, 15000], seed: 111,
    latik: lat(['.........', '.........', '..11111..', '..12221..', '..12221..', '..12221..', '..11111..', '.........', '.........']) },
  { id: 'sr-12', name: 'Paikot', w: 9, h: 9, mask: RING9, kinds: K5, moves: 26, goals: [{ type: 'collect', kind: 'kutsinta', n: 28 }], stars: [1, 6500, 9500], seed: 112 },
  { id: 'sr-13', name: 'Latik Kahit Saan', w: 9, h: 9, kinds: K6, moves: 30, goals: [{ type: 'latik' }], stars: [1, 13000, 19000], seed: 113,
    latik: lat(['.........', '.2222222.', '.2.....2.', '.2.111.2.', '.2.111.2.', '.2.111.2.', '.2.....2.', '.2222222.', '.........']) },
  { id: 'sr-14', name: 'Dalawang Order', w: 9, h: 9, kinds: K6, moves: 24, goals: [{ type: 'collect', kind: 'bibingka', n: 24 }, { type: 'collect', kind: 'ube', n: 24 }], stars: [1, 9000, 13500], seed: 114 },
  { id: 'sr-15', name: 'Pista ng San Roque', w: 9, h: 9, mask: BILAO9, kinds: K6, moves: 30, goals: [{ type: 'latik' }, { type: 'collect', kind: 'puto', n: 25 }, { type: 'collect', kind: 'suman', n: 20 }], stars: [1, 14000, 20000], seed: 115,
    latik: lat(['.........', '.........', '.........', '.111111..', '.122221..', '.111111..', '.........', '.........', '.........']),
    tip: 'Ang huling bilao ng San Roque! Ipakita kay Lola ang galing mo.' },
];

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
    if (!['collect', 'score', 'latik'].includes(q.type)) bad.push(`goal type ${q.type}`);
  }
  if (lv.latik && lv.mask && lv.latik.some((r, y) => [...r].some((c, x) => c !== '.' && lv.mask[y]?.[x] !== '#'))) bad.push('latik on a hole');
  const cells = lv.mask ? lv.mask.join('').split('').filter((c) => c === '#').length : lv.w * lv.h;
  if (cells < 25) bad.push('too few cells');
  return bad;
}
