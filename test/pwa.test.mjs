import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

test('every module, vendor file, env asset and icon is precached, and every precached file exists', () => {
  for (const f of readdirSync(new URL('../src', import.meta.url)).filter((f) => f.endsWith('.mjs'))) assert.ok(assets.includes(`src/${f}`), `src/${f}`);
  for (const f of readdirSync(new URL('../src/vendor', import.meta.url)).filter((f) => f.endsWith('.js'))) assert.ok(assets.includes(`src/vendor/${f}`), `src/vendor/${f}`);
  for (const f of readdirSync(new URL('../src/towns', import.meta.url)).filter((f) => f.endsWith('.mjs'))) assert.ok(assets.includes(`src/towns/${f}`), `src/towns/${f}`);
  for (const f of readdirSync(new URL('../assets/sfx', import.meta.url)).filter((f) => f.endsWith('.mp3'))) assert.ok(assets.includes(`assets/sfx/${f}`), `assets/sfx/${f}`);
  for (const d of ['sky', 'tex', 'props']) for (const f of readdirSync(new URL(`../assets/env/${d}`, import.meta.url))) assert.ok(assets.includes(`assets/env/${d}/${f}`), `assets/env/${d}/${f}`);
  const manifest = JSON.parse(readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  for (const i of manifest.icons) assert.ok(assets.includes(i.src), i.src);
  for (const a of assets.filter((x) => x !== './')) assert.ok(existsSync(new URL(`../${a}`, import.meta.url)), `${a} missing`);
});
