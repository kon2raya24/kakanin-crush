// Offline play: the game's files are cached on install and served cache-first; the webfont is cached
// the first time it loads. Bump VERSION whenever a file changes so players get the update.
const VERSION = 'kakanin-v3';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'src/main.mjs', 'src/game.mjs', 'src/rng.mjs', 'src/levels.mjs', 'src/towns/masks.mjs', 'src/towns/san-roque.mjs', 'src/towns/palengke.mjs', 'src/towns/simbahan.mjs', 'src/bot.mjs', 'src/progress.mjs', 'src/audio.mjs',
  'src/view3d.mjs', 'src/kakanin3d.mjs', 'src/stall3d.mjs', 'src/render2d.mjs', 'src/lola3d.mjs', 'src/people.mjs', 'src/tex.mjs', 'src/post.mjs',
  'src/vendor/three.module.min.js', 'src/vendor/three-extra.min.js', 'src/vendor/three-fx.min.js', 'src/vendor/three-mocap.min.js',
  'assets/env/sky/kloppenheim_06_puresky.hdr', 'assets/env/sky/bd_golden.jpg', 'assets/env/sky/bd_noon.jpg', 'assets/env/sky/bd_dusk.jpg',
  'assets/env/tex/asphalt_02_diff.jpg', 'assets/env/tex/asphalt_02_nor.jpg', 'assets/env/tex/rusty_corrugated_iron_diff.jpg', 'assets/env/tex/rusty_corrugated_iron_nor.jpg',
  'assets/env/props/plastic_monobloc_chair_01.glb', 'assets/env/props/plastic_crate_02.glb', 'assets/env/props/small_lpg_tank.glb', 'assets/env/props/Barrel_01.glb', 'assets/env/props/wooden_bucket_02.glb',
  'assets/sfx/chips1.mp3', 'assets/sfx/chips2.mp3', 'assets/sfx/chips3.mp3', 'assets/sfx/chips4.mp3', 'assets/sfx/chips5.mp3', 'assets/sfx/chips6.mp3', 'assets/sfx/click1.mp3', 'assets/sfx/click2.mp3', 'assets/sfx/click3.mp3', 'assets/sfx/cloth1.mp3', 'assets/sfx/cloth2.mp3', 'assets/sfx/cloth3.mp3', 'assets/sfx/coin1.mp3', 'assets/sfx/coin2.mp3', 'assets/sfx/glass1.mp3', 'assets/sfx/glass2.mp3', 'assets/sfx/glass3.mp3', 'assets/sfx/glass4.mp3', 'assets/sfx/glass5.mp3', 'assets/sfx/glass6.mp3', 'assets/sfx/go.mp3', 'assets/sfx/handle1.mp3', 'assets/sfx/handle2.mp3', 'assets/sfx/handle3.mp3', 'assets/sfx/kaldero0.mp3', 'assets/sfx/kaldero1.mp3', 'assets/sfx/kaldero2.mp3', 'assets/sfx/latik0.mp3', 'assets/sfx/latik1.mp3', 'assets/sfx/latik2.mp3', 'assets/sfx/lose.mp3', 'assets/sfx/plank0.mp3', 'assets/sfx/plank1.mp3', 'assets/sfx/plank2.mp3', 'assets/sfx/pop1.mp3', 'assets/sfx/pop2.mp3', 'assets/sfx/pop3.mp3', 'assets/sfx/pop4.mp3', 'assets/sfx/rustle0.mp3', 'assets/sfx/rustle1.mp3', 'assets/sfx/rustle2.mp3', 'assets/sfx/sandok1.mp3', 'assets/sfx/sandok2.mp3', 'assets/sfx/sandok3.mp3', 'assets/sfx/select1.mp3', 'assets/sfx/select2.mp3', 'assets/sfx/select3.mp3', 'assets/sfx/shuffle.mp3', 'assets/sfx/special1.mp3', 'assets/sfx/special2.mp3', 'assets/sfx/special3.mp3', 'assets/sfx/star3.mp3', 'assets/sfx/start.mp3', 'assets/sfx/swap1.mp3', 'assets/sfx/swap2.mp3', 'assets/sfx/swap3.mp3', 'assets/sfx/swap4.mp3', 'assets/sfx/thud0.mp3', 'assets/sfx/thud1.mp3', 'assets/sfx/thud2.mp3', 'assets/sfx/tsk.mp3', 'assets/sfx/win.mp3',
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
