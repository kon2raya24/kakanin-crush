// Town 2, Palengke ng Malinta: the market at noon. Its new blocker is the dahon: kakanin still wrapped in
// banana leaf, stuck in place until a match beside them unwraps them. Moves and stars are set by
// tools/calibrate.mjs against the casual and strong bots.
import { BILAO9, RING9, HOLE9, CROSS9, DIAMOND9, TWIN9, draw } from './masks.mjs';

export const TOWN = { id: 'palengke', n: 2, name: 'Palengke ng Malinta', place: 'The market at noon', theme: 'noon', blocker: 'dahon', dish: { name: 'Suman sa ibos', note: 'Glutinous rice cooked in coconut milk, rolled tight in young palm or banana leaves and steamed; eaten with sugar or ripe mango.' } };

const K4 = ['puto', 'kutsinta', 'sapin', 'bibingka'];
const K5 = [...K4, 'suman'];
const K6 = [...K5, 'ube'];
const w = (f) => draw((x, y) => (f(x, y) ? 'w' : '.'));
const l = (f) => draw((x, y) => f(x, y) || '.');

export const LEVELS = [
  { id: 'pk-01', name: 'Bagong Puwesto', w: 8, h: 8, kinds: K4, moves: 10, wrap: draw((x, y) => (x >= 3 && x <= 4 && y >= 3 && y <= 4 ? 'w' : '.'), 8, 8), goals: [{ type: 'dahon' }, { type: 'collect', kind: 'puto', n: 21 }], stars: [1, 13500, 28900], seed: 201, tip: 'May kakanin pang nakabalot sa dahon! Bumuo ng tugma sa tabi nito para mabuksan.' },
  { id: 'pk-02', name: 'Tali-tali', w: 8, h: 8, kinds: K4, moves: 10, wrap: draw((x, y) => (y === 4 && x >= 1 && x <= 6 ? 'w' : '.'), 8, 8), goals: [{ type: 'dahon' }, { type: 'collect', kind: 'kutsinta', n: 25 }], stars: [1, 13800, 31400], seed: 202 },
  { id: 'pk-03', name: 'Suki ni Lola', w: 9, h: 9, mask: BILAO9, kinds: K5, moves: 10, wrap: w((x, y) => (x + y) % 4 === 0 && x > 1 && x < 7 && y > 1 && y < 7), goals: [{ type: 'dahon' }, { type: 'collect', kind: 'suman', n: 15 }], stars: [1, 8700, 17000], seed: 203, tip: 'Ang nakabalot, hindi nalilipat at hindi nahuhulog. Unahin ang mga nasa ibaba!' },
  { id: 'pk-04', name: 'Latik at Dahon', w: 9, h: 9, kinds: K5, moves: 33, latik: l((x, y) => (y >= 6 ? '1' : '')), wrap: w((x, y) => y === 5 && x % 2 === 0), goals: [{ type: 'dahon' }, { type: 'latik' }], stars: [1, 31600, 42300], seed: 204 },
  { id: 'pk-05', name: 'Tanghaling Tapat', w: 9, h: 9, kinds: K5, moves: 17, wrap: w((x, y) => (x === 2 || x === 6) && y >= 2 && y <= 6), goals: [{ type: 'score', n: 9000 }, { type: 'dahon' }], stars: [1, 15600, 22100], seed: 205 },
  { id: 'pk-06', name: 'Paikot na Puwesto', w: 9, h: 9, mask: RING9, kinds: K5, moves: 34, wrap: w((x, y) => (x === 0 || x === 8) && y % 2 === 1), goals: [{ type: 'dahon' }, { type: 'collect', kind: 'kutsinta', n: 18 }], stars: [1, 12600, 17800], seed: 206 },
  { id: 'pk-07', name: 'Dalawang Suki', w: 9, h: 9, kinds: K6, moves: 20, wrap: w((x, y) => y === 7 && x >= 1 && x <= 7), goals: [{ type: 'dahon' }, { type: 'collect', kind: 'puto', n: 16 }, { type: 'collect', kind: 'ube', n: 16 }], stars: [1, 11600, 20300], seed: 207 },
  { id: 'pk-08', name: 'Krus ng Palengke', w: 9, h: 9, mask: CROSS9, kinds: K5, moves: 16, latik: l((x, y) => (x >= 3 && x <= 5 && y >= 3 && y <= 5 ? '2' : '')), wrap: w((x, y) => (x === 4 && (y === 1 || y === 7)) || (y === 4 && (x === 1 || x === 7))), goals: [{ type: 'latik' }, { type: 'dahon' }], stars: [1, 14300, 21200], seed: 208 },
  { id: 'pk-09', name: 'Bunton ng Dahon', w: 9, h: 9, kinds: K5, moves: 17, wrap: w((x, y) => y >= 5 && (x + y) % 2 === 0), goals: [{ type: 'dahon' }], stars: [1, 15700, 22700], seed: 209 },
  { id: 'pk-10', name: 'Butas sa Bilao', w: 9, h: 9, mask: HOLE9, kinds: K5, moves: 20, wrap: w((x, y) => (y === 2 || y === 6) && x >= 2 && x <= 6), goals: [{ type: 'dahon' }, { type: 'collect', kind: 'sapin', n: 18 }], stars: [1, 11400, 18200], seed: 210 },
  { id: 'pk-11', name: 'Diyamante', w: 9, h: 9, mask: DIAMOND9, kinds: K5, moves: 14, wrap: w((x, y) => Math.abs(x - 4) + Math.abs(y - 4) === 3), goals: [{ type: 'dahon' }, { type: 'collect', kind: 'sapin', n: 14 }], stars: [1, 8600, 16500], seed: 211 },
  { id: 'pk-12', name: 'Malagkit na Hapon', w: 9, h: 9, kinds: K5, moves: 26, latik: l((x, y) => (y >= 5 && (x + y) % 3 === 0 ? '1' : '')), wrap: w((x, y) => y === 8 && x % 2 === 1), goals: [{ type: 'latik' }, { type: 'dahon' }], stars: [1, 26300, 32700], seed: 212 },
  { id: 'pk-13', name: 'Kambal na Tindahan', w: 9, h: 9, mask: TWIN9, kinds: K5, moves: 18, wrap: w((x, y) => (x === 1 || x === 7) && y >= 2 && y <= 6), goals: [{ type: 'dahon' }, { type: 'collect', kind: 'bibingka', n: 18 }], stars: [1, 10900, 17100], seed: 213 },
  { id: 'pk-14', name: 'Bago Magsara', w: 9, h: 9, kinds: K5, moves: 35, latik: l((x, y) => (y <= 1 ? '1' : '')), wrap: w((x, y) => y === 6 && x >= 1 && x <= 7), goals: [{ type: 'latik' }, { type: 'dahon' }, { type: 'collect', kind: 'suman', n: 5 }], stars: [1, 26300, 39600], seed: 214 },
  { id: 'pk-15', name: 'Pista ng Palengke', w: 9, h: 9, mask: BILAO9, kinds: K6, moves: 28, latik: l((x, y) => (Math.abs(x - 4) + Math.abs(y - 4) <= 1 ? '2' : '')), wrap: w((x, y) => y >= 6 && x >= 2 && x <= 6 && (x + y) % 2 === 1), goals: [{ type: 'latik' }, { type: 'dahon' }, { type: 'collect', kind: 'puto', n: 18 }], stars: [1, 15300, 22900], seed: 215, tip: 'Ang huling bilao ng palengke! Buksan lahat ng dahon bago magsara.' },
];
