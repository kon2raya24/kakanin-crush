// node tools/check.mjs [port | url]: Kakanin Crush in headless Chrome — desktop and phone, drag and tap,
// rapid input during a cascade, the flat fallback, a resize mid-cascade, and no page errors.
import { openChrome, sleep } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const arg = process.argv[2] || '5520';
const BASE = arg.startsWith('http') ? arg.replace(/\/?$/, '/') : `http://127.0.0.1:${arg}/`;
mkdirSync('.scratch', { recursive: true });
const page = await openChrome(9600 + Math.floor(Math.random() * 90));
await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: "window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message)));addEventListener('unhandledrejection',e=>__errs.push('rej '+String(e.reason)));" });
const E = (js) => page.evaluate(js);
// headless renders at 1-2 fps, so animations take real seconds
const until = async (js, ms = 60000) => { for (let t = 0; t < ms; t += 200) { if (await E(js)) return true; await sleep(200); } return false; };
const shot = async (name) => { const r = await page.cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(`.scratch/check-${name}.png`, Buffer.from(r.data, 'base64')); };
const fails = [];
const check = (ok, what) => { console.log(ok ? 'ok  ' : 'FAIL', what); if (!ok) fails.push(what); };
const mouse = async (type, x, y) => page.cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
// screen point of a cell, found by scanning with the view's own picking
const cellPoint = (i) => E(`(() => { const c = document.querySelector('canvas'), r = c.getBoundingClientRect(); for (let y = r.top; y < r.bottom; y += 6) for (let x = r.left; x < r.right; x += 6) if (__kc.view.pick(x, y) === ${i}) return [x + 3, y + 3]; return null; })()`);
const matches = () => E(`(() => { const d = __kc.view.dump().kinds, g = __kc.game; return JSON.stringify(Array.from({ length: g.cell.length }, (_, i) => d[i] ?? -1)) === JSON.stringify(Array.from(g.cell).map((c, i) => (g.mask[i] ? c : -1))); })()`);

// 1. desktop title, then a level
await page.viewport(1280, 760);
await page.load(`${BASE}?test=1`);
await until('!!window.__kc'); await sleep(2500); await shot('title');
check(await E('__kc.mode') === 'title', 'title screen');
await page.load(`${BASE}?test=1&level=sr-01&seed=4`);
await until('window.__kc && __kc.mode === "play"'); await sleep(1500); await shot('desktop-play');
// 1b. sounds and reactions arrive with the animation: swap, then the pops, then the landing
await E('__kc.beats.length = 0, 1');
const [ba, bb] = JSON.parse(await E('JSON.stringify(__kc.moves()[0])'));
await E(`__kc.swap(${ba}, ${bb}), 1`);
await until('!__kc.busy()', 90000);
const beats = JSON.parse(await E('JSON.stringify(__kc.beats.map((b) => [b.type, b.t]))'));
const at = (type) => beats.find((b) => b[0] === type);
check(at('swap') && at('pop') && at('land') && beats.indexOf(at('swap')) < beats.indexOf(at('pop')) && beats.indexOf(at('pop')) < beats.indexOf(at('land')), `beats come in order: ${beats.map((b) => b[0]).join(' ')}`);
check(at('pop') && at('pop')[1] - at('swap')[1] >= 100, 'the pop sounds when the pieces burst, not at the swap');
// 1c. the recorded sounds load and play with a move
await E('__kc.view && document.getElementById("hint-btn").click(), 1'); // a user gesture starts the audio
await until('__kc.audioStats().loaded >= 40', 30000);
const p0 = await E('__kc.audioStats().plays');
const [sa, sb] = JSON.parse(await E('JSON.stringify(__kc.moves()[0])'));
await E(`__kc.swap(${sa}, ${sb}), 1`); await until('!__kc.busy()', 90000);
const st = JSON.parse(await E('JSON.stringify(__kc.audioStats())'));
check(st.fails === 0 && st.plays - p0 >= 3, `recorded sounds load and play (loaded ${st.loaded}, fails ${st.fails}, plays ${st.plays - p0})`);
// 2. drag a real move
const [a, b] = JSON.parse(await E('JSON.stringify(__kc.moves()[0])'));
const pa = await cellPoint(a), pb = await cellPoint(b);
check(pa && pb, 'cells can be picked on screen');
const before = await E('__kc.game.moves');
await mouse('mousePressed', ...pa); await mouse('mouseMoved', (pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2); await mouse('mouseMoved', ...pb); await mouse('mouseReleased', ...pb);
await until('!__kc.busy()', 90000);
check(await E('__kc.game.moves') === before - 1, 'drag swaps and costs one move');
check(await matches(), 'the 3D board matches the rules after the move');
// 3. tap-tap
const [c, d] = JSON.parse(await E('JSON.stringify(__kc.moves()[0])'));
const pc = await cellPoint(c), pd = await cellPoint(d);
await mouse('mousePressed', ...pc); await mouse('mouseReleased', ...pc); await mouse('mousePressed', ...pd); await mouse('mouseReleased', ...pd);
await until('!__kc.busy()', 90000);
check(await E('__kc.game.moves') === before - 2, 'tap one, tap its neighbour: a swap');
// 4. rapid input while the board animates: only one swap counts
const [e2, f2] = JSON.parse(await E('JSON.stringify(__kc.moves()[0])'));
const pe = await cellPoint(e2), pf = await cellPoint(f2), m0 = await E('__kc.game.moves');
await mouse('mousePressed', ...pe); await mouse('mouseMoved', ...pf); await mouse('mouseReleased', ...pf);
for (let k = 0; k < 6; k++) { await mouse('mousePressed', ...pe); await mouse('mouseMoved', ...pf); await mouse('mouseReleased', ...pf); }
await until('!__kc.busy()', 90000);
check((await E('__kc.game.moves')) === m0 - 1, `taps during a cascade are ignored, not queued (${m0 - (await E('__kc.game.moves'))} swaps)`);
check(await matches(), 'still in sync after rapid input');
// 5. a resize mid-cascade
const [g2, h2] = JSON.parse(await E('JSON.stringify(__kc.moves()[0])'));
await E(`__kc.swap(${g2}, ${h2})`); await sleep(120); await page.viewport(900, 700); await sleep(200); await page.viewport(1280, 760);
await until('!__kc.busy()', 90000);
check(await matches(), 'a resize during a cascade leaves the board right');
// 5b. leaving mid-animation: a move that ends the level, then pause and restart before it finishes
await page.load(`${BASE}?test=1&level=sr-01&seed=4`);
await until('window.__kc && __kc.mode === "play"');
await E('__kc.game.moves = 1, 1');
const [lv1, lv2] = JSON.parse(await E('JSON.stringify(__kc.moves()[0])'));
await E(`__kc.swap(${lv1}, ${lv2}), 1`); await sleep(150); // don't await the swap: it resolves when the animation ends
check(await E('__kc.busy()'), 'the last move is still animating');
await E('document.getElementById("pause-btn").click(), document.getElementById("restart").click(), 1');
await until('!__kc.busy()', 90000); await sleep(1500);
check(await E('__kc.mode') === 'play' && await E('__kc.game.phase') === 'play' && await E('__kc.game.moves === __kc.LEVELS[0].moves'), `an old animation can't end the new game (mode ${await E('__kc.mode')})`);
// 5b2. leaving mid-animation also silences the old move: none of its beats reach the new level
await page.load(`${BASE}?test=1&level=sr-01&seed=4`);
await until('window.__kc && __kc.mode === "play"');
{
  const [la, lb] = JSON.parse(await E('JSON.stringify(__kc.moves()[0])'));
  await E(`__kc.swap(${la}, ${lb}), 1`); await sleep(150);
  await E('document.getElementById("pause-btn").click(), document.getElementById("restart").click(), __kc.beats.length = 0, 1');
  await until('!__kc.busy()', 90000); await sleep(1500);
  const late = JSON.parse(await E('JSON.stringify(__kc.beats.map((b) => b.type).filter((t) => t !== "go"))'));
  check(late.length === 0, `no sounds or reactions from a move you left (${late.join(' ') || 'none'})`);
}
// 5b3. many specials going off at once stay a few voices, not a pile-up
{
  await E('document.getElementById("hint-btn").click(), 1');
  const p0 = await E('__kc.audioStats().plays');
  await E('for (let k = 0; k < 12; k++) __kc.audio.event({ type: "fire", i: k, spec: k % 2 ? 3 : 1 }); 1');
  const burst = (await E('__kc.audioStats().plays')) - p0;
  check(burst <= 4, `twelve specials at once play at most 4 samples (${burst})`);
}
// 5c. keys after moving from a 9x9 level to a 7x7 one
await page.load(`${BASE}?test=1&level=sr-07&seed=4&instant`);
await until('window.__kc && __kc.mode === "play"');
for (let k = 0; k < 8; k++) { await page.key('ArrowDown', { keyCode: 40 }); await page.key('ArrowRight', { keyCode: 39 }); }
await E('__kc.start(0), 1'); await sleep(300);
await page.key('ArrowLeft', { keyCode: 37 });
check(await E('__kc.cursor >= 0 && __kc.cursor < __kc.game.cell.length'), `arrow keys work on a smaller board (cursor ${await E('__kc.cursor')})`);
// 5d. leaving for the menu mid-animation: the title demo keeps playing
await page.load(`${BASE}?test=1&level=sr-01&seed=4`);
await until('window.__kc && __kc.mode === "play"');
const [m1, m2] = JSON.parse(await E('JSON.stringify(__kc.moves()[0])'));
await E(`__kc.swap(${m1}, ${m2}), 1`); await sleep(150);
await E('document.getElementById("pause-btn").click(), document.querySelector("#pause .to-levels").click(), document.querySelector("#levels .menu").click(), 1');
const turn0 = await E('__kc.game ? __kc.game.turn : -1');
check(await until(`__kc.mode === 'title' && __kc.game && __kc.game.turn !== ${turn0}`, 90000), 'the title demo plays after leaving mid-animation');
// 5e. Lola: real when the people files are there, a stand-in without; she claps for a special and never covers the board
await page.load(`${BASE}?test=1&level=sr-03&seed=6&instant`);
await until('window.__kc && __kc.mode === "play" && __kc.lola');
check(await until('__kc.lola.state() === "real"', 60000), `Lola is the real figure (${await E('__kc.lola.state()')})`);
// the strong bot goes for specials: let it play a longer level until one is made
await page.load(`${BASE}?test=1&level=sr-07&seed=6&instant&bot`);
await until('window.__kc && __kc.lola && (__kc.lola.history().includes("clap") || __kc.mode === "result")', 90000);
check(await E('__kc.lola.history().includes("clap")'), `Lola claps for a special (${await E('JSON.stringify(__kc.lola.history().slice(-6))')})`);
await page.load(`${BASE}?test=1&level=sr-03&seed=6&instant`);
await until('window.__kc && __kc.mode === "play" && __kc.lola');
const overlap = async () => E(`(() => { const a = __kc.lola.box(), b = __kc.view.boardBox(); if (!a) return 'offscreen'; return a.x1 < b.x0 || a.x0 > b.x1 || a.y1 < b.y0 || a.y0 > b.y1 ? 'clear' : JSON.stringify({ lola: a, board: b }); })()`);
const ov1 = await overlap(); check(ov1 === 'clear' || ov1 === 'offscreen', `Lola doesn't cover the board on desktop (${ov1})`);
await shot('lola-desktop');
await page.load(`${BASE}?test=1&level=sr-03&seed=6&people=0`);
await until('window.__kc && __kc.mode === "play" && __kc.lola');
check(await E('__kc.lola.state()') === 'standin', 'without the people files, a stand-in Lola');
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await page.load(`${BASE}?test=1&level=sr-03&seed=6`);
await until('window.__kc && __kc.mode === "play" && __kc.lola'); await until('__kc.lola.state() === "real"', 60000); await sleep(1500);
const ov2 = await overlap(); check(ov2 === 'clear' || ov2 === 'offscreen', `Lola doesn't cover the board on a phone (${ov2})`);
await shot('lola-phone');
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 760, deviceScaleFactor: 1, mobile: false });
// 5f. keyboard: arrows move, Space picks up, an arrow swaps
await page.load(`${BASE}?test=1&level=sr-01&seed=4&instant`);
await until('window.__kc && __kc.mode === "play"');
{
  const [ka, kb] = JSON.parse(await E('JSON.stringify(__kc.moves()[0])')), W = await E('__kc.game.W'), k0 = await E('__kc.game.moves');
  await page.key('ArrowRight', { keyCode: 39 }); await page.key('ArrowLeft', { keyCode: 37 }); // the cursor appears at the centre
  let cur = await E('__kc.cursor');
  for (let n = 0; n < 20 && cur % W !== ka % W; n++) { await page.key(cur % W < ka % W ? 'ArrowRight' : 'ArrowLeft', { keyCode: cur % W < ka % W ? 39 : 37 }); cur = await E('__kc.cursor'); }
  for (let n = 0; n < 20 && Math.floor(cur / W) !== Math.floor(ka / W); n++) { await page.key(cur < ka ? 'ArrowDown' : 'ArrowUp', { keyCode: cur < ka ? 40 : 38 }); cur = await E('__kc.cursor'); }
  await page.key(' ', { code: 'Space', keyCode: 32, text: ' ' });
  const dir = kb === ka + 1 ? ['ArrowRight', 39] : ['ArrowDown', 40];
  await page.key(dir[0], { keyCode: dir[1] }); await until('!__kc.busy()', 30000);
  check(await E('__kc.game.moves') === k0 - 1, `a keyboard swap (cursor ${cur}, move ${ka}-${kb})`);
}
// 5g. the hint waits for the board to settle; the cursor never sits on a hole
await page.load(`${BASE}?test=1&level=sr-06&seed=4`);
await until('window.__kc && __kc.mode === "play"');
{
  const [ha, hb] = JSON.parse(await E('JSON.stringify(__kc.moves()[0])'));
  await E(`__kc.swap(${ha}, ${hb}), 1`); await sleep(150);
  await E('document.getElementById("hint-btn").click(), 1');
  check(await E('__kc.busy() && __kc.view.hintShown() === null'), 'no hint while the board moves');
  await until('!__kc.busy()', 90000);
  let onHole = false;
  for (const [key, code] of [['ArrowUp', 38], ['ArrowLeft', 37], ['ArrowUp', 38], ['ArrowLeft', 37], ['ArrowUp', 38], ['ArrowLeft', 37], ['ArrowUp', 38], ['ArrowUp', 38]]) { await page.key(key, { keyCode: code }); if (await E('__kc.cursor >= 0 && !__kc.game.mask[__kc.cursor]')) onHole = true; }
  check(!onHole, 'the keyboard cursor never lands on a hole');
}
// 5h. restarting doesn't pile up GPU geometry
{
  const counts = [];
  for (let r = 0; r < 4; r++) { await E('__kc.start(5), 1'); await sleep(800); counts.push(await E('__kc.view.renderer.info.memory.geometries')); }
  check(counts[3] - counts[0] <= 1, `restarts don't pile up GPU geometry (${counts.join(' → ')})`);
}
// 6. the bot finishes a level and the result screen shows
await page.load(`${BASE}?test=1&level=sr-01&bot&instant&seed=2`);
check(await until('__kc.mode === "result"', 90000), 'the bot finishes level 1');
await sleep(2200);
check(await E('document.querySelectorAll("#result-stars .star.on").length === __kc.game.won'), `the stars earned land on the results (${await E('document.querySelectorAll("#result-stars .star.on").length')} of ${await E('__kc.game.won')})`);
await shot('result');
// 7. phone portrait: the bilao fills the width, the HUD strip above it
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
await page.load(`${BASE}?test=1&level=sr-06&seed=3`);
await until('window.__kc && __kc.mode === "play"'); await sleep(1500); await shot('phone-play');
// the widest row of cells on screen (a bilao-shaped level has holes at its corners)
const span = JSON.parse(await E(`JSON.stringify((() => { let best = [0, 0]; for (let y = innerHeight * 0.3; y < innerHeight * 0.9; y += 8) { const cols = []; for (let x = 0; x < innerWidth; x += 3) if (__kc.view.pick(x, y) >= 0) cols.push(x); if (cols.length && cols.at(-1) - cols[0] > best[1] - best[0]) best = [cols[0], cols.at(-1)]; } return best; })())`));
check(span[1] - span[0] >= 390 * 0.85, `the board spans the phone's width (${span[1] - span[0]}px of 390)`);
const signBottom = await E(`Math.max(...[...document.querySelectorAll('.sign:not(#sign-boost)')].map((s) => s.getBoundingClientRect().bottom))`);
const boardTop = await E(`(() => { for (let y = 0; y < innerHeight; y += 3) if (__kc.view.pick(innerWidth / 2, y) >= 0) return y; return 9999; })()`);
const boostTop = await E(`document.getElementById('sign-boost').getBoundingClientRect().top`);
const boardBottom = await E(`(() => { for (let y = innerHeight - 1; y > 0; y -= 3) if (__kc.view.pick(innerWidth / 2, y) >= 0) return y; return 0; })()`);
check(boostTop >= boardBottom - 4, `the boosters sit below the board on a phone (${boostTop} ≥ ${boardBottom})`);
check(signBottom <= boardTop + 4, `the signboards sit above the board (${signBottom} ≤ ${boardTop})`);
// 8. the flat fallback is playable
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 760, deviceScaleFactor: 1, mobile: false });
await page.load(`${BASE}?test=1&level=sr-01&flat=1&bot&instant&seed=5`);
check(await until('__kc.mode === "result"', 60000), 'the flat fallback plays a level through');
await shot('flat');
// 9. phase 3: blockers drawn and kept in sync, ingredients delivered, boosters used
const layers = () => E(`(() => { const d = __kc.view.dump(), g = __kc.game; for (let i = 0; i < g.cell.length; i++) { if (!g.mask[i]) continue; if ((d.wraps[i] || 0) !== g.wrap[i]) return 'wrap ' + i; if (g.cell[i] === 9 && d.specs[i] !== g.crate[i]) return 'crate ' + i; } return 'ok'; })()`);
await page.load(`${BASE}?test=1&level=pk-04&seed=4`);
await until('window.__kc && __kc.mode === "play"'); await sleep(1500); await shot('dahon');
check(await layers() === 'ok' && await E('__kc.game.wrap.some((w) => w)'), `the dahon wraps are drawn (${await layers()})`);
for (let n = 0; n < 3; n++) { await E('__kc.swap(...__kc.moves()[0]), 1'); await until('!__kc.busy()', 30000); }
check(await matches() && await layers() === 'ok', `wraps and pieces stay in sync over moves (${await layers()})`);
// crates and ants put on the board by hand (their towns come later)
await E(`(() => { const g = __kc.game; g.cell[0] = 9; g.crate[0] = 2; g.cell[2] = 9; g.crate[2] = 1; g.cell[g.W * 2] = 10; __kc.view.setGame(g); return 1; })()`);
await sleep(800); await shot('blockers');
check(await matches() && await layers() === 'ok', 'crates (by hp) and ants are drawn');
for (let n = 0; n < 4 && await E('__kc.game.phase === "play"'); n++) { await E('__kc.swap(...__kc.moves()[0]), 1'); await until('!__kc.busy()', 30000); }
check(await matches() && await layers() === 'ok', `crates, ants and wraps stay in sync over moves (${await layers()})`);
// boosters: Merienda at once; the Siyanse picks a cell, and Esc backs out
await E(`__kc.grant('merienda', 1), __kc.grant('siyanse', 2), 1`);
let mv0 = await E('__kc.game.moves');
await E(`document.querySelector('.boost[data-kind=merienda]').click(), 1`); await until('!__kc.busy()', 20000);
check(await E('__kc.game.moves') === mv0 + 5 && await E(`document.querySelector('.boost[data-kind=merienda]').disabled`), 'Merienda gives 5 moves and is used up');
await E(`document.querySelector('.boost[data-kind=siyanse]').click(), 1`);
check(await E('__kc.picking') === 'siyanse', 'the Siyanse waits for a cell');
await page.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
check(await E('__kc.picking') === null && await E('__kc.mode') === 'play', 'Esc backs out of picking, without pausing');
await E(`document.querySelector('.boost[data-kind=siyanse]').click(), 1`);
const tgt = await E(`__kc.game.cell.findIndex((c, i) => __kc.game.mask[i] && c >= 0 && c < 6 && !__kc.game.wrap[i])`), tp = await cellPoint(tgt);
mv0 = await E('__kc.game.moves');
await mouse('mousePressed', tp[0], tp[1]); await mouse('mouseReleased', tp[0], tp[1]); await until('!__kc.busy()', 30000);
check(await E('__kc.picking') === null && await E('__kc.game.moves') === mv0 && await E(`document.querySelector('.boost[data-kind=siyanse] small').textContent`) === '1', 'the Siyanse clears a picked cell, costs no move, and counts down');
check(await matches() && await layers() === 'ok', 'still in sync after boosters');
// a delivery level played through: the gata sinks, is delivered, and the board stays right
await page.load(`${BASE}?test=1&level=sb-04&bot&instant&seed=7`);
check(await until('__kc.mode === "result"', 120000), 'the bot plays a delivery level through');
check(await E(`__kc.beats.some((b) => b.type === 'deliver') && __kc.beats.some((b) => b.type === 'sink')`), 'ingredients sink and are delivered, with their beats');
check((await E('JSON.stringify(__errs)')) === '[]', `no page errors ${await E('JSON.stringify(__errs)')}`);
await page.close().catch(() => {});
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall ok');
process.exit(fails.length ? 1 : 0);
