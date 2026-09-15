// Modelos da cidade portuária: térreo em 3D (vitrines recuadas com caixilhos, konbini, izakaya, portas de
// aço com caixa, letreiros iluminados e toldos), varandas com guarda-corpo e divisórias, rufos e platibandas,
// caixas-d'água com estrutura, condensadores, antenas, canos de descida, postes de iluminação japoneses,
// postes de fiação com transformadores e fios de serviço, semáforos de três luzes, árvores com folhagem,
// refletores na mureta e bueiros. Tudo junto por material (poucas chamadas de desenho).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SHOP_KINDS, SIGN_TEXTS } from './cityTextures.js';

// Baldes de geometria por material: tudo vira uma malha por material no fim.
export class Buckets {
  constructor() { this.map = new Map(); }
  add(key, geometry, matrix = null) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!this.map.has(key)) this.map.set(key, []);
    this.map.get(key).push(g);
  }
  build(root, materials) {
    for (const [key, list] of this.map) {
      const merged = mergeGeometries(list);
      list.forEach((g) => g.dispose());
      if (!merged || !materials[key]) continue;
      const mesh = new THREE.Mesh(merged, materials[key]);
      mesh.userData.dynamic = true; // já está junto: o mergeStatic do mundo não precisa mexer
      root.add(mesh);
    }
    this.map.clear();
  }
}

// Quadrilátero (a, b, c, d em sentido anti-horário visto de fora) com UV
function quad(a, b, c, d, [u0, v0, u1, v1] = [0, 0, 1, 1]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  g.computeVertexNormals();
  return g;
}

const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

// Referencial da fachada da frente: X ao longo (direita de quem olha da rua), Y para cima, Z para a rua.
export function frontMatrix(f) {
  const X = new THREE.Vector3(-f.ex[0], 0, -f.ex[1]);
  const Z = new THREE.Vector3(-f.ez[0], 0, -f.ez[1]);
  const m = new THREE.Matrix4().makeBasis(X, new THREE.Vector3(0, 1, 0), Z);
  m.setPosition(f.cx - f.ez[0] * f.d / 2, 0, f.cz - f.ez[1] * f.d / 2);
  return m;
}

// --- Térreo das fachadas de frente ------------------------------------------------------------------------
const KIND_WEIGHTS = { konbini: 0.1, izakaya: 0.15, pharmacy: 0.08, shutter: 0.26, lobby: 0.12, arcade: 0.06, dark: 0.11, garage: 0.12 };
const SIGN_OF = { konbini: [0, 7], izakaya: [1, 4], pharmacy: [2], arcade: [3], garage: [5], dark: [6] };

function pickKind(rand) {
  let r = rand();
  for (const [k, w] of Object.entries(KIND_WEIGHTS)) { if ((r -= w) <= 0) return k; }
  return 'shutter';
}

export function buildStorefronts(buckets, fronts, rand, GROUND) {
  const cellU = 1 / SHOP_KINDS.length;
  for (const f of fronts) {
    const M = frontMatrix(f);
    const half = f.w / 2;
    // pilares e divisão em lojas
    const cuts = [-half];
    let x = -half + 0.35;
    while (x < half - 3) {
      const uw = Math.min(half - 0.35 - x, 3.4 + rand() * 3);
      if (half - 0.35 - (x + uw) < 2.4) { cuts.push(half); break; }
      x += uw + 0.35;
      cuts.push(x - 0.175);
    }
    if (cuts[cuts.length - 1] !== half) cuts.push(half);
    // pilares de pedra (inclusive nos cantos) e faixa acima das lojas
    for (const cx of cuts) buckets.add('stone', box(0.4, GROUND, 0.22, cx, GROUND / 2, 0.06), M);
    buckets.add('stone', quad([-half, 3.05, 0.01], [half, 3.05, 0.01], [half, GROUND, 0.01], [-half, GROUND, 0.01], [0, 0, f.w / 2, 0.4]), M);
    for (let k = 0; k < cuts.length - 1; k++) {
      const a = cuts[k] + 0.2, b = cuts[k + 1] - 0.2;
      if (b - a < 1.2) continue;
      const kind = pickKind(rand);
      const ci = SHOP_KINDS.indexOf(kind);
      const uv = [ci * cellU + 0.002, 0, (ci + 1) * cellU - 0.002, 1];
      const D = kind === 'shutter' ? 0.16 : 0.5;
      const top = kind === 'shutter' ? 2.8 : 3.0;
      // fundo (interior, porta de aço ou oficina)
      buckets.add('shop', quad([a, 0.02, -D], [b, 0.02, -D], [b, top, -D], [a, top, -D], uv), M);
      // laterais e teto do recuo
      buckets.add('stoneDark', quad([a, 0, 0], [a, 0, -D], [a, top, -D], [a, top, 0]), M);
      buckets.add('stoneDark', quad([b, 0, -D], [b, 0, 0], [b, top, 0], [b, top, -D]), M);
      buckets.add('stoneDark', quad([a, top, 0], [a, top, -D], [b, top, -D], [b, top, 0]), M);
      if (kind === 'shutter' || kind === 'garage') {
        // caixa da porta de enrolar
        buckets.add('metal', box(b - a, 0.34, 0.3, (a + b) / 2, top + 0.17, 0.06), M);
        if (kind === 'garage') buckets.add('shopGlass', quad([a, 0.02, -D + 0.05], [b, 0.02, -D + 0.05], [b, top, -D + 0.05], [a, top, -D + 0.05]), M);
      } else {
        // caixilhos de alumínio: montantes, travessa, rodapé e porta
        const zf = -D + 0.1;
        const mids = [a + 0.03, b - 0.03];
        const doorW = Math.min(1.8, (b - a) * 0.4);
        const doorC = (a + b) / 2 + (rand() - 0.5) * (b - a - doorW) * 0.5;
        mids.push(doorC - doorW / 2, doorC + doorW / 2, doorC);
        for (const mx of mids) buckets.add('alu', box(0.05, top - 0.02, 0.06, mx, top / 2, zf), M);
        buckets.add('alu', box(b - a, 0.06, 0.06, (a + b) / 2, 2.3, zf), M);
        buckets.add('alu', box(b - a, 0.12, 0.07, (a + b) / 2, 0.08, zf), M);
        buckets.add('alu', box(0.03, 0.5, 0.04, doorC - 0.12, 1.1, zf + 0.05), M);
        buckets.add('alu', box(0.03, 0.5, 0.04, doorC + 0.12, 1.1, zf + 0.05), M);
        buckets.add('shopGlass', quad([a, 0.02, zf + 0.035], [b, 0.02, zf + 0.035], [b, top, zf + 0.035], [a, top, zf + 0.035]), M);
      }
      // letreiro iluminado (caixa saliente) ou toldo
      const signs = SIGN_OF[kind];
      if (signs && rand() < 0.85) {
        const row = signs[Math.floor(rand() * signs.length)];
        const v1 = 1 - row / 8, v0 = v1 - 1 / 8;
        const y0 = 3.1, y1 = 3.68, zs = 0.3;
        buckets.add('sign', quad([a, y0, zs], [b, y0, zs], [b, y1, zs], [a, y1, zs], [0, v0 + 0.004, 0.5, v1 - 0.004]), M);
        buckets.add('metal', quad([a, y1, 0], [a, y1, zs], [b, y1, zs], [b, y1, 0]), M);
        buckets.add('metal', quad([a, y0, zs], [a, y0, 0], [b, y0, 0], [b, y0, zs]), M);
        buckets.add('metal', quad([a, y0, 0], [a, y0, zs], [a, y1, zs], [a, y1, 0]), M);
        buckets.add('metal', quad([b, y0, zs], [b, y0, 0], [b, y1, 0], [b, y1, zs]), M);
      }
      if ((kind === 'izakaya' || kind === 'dark' || kind === 'pharmacy') && rand() < 0.6) {
        const row = Math.floor(rand() * 4);
        const v1 = 1 - row / 4, v0 = v1 - 0.25;
        const out = 1.0, yTop = 3.0, yLow = 2.55;
        buckets.add('awning', quad([a, yLow, out], [b, yLow, out], [b, yTop, 0.02], [a, yTop, 0.02], [0.5, v0, 1, v1 - 0.06]), M);
        buckets.add('awning', quad([a, yLow - 0.22, out], [b, yLow - 0.22, out], [b, yLow, out], [a, yLow, out], [0.5, v0, 1, v0 + 0.06]), M);
        for (const ex of [a, b]) buckets.add('metal', box(0.03, 0.03, out, ex, (yTop + yLow) / 2, out / 2), M);
      }
    }
  }
}

// --- Varandas dos prédios de apartamentos -----------------------------------------------------------------
// Módulo de 3,2 m: laje, guarda-corpo de vidro fosco, divisória de emergência e condensador do ar.
export function balconyModule() {
  const geos = {
    concrete: [box(3.2, 0.16, 1.15, 0, 0, 0.575), box(3.2, 0.1, 0.06, 0, -0.05, 1.15)],
    railing: [quad([-1.6, 0.08, 1.12], [1.6, 0.08, 1.12], [1.6, 1.12, 1.12], [-1.6, 1.12, 1.12]), quad([1.6, 0.08, 1.12], [-1.6, 0.08, 1.12], [-1.6, 1.12, 1.12], [1.6, 1.12, 1.12])],
    divider: [box(0.05, 2.2, 1.05, 1.57, 1.18, 0.56)],
    ac: [box(0.78, 0.56, 0.3, 0.95, 0.36, 0.28)],
  };
  return geos;
}

// --- Telhados ---------------------------------------------------------------------------------------------
export function waterTankGeometry() {
  const parts = [];
  const tank = new THREE.CylinderGeometry(0.85, 0.85, 1.7, 16);
  tank.translate(0, 2.35, 0);
  parts.push(tank);
  const lid = new THREE.SphereGeometry(0.86, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.22);
  lid.scale(1, 0.5, 1).translate(0, 3.1, 0);
  parts.push(lid);
  for (const [lx, lz] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]]) parts.push(box(0.08, 1.5, 0.08, lx, 0.75, lz));
  parts.push(box(1.5, 0.08, 1.5, 0, 1.5, 0));
  parts.push(box(1.35, 0.06, 0.06, 0, 0.8, -0.6), box(1.35, 0.06, 0.06, 0, 0.8, 0.6), box(0.06, 0.06, 1.35, -0.6, 0.8, 0), box(0.06, 0.06, 1.35, 0.6, 0.8, 0));
  for (let y = 0.3; y < 3; y += 0.35) parts.push(box(0.4, 0.03, 0.03, 0, y, 0.95)); // escada
  parts.push(box(0.03, 2.9, 0.03, -0.2, 1.45, 0.95), box(0.03, 2.9, 0.03, 0.2, 1.45, 0.95));
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

export function penthouseGeometry() {
  const parts = [box(3, 2.6, 2.6, 0, 1.3, 0), box(3.2, 0.15, 2.8, 0, 2.65, 0)];
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

export function antennaGeometry() {
  const parts = [new THREE.CylinderGeometry(0.03, 0.04, 4.5, 6).translate(0, 2.25, 0)];
  for (const y of [3.4, 3.9, 4.35]) {
    parts.push(box(0.03, 0.03, 1.6, 0, y, 0));
    for (let z = -0.7; z <= 0.7; z += 0.2) parts.push(box(0.9 - Math.abs(z) * 0.4, 0.02, 0.02, 0, y, z));
  }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

// --- Rua --------------------------------------------------------------------------------------------------
// Poste de iluminação: base, coluna cônica, braço curvo e luminária achatada. Origem no pé do poste;
// o braço aponta para +X até reach metros, altura height.
export function streetLampGeometry(reach = 3.2, height = 7.1) {
  const pole = [], head = [];
  pole.push(box(0.36, 0.5, 0.36, 0, 0.25, 0));
  pole.push(new THREE.CylinderGeometry(0.075, 0.12, height, 12).translate(0, height / 2, 0));
  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, height - 0.4, 0), new THREE.Vector3(0, height + 0.35, 0),
    new THREE.Vector3(reach * 0.35, height + 0.25, 0), new THREE.Vector3(reach, height - 0.05, 0),
  );
  pole.push(new THREE.TubeGeometry(curve, 16, 0.055, 8, false));
  const lum = new RoundedBoxGeometry(0.85, 0.16, 0.36, 2, 0.06);
  lum.translate(reach + 0.3, height - 0.08, 0);
  pole.push(lum);
  const lens = new THREE.PlaneGeometry(0.66, 0.24);
  lens.rotateX(Math.PI / 2).translate(reach + 0.32, height - 0.17, 0);
  head.push(lens);
  return {
    pole: mergeGeometries(pole.map((g) => (g.index ? g.toNonIndexed() : g))),
    lens: mergeGeometries(head.map((g) => g.toNonIndexed())),
  };
}

// Poste de fiação: coluna de concreto (UV de 0 a 10 m), duas cruzetas, isoladores e transformador opcional.
export function utilityPoleGeometry(transformer) {
  const concrete = [new THREE.CylinderGeometry(0.13, 0.19, 10.5, 12, 1).translate(0, 5.25, 0)];
  const steel = [], porcelain = [], can = [];
  for (const [y, len] of [[9.4, 2.0], [8.5, 1.6]]) {
    steel.push(box(len, 0.1, 0.1, 0, y, 0.2));
    for (const px of [-len / 2 + 0.12, 0, len / 2 - 0.12]) {
      if (px === 0 && y > 9) continue;
      porcelain.push(new THREE.CylinderGeometry(0.045, 0.06, 0.16, 8).translate(px, y + 0.13, 0.2));
    }
    steel.push(box(0.05, 0.05, 0.6, len * 0.3, y - 0.25, 0.1).rotateX(0));
  }
  if (transformer) {
    can.push(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 14).translate(0, 7.1, 0.45));
    can.push(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 14).translate(0, 7.57, 0.45));
    steel.push(box(0.5, 0.08, 0.5, 0, 6.62, 0.35));
    porcelain.push(new THREE.CylinderGeometry(0.04, 0.05, 0.2, 8).translate(-0.12, 7.7, 0.45), new THREE.CylinderGeometry(0.04, 0.05, 0.2, 8).translate(0.12, 7.7, 0.45));
  }
  // degraus de subida
  for (let y = 2.4; y < 8; y += 0.45) steel.push(box(0.26, 0.025, 0.025, 0, y, (y * 10) % 2 < 1 ? 0.18 : -0.18));
  const m = (list) => (list.length ? mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g))) : null);
  return { concrete: m(concrete), steel: m(steel), porcelain: m(porcelain), can: m(can) };
}

// Semáforo japonês horizontal com três luzes e pala; origem no topo do braço, faces para +Z.
export function signalHeadGeometry() {
  const housing = [new RoundedBoxGeometry(1.25, 0.42, 0.26, 2, 0.06)];
  const visor = [];
  const lamps = { green: null, yellow: null, red: null };
  [['green', -0.4], ['yellow', 0], ['red', 0.4]].forEach(([key, x]) => {
    const v = new THREE.CylinderGeometry(0.17, 0.17, 0.22, 16, 1, true, -Math.PI / 2, Math.PI);
    v.rotateX(Math.PI / 2).rotateZ(Math.PI / 2 * 0).translate(x, 0.02, 0.22);
    visor.push(v);
    lamps[key] = new THREE.CircleGeometry(0.135, 18).translate(x, 0, 0.135);
  });
  return {
    housing: mergeGeometries(housing.map((g) => g.toNonIndexed())),
    visor: mergeGeometries(visor.map((g) => g.toNonIndexed())),
    ...lamps,
  };
}

// Árvore: tronco levemente torto com galhos e cachos de folhas em cartões cruzados
export function treeGeometry(rand) {
  const trunk = [];
  const bend = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3((rand() - 0.5) * 0.3, 1.4, (rand() - 0.5) * 0.3),
    new THREE.Vector3((rand() - 0.5) * 0.4, 2.8, (rand() - 0.5) * 0.4), new THREE.Vector3((rand() - 0.5) * 0.5, 3.6, (rand() - 0.5) * 0.5),
  ]);
  const t = new THREE.TubeGeometry(bend, 12, 0.14, 8, false);
  // afina para cima
  const p = t.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const ty = Math.min(1, Math.max(0, y / 3.6));
    const k = 1 - ty * 0.5;
    const c = bend.getPoint(ty);
    p.setX(i, c.x + (p.getX(i) - c.x) * k);
    p.setZ(i, c.z + (p.getZ(i) - c.z) * k);
  }
  t.computeVertexNormals();
  trunk.push(t);
  const leaves = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + rand();
    const from = bend.getPoint(0.55 + rand() * 0.3);
    const to = new THREE.Vector3(from.x + Math.cos(a) * 1.2, from.y + 0.9 + rand() * 0.6, from.z + Math.sin(a) * 1.2);
    trunk.push(new THREE.TubeGeometry(new THREE.LineCurve3(from, to), 2, 0.05, 5, false));
  }
  for (let k = 0; k < 11; k++) {
    const a = rand() * Math.PI * 2, r = rand() * 1.3;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = 3.6 + rand() * 2 - r * 0.25;
    const size = 1.6 + rand() * 1.1;
    for (const rot of [rand() * Math.PI, rand() * Math.PI + Math.PI / 2]) {
      const card = new THREE.PlaneGeometry(size, size * 0.85);
      card.rotateY(rot).rotateX((rand() - 0.5) * 0.5).translate(cx, cy, cz);
      leaves.push(card);
    }
    const flat = new THREE.PlaneGeometry(size * 0.9, size * 0.9);
    flat.rotateX(-Math.PI / 2).translate(cx, cy + 0.2, cz);
    leaves.push(flat);
  }
  const planter = [box(1.4, 0.5, 1.4, 0, 0.25, 0), box(1.5, 0.08, 1.5, 0, 0.52, 0)];
  const soil = [box(1.2, 0.02, 1.2, 0, 0.5, 0)];
  const m = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));
  return { trunk: m(trunk), leaves: m(leaves), planter: m(planter), soil: m(soil) };
}

export function signOfKind(kind) { return SIGN_OF[kind]; }
export { SIGN_TEXTS };
