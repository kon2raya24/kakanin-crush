// Town 3, Simbahan plaza: after Simbang Gabi, at dusk. Its new pieces are the ingredients: gata
// (coconut) and asukal (sugar) that Lola needs for the next batch. They never match; bring them down to
// the bottom of the bilao to deliver them. Moves and stars are set by tools/calibrate.mjs.
import { BILAO9, RING9, HOLE9, CROSS9, DIAMOND9, TWIN9, draw } from './masks.mjs';

export const TOWN = { id: 'simbahan', n: 3, name: 'Simbahan', place: 'The church plaza at dusk', theme: 'dusk', blocker: 'ingredients', dish: { name: 'Bibingka at puto bumbong', note: 'After Simbang Gabi: bibingka baked over and under coals in a banana-leaf-lined clay pot, and purple puto bumbong steamed in bamboo tubes.' } };

const K4 = ['puto', 'kutsinta', 'sapin', 'bibingka'];
const K5 = [...K4, 'ube'];
const K6 = [...K5, 'suman'];
const w = (f) => draw((x, y) => (f(x, y) ? 'w' : '.'));
const l = (f) => draw((x, y) => f(x, y) || '.');
const ing = (gata, asukal = 0, onBoard = 1) => ({ gata, asukal, onBoard });

export const LEVELS = [
  { id: 'sb-01', name: 'Unang Gata', w: 8, h: 8, kinds: K4, moves: 10, ingredients: ing(2), goals: [{ type: 'deliver', kind: 'gata', n: 2 }, { type: 'collect', kind: 'puto', n: 19 }], stars: [1, 14300, 35600], seed: 301, tip: 'Kailangan ni Lola ng gata! Ibaba ito sa pinakailalim ng bilao.' },
  { id: 'sb-02', name: 'Asukal na Pula', w: 8, h: 8, kinds: K4, moves: 13, ingredients: ing(1, 2), goals: [{ type: 'deliver', kind: 'gata', n: 1 }, { type: 'deliver', kind: 'asukal', n: 2 }], stars: [1, 20200, 42700], seed: 302, tip: 'Hindi tumutugma ang gata at asukal. Bumuo ng tugma sa ilalim nila para bumaba.' },
  { id: 'sb-03', name: 'Pagkatapos ng Misa', w: 9, h: 9, mask: BILAO9, kinds: K5, moves: 10, ingredients: ing(3, 0, 2), goals: [{ type: 'deliver', kind: 'gata', n: 3 }, { type: 'collect', kind: 'sapin', n: 12 }], stars: [1, 11400, 21300], seed: 303 },
  { id: 'sb-04', name: 'Bibingka sa Uling', w: 9, h: 9, kinds: K5, moves: 15, ingredients: ing(2, 1), goals: [{ type: 'deliver', kind: 'gata', n: 2 }, { type: 'deliver', kind: 'asukal', n: 1 }, { type: 'collect', kind: 'bibingka', n: 16 }], stars: [1, 15100, 34300], seed: 304 },
  { id: 'sb-05', name: 'Dahon at Gata', w: 9, h: 9, kinds: K5, moves: 10, ingredients: ing(2), wrap: w((x, y) => y === 6 && x >= 2 && x <= 6), goals: [{ type: 'deliver', kind: 'gata', n: 2 }, { type: 'dahon' }], stars: [1, 11900, 24200], seed: 305 },
  { id: 'sb-06', name: 'Paikot sa Plaza', w: 9, h: 9, mask: RING9, kinds: K5, moves: 15, ingredients: ing(2, 1), goals: [{ type: 'deliver', kind: 'gata', n: 2 }, { type: 'deliver', kind: 'asukal', n: 1 }], stars: [1, 10300, 12300], seed: 306 },
  { id: 'sb-07', name: 'Latik sa Kampanaryo', w: 9, h: 9, kinds: K5, moves: 35, ingredients: ing(0, 2), latik: l((x, y) => (y === 8 ? '1' : '')), goals: [{ type: 'deliver', kind: 'asukal', n: 2 }, { type: 'latik' }], stars: [1, 27400, 39300], seed: 307 },
  { id: 'sb-08', name: 'Krus ng Simbahan', w: 9, h: 9, mask: CROSS9, kinds: K5, moves: 10, ingredients: ing(3, 0, 2), goals: [{ type: 'deliver', kind: 'gata', n: 3 }, { type: 'collect', kind: 'ube', n: 16 }], stars: [1, 12800, 20200], seed: 308 },
  { id: 'sb-09', name: 'Puto Bumbong', w: 9, h: 9, kinds: K5, moves: 10, ingredients: ing(2, 2, 2), goals: [{ type: 'deliver', kind: 'gata', n: 2 }, { type: 'deliver', kind: 'asukal', n: 2 }], stars: [1, 14700, 24600], seed: 309 },
  { id: 'sb-10', name: 'Butas sa Gitna', w: 9, h: 9, mask: HOLE9, kinds: K5, moves: 12, ingredients: ing(2), wrap: w((x, y) => (y === 7) && x % 2 === 0), goals: [{ type: 'deliver', kind: 'gata', n: 2 }, { type: 'dahon' }], stars: [1, 9500, 14600], seed: 310 },
  { id: 'sb-11', name: 'Diyamante sa Altar', w: 9, h: 9, mask: DIAMOND9, kinds: K5, moves: 13, ingredients: ing(2, 1), latik: l((x, y) => (Math.abs(x - 4) + Math.abs(y - 4) <= 2 ? '1' : '')), goals: [{ type: 'deliver', kind: 'gata', n: 2 }, { type: 'deliver', kind: 'asukal', n: 1 }, { type: 'latik' }], stars: [1, 12600, 22900], seed: 311 },
  { id: 'sb-12', name: 'Dalawang Kampana', w: 9, h: 9, mask: TWIN9, kinds: K5, moves: 11, ingredients: ing(2, 2, 2), goals: [{ type: 'deliver', kind: 'gata', n: 2 }, { type: 'deliver', kind: 'asukal', n: 2 }], stars: [1, 10100, 17200], seed: 312 },
  { id: 'sb-13', name: 'Gabi ng Simbang Gabi', w: 9, h: 9, kinds: K5, moves: 27, ingredients: ing(3, 0, 2), wrap: w((x, y) => y === 5 && x % 2 === 1), latik: l((x, y) => (y === 8 ? '1' : '')), goals: [{ type: 'deliver', kind: 'gata', n: 3 }, { type: 'dahon' }, { type: 'latik' }], stars: [1, 27900, 37100], seed: 313 },
  { id: 'sb-14', name: 'Handa sa Noche Buena', w: 9, h: 9, kinds: K6, moves: 13, ingredients: ing(2, 2, 2), wrap: w((x, y) => y === 7 && x >= 2 && x <= 6), goals: [{ type: 'deliver', kind: 'gata', n: 2 }, { type: 'deliver', kind: 'asukal', n: 2 }, { type: 'dahon' }], stars: [1, 11900, 18900], seed: 314 },
  { id: 'sb-15', name: 'Pista ng Simbahan', w: 9, h: 9, mask: BILAO9, kinds: K5, moves: 24, ingredients: ing(3, 2, 2), latik: l((x, y) => (y >= 6 && x >= 2 && x <= 6 ? '1' : '')), goals: [{ type: 'deliver', kind: 'gata', n: 3 }, { type: 'deliver', kind: 'asukal', n: 2 }, { type: 'latik' }], stars: [1, 26500, 38100], seed: 315, tip: 'Pinakamalaking order ng gabi! Gata, asukal, at linisin ang latik.' },
];
