// Saves: stars and best scores per level, sound and motion settings, hints already shown. Everything in
// one localStorage entry; every access is guarded, and anything odd in it is dropped, not trusted.
import { LEVELS } from './levels.mjs';

export const KEY = 'kakanin.v1';
const IDS = new Set(LEVELS.map((l) => l.id));
export const fresh = () => ({ v: 1, stars: {}, best: {}, muted: false, calm: false, hints: [] });

function clean(v) {
  const d = fresh();
  if (!v || typeof v !== 'object') return d;
  for (const [id, n] of Object.entries(v.stars || {})) if (IDS.has(id) && Number.isFinite(n) && n > 0) d.stars[id] = Math.min(3, Math.floor(n));
  for (const [id, n] of Object.entries(v.best || {})) if (IDS.has(id) && Number.isFinite(n) && n > 0) d.best[id] = Math.floor(n);
  d.muted = v.muted === true; d.calm = v.calm === true;
  if (Array.isArray(v.hints)) d.hints = v.hints.filter((h) => typeof h === 'string').slice(0, 50);
  return d;
}

export function load(storage) { try { return clean(JSON.parse(storage.getItem(KEY))); } catch { return fresh(); } }
export function save(storage, data) { try { storage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable: play on */ } }
export function record(data, id, stars, score) {
  return { ...data, stars: { ...data.stars, [id]: Math.max(data.stars[id] || 0, stars) }, best: { ...data.best, [id]: Math.max(data.best[id] || 0, score) } };
}
export const isUnlocked = (data, index) => index === 0 || (data.stars[LEVELS[index - 1]?.id] || 0) > 0;
export const totalStars = (data) => Object.values(data.stars).reduce((a, b) => a + b, 0);
