// Marcas de pneu: buffer circular de quadriláteros no chão que ficam na pista durante a corrida.
// Mais escuras e largas quanto mais o pneu escorrega, com desenho da banda de rodagem e bordas suaves.
// Só o trecho novo do buffer sobe para a GPU a cada quadro.
import * as THREE from 'three';

const MAX = 16000;      // quadriláteros (~8 km de marca somando todas as rodas)
const WIDTH = 0.22;     // m, pneu andando reto
const SLIDE_WIDTH = 0.14; // m a mais com o pneu de lado
const SPACING = 0.5;    // m entre pontos gravados

function treadTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 64;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(32, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 32; x++) {
      const u = x / 31;
      const edge = Math.min(1, Math.min(u, 1 - u) * 5);            // bordas suaves
      const groove = (x % 8 === 3 || x % 8 === 4) ? 0.55 : 1;        // sulcos ao longo
      const block = Math.sin((y / 64) * Math.PI * 12 + (x > 15 ? 1.6 : 0)) > 0.75 ? 0.8 : 1; // blocos da banda
      const grain = 0.8 + Math.random() * 0.2;
      const i = (y * 32 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * edge * groove * block * grain);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export class SkidMarks {
  constructor(scene) {
    this.positions = new Float32Array(MAX * 6 * 3);
    this.colors = new Float32Array(MAX * 6 * 4);
    this.uvs = new Float32Array(MAX * 6 * 2);
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage);
    this.uvAttr = new THREE.BufferAttribute(this.uvs, 2).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    geo.setAttribute('uv', this.uvAttr);
    this.geo = geo;
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff, map: treadTexture(), vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
    });
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    scene.add(mesh);
    this.cursor = 0;
    this.last = new Map();
    this.wet = false;
  }

  // Chuva: marca mais fraca (água no asfalto)
  setWet(wet) {
    this.wet = wet;
    this.material.opacity = wet ? 0.45 : 1;
  }

  // side = vetor lateral unitário (lx, lz) do carro. amount 0..1: quanto o pneu escorrega. y: altura do chão.
  add(key, x, z, lx, lz, active, amount = 0.6, y = 0) {
    const prev = this.last.get(key);
    if (!active) { this.last.delete(key); return; }
    const a = Math.min(1, Math.max(0, (amount - 0.25) / 0.55));
    const alpha = 0.18 + 0.52 * a;
    const width = WIDTH + SLIDE_WIDTH * a;
    if (!prev) { this.last.set(key, { x, y, z, lx, lz, alpha: alpha * 0.3, width, v: 0 }); return; }
    const dist = Math.hypot(x - prev.x, z - prev.z);
    if (dist < SPACING) return;

    const hy = y + 0.06, py = prev.y + 0.06, v = prev.v + dist;
    const hw = width / 2, phw = prev.width / 2;
    const corners = [
      [prev.x + prev.lx * phw, py, prev.z + prev.lz * phw, prev.alpha, 0, prev.v],
      [prev.x - prev.lx * phw, py, prev.z - prev.lz * phw, prev.alpha, 1, prev.v],
      [x + lx * hw, hy, z + lz * hw, alpha, 0, v],
      [x - lx * hw, hy, z - lz * hw, alpha, 1, v],
    ];
    const o = this.cursor;
    // A orientação muda com o sentido de marcha (ré), por isso o material é DoubleSide.
    [0, 2, 1, 1, 2, 3].forEach((k, i) => {
      const [cx, cy, cz, ca, cu, cv] = corners[k];
      const p = (o * 6 + i) * 3, c = (o * 6 + i) * 4, t = (o * 6 + i) * 2;
      this.positions[p] = cx; this.positions[p + 1] = cy; this.positions[p + 2] = cz;
      this.colors[c] = this.colors[c + 1] = this.colors[c + 2] = 0.035; this.colors[c + 3] = ca;
      this.uvs[t] = cu; this.uvs[t + 1] = cv;
    });
    this.posAttr.addUpdateRange(o * 18, 18);
    this.colAttr.addUpdateRange(o * 24, 24);
    this.uvAttr.addUpdateRange(o * 12, 12);
    this.posAttr.needsUpdate = this.colAttr.needsUpdate = this.uvAttr.needsUpdate = true;
    this.cursor = (this.cursor + 1) % MAX;
    Object.assign(prev, { x, y, z, lx, lz, alpha, width, v: v % 64 });
  }

  clear() {
    this.positions.fill(0);
    this.colors.fill(0);
    for (const attr of [this.posAttr, this.colAttr, this.uvAttr]) { attr.clearUpdateRanges(); attr.needsUpdate = true; }
    this.cursor = 0;
    this.last.clear();
  }
}
