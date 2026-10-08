// Lola Pacing's kakanin stall on a fiesta street at golden hour, around the board: a photographed sky
// for light, a backdrop, a road and painted houses with iron roofs, the stall's bamboo posts, striped
// tolda and sign, banderitas and bulbs, trays of kakanin for sale, and real props. Ported from the
// approved look prototype. The board's cells sit on y = 0 around the origin.
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/three-mocap.min.js';
import { HDRLoader } from './vendor/three-fx.min.js';
import { facade, sign, rattan } from './tex.mjs';
import { makePiece, MATS, lathe2 } from './kakanin3d.mjs';

const shadow = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

export const THEMES = {
  golden: { sky: 'bd_golden', sunC: '#ffbf80', sunI: 3.0, sunP: [-8, 10, 6], hemi: ['#ffe6c4', '#6a4a30', 0.6], fog: ['#e6b88c', 30, 80], env: 0.9, exp: 0.9, lamps: 1, grade: 'golden' },
  noon: { sky: 'bd_noon', sunC: '#fff2dc', sunI: 2.5, sunP: [3, 14, 5], hemi: ['#e8f0ff', '#8a7a60', 0.75], fog: ['#e4e0d4', 40, 95], env: 0.75, exp: 0.8, lamps: 0.3, grade: 'noon' },
  dusk: { sky: 'bd_dusk', sunC: '#ff7a48', sunI: 1.5, sunP: [-12, 5, 4], hemi: ['#9a90c8', '#4a3434', 0.5], fog: ['#a88a9a', 25, 75], env: 0.45, exp: 0.95, lamps: 1.6, grade: 'dusk' },
};

export function buildStall(scene, renderer, { base = 'assets/env/' } = {}) {
  scene.background = new THREE.Color('#e9b98a');
  scene.fog = new THREE.Fog('#e6b88c', 30, 80);
  const hemi = new THREE.HemisphereLight('#ffe6c4', '#6a4a30', 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffbf80', 3.0);
  sun.position.set(-8, 10, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 16, bottom: -16, far: 70 }); sun.shadow.bias = -0.0005; sun.shadow.radius = 4;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#a8c8ff', 0.8); rim.position.set(7, 5, -7); scene.add(rim);

  const pmrem = new THREE.PMREMGenerator(renderer);
  new HDRLoader().loadAsync(base + 'sky/kloppenheim_06_puresky.hdr').then((t) => { t.mapping = THREE.EquirectangularReflectionMapping; scene.environment = pmrem.fromEquirectangular(t).texture; scene.environmentRotation = new THREE.Euler(0, 2.2, 0); t.dispose(); }).catch(() => { /* the lights alone */ });
  const tl = new THREE.TextureLoader();
  const scan = (id, rep) => { const d = tl.load(`${base}tex/${id}_diff.jpg`), n = tl.load(`${base}tex/${id}_nor.jpg`); d.colorSpace = THREE.SRGBColorSpace; for (const t of [d, n]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; } return { map: d, normalMap: n }; };
  const skyM = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false }), skies = {};
  { const sky = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 50, 48, 1, true, Math.PI * 0.62, Math.PI * 0.76), skyM);
    sky.position.set(0, 14, 4); scene.add(sky); }

  // the table and Lola's big bilao
  const table = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 13), MATS.wood); table.position.y = -0.3; table.receiveShadow = true; scene.add(table);
  const bilaoRadius = 6.2;
  const bilao = new THREE.Mesh(lathe2([[0, 0], [bilaoRadius, 0], [bilaoRadius + 0.3, 0.3], [bilaoRadius + 0.36, 0.38], [bilaoRadius + 0.22, 0.36], [bilaoRadius - 0.05, 0.08], [0, 0.08]], 120), MATS.weave);
  bilao.position.y = -0.1; shadow(bilao); scene.add(bilao);
  const front = new THREE.Mesh(new THREE.BoxGeometry(18, 1.6, 0.2), MATS.wood); front.position.set(0, -1.3, 6.5); shadow(front); scene.add(front);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(110, 70), new THREE.MeshStandardMaterial({ ...scan('asphalt_02', [22, 14]), roughness: 0.95, color: '#b9ada0' }));
  road.rotation.x = -Math.PI / 2; road.position.y = -1.6; road.receiveShadow = true; scene.add(road);
  const roofScan = scan('rusty_corrugated_iron', [4, 1]);
  const COLORS = ['#e8d3a8', '#cfe0d2', '#f0c6b0', '#d9cfe8', '#f3e6b8'];
  for (let k = 0; k < 8; k++) {
    const w = 5.6 + (k % 3) * 0.6, h = 6.4 + (k % 2) * 2.2, x = -24 + k * 6.6, z = -15.5 - (k % 2) * 1.2;
    const f = facade(1000 + k * 77, w, h, COLORS[k % 5], { shop: k === 3, lit: 0.45 });
    const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4), [0, 1, 2, 3, 4, 5].map((i) => (i === 4 ? new THREE.MeshStandardMaterial({ map: f.map, normalMap: f.normalMap, roughness: 0.9 }) : new THREE.MeshStandardMaterial({ color: COLORS[k % 5], roughness: 0.95 }))));
    house.position.set(x, -1.6 + h / 2, z); shadow(house); scene.add(house);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.08, 4.6), new THREE.MeshStandardMaterial({ ...roofScan, metalness: 0.6, roughness: 0.6 }));
    roof.position.set(x, -1.6 + h + 0.25, z + 0.2); roof.rotation.x = 0.18; shadow(roof); scene.add(roof);
  }
  // the stall
  const bamboo = rattan(5), bambooM = new THREE.MeshStandardMaterial({ map: bamboo.map, normalMap: bamboo.normalMap, roughness: 0.55 });
  for (const x of [-8.8, 8.8]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 8.2, 12), bambooM); p.position.set(x, 2.5, -6); shadow(p); scene.add(p); }
  const stripes = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 16; const x = c.getContext('2d'); for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#fff4e0' : '#d8342c'; x.fillRect(i * 16, 0, 16, 16); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const tolda = new THREE.Mesh(new THREE.PlaneGeometry(18.5, 3.6, 24, 4), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.8, side: THREE.DoubleSide }));
  { const p = tolda.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / 18.5) * Math.PI * 9) * 0.06); p.needsUpdate = true; tolda.geometry.computeVertexNormals(); }
  tolda.position.set(0, 6.6, -4.8); tolda.rotation.x = -1.2; shadow(tolda); scene.add(tolda);
  const signTex = sign([['KAKANIN NI LOLA PACING', 30], ['puto · kutsinta · sapin-sapin · bibingka · ube · suman', 12, 700]], '#2a6f3a', '#fff4d6', { w: 1024, h: 160 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(10, 1.5, 0.12), [0, 1, 2, 3, 4, 5].map((i) => (i === 4 ? new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6 }) : new THREE.MeshStandardMaterial({ color: '#7a4a22' }))));
  board.position.set(0, 4.2, -6.1); shadow(board); scene.add(board);
  const flagCols = ['#e8384f', '#ffd23f', '#2f6fd6', '#2fb36b', '#ff8ad6'], bulbs = [];
  for (const [z, y0, sag] of [[-7.5, 7.2, 0.5], [-11, 8.2, 0.8]]) for (let k = 0; k < 30; k++) {
    const x = -15 + k * 1.04, y = y0 - Math.sin((k / 29) * Math.PI) * sag;
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 3), new THREE.MeshStandardMaterial({ color: flagCols[k % 5], roughness: 0.7, side: THREE.DoubleSide }));
    f.position.set(x, y - 0.24, z); f.rotation.set(Math.PI, 0, 0); f.scale.z = 0.05; f.castShadow = true; scene.add(f);
    if (k % 2 === 0) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: '#fff0c0', emissive: '#ffcf70', emissiveIntensity: 4 })); b.position.set(x + 0.5, y + 0.05, z + 0.1); scene.add(b); bulbs.push(b); }
  }
  // trays of kakanin for sale beside the board
  for (const [x, z, kind, n] of [[-8.4, 2.6, 5, 5], [8.4, 2.6, 0, 6], [-8.4, -2.6, 1, 6], [8.4, -2.6, 4, 3]]) {
    const tray = new THREE.Mesh(lathe2([[0, 0], [1.1, 0], [1.2, 0.12], [1.13, 0.12], [1.05, 0.03], [0, 0.03]], 48), MATS.weave); tray.position.set(x, -0.08, z); shadow(tray); scene.add(tray);
    for (let k = 0; k < n; k++) { const p = makePiece(kind, 0); const a = (k / n) * Math.PI * 2; p.position.set(x + Math.cos(a) * (k ? 0.55 : 0), -0.05, z + Math.sin(a) * (k ? 0.55 : 0)); p.scale.setScalar(0.85); scene.add(p); }
  }
  // real props from the street
  const gl = new GLTFLoader();
  for (const [id, x, z, ry] of [['plastic_monobloc_chair_01', -11.5, 5, 0.6], ['plastic_monobloc_chair_01', 11.8, 4, -0.5], ['plastic_crate_02', 10.6, -1, 0.3], ['small_lpg_tank', -10.8, -2, 0], ['Barrel_01', 13.5, -6, 0.4], ['wooden_bucket_02', -12.8, -4.8, 0]]) {
    gl.loadAsync(`${base}props/${id}.glb`).then((g) => { const o = g.scene; o.scale.setScalar(2.2); o.position.set(x, -1.6, z); o.rotation.y = ry; shadow(o); scene.add(o); }).catch(() => { /* fine without */ });
  }
  // each town's street dressing, built the first time it's needed
  const stripeTex = (a, b) => { const c = document.createElement('canvas'); c.width = 128; c.height = 8; const x = c.getContext('2d'); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect(i * 16, 0, 16, 8); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const DRESS = {
    // the market: striped awnings over the doors, and crates of produce on the street
    noon() {
      const g = new THREE.Group(), cols = [['#2f6fd6', '#f4f0e4'], ['#2fa060', '#f4f0e4'], ['#e8a020', '#fff4e0']];
      const fruit = [['#d8302a', 0.16], ['#7ab83a', 0.11], ['#f2c02a', 0.17], ['#6a2a7a', 0.15]], fruitGeo = new THREE.SphereGeometry(1, 12, 8);
      const crateM = new THREE.MeshStandardMaterial({ color: '#a7743f', roughness: 0.85 });
      for (let k = 0; k < 8; k++) {
        const x = -24 + k * 6.6, z = -15.5 - (k % 2) * 1.2 + 2.05, [ca, cb] = cols[k % 3];
        const aw = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.6), new THREE.MeshStandardMaterial({ map: stripeTex(ca, cb), roughness: 0.8, side: THREE.DoubleSide }));
        aw.position.set(x, 1.5, z + 0.7); aw.rotation.x = -1.05; g.add(aw);
        for (let c = 0; c < 3; c++) {
          const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.6), crateM); crate.position.set(x - 1.2 + c * 1.2, -1.38, z + 1.1); g.add(crate);
          const [fc, r] = fruit[(k + c) % 4], fm = new THREE.MeshStandardMaterial({ color: fc, roughness: 0.45 });
          for (let q = 0; q < 6; q++) { const f = new THREE.Mesh(fruitGeo, fm); f.scale.setScalar(r); f.position.set(x - 1.2 + c * 1.2 + ((q % 3) - 1) * 0.26, -1.1, z + 1.1 + ((q / 3) | 0) * 0.24 - 0.12); g.add(f); }
        }
      }
      return shadow(g);
    },
    // Simbang Gabi: glowing parol stars hung from the stall, tails and all
    dusk() {
      const g = new THREE.Group(), star = new THREE.Shape();
      for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 0.26 : 0.62; k ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      const geo = new THREE.ExtrudeGeometry(star, { depth: 0.12, bevelEnabled: false }); geo.center();
      const ringGeo = new THREE.TorusGeometry(0.66, 0.025, 6, 40), tailGeo = new THREE.BoxGeometry(0.05, 1.0, 0.01);
      [['#ff3a3a', -7.0], ['#ffd23f', -5.9], ['#3a9aff', 5.9], ['#ff5ad0', 7.0]].forEach(([c, x], k) => {
        const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4, roughness: 0.5 }), p = new THREE.Group();
        p.add(new THREE.Mesh(geo, m), new THREE.Mesh(ringGeo, m));
        for (const dx of [-0.12, 0, 0.12]) { const t = new THREE.Mesh(tailGeo, m); t.position.set(dx, -1.05, 0); p.add(t); }
        p.position.set(x, 4.9 - (k % 2) * 0.5, -5.6); p.userData.parol = true; g.add(p);
      });
      const glow = new THREE.PointLight('#ffb070', 2, 7, 1.8); glow.position.set(0, 5.4, -5.4); g.add(glow);
      return g;
    },
  };
  const dressed = {};
  // each town's time of day: the backdrop, the sun, the sky light, fog, exposure and how bright the string lights are
  let lamps = 1;
  function setTheme(id) {
    const T = THEMES[id] || THEMES.golden;
    if (!skies[T.sky]) { const t = tl.load(`${base}sky/${T.sky}.jpg`); t.colorSpace = THREE.SRGBColorSpace; skies[T.sky] = t; }
    skyM.map = skies[T.sky]; skyM.needsUpdate = true;
    sun.color.set(T.sunC); sun.intensity = T.sunI; sun.position.set(...T.sunP);
    hemi.color.set(T.hemi[0]); hemi.groundColor.set(T.hemi[1]); hemi.intensity = T.hemi[2];
    scene.fog.color.set(T.fog[0]); scene.fog.near = T.fog[1]; scene.fog.far = T.fog[2];
    scene.environmentIntensity = T.env; renderer.toneMappingExposure = T.exp; lamps = T.lamps;
    if (!dressed[id] && DRESS[id]) { dressed[id] = DRESS[id](); scene.add(dressed[id]); }
    for (const [k, o] of Object.entries(dressed)) o.visible = k === id;
    return T.grade;
  }
  setTheme('golden');
  return { bilaoRadius, sun, setTheme, update(t) { for (const b of bulbs) b.material.emissiveIntensity = lamps * (3 + Math.sin(t * 3 + b.id) * 1); if (dressed.dusk?.visible) dressed.dusk.children.forEach((p, k) => { if (p.userData.parol) p.rotation.z = Math.sin(t * 0.9 + k) * 0.06; }); } };
}
