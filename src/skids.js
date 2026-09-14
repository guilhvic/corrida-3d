// Marcas de pneu: buffer circular de quadriláteros no chão.
import * as THREE from 'three';

const MAX = 4000;
const WIDTH = 0.24;

export class SkidMarks {
  constructor(scene) {
    this.positions = new Float32Array(MAX * 6 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x0a0a0a, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
    }));
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    scene.add(mesh);
    this.cursor = 0;
    this.last = new Map();
  }

  // side = vetor lateral unitário (lx, lz) do carro.
  add(key, x, z, lx, lz, active) {
    const prev = this.last.get(key);
    if (!active) { this.last.delete(key); return; }
    if (!prev) { this.last.set(key, { x, z }); return; }
    if ((x - prev.x) ** 2 + (z - prev.z) ** 2 < 0.25) return;

    const hw = WIDTH / 2, y = 0.06, p = this.positions, o = this.cursor * 18;
    const v = [
      prev.x + lx * hw, y, prev.z + lz * hw,
      prev.x - lx * hw, y, prev.z - lz * hw,
      x + lx * hw, y, z + lz * hw,
      x - lx * hw, y, z - lz * hw,
    ];
    // A orientação muda com o sentido de marcha (ré), por isso o material é DoubleSide.
    const order = [0, 2, 1, 1, 2, 3];
    for (let i = 0; i < 6; i++) {
      const k = order[i] * 3;
      p[o + i * 3] = v[k]; p[o + i * 3 + 1] = v[k + 1]; p[o + i * 3 + 2] = v[k + 2];
    }
    this.cursor = (this.cursor + 1) % MAX;
    this.geo.attributes.position.needsUpdate = true;
    prev.x = x; prev.z = z;
  }

  clear() {
    this.positions.fill(0);
    this.geo.attributes.position.needsUpdate = true;
    this.last.clear();
  }
}
