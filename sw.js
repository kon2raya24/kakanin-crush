// Offline play: the game's files are cached on install and served cache-first; the webfont is cached
// the first time it loads. Bump VERSION whenever a file changes so players get the update.
const VERSION = 'kakanin-v1';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'src/main.mjs', 'src/game.mjs', 'src/rng.mjs', 'src/levels.mjs', 'src/bot.mjs', 'src/progress.mjs', 'src/audio.mjs',
  'src/view3d.mjs', 'src/kakanin3d.mjs', 'src/stall3d.mjs', 'src/render2d.mjs', 'src/tex.mjs', 'src/post.mjs',
  'src/vendor/three.module.min.js', 'src/vendor/three-extra.min.js', 'src/vendor/three-fx.min.js', 'src/vendor/three-mocap.min.js',
  'assets/env/sky/kloppenheim_06_puresky.hdr', 'assets/env/sky/bd_golden.jpg',
  'assets/env/tex/asphalt_02_diff.jpg', 'assets/env/tex/asphalt_02_nor.jpg', 'assets/env/tex/rusty_corrugated_iron_diff.jpg', 'assets/env/tex/rusty_corrugated_iron_nor.jpg',
  'assets/env/props/plastic_monobloc_chair_01.glb', 'assets/env/props/plastic_crate_02.glb', 'assets/env/props/small_lpg_tank.glb', 'assets/env/props/Barrel_01.glb', 'assets/env/props/wooden_bucket_02.glb',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !font) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: url.origin === location.origin });
    if (hit) return hit;
    try { const res = await fetch(e.request); if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone()); return res; }
    catch { return (await cache.match('index.html')) || Response.error(); }
  }));
});
