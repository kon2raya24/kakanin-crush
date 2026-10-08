// Town 1, San Roque: a sari-sari street at golden hour. 15 levels that teach the game: plain collecting,
// then specials, then latik (the town's new blocker), then everything together. Each level is data; the
// rules (game.mjs) build the board from it. Masks: '#' a cell, '.' a hole. Latik: '1'-'9' layers.
import { BILAO9, RING9, HOLE9 } from './masks.mjs';

export const TOWN = { id: 'san-roque', n: 1, name: 'San Roque', place: 'Sari-sari street', theme: 'golden', blocker: 'latik', dish: { name: 'Bilao ng puto at kutsinta', note: 'Puto is steamed rice cake; kutsinta, its chewy brown cousin, gets its colour from lye water and annatto.' } };

const K4 = ['puto', 'kutsinta', 'sapin', 'bibingka'];
const K5 = [...K4, 'ube'];
const K6 = [...K5, 'suman'];
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
