// Peças dos carros, montadas sobre a lataria (CarBody): tubos lisos, cascas finas que acompanham a
// superfície (lanternas, saias, lábios), retrovisores, maçanetas, limpadores, placas com moldura,
// escapamentos, ganchos de reboque, grades, emblemas, faróis e lanternas com refletor e lente.
// Todas recebem ctx = { THREE, body, parent, detail, mats, canvasTex, ghost }.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const sides = [-1, 1];

// Peça que pode se soltar numa batida (retrovisor, tampa de farol, placa...). Fica num grupo próprio
// para escapar da junção de malhas, e o carro a solta depois (src/carModel.js + src/debris.js).
export function breakable(ctx, name, object, { radius = 0.12, hp = 2.4 } = {}) {
  if (!ctx.breakables || !object) return object;
  const holder = new THREE.Group();
  (object.parent || ctx.parent).add(holder);
  holder.add(object);
  ctx.breakables.push({ name, holder, radius, hp });
  return object;
}

export function addMesh(parent, geometry, material, { pos, rot, scale, order } = {}) {
  const m = new THREE.Mesh(geometry, material);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.set(...(Array.isArray(scale) ? scale : [scale, scale, scale]));
  if (order !== undefined) m.renderOrder = order;
  parent.add(m);
  return m;
}

export const roundedBox = (w, h, d, r = 0.01, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999);

// Tubo liso por pontos (borrachas, frisos cromados, hastes, santantônio)
export function tube(parent, points, radius, material, { closed = false, segments, radial = 6, tension = 0.5 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'catmullrom', tension);
  const g = new THREE.TubeGeometry(curve, segments ?? Math.max(4, points.length * 6), radius, radial, closed);
  return addMesh(parent, g, material);
}

// Casca fina colada na lataria: patch externo (lift+thick), interno (lift) e as bordas.
export function slab(body, { z0, z1, g0, g1, side = 1, lift = 0.002, thick = 0.02, nu = 8, nv = 8 }) {
  const outer = body.patch({ z0, z1, g0, g1, side, lift: lift + thick, nu, nv });
  const inner = body.patch({ z0, z1, g0, g1, side, lift, nu, nv });
  const po = outer.attributes.position.array, pi = inner.attributes.position.array;
  const W = nu + 1;
  const ring = [];
  for (let j = 0; j <= nu; j++) ring.push(j);                       // borda s=0
  for (let i = 1; i <= nv; i++) ring.push(i * W + nu);               // borda u=1
  for (let j = nu - 1; j >= 0; j--) ring.push(nv * W + j);           // borda s=1
  for (let i = nv - 1; i >= 1; i--) ring.push(i * W);                // borda u=0
  const pos = [], idx = [];
  ring.forEach((v) => { pos.push(po[v * 3], po[v * 3 + 1], po[v * 3 + 2], pi[v * 3], pi[v * 3 + 1], pi[v * 3 + 2]); });
  const n = ring.length;
  for (let k = 0; k < n; k++) {
    const a = k * 2, b = ((k + 1) % n) * 2;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const edge = new THREE.BufferGeometry();
  edge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  edge.setIndex(idx);
  edge.computeVertexNormals();
  return { outer, inner, edge };
}

// Normal para fora de um triângulo de borda depende do sentido do anel: usa material dupla face.
export function addSlab(parent, body, spec, faceMat, edgeMat = faceMat) {
  const { outer, edge } = slab(body, spec);
  const face = addMesh(parent, outer, faceMat);
  const e = addMesh(parent, edge, edgeMat.side === THREE.DoubleSide ? edgeMat : doubleSided(edgeMat));
  return { face, edge: e };
}

const doubleCache = new WeakMap();
export function doubleSided(material) {
  if (material.side === THREE.DoubleSide) return material;
  if (!doubleCache.has(material)) {
    const m = material.clone();
    m.side = THREE.DoubleSide;
    doubleCache.set(material, m);
  }
  return doubleCache.get(material);
}

// Extrusão de um contorno 2D (plano XY) com espessura em Z e bisel; centrada em Z.
export function extrude(shape, depth, bevel = 0.004, curveSegments = 10) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments });
  g.translate(0, 0, -depth / 2);
  return g;
}

export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0); s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0);
  s.lineTo(x1, y1 - r); s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2);
  s.lineTo(x0 + r, y1); s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

export function polygonShape(points, radius = 0) {
  const s = new THREE.Shape();
  const n = points.length;
  if (!radius) {
    points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    return s;
  }
  for (let i = 0; i < n; i++) {
    const [px, py] = points[(i - 1 + n) % n], [cx, cy] = points[i], [nx, ny] = points[(i + 1) % n];
    const l1 = Math.hypot(px - cx, py - cy), l2 = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const ax = cx + ((px - cx) / l1) * r, ay = cy + ((py - cy) / l1) * r;
    const bx = cx + ((nx - cx) / l2) * r, by = cy + ((ny - cy) / l2) * r;
    if (i === 0) s.moveTo(ax, ay); else s.lineTo(ax, ay);
    s.quadraticCurveTo(cx, cy, bx, by);
  }
  s.closePath();
  return s;
}

// Forma plana com UV 0..1 na caixa
export function flat(shape, segments = 12) {
  const g = new THREE.ShapeGeometry(shape, segments);
  g.computeBoundingBox();
  const b = g.boundingBox, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - b.min.x) / (b.max.x - b.min.x || 1), (uv.getY(i) - b.min.y) / (b.max.y - b.min.y || 1));
  return g;
}

export function canvasTex(w, h, draw, { repeat = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}

// Vira um objeto plano (feito em XY, frente +Z) para ficar tangente à lataria num ponto.
export function orientTo(object, normal, up = [0, 1, 0]) {
  const n = new THREE.Vector3(...normal).normalize();
  const u = new THREE.Vector3(...up);
  const x = new THREE.Vector3().crossVectors(u, n);
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(n, x).normalize();
  object.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, n));
  return object;
}

// Normal 3D da lataria num ponto (z, g) do lado side
export function bodyNormal(body, z, g, side = 1) {
  const [nx, ny] = body.normal2(z, g);
  const dz = 0.01;
  const a = body.surface(z - dz, g, side), b = body.surface(z + dz, g, side);
  const p = body.surface(z, g, side);
  const tz = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const n0 = new THREE.Vector3(side * nx, ny, 0);
  // remove a componente ao longo do comprimento para seguir a inclinação em z
  const t = new THREE.Vector3(...body.surface(z, g + 0.02, side)).sub(new THREE.Vector3(...p));
  const n = new THREE.Vector3().crossVectors(side > 0 ? t : tz, side > 0 ? tz : t).normalize();
  if (n.dot(n0) < 0) n.negate();
  return [n.x, n.y, n.z];
}

// --- Peças ------------------------------------------------------------------------------------------

// Retrovisor aerodinâmico anos 90: base triangular na porta, haste e concha oval com espelho.
export function sideMirror(ctx, { z, y, out = 0.12, size = 1 }) {
  const { body, mats } = ctx;
  for (const s of sides) {
    const parent = new THREE.Group(); // carcaça, vela e haste soltam juntas
    ctx.parent.add(parent);
    const g = body.gAtY(z, y, 3, 5);
    const base = body.surface(z, g, s, 0.004);
    const housing = new THREE.Group();
    housing.position.set(base[0] + s * out, base[1] + 0.03 * size, z - 0.03);
    const shell = new THREE.SphereGeometry(0.075 * size, 18, 12);
    shell.scale(1.35, 0.78, 0.62);
    // achata a parte de trás (onde fica o espelho)
    const p = shell.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getZ(i) < -0.012 * size) p.setZ(i, -0.012 * size - (p.getZ(i) + 0.012 * size) * 0.25);
    shell.computeVertexNormals();
    addMesh(housing, shell, mats.paint);
    const glassG = new THREE.CircleGeometry(0.066 * size, 20);
    glassG.scale(1.3, 0.72, 1);
    addMesh(housing, glassG, mats.mirrorGlass, { pos: [0, 0, -0.02 * size], rot: [0, Math.PI, 0] });
    const rim = new THREE.TorusGeometry(0.068 * size, 0.006, 5, 24);
    rim.scale(1.3, 0.72, 1);
    addMesh(housing, rim, mats.trim, { pos: [0, 0, -0.018 * size] });
    parent.add(housing);
    // base "vela" triangular e haste
    const sail = new THREE.Shape();
    sail.moveTo(0, 0); sail.lineTo(0.13, 0); sail.lineTo(0.02, 0.07); sail.closePath();
    const sailG = extrude(sail, 0.02, 0.004, 4);
    const sailM = addMesh(parent, sailG, mats.trim, { pos: [base[0] + s * 0.008, base[1] - 0.02, z + 0.08] });
    sailM.rotation.set(0, s > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    tube(parent, [[base[0] + s * 0.01, base[1], z - 0.02], [base[0] + s * out * 0.55, base[1] + 0.02 * size, z - 0.03], [base[0] + s * (out - 0.04), base[1] + 0.03 * size, z - 0.03]], 0.012 * size, mats.trim, { radial: 6 });
    breakable(ctx, s > 0 ? 'retrovisor-esq' : 'retrovisor-dir', parent, { hp: 1.6 });
  }
}

// Maçaneta embutida: rebaixo escuro + alavanca preta
export function doorHandle(ctx, { z, y, w = 0.12, style = 'pull' }) {
  const { body, detail, mats } = ctx;
  for (const s of sides) {
    const g = body.gAtY(z, y, 2, 4);
    const p = body.surface(z, g, s, 0.002);
    const n = bodyNormal(body, z, g, s);
    const recess = addMesh(detail, flat(roundedRectShape(w + 0.02, 0.045, 0.018)), mats.seam);
    recess.position.set(...p);
    orientTo(recess, n);
    const lever = addMesh(detail, roundedBox(w, style === 'flap' ? 0.03 : 0.022, 0.016, 0.007), style === 'chrome' ? mats.chrome : mats.trim);
    lever.position.set(p[0] + n[0] * 0.006, p[1] + n[1] * 0.006 + 0.004, p[2]);
    orientTo(lever, n);
    // fechadura
    const lock = addMesh(detail, new THREE.CircleGeometry(0.009, 10), mats.chrome);
    lock.position.set(p[0] + n[0] * 0.003, p[1] + 0.002, z - s * 0 - (w / 2 + 0.03));
    const pl = body.surface(z - w / 2 - 0.03, g, s, 0.003);
    lock.position.set(...pl);
    orientTo(lock, n);
  }
}

// Limpador: braço preto articulado + palheta com borracha, deitado sobre o para-brisa
export function wiper(ctx, { x, z, length = 0.48, angle = 0.12, lift = 0.012 }) {
  const { body, detail, mats } = ctx;
  const pts = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x - Math.cos(angle) * length * t * Math.sign(x || 1);
    const pz = z - Math.sin(angle) * length * t;
    pts.push([px, body.topY(pz, px) + lift, pz]);
  }
  tube(detail, pts.slice(0, 5), 0.0055, mats.trim, { radial: 5 });
  tube(detail, pts.slice(2), 0.004, mats.rubber, { radial: 4 });
  const pivot = addMesh(detail, new THREE.CylinderGeometry(0.014, 0.018, 0.02, 10), mats.trim);
  pivot.position.set(pts[0][0], pts[0][1] - 0.004, pts[0][2]);
}

// Placa japonesa com moldura e parafusos. back: traseira (vira para -Z).
export function licensePlate(ctx, { x = 0, y, z, back = false, tilt = 0, frame = true }) {
  const { detail, mats } = ctx;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.set(back ? tilt : -tilt, back ? Math.PI : 0, 0);
  addMesh(g, roundedBox(0.34, 0.175, 0.012, 0.006), mats.plateBack, { pos: [0, 0, -0.004] });
  addMesh(g, flat(roundedRectShape(0.33, 0.165, 0.008)), mats.plateMat, { pos: [0, 0, 0.0025] });
  if (frame) {
    const outer = roundedRectShape(0.35, 0.185, 0.012);
    const hole = roundedRectShape(0.322, 0.157, 0.006);
    outer.holes.push(hole);
    addMesh(g, extrude(outer, 0.008, 0.002, 6), mats.chrome, { pos: [0, 0, 0.006] });
  }
  for (const bx of [-0.12, 0.12]) addMesh(g, new THREE.CylinderGeometry(0.008, 0.008, 0.006, 8), mats.chrome, { pos: [bx, 0.055, 0.008], rot: [Math.PI / 2, 0, 0] });
  detail.add(g);
  breakable(ctx, back ? 'placa-tras' : 'placa-frente', g, { hp: 2.6 });
  return g;
}

// Ponteira de escapamento com borda enrolada e interior escuro; abafador atrás
export function exhaustTip(ctx, { x, y, z, r = 0.045, len = 0.16, style = 'round', dir = -1 }) {
  const { parent, mats } = ctx;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const prof = [[r * 0.82, -len], [r * 0.85, -0.01], [r * 0.88, 0], [r, 0.003], [r * 1.04, -0.008], [r * 1.02, -len]];
  const lathe = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 20);
  lathe.rotateX(dir < 0 ? -Math.PI / 2 : Math.PI / 2);
  addMesh(g, lathe, doubleSided(mats.chrome));
  const inside = new THREE.CircleGeometry(r * 0.84, 16);
  addMesh(g, inside, mats.soot, { pos: [0, 0, dir * -0.05], rot: [0, dir < 0 ? Math.PI : 0, 0] });
  if (style === 'oval') g.scale.set(1.35, 0.8, 1);
  parent.add(g);
  // abafador
  const muffler = addMesh(parent, roundedBox(0.3, 0.12, 0.34, 0.05), mats.underbody);
  muffler.position.set(x * 0.7, y + 0.02, z - dir * 0.3);
  return g;
}

// Gancho de reboque de competição (cinta vermelha)
export function towStrap(ctx, { x, y, z, back = false, color = 0xd81b22 }) {
  const { detail } = ctx;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const loop = new THREE.TorusGeometry(0.05, 0.012, 4, 14, Math.PI * 1.3);
  loop.scale(1, 1.4, 0.35);
  const m = addMesh(detail, loop, mat, { pos: [x, y, z] });
  m.rotation.set(0, 0, Math.PI * 0.85);
  if (back) m.rotation.y = Math.PI;
}

// Grade: fundo escuro recuado + tela (alpha) ou aletas
export function grille(ctx, { x = 0, y, z, w, h, r = 0.02, pattern = 'mesh', back = false, depth = 0.02, shape = null }) {
  const { parent, mats } = ctx;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (back) g.rotation.y = Math.PI;
  const s = shape || roundedRectShape(w, h, r);
  addMesh(g, flat(s), mats.cavity, { pos: [0, 0, -depth] });
  const tex = pattern === 'slats' ? slatTexture() : pattern === 'honeycomb' ? honeycombTexture() : meshTexture();
  const m = new THREE.MeshStandardMaterial({ map: tex, alphaMap: tex, transparent: false, alphaTest: 0.5, color: 0x1a1a1c, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide });
  tex.repeat.set(w / 0.05, h / 0.05);
  addMesh(g, flat(s), m, { pos: [0, 0, -depth * 0.35] });
  // moldura
  const frame = roundedRectShape(w + 0.016, h + 0.016, r + 0.008);
  frame.holes.push(roundedRectShape(w, h, r));
  if (!shape) addMesh(g, extrude(frame, 0.012, 0.003, 6), mats.trim, { pos: [0, 0, -0.004] });
  parent.add(g);
  return g;
}

let meshTex, slatTex, honeyTex;
function meshTexture() {
  if (!meshTex) {
    meshTex = canvasTex(64, 64, (c, w, h) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#fff'; c.lineWidth = 7;
      c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w / 2, 0); c.lineTo(w, h / 2); c.lineTo(w / 2, h); c.closePath(); c.stroke();
    }, { repeat: true });
    meshTex.colorSpace = THREE.NoColorSpace;
  }
  return meshTex.clone();
}
function slatTexture() {
  if (!slatTex) {
    slatTex = canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(0, 0, w, h * 0.4); }, { repeat: true });
    slatTex.colorSpace = THREE.NoColorSpace;
  }
  return slatTex.clone();
}
function honeycombTexture() {
  if (!honeyTex) {
    honeyTex = canvasTex(64, 64, (c, w, h) => {
      c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#000';
      for (const [cx, cy] of [[w / 2, h / 2], [0, 0], [w, 0], [0, h], [w, h]]) {
        c.beginPath();
        for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; c.lineTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14); }
        c.fill();
      }
    }, { repeat: true });
    honeyTex.colorSpace = THREE.NoColorSpace;
  }
  return honeyTex.clone();
}

// Emblema/letreiro em relevo (texto cromado ou pintado) numa placa plana com alpha
export function badge(ctx, { text, x = 0, y, z, h = 0.03, back = false, font = '900 64px "Arial Black", Arial, sans-serif', color = '#e8ebef', material = null, italic = false, rotY = null }) {
  const { detail } = ctx;
  const cw = 512, chh = 96;
  let width = 0;
  const tex = canvasTex(cw, chh, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    c.font = font;
    width = Math.min(W - 8, c.measureText(text).width);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.save();
    c.translate(W / 2, H / 2);
    if (italic) c.transform(1, 0, -0.22, 1, 0, 0);
    c.fillStyle = color;
    c.fillText(text, 0, 4, W - 8);
    c.restore();
  });
  const aspect = Math.max(0.2, width / chh);
  const mat = material || new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, metalness: 0.9, roughness: 0.2, envMap: ctx.mats.envMap });
  const geo = new THREE.PlaneGeometry(h * (cw / chh), h);
  const m = addMesh(detail, geo, mat, { pos: [x, y, z] });
  if (rotY !== null) m.rotation.y = rotY; else if (back) m.rotation.y = Math.PI;
  void aspect;
  return m;
}

// Lâmpada redonda com refletor cromado (tigela), bulbo e lente (para faróis, milha, piscas)
export function reflectorLamp(parent, mats, { r = 0.05, depth = 0.05, bulb = mats.bulb, lens = mats.lensClear, pos, rotY = 0, rotX = 0 }) {
  const g = new THREE.Group();
  if (pos) g.position.set(...pos);
  g.rotation.set(rotX, rotY, 0);
  const pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(r * t, -depth * (1 - t * t))); }
  const bowl = new THREE.LatheGeometry(pts, 20);
  bowl.rotateX(Math.PI / 2);
  addMesh(g, bowl, doubleSided(mats.chrome)); // concha aberta para a frente (+Z)
  addMesh(g, new THREE.SphereGeometry(r * 0.22, 10, 8), bulb, { pos: [0, 0, -depth * 0.55] });
  const lensG = new THREE.SphereGeometry(r * 1.02, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.18);
  lensG.rotateX(Math.PI / 2);
  lensG.translate(0, 0, -r * 1.02 * Math.cos(Math.PI * 0.18) + 0.004);
  addMesh(g, lensG, lens, { order: 1 });
  parent.add(g);
  return g;
}

// Projetor (lente esférica com anel cromado) para faróis modernos
export function projectorLamp(parent, mats, { r = 0.03, pos, rotY = 0, rotX = 0 }) {
  const g = new THREE.Group();
  if (pos) g.position.set(...pos);
  g.rotation.set(rotX, rotY, 0);
  addMesh(g, new THREE.CylinderGeometry(r * 1.25, r * 1.4, r * 1.6, 18, 1, true), doubleSided(mats.cavity), { rot: [Math.PI / 2, 0, 0], pos: [0, 0, -r * 0.8] });
  addMesh(g, new THREE.TorusGeometry(r * 1.12, r * 0.14, 6, 20), mats.chrome);
  addMesh(g, new THREE.SphereGeometry(r, 18, 12), mats.projector, { pos: [0, 0, -r * 0.35] });
  addMesh(g, new THREE.CircleGeometry(r * 0.55, 14), mats.bulb, { pos: [0, 0, -r * 0.1] });
  parent.add(g);
  return g;
}

// Canvas de lanterna: células com refletor em "favo" e brilho
export function lampTexture({ w = 512, h = 128, cells, base = '#1a0305', frame = '#0b0b0c', gloss = true }) {
  return canvasTex(w, h, (c, W, H) => {
    c.fillStyle = frame; c.fillRect(0, 0, W, H);
    c.fillStyle = base; c.fillRect(2, 2, W - 4, H - 4);
    for (const cell of cells) {
      const { x, y = 0.08, cw, ch = 0.84, color, pattern = 'hex', ring = false } = cell;
      const X = x * W, Y = y * H, CW = cw * W, CH = ch * H;
      const grad = c.createLinearGradient(0, Y, 0, Y + CH);
      grad.addColorStop(0, color); grad.addColorStop(0.5, shade(color, -0.12)); grad.addColorStop(1, shade(color, -0.35));
      c.fillStyle = grad;
      c.fillRect(X, Y, CW, CH);
      c.save();
      c.beginPath(); c.rect(X, Y, CW, CH); c.clip();
      if (pattern === 'hex') {
        c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 1;
        const s = 7;
        for (let yy = Y; yy < Y + CH + s; yy += s * 0.87) {
          for (let xx = X + ((Math.round((yy - Y) / (s * 0.87)) % 2) * s) / 2; xx < X + CW + s; xx += s) {
            c.beginPath();
            for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; c.lineTo(xx + Math.cos(a) * s * 0.55, yy + Math.sin(a) * s * 0.55); }
            c.closePath(); c.stroke();
          }
        }
      } else if (pattern === 'lines') {
        c.fillStyle = 'rgba(0,0,0,0.25)';
        for (let yy = Y; yy < Y + CH; yy += 5) c.fillRect(X, yy, CW, 2);
      } else if (pattern === 'fresnel') {
        c.strokeStyle = 'rgba(255,255,255,0.18)';
        for (let rr = 4; rr < Math.max(CW, CH); rr += 6) { c.beginPath(); c.arc(X + CW / 2, Y + CH / 2, rr, 0, Math.PI * 2); c.stroke(); }
      }
      if (ring) {
        const rr = Math.min(CW, CH) * 0.42;
        const rg = c.createRadialGradient(X + CW / 2, Y + CH / 2, rr * 0.2, X + CW / 2, Y + CH / 2, rr);
        rg.addColorStop(0, 'rgba(255,255,255,0.35)'); rg.addColorStop(0.7, 'rgba(255,255,255,0.05)'); rg.addColorStop(1, 'rgba(0,0,0,0.3)');
        c.fillStyle = rg; c.beginPath(); c.arc(X + CW / 2, Y + CH / 2, rr, 0, Math.PI * 2); c.fill();
      }
      c.restore();
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3; c.strokeRect(X, Y, CW, CH);
    }
    if (gloss) {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(0.25, 'rgba(255,255,255,0.03)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
  });
}

export function shade(hex, amount) {
  const c = new THREE.Color(hex);
  const t = amount < 0 ? 0 : 1, p = Math.abs(amount);
  c.r += (t - c.r) * p; c.g += (t - c.g) * p; c.b += (t - c.b) * p;
  return `#${c.getHexString()}`;
}

// --- Farol escamoteável levantado --------------------------------------------------------------------
// A tampa é o próprio pedaço do capô (recortado pela sonda) girado na dobradiça de trás: por isso
// continua com a curvatura da lataria e encosta no capô sem folga. Levantada, forma a cunha típica:
// tampa inclinada na cor do carro, laterais pretas triangulares e a frente vertical com a lâmpada.
// Atrás da frente fica o vão escuro do capô. Devolve [x, y, z] do centro da lâmpada (facho).
// spec: side, xIn/xOut (borda de dentro/de fora), zHinge/zFront, zFrontOut (frente na ponta de fora,
// para tampas que seguem a quina), angle (rad), lamp: 'round' | 'twin' | 'rect'
export function popupHeadlight(ctx, { side, xIn, xOut, zHinge, zFront, zFrontOut = zFront, angle = 0.55, lamp = 'round', thick = 0.014 }) {
  const { probe, mats } = ctx;
  const unit = new THREE.Group(); // o conjunto inteiro sai numa batida forte
  ctx.parent.add(unit);
  const parent = unit, detail = unit;
  const NU = 10, NT = 8;
  const s = side;
  const shapeFn = (u, t) => {
    const zf = zFront + (zFrontOut - zFront) * u;
    return [s * (xIn + (xOut - xIn) * u), zHinge + (zf - zHinge) * t];
  };
  const xc = s * (xIn + xOut) / 2;
  const hingeY = probe.at('y', xc, zHinge, 1)?.[1] ?? 0.7;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const rotate = (arr, isNormal) => {
    for (let i = 0; i < arr.length; i += 3) {
      const dy = arr[i + 1] - (isNormal ? 0 : hingeY), dz = arr[i + 2] - (isNormal ? 0 : zHinge);
      arr[i + 1] = (isNormal ? 0 : hingeY) + dy * ca + dz * sa;
      arr[i + 2] = (isNormal ? 0 : zHinge) - dy * sa + dz * ca;
    }
  };

  // Vão no capô (fica visível na frente da lâmpada)
  addMesh(ctx.parent, probe.patch({ axis: 'y', dir: 1, nu: NU, nv: NT, lift: 0.0015, shapeFn }), mats.cavity);

  // Tampa com espessura, girada
  const lid = probe.shell({ axis: 'y', dir: 1, nu: NU, nv: NT, lift: -thick, shapeFn }, thick + 0.001);
  for (const g of [lid.face, lid.edge]) {
    rotate(g.attributes.position.array, false);
    if (g.attributes.normal) rotate(g.attributes.normal.array, true);
  }
  addMesh(parent, lid.face, mats.paint);
  addMesh(parent, lid.edge, doubleSided(mats.paint));

  // Borda da frente da tampa depois de girar (de dentro para fora)
  const W = NU + 1;
  const lp = lid.face.attributes.position.array;
  const front = [];
  for (let i = 0; i <= NU; i++) { const v = NT * W + i; front.push([lp[v * 3], lp[v * 3 + 1], lp[v * 3 + 2]]); }
  const hoodY = (x, z) => probe.at('y', x, z, 1)?.[1] ?? hingeY;

  // Frente vertical: da borda da tampa até um pouco abaixo do capô
  const facePos = [], faceIdx = [];
  for (const [x, y, z] of front) facePos.push(x, y - 0.004, z + 0.001, x, hoodY(x, z) - 0.03, z + 0.001);
  for (let i = 0; i < NU; i++) { const a = i * 2, b = a + 2; faceIdx.push(a, a + 1, b, b, a + 1, b + 1); }
  const faceGeo = new THREE.BufferGeometry();
  faceGeo.setAttribute('position', new THREE.Float32BufferAttribute(facePos, 3));
  faceGeo.setIndex(faceIdx);
  faceGeo.computeVertexNormals();
  addMesh(parent, faceGeo, doubleSided(mats.trim));

  // Laterais triangulares: dobradiça → borda da tampa → frente → volta rente ao capô
  for (const edgeU of [0, NU]) {
    const pts = [];
    for (let j = 0; j <= NT; j++) { const v = j * W + edgeU; pts.push([lp[v * 3 + 2], lp[v * 3 + 1]]); }
    const x = lp[edgeU * 3];
    const [zF] = pts[pts.length - 1];
    const steps = 6;
    for (let k = 0; k <= steps; k++) {
      const z = zF + ((zHinge - zF) * k) / steps;
      pts.push([z, hoodY(x, z) - (k === steps ? 0 : 0.03 * (1 - k / steps))]);
    }
    const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
    const g = new THREE.ShapeGeometry(shape);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const z = p.getX(i), y = p.getY(i); p.setXYZ(i, x + s * 0.002 * (edgeU ? -1 : 1), y, z); }
    g.computeVertexNormals();
    addMesh(parent, g, doubleSided(mats.trim));
  }

  // Lâmpada na frente
  const mid = front[Math.floor(NU / 2)];
  const width = Math.abs(front[NU][0] - front[0][0]);
  const faceTop = Math.min(...front.map((f) => f[1]));
  const faceBottom = hoodY(mid[0], mid[2]);
  const height = Math.max(0.05, faceTop - faceBottom);
  const cy = faceBottom + height * 0.5;
  const cz = Math.max(...front.map((f) => f[2])) + 0.004;
  const center = [mid[0], cy, cz];
  if (lamp === 'rect') {
    const lw = width * 0.9, lh = Math.min(height * 0.78, 0.13);
    const bezel = roundedRectShape(lw + 0.02, lh + 0.02, 0.018);
    bezel.holes.push(roundedRectShape(lw, lh, 0.012));
    addMesh(detail, extrude(bezel, 0.012, 0.003, 6), mats.chrome, { pos: [center[0], cy, cz + 0.002] });
    addMesh(detail, flat(roundedRectShape(lw, lh, 0.012)), mats.cavity, { pos: [center[0], cy, cz - 0.02] });
    for (const k of [-1, 1]) reflectorLamp(detail, mats, { r: Math.min(lh * 0.46, lw * 0.22), depth: 0.04, pos: [center[0] + k * lw * 0.25, cy, cz - 0.004] });
    addMesh(detail, flat(roundedRectShape(lw, lh, 0.012)), mats.lensClear, { pos: [center[0], cy, cz + 0.006], order: 1 });
  } else if (lamp === 'twin') {
    const r = Math.min(height * 0.36, width * 0.2);
    for (const k of [-1, 1]) {
      addMesh(detail, new THREE.TorusGeometry(r * 1.08, 0.008, 6, 24), mats.chrome, { pos: [center[0] + k * width * 0.24, cy, cz + 0.002] });
      reflectorLamp(detail, mats, { r, depth: 0.04, pos: [center[0] + k * width * 0.24, cy, cz] });
    }
  } else {
    const r = Math.min(height * 0.36, width * 0.34);
    addMesh(detail, new THREE.TorusGeometry(r * 1.1, 0.01, 6, 28), mats.chrome, { pos: [center[0], cy, cz + 0.002] });
    reflectorLamp(detail, mats, { r, depth: 0.05, pos: [center[0], cy, cz] });
  }
  breakable(ctx, s > 0 ? 'farol-esq' : 'farol-dir', unit, { hp: 2.2 });
  return [center[0], cy, cz + 0.02];
}
