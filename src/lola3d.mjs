// Lola Pacing at her stall: the motion-captured Lola from Lipat-Bahay (people.mjs, assets/people) standing
// behind the table at the left, reacting to play — she waves when a bilao starts, talks while her tips
// show, claps for a special, cheers a long cascade, celebrates a win and slumps at a loss. Reactions don't
// pile up: one plays at a time, then she goes back to her idle. Without the people files (GitHub Pages,
// tests with ?people=0) a simple made-in-code Lola stands in.
import * as THREE from './vendor/three.module.min.js';
import { loadPeople, makePerson, react as playOnce, drive } from './people.mjs';

const SPOT = { x: 3.9, z: -6.4, yaw: -0.3, scale: 3.4 }; // behind her stall, just past the bilao's far rim, facing the customers

// a stand-in Lola: a floral duster, an apron, a grey bun and a smile
function standIn() {
  const g = new THREE.Group(), M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });
  const dress = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.95, 18), M('#b86a9a')); dress.position.y = 0.5; g.add(dress);
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.305, 0.6, 18, 1, true, -0.8, 1.6), M('#f4ecdc', { side: THREE.DoubleSide })); apron.position.y = 0.42; g.add(apron);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 16), M('#d9a77e')); head.position.y = 1.12; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 12, 0, Math.PI * 2, 0, 1.6), M('#d6d2cc')); hair.position.y = 1.14; g.add(hair);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), M('#d6d2cc')); bun.position.set(0, 1.2, -0.12); g.add(bun);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.4, 4, 8), M('#d9a77e')); arm.position.set(s * 0.25, 0.75, 0); arm.rotation.z = s * 0.25; arm.name = s < 0 ? 'armL' : 'armR'; g.add(arm); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// which beat earns which reaction (people.mjs clips: wave, clap, cheer, victory, sad)
function reactionFor(b) {
  if (b.type === 'go') return 'wave';
  if (b.type === 'end') return b.won ? 'victory' : 'sad';
  if (b.type === 'pop' && b.made && b.made.length) return 'clap';
  if (b.type === 'pop' && b.step >= 3) return 'cheer';
  if (b.type === 'combo' || b.type === 'ubos') return 'cheer';
  return null;
}
const RANK = { cheer: 1, clap: 2, wave: 2, victory: 3, sad: 3 }; // a reaction interrupts one of the same rank or lower

export function createLola(scene, { base = 'assets/people/', enabled = true } = {}) {
  const ground = new THREE.Group(); ground.position.y = -1.6; scene.add(ground);
  let p = null, lib = null, state = 'none', talkT = 0, busyT = 0, rank = 0;
  // an invisible box the size of Lola, for layout checks (a skinned mesh's own bounds don't follow its pose)
  // (only the part above the table top, 1.5 above the ground: the counter hides the rest)
  const tall = 1.55 * SPOT.scale - 1.5;
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(0.7 * SPOT.scale, tall, 0.6 * SPOT.scale), new THREE.MeshBasicMaterial());
  proxy.visible = false; proxy.position.set(SPOT.x, 1.5 + tall / 2, SPOT.z); ground.add(proxy);
  const history = [];
  function put(person, kind) {
    if (p) ground.remove(p.root);
    p = person; p.root.scale.setScalar(SPOT.scale); ground.add(p.root); state = kind;
  }
  const stand = makePerson(null, 'lola'); stand.root.remove(stand.model); stand.model = standIn(); stand.root.add(stand.model);
  put(stand, 'standin');
  const ready = enabled
    ? loadPeople(base, null, undefined, ['lola']).then((l) => { lib = l; const real = makePerson(l, 'lola'); if (real.real) put(real, 'real'); }).catch(() => { /* the stand-in stays */ })
    : Promise.resolve();
  return {
    ready,
    state: () => state,
    history: () => history.slice(),
    root: () => proxy,
    react(b) {
      const kind = reactionFor(b);
      if (!kind) return;
      if (busyT > 0 && RANK[kind] < rank) return; // one reaction at a time, unless a bigger one comes
      rank = RANK[kind];
      history.push(kind); if (history.length > 50) history.shift();
      busyT = kind === 'clap' ? 1.6 : kind === 'cheer' ? 1.4 : 2.5;
      if (p) playOnce(p, kind, lib);
    },
    say() { talkT = 3.2; },
    update(dt) {
      if (!p) return;
      busyT = Math.max(0, busyT - dt); talkT = Math.max(0, talkT - dt);
      drive(p, lib, dt, { x: SPOT.x, z: SPOT.z, yaw: SPOT.yaw, state: talkT > 0 ? 'talk' : 'idle' });
    },
  };
}
