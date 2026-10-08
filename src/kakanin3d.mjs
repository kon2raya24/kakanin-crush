// The six kakanin as physically based 3D models (ported from the approved look prototype), the marks
// that make a piece a special, and the Bilao ng Lahat. Templates are built once; every board piece is
// a clone that shares their geometry and materials.
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/three-extra.min.js';
import { rng, noise, fbm, paint } from './tex.mjs';

export const KCOLOR = ['#f4ecdc', '#c0561e', '#8a44b8', '#f0b13c', '#6b2f96', '#3f8a3a', '#ffd23f'];
const S = 128;
const tex = (fn, strength = 3) => paint(S, S, fn, { strength });
const lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
const r0 = rng(7), pores = noise(S, S, 2, r0), soft = fbm(S, S, 32, 3, r0);
const putoT = tex((x, y) => { const i = y * S + x, k = 0.94 + (soft[i] - 0.5) * 0.08 - (pores[i] > 0.8 ? 0.12 : 0); return [252 * k, 247 * k, 232 * k, -(pores[i] > 0.8 ? 1 : 0) + soft[i] * 0.3]; }, 2.5);
const kutsT = tex((x, y) => { const i = y * S + x, k = 0.85 + (soft[i] - 0.5) * 0.25; return [196 * k, 92 * k, 36 * k, soft[i] * 0.4]; }, 1.5);
const ubeT = tex((x, y) => { const u = x / S - 0.5, v = y / S - 0.5, a = Math.atan2(v, u), r = Math.hypot(u, v), sw = Math.sin(a * 2 + r * 28); const k = 0.8 + sw * 0.12 + (soft[y * S + x] - 0.5) * 0.15; return [118 * k, 52 * k, 160 * k, sw * 0.3]; }, 2);
const leafT = tex((x, y) => { const vein = Math.abs(Math.sin((y / S) * Math.PI * 22)) > 0.94 ? 1 : 0, k = 0.8 + (soft[y * S + x] - 0.5) * 0.3 - vein * 0.12; return [72 * k, 140 * k, 58 * k, vein * 0.6 + soft[y * S + x] * 0.2]; }, 3);
const bibT = tex((x, y) => { const i = y * S + x, char = soft[i] > 0.66 ? (soft[i] - 0.66) * 3 : 0, k = 1 - char * 0.6; return [240 * k, 176 * k - char * 30, 72 * k, (pores[i] - 0.5) * 0.4]; }, 2.5);
const weaveT = (() => { const f = noise(128, 128, 3, rng(12)); return paint(128, 128, (x, y) => { const over = ((x >> 3) + (y >> 3)) % 2, band = over ? Math.sin(((x % 8) / 8) * Math.PI) : Math.sin(((y % 8) / 8) * Math.PI), k = 0.6 + band * 0.4 + (f[y * 128 + x] - 0.5) * 0.1; return [206 * k, 160 * k, 96 * k, band]; }, { repeat: [22, 22], strength: 3 }); })();
const woodT = (() => { const f = fbm(256, 64, 16, 3, rng(9)); return paint(256, 64, (x, y) => { const g = Math.sin(y * 0.35 + x * 0.02 + f[y * 256 + x] * 5) * 0.5 + 0.5, k = 0.72 + g * 0.1 + (f[y * 256 + x] - 0.5) * 0.12; return [132 * k, 88 * k, 50 * k, g * 0.5]; }, { strength: 1.2 }); })();

export const MATS = {
  puto: new THREE.MeshPhysicalMaterial({ map: putoT.map, normalMap: putoT.normalMap, roughness: 0.75, sheen: 0.4, sheenColor: new THREE.Color('#fff8e8'), sheenRoughness: 0.7, color: '#ece4d2' }),
  cheese: new THREE.MeshPhysicalMaterial({ color: '#f5c242', roughness: 0.45, clearcoat: 0.4 }),
  kuts: new THREE.MeshPhysicalMaterial({ map: kutsT.map, normalMap: kutsT.normalMap, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
  coco: new THREE.MeshStandardMaterial({ color: '#fbf8f0', roughness: 0.8 }),
  ube: new THREE.MeshPhysicalMaterial({ map: ubeT.map, normalMap: ubeT.normalMap, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12 }),
  leaf: new THREE.MeshPhysicalMaterial({ map: leafT.map, normalMap: leafT.normalMap, roughness: 0.35, clearcoat: 0.6, side: THREE.DoubleSide }),
  bib: new THREE.MeshStandardMaterial({ map: bibT.map, normalMap: bibT.normalMap, roughness: 0.7 }),
  egg: new THREE.MeshPhysicalMaterial({ color: '#e4582f', roughness: 0.3, clearcoat: 0.5 }),
  kesong: new THREE.MeshStandardMaterial({ color: '#f6f2e6', roughness: 0.6 }),
  layer: ['#7a3aa8', '#f2c230', '#f7f0e2'].map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 })),
  latikBits: new THREE.MeshStandardMaterial({ color: '#8a4a1c', roughness: 0.6 }),
  latik: new THREE.MeshPhysicalMaterial({ color: '#7a3e14', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.92 }),
  tie: new THREE.MeshStandardMaterial({ color: '#d8b77a', roughness: 0.8 }),
  weave: new THREE.MeshStandardMaterial({ map: weaveT.map, normalMap: weaveT.normalMap, roughness: 0.85, side: THREE.DoubleSide }),
  wood: new THREE.MeshStandardMaterial({ map: woodT.map, normalMap: woodT.normalMap, roughness: 0.6 }),
  ladle: new THREE.MeshPhysicalMaterial({ color: '#b07a3e', roughness: 0.4, clearcoat: 0.5 }),
  pot: new THREE.MeshStandardMaterial({ color: '#3a3a40', roughness: 0.3, metalness: 0.85 }),
  glow: new THREE.MeshBasicMaterial({ color: '#ffe98a', transparent: true, opacity: 0.55, depthWrite: false }),
};
const M = MATS;

function makePuto() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lathe([[0, 0], [0.36, 0], [0.4, 0.06], [0.4, 0.14], [0.36, 0.28], [0.26, 0.38], [0.12, 0.43], [0, 0.44]]), M.puto));
  const ch = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.05, 0.12, 2, 0.015), M.cheese); ch.position.y = 0.45; ch.rotation.y = 0.4; g.add(ch);
  return g;
}
function makeKutsinta() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lathe([[0, 0], [0.36, 0], [0.42, 0.06], [0.42, 0.2], [0.36, 0.28], [0.22, 0.27], [0.12, 0.22], [0, 0.21]]), M.kuts));
  const r = rng(5), shred = new THREE.BoxGeometry(0.1, 0.012, 0.018);
  for (let k = 0; k < 14; k++) { const s = new THREE.Mesh(shred, M.coco); const a = r() * 6.28, d = r() * 0.22; s.position.set(Math.cos(a) * d, 0.27 + r() * 0.02, Math.sin(a) * d); s.rotation.set(r(), r() * 3, r()); g.add(s); }
  return g;
}
function makeSapin() {
  const g = new THREE.Group();
  M.layer.forEach((m, i) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.15, 0.66, 3, 0.05), m); b.position.y = 0.075 + (2 - i) * 0.14; g.add(b); });
  const r = rng(8), crumb = new THREE.DodecahedronGeometry(0.03);
  for (let k = 0; k < 16; k++) { const c = new THREE.Mesh(crumb, M.latikBits); c.position.set((r() - 0.5) * 0.5, 0.43, (r() - 0.5) * 0.5); g.add(c); }
  g.rotation.y = 0.2;
  return g;
}
function makeBibingka() {
  const g = new THREE.Group();
  const leaf = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.02, 40), M.leaf); leaf.position.y = 0.01; g.add(leaf);
  g.add(new THREE.Mesh(lathe([[0, 0.02], [0.36, 0.02], [0.39, 0.06], [0.39, 0.15], [0.34, 0.2], [0, 0.21]]), M.bib));
  const egg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 24, 1, false, 0, Math.PI), M.egg); egg.position.set(0.06, 0.22, -0.04); egg.rotation.y = 0.6; g.add(egg);
  const k = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.04, 0.1, 2, 0.01), M.kesong); k.position.set(-0.13, 0.22, 0.1); g.add(k);
  return g;
}
// ube halaya in its llanera: an oval with fluted sides and a glossy swirled top
function makeUbe() {
  const g = new THREE.Group();
  const geo = lathe([[0, 0], [0.4, 0], [0.42, 0.04], [0.4, 0.22], [0.34, 0.27], [0, 0.29]], 48);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z); const f = 1 + Math.sin(a * 16) * 0.035 * Math.min(1, p.getY(i) * 6); p.setX(i, Math.cos(a) * r * f * 1.12); p.setZ(i, Math.sin(a) * r * f * 0.88); }
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, M.ube));
  return g;
}
function makeSuman() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.5, 8, 24), M.leaf); body.rotation.z = Math.PI / 2; body.position.y = 0.18; g.add(body);
  for (const x of [-0.16, 0.16]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.018, 8, 32), M.tie); t.rotation.y = Math.PI / 2; t.position.set(x, 0.18, 0); g.add(t); }
  g.rotation.y = -0.6;
  return g;
}
// the Bilao ng Lahat: a little glowing bilao holding a bit of every kakanin
function makeLahat() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lathe([[0, 0], [0.38, 0], [0.44, 0.1], [0.42, 0.12], [0.36, 0.04], [0, 0.04]]), M.weave));
  const dot = new THREE.SphereGeometry(0.075, 16, 12);
  KCOLOR.slice(0, 6).forEach((c, k) => { const m = new THREE.Mesh(dot, new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 1 })); const a = (k / 6) * Math.PI * 2; m.position.set(Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.2); g.add(m); });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 40), M.glow); ring.rotation.x = Math.PI / 2; ring.position.y = 0.12; ring.name = 'glow'; g.add(ring);
  return g;
}
// a sandok (wooden ladle) laid across: along x for a row Sandok, along z for a column one
function makeSandok(spec) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.8, 10), M.ladle); handle.rotation.z = Math.PI / 2; g.add(handle);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.ladle); bowl.rotation.z = Math.PI; bowl.position.x = 0.42; g.add(bowl);
  g.position.y = 0.5; if (spec === 2) g.rotation.y = Math.PI / 2;
  return g;
}
function makeLid() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.04, 32), M.pot));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), M.pot); knob.position.y = 0.05; g.add(knob);
  g.position.y = 0.5;
  return g;
}

const MAKERS = [makePuto, makeKutsinta, makeSapin, makeBibingka, makeUbe, makeSuman];
const templates = new Map();
function shadowed(o) { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }
export function makePiece(kind, spec = 0) {
  const key = `${kind}:${spec}`;
  if (!templates.has(key)) {
    let t;
    if (kind === 6) t = makeLahat();
    else { t = new THREE.Group(); t.add(MAKERS[kind]()); if (spec === 1 || spec === 2) t.add(makeSandok(spec)); if (spec === 3) t.add(makeLid()); }
    templates.set(key, shadowed(t));
  }
  const p = templates.get(key).clone();
  p.userData = { kind, spec };
  return p;
}
export const lathe2 = lathe; // for the stall's trays and bilao
