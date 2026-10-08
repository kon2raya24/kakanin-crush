// The 3D bilao for Kakanin Crush. It draws the rules' state (game.mjs) and plays their events as
// animations; it never changes the state. After every move it checks itself against the state and
// rebuilds any cell that differs, so a dropped frame or a resize mid-cascade can never leave it wrong.
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/three-extra.min.js';
import { EMPTY, BILAO, NONE, SANDOK_H, SANDOK_V, KALDERO, LAHAT } from './game.mjs';
import { makePiece, MATS, KCOLOR } from './kakanin3d.mjs';
import { buildStall } from './stall3d.mjs';
import { createPost } from './post.mjs';

export const CELL = 1.0;
const CALLOUTS = ['', '', 'Sarap!', 'Linamnam!', 'Panalo!', 'Ubos-Benta!'];
const ease = { out: (t) => 1 - (1 - t) ** 3, in: (t) => t * t, back: (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; } };

export function createView(canvas, { gfx = null, reduced = () => false, speed = 1, base = 'assets/env/' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const low = /Android|iPhone|iPad/.test(navigator.userAgent) || (navigator.hardwareConcurrency || 8) <= 4;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.5 : 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 160);
  const stall = buildStall(scene, renderer, { base });
  const fixed = gfx !== null && gfx !== '' && gfx !== undefined;
  const post = createPost(renderer, scene, camera, { level: fixed ? +gfx : low ? 1 : 2, auto: !fixed });
  post.setStage('golden');

  const boardG = new THREE.Group(); scene.add(boardG);
  let g = null, W = 0, H = 0, meshes = [], latikM = [], selected = -1, hintPair = null, callout = () => {}, t = 0;
  const tweens = [];
  const k = () => (reduced() ? 0.5 : 1) / speed;
  const tween = (dur, fn) => new Promise((res) => { if (dur <= 0) { fn(1); res(); return; } tweens.push({ t: 0, dur, fn, res }); });
  const cellPos = (i, y = 0.04) => new THREE.Vector3(((i % W) - (W - 1) / 2) * CELL, y, (((i / W) | 0) - (H - 1) / 2) * CELL);

  // the selection ring and the hint glow
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: '#fff3a0' })); ring.rotation.x = Math.PI / 2; ring.visible = false; scene.add(ring);
  const hintM = new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0, depthWrite: false });
  const hintTiles = [0, 1].map(() => { const m = new THREE.Mesh(new RoundedBoxGeometry(CELL * 0.92, 0.01, CELL * 0.92, 2, 0.004), hintM); m.visible = false; scene.add(m); return m; });

  // crumbs: one instanced mesh, recycled
  const MAXC = 400, crumbGeo = new THREE.DodecahedronGeometry(0.05), crumbMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  const crumbs = new THREE.InstancedMesh(crumbGeo, crumbMat, MAXC); crumbs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); crumbs.count = 0; scene.add(crumbs);
  const parts = []; const dummy = new THREE.Object3D(), col = new THREE.Color();
  function burst(p, kind, n = 10) {
    for (let q = 0; q < n && parts.length < MAXC; q++) parts.push({ p: p.clone().add(new THREE.Vector3(0, 0.3, 0)), v: new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4), life: 0.7, c: KCOLOR[kind] || '#ffffff' });
  }
  const flashM = new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0, depthWrite: false });
  function beam(i, sp) {
    const geo = sp === SANDOK_H ? new THREE.BoxGeometry(W * CELL, 0.05, 0.5) : sp === SANDOK_V ? new THREE.BoxGeometry(0.5, 0.05, H * CELL) : new THREE.BoxGeometry(3 * CELL, 0.05, 3 * CELL);
    const m = new THREE.Mesh(geo, flashM.clone()); const p = cellPos(i, 0.3);
    if (sp === SANDOK_H) p.x = 0; if (sp === SANDOK_V) p.z = 0;
    m.position.copy(p); scene.add(m);
    return tween(0.3 * k(), (u) => { m.material.opacity = 0.8 * (1 - u); if (u >= 1) { scene.remove(m); geo.dispose(); m.material.dispose(); } });
  }

  function clearBoard() {
    for (const o of [...boardG.children]) { boardG.remove(o); o.traverse((m) => { if (m.isMesh && m.userData.own) m.geometry.dispose(); }); }
    meshes = []; latikM = [];
  }
  function place(i) {
    if (meshes[i]) { boardG.remove(meshes[i]); meshes[i] = null; }
    if (!g.mask[i] || g.cell[i] === EMPTY) return;
    const m = makePiece(g.cell[i], g.cell[i] === BILAO ? 0 : g.spec[i]);
    m.position.copy(cellPos(i)); m.userData.phase = Math.random() * 6; boardG.add(m); meshes[i] = m;
  }
  function placeLatik(i) {
    if (latikM[i]) { boardG.remove(latikM[i]); latikM[i] = null; }
    const n = g.latik[i]; if (!n) return;
    const m = new THREE.Mesh(new RoundedBoxGeometry(CELL * 0.94, 0.03 + n * 0.03, CELL * 0.94, 2, 0.012), MATS.latik);
    m.userData.own = true; m.position.copy(cellPos(i, 0.03)); m.receiveShadow = true; boardG.add(m); latikM[i] = m;
  }
  // the board's tiles share one geometry and two materials for the life of the view (no per-level leak)
  const tileM = [new THREE.MeshStandardMaterial({ color: '#4a9440', roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: '#3d8236', roughness: 0.5 })];
  const tileGeo = new RoundedBoxGeometry(CELL - 0.06, 0.03, CELL - 0.06, 2, 0.01);
  function setGame(game) {
    g = game; W = g.W; H = g.H; clearBoard();
    const mat = new THREE.Mesh(new RoundedBoxGeometry(W * CELL + 0.25, 0.04, H * CELL + 0.25, 2, 0.02), MATS.leaf); mat.userData.own = true; mat.position.y = 0; mat.receiveShadow = true; boardG.add(mat);
    for (let i = 0; i < W * H; i++) {
      if (!g.mask[i]) continue;
      const tile = new THREE.Mesh(tileGeo, tileM[((i % W) + ((i / W) | 0)) % 2]); tile.position.copy(cellPos(i, 0.02)); tile.receiveShadow = true; boardG.add(tile);
    }
    mat.visible = true;
    for (let i = 0; i < W * H; i++) { placeLatik(i); place(i); }
    fit();
  }

  // ---------- events ----------
  // Play a move's events. onBeat(beat) fires as each part animates, so sound and Lola land on time:
  // swap/bounce/combo/shuffle/ubos/ubosMake/end as they start; per cascade step, 'fire' per special as its
  // beam starts, 'pop' as the pieces burst, 'land' when the falls end. During Ubos-Benta the Sandoks go
  // off one after another.
  async function play(events, game, onBeat = () => {}) {
    g = game;
    let ubos = false;
    for (const e of events) {
      if (e.type === 'swap' || e.type === 'bounce') {
        onBeat(e);
        const A = meshes[e.a], B = meshes[e.b], pa = cellPos(e.a), pb = cellPos(e.b);
        await tween(0.16 * k(), (u) => { const s = ease.out(u); if (A) A.position.lerpVectors(pa, pb, s); if (B) B.position.lerpVectors(pb, pa, s); });
        if (e.type === 'bounce') await tween(0.16 * k(), (u) => { const s = ease.out(u); if (A) A.position.lerpVectors(pb, pa, s); if (B) B.position.lerpVectors(pa, pb, s); });
        else [meshes[e.a], meshes[e.b]] = [meshes[e.b], meshes[e.a]];
      } else if (e.type === 'step') {
        if (CALLOUTS[Math.min(e.step, 5)]) callout(CALLOUTS[Math.min(e.step, 5)], e.step);
        if (ubos) for (const [i, sp] of e.fired) { onBeat({ type: 'fire', i, spec: sp }); await Promise.race([beam(i, sp), tween(0.09 * k(), () => {})]); }
        else { for (const [i, sp] of e.fired) onBeat({ type: 'fire', i, spec: sp }); await Promise.all(e.fired.map(([i, sp]) => beam(i, sp))); }
        onBeat({ type: 'pop', step: e.step, cleared: e.cleared, latik: e.latik, made: e.made });
        const gone = e.cleared.map(([i, kind]) => { const m = meshes[i]; meshes[i] = null; burst(cellPos(i), kind); return m; }).filter(Boolean);
        await tween(0.2 * k(), (u) => { for (const m of gone) m.scale.setScalar(u < 0.3 ? 1 + u : Math.max(0.001, 1.3 * (1 - (u - 0.3) / 0.7))); });
        for (const m of gone) boardG.remove(m);
        for (const [i] of e.latik) placeLatik(i);
        for (const [i] of e.made) { place(i); const m = meshes[i]; if (m) { m.scale.setScalar(0.01); tween(0.25 * k(), (u) => m.scale.setScalar(Math.max(0.01, ease.back(u)))); } }
        // falls and new pieces drop together
        const moving = [];
        for (const [from, to] of e.falls) { const m = meshes[from]; meshes[from] = null; meshes[to] = m; if (m) moving.push([m, m.position.clone(), cellPos(to)]); }
        for (const [i, kind, n] of e.spawns) {
          const m = makePiece(kind, 0); m.userData.phase = Math.random() * 6; boardG.add(m); meshes[i] = m;
          const end = cellPos(i), start = end.clone(); start.z = -((H - 1) / 2) * CELL - n * CELL; start.y = 1.2; m.position.copy(start); moving.push([m, start, end]);
        }
        const far = Math.max(1, ...moving.map(([, a, b]) => a.distanceTo(b)));
        await tween((0.12 + far * 0.05) * k(), (u) => { const s = ease.in(u); for (const [m, a, b] of moving) m.position.lerpVectors(a, b, s); });
        onBeat({ type: 'land', count: moving.length });
      } else if (e.type === 'ubosMake') {
        ubos = true; onBeat(e);
        callout('Ubos-Benta!', 5);
        for (const [i] of e.made) { place(i); }
        await tween(0.35 * k(), () => {});
      } else if (e.type === 'shuffle') {
        onBeat(e);
        await tween(0.25 * k(), (u) => { for (const m of meshes) if (m) m.scale.setScalar(Math.max(0.01, 1 - u)); });
        for (let i = 0; i < W * H; i++) place(i);
      } else onBeat(e); // combo, ubos, end
    }
    sync();
  }
  // the board must match the rules exactly when everything is still
  function sync() {
    for (let i = 0; i < W * H; i++) {
      const m = meshes[i], want = g.mask[i] && g.cell[i] !== EMPTY;
      const kindOk = m && want && m.userData.kind === g.cell[i] && (g.cell[i] === BILAO || m.userData.spec === g.spec[i]);
      if ((want && !kindOk) || (!want && m)) place(i);
      if (meshes[i]) { meshes[i].position.copy(cellPos(i)); meshes[i].scale.setScalar(1); }
      if ((latikM[i] ? 1 : 0) !== (g.latik[i] ? 1 : 0)) placeLatik(i);
    }
  }

  // ---------- camera: frame the bilao for the screen, the street above ----------
  const target = new THREE.Vector3(0, 0, -0.8), dir = new THREE.Vector3(0, 8.6, 10.6).normalize();
  function fit() {
    const aspect = camera.aspect, v = THREE.MathUtils.degToRad(camera.fov), h = 2 * Math.atan(Math.tan(v / 2) * aspect);
    const halfW = (Math.max(W, 7) * CELL) / 2 + 0.9, halfH = (Math.max(H, 7) * CELL) / 2 + 1.2;
    const dist = Math.max(halfW / Math.tan(h / 2), (halfH / Math.tan(v / 2)) * 1.25);
    // portrait phones: the HUD strip takes the top, so look a little higher and come a little closer
    const portrait = aspect < 0.9;
    target.set(0, 0, portrait ? -1.6 : -0.8);
    camera.position.copy(target).addScaledVector(dir, dist * (portrait ? 1.02 : 1));
    camera.lookAt(target);
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); post.resize(); fit();
  }

  // ---------- picking ----------
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  function pick(cx, cy) {
    if (!g) return -1;
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    const x = Math.round(hit.x / CELL + (W - 1) / 2), y = Math.round(hit.z / CELL + (H - 1) / 2);
    if (x < 0 || y < 0 || x >= W || y >= H) return -1;
    const i = y * W + x;
    return g.mask[i] ? i : -1;
  }

  // ---------- frame ----------
  function update(dt) {
    t += dt;
    for (let q = tweens.length - 1; q >= 0; q--) { const w = tweens[q]; w.t += dt; const u = Math.min(1, w.t / w.dur); w.fn(u); if (u >= 1) { tweens.splice(q, 1); w.res(); } }
    // idle life: a bob; the kutsinta wobbles like jelly; the Bilao glows
    if (!reduced()) for (const m of meshes) if (m && !tweens.length) {
      const ph = m.userData.phase, kind = m.userData.kind;
      m.position.y = 0.04 + Math.sin(t * 1.6 + ph) * 0.012;
      if (kind === 1) m.scale.set(1 + Math.sin(t * 5 + ph) * 0.015, 1 - Math.sin(t * 5 + ph) * 0.02, 1 + Math.sin(t * 5 + ph) * 0.015);
      if (kind === BILAO) m.rotation.y = t * 0.8;
    }
    ring.visible = selected >= 0; if (selected >= 0) { ring.position.copy(cellPos(selected, 0.08)); ring.scale.setScalar(1 + Math.sin(t * 8) * 0.04); }
    hintM.opacity = hintPair ? 0.25 + Math.sin(t * 5) * 0.2 : 0;
    // crumbs
    let n = 0;
    for (let q = parts.length - 1; q >= 0; q--) {
      const p = parts[q]; p.life -= dt; if (p.life <= 0) { parts.splice(q, 1); continue; }
      p.v.y -= 9 * dt; p.p.addScaledVector(p.v, dt); if (p.p.y < 0.05) { p.p.y = 0.05; p.v.multiplyScalar(0.4); }
      dummy.position.copy(p.p); dummy.scale.setScalar(Math.min(1, p.life * 2)); dummy.rotation.set(p.life * 9, p.life * 7, 0); dummy.updateMatrix();
      crumbs.setMatrixAt(n, dummy.matrix); crumbs.setColorAt(n, col.set(p.c)); n++;
    }
    crumbs.count = n; crumbs.instanceMatrix.needsUpdate = true; if (crumbs.instanceColor) crumbs.instanceColor.needsUpdate = true;
    stall.update(t);
    post.render(dt);
  }

  // ---------- icons for the HUD: each kakanin rendered once ----------
  function icons() {
    const out = {}, size = 128, rt = new THREE.WebGLRenderTarget(size, size, { colorSpace: THREE.SRGBColorSpace });
    const s2 = new THREE.Scene(); s2.environment = scene.environment;
    s2.add(new THREE.HemisphereLight('#fff6e8', '#7a5a40', 1.4)); const l = new THREE.DirectionalLight('#ffffff', 2.4); l.position.set(-2, 4, 3); s2.add(l);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20); cam.position.set(0, 1.5, 1.9); cam.lookAt(0, 0.18, 0);
    const px = new Uint8Array(size * size * 4), cv = document.createElement('canvas'); cv.width = cv.height = size; const ctx = cv.getContext('2d');
    for (let kind = 0; kind <= 6; kind++) {
      const p = makePiece(kind, 0); s2.add(p);
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(s2, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
      const img = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
      ctx.putImageData(img, 0, 0); out[kind] = cv.toDataURL('image/png');
      s2.remove(p);
    }
    renderer.setRenderTarget(null); rt.dispose();
    return out;
  }

  // where an object (or the board) sits on screen, in CSS pixels, for layout checks
  const box3 = new THREE.Box3(), corner = new THREE.Vector3();
  function screenBox(obj) {
    if (!obj) return null;
    obj.updateWorldMatrix(true, true); box3.setFromObject(obj);
    if (box3.isEmpty()) return null;
    const r = canvas.getBoundingClientRect(); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, seen = false;
    for (let q = 0; q < 8; q++) {
      corner.set(q & 1 ? box3.max.x : box3.min.x, q & 2 ? box3.max.y : box3.min.y, q & 4 ? box3.max.z : box3.min.z).project(camera);
      if (corner.z > 1) continue; seen = true;
      const sx = r.left + ((corner.x + 1) / 2) * r.width, sy = r.top + ((1 - corner.y) / 2) * r.height;
      x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
    }
    if (!seen || x1 < r.left || x0 > r.right || y1 < r.top || y0 > r.bottom) return null; // off screen
    return { x0, y0, x1, y1 };
  }

  return {
    setGame, play, pick, update, resize, icons, scene, screenBox,
    boardBox: () => screenBox(boardG),
    select(i) { selected = i; },
    showHint(pair) { hintPair = pair; hintTiles.forEach((m, q) => { m.visible = !!pair; if (pair) m.position.copy(cellPos(pair[q], 0.05)); }); },
    busy: () => tweens.length > 0,
    hintShown: () => hintPair,
    dump: () => ({ kinds: meshes.map((m) => (m ? m.userData.kind : EMPTY)), specs: meshes.map((m) => (m ? m.userData.spec : NONE)) }),
    onCallout(fn) { callout = fn; },
    get level() { return post.level; },
    setSpeed(s) { speed = s; },
    renderer,
  };
}
