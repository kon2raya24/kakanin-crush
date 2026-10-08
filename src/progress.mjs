// Saves: stars and best scores per level, sound and motion settings, hints already shown. Everything in
// one localStorage entry; every access is guarded, and anything odd in it is dropped, not trusted.
import { LEVELS, TOWNS } from './levels.mjs';

export const KEY = 'kakanin.v1';
const IDS = new Set(LEVELS.map((l) => l.id));
export const BOOSTERS = ['pamaypay', 'sandok', 'merienda', 'siyanse'];
export const fresh = () => ({ v: 1, stars: {}, best: {}, muted: false, calm: false, hints: [], boosters: {}, granted: 0 });

function clean(v) {
  const d = fresh();
  if (!v || typeof v !== 'object') return d;
  for (const [id, n] of Object.entries(v.stars || {})) if (IDS.has(id) && Number.isFinite(n) && n > 0) d.stars[id] = Math.min(3, Math.floor(n));
  for (const [id, n] of Object.entries(v.best || {})) if (IDS.has(id) && Number.isFinite(n) && n > 0) d.best[id] = Math.floor(n);
  d.muted = v.muted === true; d.calm = v.calm === true;
  for (const k of BOOSTERS) { const n = v.boosters?.[k]; if (Number.isFinite(n) && n > 0) d.boosters[k] = Math.min(3, Math.floor(n)); }
  if (Number.isFinite(v.granted) && v.granted > 0) d.granted = Math.floor(v.granted);
  if (Array.isArray(v.hints)) d.hints = v.hints.filter((h) => typeof h === 'string').slice(0, 50);
  return d;
}

export function load(storage) { try { return clean(JSON.parse(storage.getItem(KEY))); } catch { return fresh(); } }
export function save(storage, data) { try { storage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable: play on */ } }
export function record(data, id, stars, score) {
  return { ...data, stars: { ...data.stars, [id]: Math.max(data.stars[id] || 0, stars) }, best: { ...data.best, [id]: Math.max(data.best[id] || 0, score) } };
}
export const totalStars = (data) => Object.values(data.stars).reduce((a, b) => a + b, 0);
// Town t (0-based) opens once the town before it has its finale cleared and 12 stars per town are in hand.
export const starsToOpen = (data, t) => Math.max(0, 12 * t - totalStars(data));
export const townOpen = (data, t) => t === 0 || ((data.stars[TOWNS[t - 1]?.levels.at(-1)] || 0) > 0 && !starsToOpen(data, t));
// a level opens with its town (the first) or after the one before it in the same town
export function isUnlocked(data, index) {
  const lv = LEVELS[index]; if (!lv) return false;
  const t = TOWNS.findIndex((x) => x.id === lv.town), k = TOWNS[t].levels.indexOf(lv.id);
  return k === 0 ? townOpen(data, t) : (data.stars[TOWNS[t].levels[k - 1]] || 0) > 0;
}
// A booster for every 10 stars, the kinds in turn, at most 3 of each; granted counts thresholds paid.
export function grant(data) {
  const due = Math.floor(totalStars(data) / 10), boosters = { ...data.boosters }, given = [];
  let n = data.granted;
  for (; n < due; n++) { const k = BOOSTERS[n % BOOSTERS.length]; if ((boosters[k] || 0) < 3) { boosters[k] = (boosters[k] || 0) + 1; given.push(k); } }
  return { data: { ...data, boosters, granted: n }, given };
}
