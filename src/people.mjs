// The family and the neighbours, real: Mixamo people with motion capture (converted by the Bakbakan
// tools into assets/people/), driven by the view. They idle, walk tile to tile, push (a "Pushing" clip if
// there is one, else arms out in front over the walking legs), cheer, jump, look around and slump when
// something is too heavy. Without the files, simple stand-ins take their place.
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader, cloneSkinned } from './vendor/three-mocap.min.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, k) => a + (b - a) * k;
const TAU = Math.PI * 2;
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const canon = (n) => n.replace(/^mixamorig\d*[:_]?/i, '');
const UPPER = /^(Spine|Spine1|Spine2|Neck|Head|HeadTop_End|Left(Shoulder|Arm|ForeArm|Hand).*|Right(Shoulder|Arm|ForeArm|Hand).*)$/;

// clip slots: the first name that matches, else a stand-in slot
const SLOTS = {
  idle: [[/happy idle/i, /^idle/i], []],
  walk: [[/^walking$/i], ['idle']],
  run: [[/^running/i], ['walk']],
  clap: [[/^clapping/i], ['cheer']],
  push: [[/^pushing$/i, /^push/i], []],
  carry: [[/carrying/i], ['walk']],
  talk: [[/^talking/i], ['idle']],
  wave: [[/wav/i], ['cheer']],
  cheer: [[/^cheering$/i], ['idle']],
  victory: [[/^victory$/i], ['cheer']],
  jump: [[/^jump$/i], ['cheer']],
  look: [[/looking around/i], ['idle']],
  sad: [[/defeated/i], ['idle']],
  pick: [[/picking up/i], ['idle']],
};
// reactions that play once, at the clip's own speed: which part of it ([from, to] as fractions), and how
// many times through (a jump of joy is two jumps)
const ONCE = { jump: [0, 1, 2], victory: [0.02, 0.7, 1], sad: [0.04, 0.42, 1], cheer: [0, 0.82, 1], clap: [0, 1, 3], wave: [0, 1, 4], look: [0, 0.5, 1] };

export const PEOPLE_VERSION = 3; // 2: Running, Clapping, Pushing, Talking, Waving · 3: a new Nanay

export const CAST = {
  tatay: { h: 1.72, color: '#3f8a4a', ring: '#ffd23f' },
  ate: { h: 1.6, color: '#d8507a', ring: '#ff7eb6', hair: '#3a2a22' },
  bunso: { h: 1.18, color: '#2f6fd6', ring: '#5ac8fa', head: 1.16 },
  nanay: { h: 1.57, color: '#9a5ad8', ring: '#c89cff' },
  lola: { h: 1.5, color: '#b88a5a', ring: '#ffb27e', greyHair: '#cfcac4', skin: '#f4dcc4' },
  nonoy: { h: 1.7, color: '#7a6a4a', ring: '#a6e36a' },
  kikay: { h: 1.56, color: '#e08a2a', ring: '#ffcc66' },
  bebang: { h: 1.55, color: '#7a3a6a', ring: '#ff9ad5', as: 'kikay', tint: '#e8c8e0' },
};

// v: bump when the converted people or clips change, so no cache keeps the old ones
// Load the people: the clips once, then each person's model. ids: just these (the rest can come later,
// into the same lib); onProgress gets 0..1 over this call's downloads.
export async function loadPeople(base = 'assets/people/', onProgress = null, v = PEOPLE_VERSION, ids = null, lib = null) {
  if (!lib) {
    const res = await fetch(base + 'clips.json?v=' + v);
    if (!res.ok) throw new Error('no people');
    const meta = await res.json();
    const names = Object.keys(meta.clips), slots = {};
    for (const [slot, [pats]] of Object.entries(SLOTS)) { const n = pats.map((p) => names.find((x) => p.test(x))).find(Boolean); if (n) slots[slot] = n; }
    const resolve = (slot, seen = new Set()) => { if (slots[slot]) return slots[slot]; seen.add(slot); for (const alt of SLOTS[slot][1]) if (!seen.has(alt)) { const r = resolve(alt, seen); if (r) return r; } return null; };
    for (const slot of Object.keys(SLOTS)) slots[slot] = resolve(slot) || slots.idle || names[0];
    slots.realPush = names.some((x) => SLOTS.push[0].some((p) => p.test(x)));
    lib = { meta, templates: {}, slots, loader: new GLTFLoader() };
  }
  const want = (ids || Object.keys(lib.meta.chars)).filter((id) => lib.meta.chars[id] && !lib.templates[id]);
  const got = {}, tot = {};
  const report = () => { if (!onProgress) return; const t = Object.values(tot).reduce((a, b) => a + b, 0); if (t) onProgress(Object.values(got).reduce((a, b) => a + b, 0) / t); };
  await Promise.all(want.map(async (id) => {
    lib.templates[id] = (await lib.loader.loadAsync(base + id + '.glb?v=' + v, (e) => { got[id] = e.loaded; if (e.total) tot[id] = e.total; report(); })).scene;
  }));
  return lib;
}

// a clip bound to this person's bones; the game moves people, so the hips keep only their height
function bindClips(lib, bones, hipRest) {
  const out = {}, upper = {}, lower = {};
  for (const [name, c] of Object.entries(lib.meta.clips)) {
    const tracks = [], up = [], low = [];
    for (const [bone, kind, times, values] of c.tr) {
      const b = bones[bone];
      if (!b) continue;
      let t;
      if (kind === 'q') t = new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, values);
      else {
        const k = hipRest / c.hip, v = values.slice();
        for (let i = 0; i < v.length; i += 3) { v[i] = 0; v[i + 1] *= k; v[i + 2] = 0; }
        t = new THREE.VectorKeyframeTrack(`${b.name}.position`, times, v);
      }
      tracks.push(t); (UPPER.test(bone) ? up : low).push(t);
    }
    out[name] = new THREE.AnimationClip(name, c.d, tracks);
    upper[name] = new THREE.AnimationClip(name + ':upper', c.d, up);
    lower[name] = new THREE.AnimationClip(name + ':lower', c.d, low);
  }
  return { out, upper, lower };
}

// a simple stand-in when there are no models: a body, a head, a little shadow of a face
function standIn(id) {
  const c = CAST[id] || CAST.tatay, g = new THREE.Group(), s = c.h / 1.7;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2 * s, 0.75 * s, 6, 12), new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.7 }));
  body.position.y = 0.62 * s; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s * (c.head || 1), 18, 14), new THREE.MeshStandardMaterial({ color: '#c68e62', roughness: 0.6 }));
  head.position.y = 1.36 * s; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.155 * s * (c.head || 1), 18, 10, 0, TAU, 0, 1.7), new THREE.MeshStandardMaterial({ color: '#1b1410', roughness: 0.8 }));
  hair.position.y = 1.38 * s; g.add(hair);
  return g;
}

export function makePerson(lib, id) {
  const c = CAST[id] || CAST.tatay, src = c.as || id, root = new THREE.Group();
  const p = { id, root, cast: c, mixer: null, action: null, layers: [], loopT: Math.random() * 3, once: null, yaw: 0, want: 'idle', bob: 0, real: false };
  const meta = lib && lib.meta.chars[src];
  if (!meta || !lib.templates[src]) {
    p.model = standIn(id); root.add(p.model);
    return p;
  }
  const model = cloneSkinned(lib.templates[src]);
  root.add(model);
  model.scale.multiplyScalar(c.h / meta.height);
  const bones = {};
  model.traverse((o) => {
    if (o.isBone) bones[canon(o.name)] = o;
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      // hair and skin to suit who they play: Lola's goes grey, Nanay's and Ate's dark
      const hairy = /hair/i.test(o.material.name || '') || /hair/i.test(o.name || '');
      if (hairy && c.greyHair) { o.material = o.material.clone(); o.material.map = null; o.material.color = new THREE.Color(c.greyHair); o.material.needsUpdate = true; }
      else if (hairy && c.hair) { o.material = o.material.clone(); o.material.color = new THREE.Color(c.hair).multiplyScalar(2.2); }
      else if (!hairy && (c.skin || c.tint)) { o.material = o.material.clone(); o.material.color = new THREE.Color(c.tint || c.skin); }
    }
  });
  // a child's head is bigger for their size
  if (c.head && bones.Head) bones.Head.scale.setScalar(c.head);
  const clips = bindClips(lib, bones, bones.Hips.position.y);
  const mixer = new THREE.AnimationMixer(model), actions = new Map();
  p.action = (name, part = 'full') => {
    const key = part + ':' + name;
    if (!actions.has(key)) { const a = mixer.clipAction(part === 'upper' ? clips.upper[name] : part === 'lower' ? clips.lower[name] : clips.out[name]); a.play(); a.paused = true; a.setEffectiveWeight(0); a.userData = { part }; actions.set(key, a); }
    return actions.get(key);
  };
  Object.assign(p, { model, mixer, bones, real: true, headScale: c.head || 1 });
  return p;
}

// a moment that plays once over whatever they're doing: 'jump', 'victory', 'cheer', 'sad', 'wave', 'look'
export function react(p, kind, lib = null) {
  if (!ONCE[kind]) return;
  const [a, b, reps] = ONCE[kind], clip = lib && lib.meta.clips[lib.slots[kind]];
  p.once = { kind, t: 0, d: (clip ? clip.d * (b - a) : 1.2) * reps, reps };
}

// this frame's clip for a person: { slot, t, upper? }
function plan(p, lib, state) {
  const D = (slot) => lib.meta.clips[lib.slots[slot]].d;
  const loop = (slot, speed = 1) => ({ slot, t: (p.loopT * speed) % D(slot) });
  if (state === 'push') {
    if (lib.slots.realPush) return loop('push', 1.5); // the heavy shove, a little quicker than life
    return { ...loop('walk', 1.1), upper: { slot: 'carry', t: D('carry') * 0.28 } }; // until there's a pushing clip: arms out, walking into it
  }
  // a light jog from tile to tile, its stride matched to how fast they cover a tile (no sliding feet)
  if (state === 'walk') return lib.slots.run !== lib.slots.walk ? loop('run', p.pace || 0.78) : loop('walk', 2);
  if (p.once) {
    const [a, b] = ONCE[p.once.kind], f = (p.once.t / p.once.d * p.once.reps) % 1;
    return { slot: p.once.kind, t: lerp(a, b, f) * D(p.once.kind) };
  }
  if (state === 'talk') return loop('talk');
  return loop('idle');
}

const UP = new THREE.Vector3(0, 1, 0);
// Pose a person this frame. pos: {x, z}; yaw: which way they face; state: idle, walk, push or talk.
export function drive(p, lib, dt, { x, z, yaw, state = 'idle' }) {
  p.loopT += dt;
  if (p.once) { p.once.t += dt; if (p.once.t >= p.once.d || state === 'walk' || state === 'push') p.once = null; }
  p.root.position.set(x, 0, z);
  p.yaw = p.yaw + wrap(yaw - p.yaw) * Math.min(1, dt * 14);
  p.root.rotation.y = p.yaw;
  if (!p.real) {
    // the stand-ins bob as they walk and lean into a push
    p.bob += dt * (state === 'idle' || state === 'talk' ? 2 : 12);
    p.model.position.y = state === 'walk' || state === 'push' ? Math.abs(Math.sin(p.bob)) * 0.05 : Math.sin(p.bob) * 0.01;
    p.model.rotation.x = lerp(p.model.rotation.x, state === 'push' ? 0.25 : p.once && p.once.kind === 'jump' ? -0.1 : 0, Math.min(1, dt * 10));
    if (p.once && (p.once.kind === 'jump' || p.once.kind === 'cheer' || p.once.kind === 'victory')) p.model.position.y += Math.abs(Math.sin(p.once.t * 9)) * 0.15;
    return;
  }
  const want = plan(p, lib, state);
  const wanted = want.upper
    ? [[p.action(lib.slots[want.slot], 'lower'), want.t], [p.action(lib.slots[want.upper.slot], 'upper'), want.upper.t]]
    : [[p.action(lib.slots[want.slot]), want.t]];
  const fade = state === 'walk' || state === 'push' ? 0.1 : 0.22; // quick into a move, gentle back to standing
  for (const [a, t] of wanted) { let l = p.layers.find((q) => q.a === a); if (!l) { l = { a, w: p.layers.length ? 0 : 1 }; p.layers.push(l); } l.t = t; l.on = true; }
  for (const q of p.layers) { if (!wanted.some(([a]) => a === q.a)) q.on = false; q.w = clamp(q.w + (q.on ? 1 : -1) * dt / fade, 0, 1); }
  for (const q of p.layers) if (!q.on && q.w <= 0) q.a.setEffectiveWeight(0);
  p.layers = p.layers.filter((q) => q.on || q.w > 0);
  const sum = (part) => p.layers.reduce((acc, q) => acc + (q.a.userData.part === part ? q.w : 0), 0);
  const F = sum('full'), Lo = sum('lower'), U = sum('upper'), sc = F + Lo > 0 ? 1 / (F + Lo) : 1, su = U > 0 ? Math.max(0, 1 - F * sc) / U : 0;
  for (const q of p.layers) { q.a.time = q.t; q.a.setEffectiveWeight(q.a.userData.part === 'upper' ? q.w * su : q.w * sc); }
  p.mixer.update(0);
  if (p.headScale !== 1 && p.bones.Head) p.bones.Head.scale.setScalar(p.headScale);
}

// Hands on the furniture. The pushing clip shoves at chest height; on a low piece (a box, a sack) the hands
// would float over the top. So whoever's in front bends at the waist until the hands come down to the side
// of the piece, then stands just far enough off that the palms meet it. target: { mesh, dir: [dx, dz] }, or
// null to straighten up again. Call after drive().
const hA = new THREE.Vector3(), hB = new THREE.Vector3(), sp = new THREE.Vector3(), axis = new THREE.Vector3(), qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), box3 = new THREE.Box3();
function turnBone(bone, q) { bone.parent.getWorldQuaternion(qp); bone.quaternion.premultiply(qp).premultiply(q).premultiply(qp.invert()); bone.updateMatrixWorld(true); }
export function reach(p, target, dt) {
  p.reachW = clamp((p.reachW || 0) + (target ? dt * 8 : -dt * 5), 0, 1);
  if (target) p.reachT = target;
  if (!p.real || p.reachW <= 0 || !p.reachT || !p.bones.LeftHand || !p.bones.Spine) return;
  const { mesh, dir: [dx, dz] } = p.reachT, w = p.reachW;
  p.model.updateMatrixWorld(true);
  box3.setFromObject(mesh);
  const hands = () => { p.bones.LeftHand.getWorldPosition(hA); p.bones.RightHand.getWorldPosition(hB); return hA.add(hB).multiplyScalar(0.5); };
  let H = hands();
  // bend: the hands a hand's width under the top, never lower than the knees
  const want = Math.max(0.42, box3.max.y - 0.14), drop = (H.y - want) * w;
  if (drop > 0.01) {
    p.bones.Spine.getWorldPosition(sp);
    const r = Math.max(0.35, H.distanceTo(sp)), ang = Math.asin(clamp(drop / r, 0, 0.9));
    axis.set(dz, 0, -dx); // the pusher's right: turning about it tips the chest forward
    for (const b of [p.bones.Spine, p.bones.Spine1, p.bones.Spine2]) if (b) turnBone(b, qa.setFromAxisAngle(axis, ang / 3));
    p.model.updateMatrixWorld(true);
    H = hands();
  }
  // step in or back so the palms meet the near face
  const sgn = dx || dz, face = dx > 0 ? box3.min.x : dx < 0 ? box3.max.x : dz > 0 ? box3.min.z : box3.max.z;
  const gap = (face - (dx ? H.x : H.z)) * sgn - 0.015;
  const off = clamp(gap, -0.45, 0.6) * w;
  p.root.position.x += (dx ? sgn : 0) * off; p.root.position.z += (dz ? sgn : 0) * off;
}

// ---------- hats (from the shop) ----------
const hatMat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
function stripesTex(a, b) { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? a : b; x.fillRect(0, k * 8, 64, 8); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
export function makeHat(kind) {
  const g = new THREE.Group();
  if (kind === 'salakot') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.13, 24, 1, true), hatMat('#c9a45a', { side: THREE.DoubleSide })); cone.position.y = 0.05; g.add(cone);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), hatMat('#8a6a2a')); tip.position.y = 0.12; g.add(tip);
  } else if (kind === 'cap') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), hatMat('#d23b4a')); dome.position.y = -0.02; g.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 18, 1, false, -Math.PI / 2, Math.PI), hatMat('#d23b4a')); brim.position.set(0, -0.02, 0.08); brim.scale.set(1, 1, 0.9); g.add(brim);
  } else if (kind === 'party') {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 18), new THREE.MeshStandardMaterial({ map: stripesTex('#ff5a4f', '#ffd23f'), roughness: 0.6 })); c.position.y = 0.08; g.add(c);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), hatMat('#3fa8ff')); pom.position.y = 0.19; g.add(pom);
  } else if (kind === 'santa') {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.24, 18), hatMat('#c8202a')); c.position.set(0, 0.09, -0.02); c.rotation.x = -0.35; g.add(c);
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 8, 20), hatMat('#f4f1ea')); brim.rotation.x = Math.PI / 2; brim.position.y = -0.02; g.add(brim);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), hatMat('#f4f1ea')); pom.position.set(0, 0.19, -0.1); g.add(pom);
  } else if (kind === 'hardhat') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), hatMat('#ffc928', { roughness: 0.35 })); dome.position.y = -0.03; g.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.01, 20), hatMat('#ffc928', { roughness: 0.35 })); brim.position.y = -0.03; g.add(brim);
  } else if (kind === 'korona') {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 20, 1, true), hatMat('#ffcc33', { metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide })); band.position.y = 0.01; g.add(band);
    for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 6), hatMat('#ffcc33', { metalness: 0.9, roughness: 0.25 })); const a = k * Math.PI / 3; sp.position.set(Math.cos(a) * 0.085, 0.055, Math.sin(a) * 0.085); g.add(sp); }
  } else if (kind === 'bulaklak') {
    for (let k = 0; k < 5; k++) { const pe = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), hatMat('#fbfbf3')); const a = k * 1.256; pe.position.set(0.09, -0.04 + Math.sin(a) * 0.025, Math.cos(a) * 0.025); g.add(pe); }
    const mid = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), hatMat('#ffd23f')); mid.position.set(0.1, -0.04, 0); g.add(mid);
  } else if (kind === 'bandana') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.018, 8, 24), hatMat('#2f6fd6')); band.rotation.x = Math.PI / 2; band.position.y = -0.07; band.scale.set(1, 1.15, 1); g.add(band);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// put a hat on (null takes it off), on top of the head whatever the model's scale
const hws = new THREE.Vector3();
export function wearHat(p, kind) {
  if (p.hat) { p.hat.parent && p.hat.parent.remove(p.hat); p.hat = null; }
  if (!kind) return;
  const hat = makeHat(kind), holder = new THREE.Group();
  holder.add(hat);
  const top = p.real && (p.bones.HeadTop_End || p.bones.Head);
  if (top) {
    p.model.updateMatrixWorld(true); top.getWorldScale(hws);
    holder.scale.setScalar(1 / hws.x);
    if (top === p.bones.Head) holder.position.y = 0.18 / hws.x;
    holder.position.y -= 0.03 / hws.x;
    top.add(holder);
  } else { holder.position.y = p.cast.h + 0.02; p.root.add(holder); }
  p.hat = holder;
}

// ---------- accessories (the second thing from the shop): on the neck, the face, the shoulder, the back ----------
export function makeAcc(kind) {
  const g = new THREE.Group();
  if (kind === 'lei') {
    for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 2, f = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), hatMat(k % 4 ? '#fbfbf2' : '#ffd23f')); f.position.set(Math.cos(a) * 0.1, -0.02 - Math.max(0, Math.sin(a)) * 0.06, Math.sin(a) * 0.085); g.add(f); }
  } else if (kind === 'shades') {
    const lens = hatMat('#111', { roughness: 0.1, metalness: 0.6 });
    for (const x of [-0.034, 0.034]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.008, 16), lens); l.rotation.x = Math.PI / 2; l.position.set(x, 0, 0); g.add(l); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.006, 0.006), lens); g.add(bar);
  } else if (kind === 'scarf') {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.025, 8, 20), hatMat('#d23b4a')); t.rotation.x = Math.PI / 2; g.add(t);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.02), hatMat('#d23b4a')); tail.position.set(0.04, -0.08, 0.07); tail.rotation.z = 0.2; g.add(tail);
  } else if (kind === 'bimpo') {
    const towel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.3), hatMat('#f2f2f2', { roughness: 0.95 })); towel.position.set(0, 0, 0); towel.rotation.z = 0.15; g.add(towel);
    for (const z of [-0.14, 0.14]) { const flap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.01), hatMat('#f2f2f2', { roughness: 0.95 })); flap.position.set(0, -0.06, z); g.add(flap); }
  } else if (kind === 'bag') {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.12), hatMat('#2f6fd6')); g.add(pack);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.03), hatMat('#ffd23f')); pocket.position.set(0, -0.06, -0.07); g.add(pocket);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// where each sits: [bone, offset in metres (x, y, z on the bone)]
const ACC_AT = { lei: ['Neck', [0, 0.02, 0.02]], scarf: ['Neck', [0, 0.03, 0.0]], shades: ['Head', [0, 0.085, 0.09]], bimpo: ['RightShoulder', [0.05, 0.06, 0]], bag: ['Spine2', [0, 0.02, -0.14]] };
export function wearAcc(p, kind) {
  if (p.acc) { p.acc.parent && p.acc.parent.remove(p.acc); p.acc = null; }
  if (!kind || !ACC_AT[kind]) return;
  const [boneName, off] = ACC_AT[kind], bone = p.real && p.bones[boneName], holder = new THREE.Group();
  holder.add(makeAcc(kind));
  if (bone) {
    p.model.updateMatrixWorld(true); bone.getWorldScale(hws);
    holder.scale.setScalar(1 / hws.x); holder.position.set(off[0] / hws.x, off[1] / hws.x, off[2] / hws.x);
    bone.add(holder);
  } else { holder.position.y = p.cast.h * 0.82; p.root.add(holder); }
  p.acc = holder;
}

// where the top of someone's head is, in the world (for speech bubbles and the "you" marker)
const hv = new THREE.Vector3();
export function headTop(p, out) {
  if (p.real && p.bones.Head) { p.model.updateMatrixWorld(true); p.bones.Head.getWorldPosition(out); out.y += 0.28 * (p.cast.h / 1.7); return out; }
  out.copy(p.root.position); out.y += p.cast.h + 0.1; return out;
}
export { UP };
