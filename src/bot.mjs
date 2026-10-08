// A decent player for the balance tests and the title demo: it tries every legal swap on a copy of the
// game and keeps the one that helps the goals most. It sees the real refills (the copy carries the RNG),
// so it plays a little better than a person; the balance bands allow for that.
import { createGame, swap, findMoves, clone, NONE, BILAO } from './game.mjs';

function value(g) {
  if (g.phase === 'won') return 1e9 + g.score;
  let v = 0;
  for (const q of g.goals) v += (Math.min(q.got, q.need) / q.need) * 10000;
  v += g.score / 20;
  for (let i = 0; i < g.spec.length; i++) if (g.spec[i] !== NONE) v += g.cell[i] === BILAO ? 900 : 400;
  return v;
}

export function chooseMove(g) {
  let best = null, bv = -Infinity;
  for (const [a, b] of findMoves(g)) {
    const t = clone(g);
    if (!swap(t, a, b).ok) continue;
    const v = value(t);
    if (v > bv) { bv = v; best = [a, b]; }
  }
  return best;
}

export function playLevel(level, seed = level.seed) {
  const g = createGame(level, seed);
  let movesLeft = 0; // counted when the order is done, before Ubos-Benta spends them
  for (let guard = 0; guard < 500 && g.phase === 'play'; guard++) {
    const mv = chooseMove(g);
    if (!mv) break;
    const u = swap(g, ...mv).events.find((e) => e.type === 'ubos');
    if (u) movesLeft = u.moves;
  }
  return { won: g.phase === 'won', stars: g.won, score: g.score, movesLeft };
}
