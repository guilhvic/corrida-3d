// Rodas dos carros: pneu com ombro e lateral abaulada (textura com banda de rodagem e letreiro em relevo),
// aro em várias peças (tala, aba polida, raios côncavos extrudados, cubo, porcas) e freio (disco ventilado
// com furos e pinça). Geometrias em cache por estilo/lado/tamanho: vários carros compartilham.
// Referencial da roda: eixo em X; side = +1 roda esquerda (face externa para +X), -1 direita.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const cache = new Map();
const shared = (key, make) => {
  if (!cache.has(key)) {
    const g = make();
    g.userData.shared = true;
    cache.set(key, g);
  }
  return cache.get(key);
};

// Lathe em volta do eixo X a partir de pontos [raio, x]; v da UV proporcional ao comprimento do perfil.
function latheX(points, segments, side = 1) {
  const pts = points.map(([r, x]) => new THREE.Vector2(r, x * side));
  if (side < 0) pts.reverse();
  const g = new THREE.LatheGeometry(pts, segments);
  // Lathe gira em torno de Y: Y vira +X
  g.rotateZ(-Math.PI / 2);
  const uv = g.attributes.uv;
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = acc[acc.length - 1] || 1;
  const n = pts.length;
  for (let i = 0; i < uv.count; i++) {
    const j = i % n;
    uv.setY(i, acc[j] / total);
  }
  return g;
}

// --- Pneu ------------------------------------------------------------------------------------------
function tireProfile(R, rr, W) {
  const h = R - rr;
  const half = W / 2;
  const p = [
    [rr + 0.01, -half + 0.022], [rr + 0.022, -half + 0.002], [rr + h * 0.35, -half - 0.009], [rr + h * 0.65, -half - 0.01],
    [R - 0.022, -half - 0.002], [R - 0.008, -half + 0.012], [R - 0.001, -half + 0.03],
  ];
  // banda de rodagem com 3 sulcos
  const grooves = [-0.3, 0, 0.3];
  const tread = [[R, -half + 0.035]];
  for (const gx of grooves) {
    const x = gx * half;
    tread.push([R, x - 0.012], [R - 0.009, x - 0.008], [R - 0.009, x + 0.008], [R, x + 0.012]);
  }
  tread.push([R, half - 0.035]);
  const mirror = p.slice().reverse().map(([r, x]) => [r, -x]);
  return [...p, ...tread, ...mirror];
}

function tireTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const ctx = c.getContext('2d');
  const H = c.height, W = c.width;
  ctx.fillStyle = '#1b1b1c'; ctx.fillRect(0, 0, W, H);
  // Faixas: lateral (0..0.36), banda (0.36..0.64), lateral (0.64..1)
  const tread0 = H * 0.37, tread1 = H * 0.63;
  ctx.fillStyle = '#141415'; ctx.fillRect(0, tread0, W, tread1 - tread0);
  // Blocos da banda de rodagem (diagonais nos ombros)
  ctx.fillStyle = '#0b0b0c';
  for (let x = 0; x < W; x += 12) {
    ctx.beginPath(); ctx.moveTo(x, tread0); ctx.lineTo(x + 5, tread0); ctx.lineTo(x + 9, tread0 + 9); ctx.lineTo(x + 4, tread0 + 9); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 6, tread1); ctx.lineTo(x + 11, tread1); ctx.lineTo(x + 7, tread1 - 9); ctx.lineTo(x + 2, tread1 - 9); ctx.fill();
  }
  for (let x = 0; x < W; x += 24) ctx.fillRect(x, H * 0.47, 2, H * 0.06);
  // Lateral: frisos concêntricos e letreiro em relevo (cinza claro, levemente gasto)
  ctx.fillStyle = '#242426';
  ctx.fillRect(0, H * 0.06, W, 2); ctx.fillRect(0, H * 0.94 - 2, W, 2);
  ctx.textBaseline = 'middle';
  const writeBand = (y, flip) => {
    ctx.save();
    ctx.translate(0, y);
    if (flip) ctx.scale(1, -1);
    ctx.font = '900 21px "Arial Black", Arial, sans-serif';
    ctx.fillStyle = '#5d5e62';
    ctx.textAlign = 'center';
    ctx.fillText('ZETA', W * 0.25, 0);
    ctx.fillText('ZETA', W * 0.75, 0);
    ctx.font = '700 12px Arial, sans-serif';
    ctx.fillStyle = '#434447';
    ctx.fillText('DRIFT SPEC  RADIAL', W * 0.5, 0);
    ctx.fillText('205/55R16 87V', W * 0.0 + 70, 0);
    ctx.fillText('TUBELESS  TREADWEAR 200', W - 110, 0);
    ctx.restore();
  };
  writeBand(H * 0.2, false);
  writeBand(H * 0.8, true);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// --- Aro -------------------------------------------------------------------------------------------
// Raio extrudado: forma no plano (r, w) com espessura; dobrado para o prato côncavo e girado para o ângulo.
function spokeGeometry({ r0, r1, w0, w1, thick, dishIn, dishOut, faceX, tip = 0, angle, side, bevel = 0.004 }) {
  const shape = new THREE.Shape();
  const steps = 10;
  const half = (r) => { const t = (r - r0) / (r1 - r0); return (w0 + (w1 - w0) * t) / 2 + tip * Math.sin(Math.PI * t) * 0.01; };
  shape.moveTo(r0, -half(r0));
  for (let i = 1; i <= steps; i++) { const r = r0 + ((r1 - r0) * i) / steps; shape.lineTo(r, -half(r)); }
  for (let i = steps; i >= 0; i--) { const r = r0 + ((r1 - r0) * i) / steps; shape.lineTo(r, half(r)); }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  const p = g.attributes.position;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  for (let i = 0; i < p.count; i++) {
    const r = p.getX(i), w = p.getY(i), d = p.getZ(i);
    const t = THREE.MathUtils.clamp((r - r0) / (r1 - r0), 0, 1);
    // Prato: perto do cubo o raio fica mais para dentro (côncavo); na borda sobe até a aba.
    const x = faceX - dishIn * (1 - t) * (1 - t) + dishOut * t - d;
    const rr = Math.hypot(r, w), a = Math.atan2(w, r);
    p.setXYZ(i, side * x, rr * Math.cos(a + angle), rr * Math.sin(a + angle));
  }
  if (side < 0) {
    const idx = g.index ? g.index.array : null;
    if (idx) for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
    else {
      const arr = p.array;
      for (let k = 0; k < arr.length; k += 9) {
        for (let c = 0; c < 3; c++) { const tmp = arr[k + 3 + c]; arr[k + 3 + c] = arr[k + 6 + c]; arr[k + 6 + c] = tmp; }
      }
      const uv = g.attributes.uv.array;
      for (let k = 0; k < uv.length; k += 6) {
        for (let c = 0; c < 2; c++) { const tmp = uv[k + 2 + c]; uv[k + 2 + c] = uv[k + 4 + c]; uv[k + 4 + c] = tmp; }
      }
    }
  }
  g.computeVertexNormals();
  void ca; void sa;
  return g;
}

const STYLES = {
  // TE37: 6 raios retos engrossando para fora, bem côncavos
  six: { spokes: 6, w0: 0.034, w1: 0.05, thick: 0.03, dishIn: 0.045, pairs: 0 },
  // 5 raios largos (original do S15)
  five: { spokes: 5, w0: 0.05, w1: 0.075, thick: 0.026, dishIn: 0.022, pairs: 0 },
  // malha: 10 raios finos + anel
  mesh: { spokes: 10, w0: 0.014, w1: 0.018, thick: 0.02, dishIn: 0.018, ring: true },
  // 8 raios finos (Minilite)
  eight: { spokes: 8, w0: 0.022, w1: 0.032, thick: 0.024, dishIn: 0.03 },
  // disco fechado com 6 furos ovais
  disc: { disc: true, holes: 6, dishIn: 0.012 },
  // 5 pares de raios finos
  twin: { spokes: 10, pairs: 0.14, w0: 0.016, w1: 0.022, thick: 0.024, dishIn: 0.04 },
};

export function rimGeometries(style, side, { rr, W }) {
  const key = `${style}|${side}|${rr}|${W}`;
  return shared(`rim-face|${key}`, () => {
    const S = STYLES[style] || STYLES.six;
    const lipX = W / 2 - 0.004;          // borda externa da aba
    const faceX = lipX - 0.026;          // plano do aro junto à aba
    const parts = [];
    const r0 = 0.058, r1 = rr - 0.018;
    if (S.disc) {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, r1 + 0.004, 0, Math.PI * 2, false);
      for (let i = 0; i < S.holes; i++) {
        const a = (i / S.holes) * Math.PI * 2 + 0.3;
        const hole = new THREE.Path();
        const cx = Math.cos(a) * rr * 0.62, cy = Math.sin(a) * rr * 0.62;
        hole.absellipse(cx, cy, 0.03, 0.02, 0, Math.PI * 2, true, a);
        shape.holes.push(hole);
      }
      const hub = new THREE.Path();
      hub.absarc(0, 0, 0.05, 0, Math.PI * 2, true);
      shape.holes.push(hub);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 28 });
      g.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
      g.translate(side * (faceX - 0.01), 0, 0);
      parts.push(g);
    } else {
      for (let i = 0; i < S.spokes; i++) {
        let angle = (i / S.spokes) * Math.PI * 2;
        if (S.pairs) angle = (Math.floor(i / 2) / (S.spokes / 2)) * Math.PI * 2 + (i % 2 ? S.pairs : -S.pairs);
        parts.push(spokeGeometry({ r0, r1, w0: S.w0, w1: S.w1, thick: S.thick, dishIn: S.dishIn, dishOut: 0, faceX, angle, side }));
      }
      if (S.ring) {
        const ring = new THREE.TorusGeometry(rr * 0.5, 0.007, 6, 40);
        ring.rotateY(Math.PI / 2);
        ring.translate(side * (faceX - S.dishIn * 0.3), 0, 0);
        parts.push(ring);
      }
    }
    // Cubo: disco com degrau onde os raios nascem
    const hx = faceX - S.dishIn;
    parts.push(latheX([[0.001, hx + 0.006], [0.05, hx + 0.006], [0.058, hx + 0.001], [0.074, hx - 0.004], [0.08, hx - 0.03]], 28, side));
    // Anel externo do aro (onde os raios apoiam) com a borda da aba
    parts.push(latheX([[rr - 0.036, faceX - 0.03], [rr - 0.034, faceX - 0.004], [rr - 0.022, faceX + 0.002], [rr - 0.004, lipX - 0.004], [rr + 0.012, lipX], [rr + 0.02, lipX - 0.006], [rr + 0.018, lipX - 0.016]], 48, side));
    return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  });
}

// Aba polida + tala (parte de dentro do aro)
export function barrelGeometry(side, { rr, W }) {
  // perfil de fora para dentro: faces viradas para o eixo (vistas por entre os raios)
  return shared(`barrel|${side}|${rr}|${W}`, () => latheX([
    [rr - 0.02, W / 2 - 0.03], [rr - 0.022, -W / 2 + 0.01], [rr - 0.03, -W / 2 + 0.03],
  ], 36, side));
}

// Aro inteiro numa geometria (raios + cubo + tala + porcas, e a aba quando é da mesma cor)
export function wheelRimGeometry(style, side, spec, withLip) {
  return shared(`rim|${style}|${side}|${spec.rr}|${spec.W}|${withLip}`, () => {
    const parts = [rimGeometries(style, side, spec), barrelGeometry(side, spec), nutsGeometry(side, { ...spec, style })];
    if (withLip) parts.push(lipGeometry(side, spec));
    return mergeGeometries(parts.map((g) => { const n = g.index ? g.toNonIndexed() : g.clone(); for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; }));
  });
}
export function lipGeometry(side, { rr, W }) {
  return shared(`lip|${side}|${rr}|${W}`, () => latheX([
    [rr - 0.022, W / 2 - 0.036], [rr - 0.02, W / 2 - 0.03], [rr - 0.004, W / 2 - 0.02], [rr + 0.004, W / 2 - 0.014],
    [rr + 0.012, W / 2 - 0.009], [rr + 0.015, W / 2 - 0.013],
  ], 40, side));
}
export function nutsGeometry(side, { rr, W, style }) {
  return shared(`nuts|${side}|${rr}|${W}|${style}`, () => {
    const S = STYLES[style] || STYLES.six;
    const faceX = W / 2 - 0.034;
    const parts = [];
    const n = 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 4;
      const nut = new THREE.CylinderGeometry(0.0085, 0.0095, 0.022, 6);
      nut.rotateZ(Math.PI / 2);
      nut.translate(side * (faceX - S.dishIn + 0.004), Math.cos(a) * 0.036, Math.sin(a) * 0.036);
      parts.push(nut);
    }
    const cap = new THREE.SphereGeometry(0.024, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1, 0.45, 1);
    cap.rotateZ(-Math.PI / 2 * side);
    cap.translate(side * (faceX - S.dishIn + 0.002), 0, 0);
    parts.push(cap);
    return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  });
}

// --- Freio -----------------------------------------------------------------------------------------
export function rotorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  g.addColorStop(0, '#2a2a2c'); g.addColorStop(0.42, '#2a2a2c'); g.addColorStop(0.44, '#8d8f93'); g.addColorStop(0.7, '#a3a5a8'); g.addColorStop(0.98, '#7d7f83'); g.addColorStop(1, '#3a3a3c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  // riscos concêntricos de uso
  ctx.strokeStyle = 'rgba(40,40,44,0.35)';
  for (let r = 60; r < 126; r += 3) { ctx.beginPath(); ctx.arc(128, 128, r, 0, Math.PI * 2); ctx.stroke(); }
  // furos em espiral e rasgos
  ctx.fillStyle = '#161618';
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const r = 70 + (i % 3) * 16;
    ctx.beginPath(); ctx.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 3.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#1c1c1e'; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.2;
    ctx.beginPath(); ctx.arc(128, 128, 98, a, a + 0.5); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function rotorGeometry(rr) {
  return shared(`rotor|${rr}`, () => {
    const R = rr - 0.035;
    const faceA = new THREE.CircleGeometry(R, 36);
    faceA.rotateY(Math.PI / 2); faceA.translate(0.013, 0, 0);
    const faceB = new THREE.CircleGeometry(R, 36);
    faceB.rotateY(-Math.PI / 2); faceB.translate(-0.013, 0, 0);
    // UV da face: planar
    for (const f of [faceA, faceB]) {
      const p = f.attributes.position, uv = f.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getZ(i) / (2 * R), 0.5 + p.getY(i) / (2 * R));
    }
    const edge = new THREE.CylinderGeometry(R, R, 0.026, 36, 1, true);
    edge.rotateZ(Math.PI / 2);
    const hat = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20);
    hat.rotateZ(Math.PI / 2);
    return mergeGeometries([faceA, faceB, edge, hat].map((g) => g.toNonIndexed()));
  });
}

// Pinça: setor de anel com espessura, montada atrás/acima do disco.
export function caliperGeometry(rr) {
  return shared(`caliper|${rr}`, () => {
    const rOut = rr - 0.028, rIn = rr - 0.092, span = 0.95;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, rOut, -span / 2, span / 2, false);
    shape.absarc(0, 0, rIn, span / 2, -span / 2, true);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 12 });
    g.translate(0, 0, -0.03);
    // plano do setor (x,y) → (z,y) da roda; extrusão em X
    g.rotateY(Math.PI / 2);
    return g;
  });
}

export function tireGeometry(R, rr, W) {
  return shared(`tire|${R}|${rr}|${W}`, () => latheX(tireProfile(R, rr, W), 48, 1));
}

let tireTex = null;
let rotorTex = null;
export function wheelTextures() {
  if (!tireTex) { tireTex = tireTexture(); rotorTex = rotorTexture(); }
  return { tire: tireTex, rotor: rotorTex };
}
