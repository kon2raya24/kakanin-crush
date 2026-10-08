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
const matches = () => E(`JSON.stringify(__kc.view.dump().kinds) === JSON.stringify(Array.from(__kc.game.cell).map((c, i) => __kc.game.mask[i] ? c : -1))`);

// 1. desktop title, then a level
await page.viewport(1280, 760);
await page.load(`${BASE}?test=1`);
await until('!!window.__kc'); await sleep(2500); await shot('title');
check(await E('__kc.mode') === 'title', 'title screen');
await page.load(`${BASE}?test=1&level=sr-01&seed=4`);
await until('window.__kc && __kc.mode === "play"'); await sleep(1500); await shot('desktop-play');
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
check((await E('__kc.game.moves')) >= m0 - 2, 'taps during a cascade are ignored, not queued');
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
check(await E('__kc.mode') === 'play' && await E('__kc.game.phase') === 'play' && await E('__kc.game.moves') === 18, `an old animation can't end the new game (mode ${await E('__kc.mode')})`);
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
await sleep(20000);
check(await E('__kc.mode') === 'title' && (await E('__kc.game ? __kc.game.turn : -1')) !== turn0, 'the title demo plays after leaving mid-animation');
// 6. the bot finishes a level and the result screen shows
await page.load(`${BASE}?test=1&level=sr-01&bot&instant&seed=2`);
check(await until('__kc.mode === "result"', 90000), 'the bot finishes level 1');
await shot('result');
// 7. phone portrait: the bilao fills the width, the HUD strip above it
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
await page.load(`${BASE}?test=1&level=sr-06&seed=3`);
await until('window.__kc && __kc.mode === "play"'); await sleep(1500); await shot('phone-play');
// the widest row of cells on screen (a bilao-shaped level has holes at its corners)
const span = JSON.parse(await E(`JSON.stringify((() => { let best = [0, 0]; for (let y = innerHeight * 0.3; y < innerHeight * 0.9; y += 8) { const cols = []; for (let x = 0; x < innerWidth; x += 3) if (__kc.view.pick(x, y) >= 0) cols.push(x); if (cols.length && cols.at(-1) - cols[0] > best[1] - best[0]) best = [cols[0], cols.at(-1)]; } return best; })())`));
check(span[1] - span[0] >= 390 * 0.85 - 40, `the board spans the phone's width (${span[1] - span[0]}px of 390)`);
const signBottom = await E(`Math.max(...[...document.querySelectorAll('.sign')].map((s) => s.getBoundingClientRect().bottom))`);
const boardTop = await E(`(() => { for (let y = 0; y < innerHeight; y += 3) if (__kc.view.pick(innerWidth / 2, y) >= 0) return y; return 9999; })()`);
check(signBottom <= boardTop + 4, `the signboards sit above the board (${signBottom} ≤ ${boardTop})`);
// 8. the flat fallback is playable
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 760, deviceScaleFactor: 1, mobile: false });
await page.load(`${BASE}?test=1&level=sr-01&flat=1&bot&instant&seed=5`);
check(await until('__kc.mode === "result"', 60000), 'the flat fallback plays a level through');
await shot('flat');
check((await E('JSON.stringify(__errs)')) === '[]', `no page errors ${await E('JSON.stringify(__errs)')}`);
await page.close().catch(() => {});
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall ok');
process.exit(fails.length ? 1 : 0);
