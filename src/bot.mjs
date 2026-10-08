// Two players for the balance tests and the title demo.
// - strong (the default): tries every legal swap on a copy of the game and keeps the one that helps the
//   goals most. It sees the real refills (the copy carries the RNG), so it plays better than a person:
//   if it can't win a level, nobody can.
// - casual: sees only the match its swap makes (the first step: no cascades, no refills) and picks among
//   its best three, like a person scanning the board. The difficulty curve is tuned against it.
import { createGame, swap, findMoves, clone, NONE, BILAO } from './game.mjs';
import { next } from './rng.mjs';

function value(g) {
  if (g.phase === 'won') return 1e9 + g.score;
  let v = 0;
  for (const q of g.goals) v += (Math.min(q.got, q.need) / q.need) * 10000;
  v += g.score / 20;
  for (let i = 0; i < g.spec.length; i++) if (g.spec[i] !== NONE) v += g.cell[i] === BILAO ? 900 : 400;
  return v;
}

function casualMove(g, r) {
  const scored = [];
  for (const [a, b] of findMoves(g)) {
    const s = swap(clone(g), a, b).events.find((e) => e.type === 'step');
    if (!s) continue;
    let v = s.cleared.length + s.made.length * 3 + s.latik.length * 2;
    for (const q of g.goals) if (q.type === 'collect') v += s.cleared.filter((c) => c[1] === q.kind).length * 2;
    scored.push([v, a, b]);
  }
  scored.sort((x, y) => y[0] - x[0]);
  const top = scored.slice(0, 3);
  if (!top.length) return null;
  const [s, u] = next(r.s); r.s = s;
  const pick = top[Math.floor(u * top.length)];
  return [pick[1], pick[2]];
}

export function chooseMove(g, { casual = false, r = { s: 1 } } = {}) {
  if (casual) return casualMove(g, r);
  let best = null, bv = -Infinity;
  for (const [a, b] of findMoves(g)) {
    const t = clone(g);
    if (!swap(t, a, b).ok) continue;
    const v = value(t);
    if (v > bv) { bv = v; best = [a, b]; }
  }
  return best;
}

export function playLevel(level, seed = level.seed, { casual = false } = {}) {
  const g = createGame(level, seed), r = { s: (seed * 2654435761) >>> 0 };
  let movesLeft = 0; // counted when the order is done, before Ubos-Benta spends them
  for (let guard = 0; guard < 500 && g.phase === 'play'; guard++) {
    const mv = chooseMove(g, { casual, r });
    if (!mv) break;
    const u = swap(g, ...mv).events.find((e) => e.type === 'ubos');
    if (u) movesLeft = u.moves;
  }
  return { won: g.phase === 'won', stars: g.won, score: g.score, movesLeft };
}
