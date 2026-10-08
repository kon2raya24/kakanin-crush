// The page: screens, the HUD, input (drag, tap-tap, keys), the loop, sound and saves. The rules live in
// game.mjs and only change through swap(); the view animates their events and ignores input until the
// board is still again.
import { createGame, swap, hint, adjacent, findMoves, KAKANIN } from './game.mjs';
import { LEVELS, TOWN } from './levels.mjs';
import { chooseMove } from './bot.mjs';
import { load, save, record, isUnlocked, totalStars, fresh } from './progress.mjs';
import { createAudio } from './audio.mjs';

const Q = new URLSearchParams(location.search);
const TEST = Q.get('test') === '1', BOT = Q.has('bot');
const FAST = TEST && Q.has('instant') ? Infinity : Number(Q.get('fast')) || 1; // ?instant: animations end at once (headless checks render at 1-2 fps)
const store = TEST ? null : (() => { try { return window.localStorage; } catch { return null; } })();
let data = store ? load(store) : fresh();
const persist = () => { if (store) save(store, data); };
const $ = (id) => document.getElementById(id);
const reduced = () => data.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
const A = createAudio(); A.setMuted(data.muted);
const LOLA = {
  win: ['Ayan! Ubos ang paninda!', 'Galing mo, apo!', 'Busog ang barangay!'],
  lose: ['Hay naku, may natira pa. Ulitin natin!', 'Konti na lang, apo!', 'Bukas, mauubos din \'yan.'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ---------- the view: 3D, or the flat fallback ----------
let view;
async function makeView() {
  const canvas = $('view');
  const want3d = Q.get('flat') !== '1' && (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
  if (want3d) {
    try { const { createView } = await import('./view3d.mjs'); view = createView(canvas, { gfx: Q.get('gfx'), reduced, speed: FAST }); }
    catch (err) { console.warn('3D view failed, using the flat board', err); view = null; }
  }
  if (!view) { const { createFlat } = await import('./render2d.mjs'); const c2 = canvas.cloneNode(); canvas.replaceWith(c2); view = createFlat(c2); document.body.classList.add('flat'); }
  view.onCallout((text, step) => { const c = $('callout'); c.textContent = text; c.classList.remove('go'); void c.offsetWidth; c.classList.add('go'); });
  addEventListener('resize', () => view.resize());
  view.resize();
}

// ---------- state ----------
let mode = 'title', game = null, levelIx = 0, sel = -1, idle = 0, icons = {}, busy = false;
const SCREENS = ['title', 'levels', 'intro', 'pause', 'result'];
function show(name) {
  for (const id of SCREENS) $(id).hidden = id !== name;
  $('hud').hidden = !(name === null || name === 'pause');
  $('help').hidden = name === null;
  const first = name && ($(name).querySelector('button.primary') || $(name).querySelector('button'));
  if (first) first.focus({ preventScroll: true });
}
function toast(text, ms = 2600) { const t = $('toast'); t.textContent = text; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, ms); }
function hintOnce(id, text) { if (data.hints.includes(id)) return; data.hints.push(id); persist(); toast(text, 3600); }
function say(text) { const b = $('bubble'); b.innerHTML = '<b>Lola:</b> '; b.append(text); b.hidden = false; clearTimeout(say.t); say.t = setTimeout(() => { b.hidden = true; }, 3800); }

// ---------- HUD ----------
const goalText = (q) => (q.type === 'collect' ? `${KAKANIN[q.kind]}` : q.type === 'latik' ? 'latik' : 'puntos');
function drawGoals() {
  const box = $('h-goals'); box.replaceChildren();
  for (const q of game.goals) {
    const row = document.createElement('div'); row.className = 'goal' + (q.got >= q.need ? ' done' : '');
    if (q.type === 'collect' && icons[q.kind]) { const im = new Image(); im.src = icons[q.kind]; im.alt = KAKANIN[q.kind]; row.append(im); }
    const left = Math.max(0, q.need - q.got);
    row.append(q.type === 'score' ? `${Math.min(q.got, q.need)} / ${q.need}` : q.type === 'latik' ? `latik × ${left}` : `× ${left}`);
    box.append(row);
  }
}
function hud(prev) {
  const lv = LEVELS[levelIx];
  $('h-score').querySelector('b').textContent = game.score.toLocaleString('en-PH');
  $('h-best').querySelector('b').textContent = Math.max(data.best[lv.id] || 0, game.score).toLocaleString('en-PH');
  $('h-level').querySelector('b').textContent = `${TOWN.name.toUpperCase()} ${levelIx + 1}`;
  $('h-level').querySelector('em').textContent = lv.name;
  $('h-moves').textContent = game.moves; $('h-moves').classList.toggle('low', game.moves <= 5);
  const top = lv.stars[2] * 1.1; $('h-meter').style.width = `${Math.min(100, (game.score / top) * 100)}%`;
  $('h-s2').style.left = `${(lv.stars[1] / top) * 100}%`; $('h-s3').style.left = `${(lv.stars[2] / top) * 100}%`;
  const s = game.score >= lv.stars[2] ? 3 : game.score >= lv.stars[1] ? 2 : game.goals.every((q) => q.got >= q.need) ? 1 : 0;
  $('h-stars').textContent = '★'.repeat(s) + '☆'.repeat(3 - s);
  drawGoals();
  if (prev) game.goals.forEach((q, n) => { if (q.got !== prev[n]) { const el = $('h-goals').children[n]; el?.classList.add('pop'); A.event({ type: 'goal' }); } });
}

// ---------- beats: the view calls this as each part of a move animates ----------
const beats = []; // the last moves' beats, for the browser checks
function beat(b) {
  A.event(b);
  if (TEST) { beats.push({ type: b.type, t: performance.now() }); if (beats.length > 400) beats.splice(0, 200); }
}

// ---------- flow ----------
function titleScreen() { mode = 'title'; game = null; busy = false; $('title-stars').textContent = totalStars(data) ? `★ ${totalStars(data)} / ${LEVELS.length * 3}` : ''; show('title'); demo(); }
function levelsScreen() {
  mode = 'levels'; game = null; busy = false;
  const grid = $('grid'); grid.replaceChildren();
  LEVELS.forEach((lv, k) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lvl'; b.disabled = !isUnlocked(data, k);
    b.innerHTML = `${k + 1}<small>${'★'.repeat(data.stars[lv.id] || 0)}</small>`; b.setAttribute('aria-label', `Level ${k + 1}, ${lv.name}`);
    b.onclick = () => intro(k); grid.append(b);
  });
  $('town-stars').textContent = `★ ${totalStars(data)} / ${LEVELS.length * 3}`;
  show('levels');
}
function intro(k) {
  levelIx = k; const lv = LEVELS[k]; mode = 'intro';
  $('intro-name').textContent = `${k + 1}. ${lv.name}`;
  $('intro-goals').textContent = 'Kailangan: ' + lv.goals.map((q) => (q.type === 'collect' ? `${q.n} ${q.kind}` : q.type === 'latik' ? 'linisin ang lahat ng latik' : `${q.n.toLocaleString('en-PH')} puntos`)).join(' · ') + ` — sa ${lv.moves} galaw`;
  $('intro-tip').textContent = lv.tip ? `Lola: "${lv.tip}"` : '';
  show('intro');
}
function start(k = levelIx) {
  levelIx = k; A.start(); A.music(true);
  const lv = LEVELS[k], seed = Q.get('seed') ? Number(Q.get('seed')) : (lv.seed * 7919 + Math.floor(Math.random() * 1e6)) >>> 0;
  game = createGame(lv, seed); sel = -1; cursor = -1; idle = 0; busy = false;
  view.setGame(game); view.select(-1); view.showHint(null);
  mode = 'play'; show(null); hud(); A.event({ type: 'go' });
  if (lv.tip) say(lv.tip);
  hintOnce('swap', 'I-drag ang kakanin papunta sa katabi, o i-tap ang dalawa.');
}
async function doSwap(a, b) {
  if (mode !== 'play' || busy || view.busy() || !adjacent(game, a, b)) return;
  busy = true; sel = -1; view.select(-1); view.showHint(null); idle = 0;
  const g0 = game, prev = game.goals.map((q) => q.got);
  const r = swap(game, a, b);
  if (!r.ok) A.event({ type: 'tsk' });
  await view.play(r.events, game, beat);
  if (game !== g0) return; // the player left this game (restart, levels, menu) while it animated
  hud(prev);
  busy = false;
  const end = r.events.find((e) => e.type === 'end');
  if (end) finish(end);
  else if (r.events.some((e) => e.type === 'shuffle')) say('Ayusin natin!');
  else if (r.events.some((e) => e.type === 'step' && e.made.length)) hintOnce('special', 'May espesyal ka! Gamitin sa tugma para sumabog.');
}
function finish(end) {
  const lv = LEVELS[levelIx];
  if (end.won) { data = record(data, lv.id, end.stars, end.score); persist(); }
  A.music(false);
  const g0 = game;
  setTimeout(() => {
    if (game !== g0) return;
    mode = 'result';
    $('result-title').textContent = end.won ? 'Ubos ang paninda!' : 'May natira pa…';
    $('result-stars').textContent = end.won ? '★'.repeat(end.stars) + '☆'.repeat(3 - end.stars) : '';
    $('result-score').textContent = `${end.score.toLocaleString('en-PH')} puntos · best ${(data.best[lv.id] || end.score).toLocaleString('en-PH')}`;
    $('result-lola').textContent = `Lola: "${pick(end.won ? LOLA.win : LOLA.lose)}"`;
    $('next').hidden = !end.won || levelIx >= LEVELS.length - 1;
    show('result');
  }, 700 / FAST);
}
function pause() { if (mode === 'play') { mode = 'pause'; show('pause'); } }
function resume() { if (mode === 'pause') { mode = 'play'; show(null); } }

// ---------- input: drag a kakanin to a neighbour, or tap one then the other; keys move a cursor ----------
let down = null;
const stage = $('stage');
stage.addEventListener('pointerdown', (e) => {
  if (mode !== 'play' || busy || view.busy() || e.target.closest('button')) return;
  A.start();
  const i = view.pick(e.clientX, e.clientY); if (i < 0) return;
  down = { i, x: e.clientX, y: e.clientY, moved: false };
});
stage.addEventListener('pointermove', (e) => {
  if (!down || down.moved) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (Math.hypot(dx, dy) < 22) return;
  down.moved = true;
  const W = game.W, j = Math.abs(dx) > Math.abs(dy) ? down.i + Math.sign(dx) : down.i + Math.sign(dy) * W;
  if (adjacent(game, down.i, j)) doSwap(down.i, j);
});
stage.addEventListener('pointerup', () => {
  if (!down) return;
  const { i, moved } = down; down = null;
  if (moved || mode !== 'play') return;
  if (sel >= 0 && adjacent(game, sel, i)) { doSwap(sel, i); return; }
  sel = sel === i ? -1 : i; view.select(sel); A.event({ type: 'select' });
});
stage.addEventListener('pointercancel', () => { down = null; });
let cursor = -1;
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (mode === 'play') pause(); else if (mode === 'pause') resume(); return; }
  if (mode !== 'play' || !game) return;
  const W = game.W, H = game.H, d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -W, ArrowDown: W }[e.key];
  if (d !== undefined) {
    e.preventDefault();
    if (cursor < 0) cursor = Math.floor(H / 2) * W + Math.floor(W / 2);
    const to = cursor + d;
    if (!adjacent(game, cursor, to)) return;
    if (sel >= 0) { doSwap(sel, to); cursor = to; return; }
    cursor = to; view.select(cursor);
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault(); if (cursor < 0) return;
    sel = sel === cursor ? -1 : cursor; view.select(sel >= 0 ? sel : cursor); A.event({ type: 'select' });
  }
});

// ---------- buttons ----------
function labels() { for (const b of document.querySelectorAll('.sound')) b.textContent = data.muted ? '🔇' : '🔊'; }
for (const b of document.querySelectorAll('.sound')) b.onclick = () => { A.start(); data.muted = !data.muted; A.setMuted(data.muted); persist(); labels(); };
labels();
$('play').onclick = () => { A.start(); levelsScreen(); };
$('go').onclick = () => start(levelIx);
$('resume').onclick = resume;
$('restart').onclick = () => start(levelIx);
$('again').onclick = () => start(levelIx);
$('next').onclick = () => intro(levelIx + 1);
$('pause-btn').onclick = pause;
$('hint-btn').onclick = () => { if (mode === 'play' && game) view.showHint(hint(game)); };
for (const b of document.querySelectorAll('.to-levels')) b.onclick = levelsScreen;
document.addEventListener('click', (e) => { if (e.target.closest('button')) A.event({ type: 'click' }); });
for (const b of document.querySelectorAll('.menu')) b.onclick = titleScreen;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------- the title demo: the bot plays level 1 behind the title ----------
let demoT = 0;
function demo() { const g2 = createGame(LEVELS[0], (Math.random() * 1e9) >>> 0); game = g2; view.setGame(g2); }
async function demoMove() {
  if (!game || busy || view.busy()) return;
  if (game.phase !== 'play') { demo(); return; }
  const mv = chooseMove(game); if (!mv) { demo(); return; }
  busy = true; const g0 = game, r = swap(game, ...mv); await view.play(r.events, game); if (game === g0) busy = false; // the demo is silent
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000) * (mode === 'title' ? 1 : 1); last = now;
  if (mode === 'title' && (demoT += dt) > 1.2) { demoT = 0; demoMove(); }
  if (mode === 'play' && BOT && !busy && !view.busy() && game.phase === 'play') { const mv = chooseMove(game); if (mv) doSwap(...mv); }
  if (mode === 'play' && !busy && !view.busy() && game.phase === 'play' && (idle += dt) > 6) { view.showHint(hint(game)); idle = -999; }
  view.update(dt);
  requestAnimationFrame(frame);
}

await makeView();
icons = view.icons();
if ('serviceWorker' in navigator && !TEST) navigator.serviceWorker.register('sw.js').catch(() => { /* online only */ });
const startAt = Q.get('level') ? LEVELS.findIndex((l) => l.id === Q.get('level')) : -1;
if (startAt >= 0) start(startAt); else titleScreen();
requestAnimationFrame(frame);
if (TEST) window.__kc = { get game() { return game; }, get mode() { return mode; }, get view() { return view; }, start, swap: doSwap, moves: () => findMoves(game), beats, audioStats: () => A.stats(), get cursor() { return cursor; }, LEVELS, busy: () => busy || view.busy() };
