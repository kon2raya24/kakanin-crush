// node tools/shots.mjs [port] [levelId…]: a desktop screenshot of each level's opening board into .scratch/
import { openChrome, sleep } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
const [port = '5520', ...ids] = process.argv.slice(2);
mkdirSync('.scratch', { recursive: true });
const page = await openChrome(9700 + Math.floor(Math.random() * 90));
await page.viewport(1280, 760);
for (const id of ids) {
  await page.load(`http://127.0.0.1:${port}/?test=1&level=${id}&seed=3`);
  for (let t = 0; t < 60 && !(await page.evaluate('window.__kc && __kc.mode === "play"')); t++) await sleep(300);
  await sleep(5000);
  const r = await page.cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`.scratch/shot-${id}.png`, Buffer.from(r.data, 'base64')); console.log(id);
}
await page.close().catch(() => {});
process.exit(0);
