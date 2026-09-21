// Cones do estacionamento de treino: ficam de pé onde foram postos e voam quando o carro passa por cima.
// Cada cone é um ponto com velocidade e uma inclinação (0 = de pé, π/2 = deitado); todos são desenhados por
// uma única InstancedMesh. O choque só mexe no cone: 1 kg contra 1.200 kg não muda nada no carro.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAR_HALF_LENGTH, CAR_HALF_WIDTH } from './walls.js';

export const CONE_RADIUS = 0.2; // raio da base (m), usado na colisão
const HEIGHT = 0.7;
const GRAVITY = 9.81;

// Corpo laranja com a faixa refletiva branca e a base preta quadrada, numa geometria só com cor por vértice.
function coneGeometry() {
  const parts = [];
  const paint = (geo, hex) => {
    const c = new THREE.Color(hex);
    const colors = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo.index ? geo.toNonIndexed() : geo;
  };
  const band = (y0, y1, hex) => {
    const r0 = 0.16 - (y0 / HEIGHT) * 0.13, r1 = 0.16 - (y1 / HEIGHT) * 0.13;
    const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, 14, 1, true);
    g.translate(0, (y0 + y1) / 2, 0);
    parts.push(paint(g, hex));
  };
  band(0.04, 0.3, 0xff5a0a);
  band(0.3, 0.44, 0xf2f2ec);
  band(0.44, HEIGHT, 0xff5a0a);
  const tip = new THREE.CircleGeometry(0.03, 10);
  tip.rotateX(-Math.PI / 2);
  tip.translate(0, HEIGHT, 0);
  parts.push(paint(tip, 0xff5a0a));
  const base = new THREE.BoxGeometry(0.4, 0.04, 0.4);
  base.translate(0, 0.02, 0);
  parts.push(paint(base, 0x1a1a1a));
  return mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g; }));
}

// bounds: { minX, maxX, minZ, maxZ } do recinto: cone que voa bate na mureta e volta (não atravessa).
export class Cones {
  constructor(parent, layout = [], bounds = null) {
    this.layout = layout;
    this.bounds = bounds;
    this.mesh = new THREE.InstancedMesh(coneGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), Math.max(1, layout.length));
    this.mesh.frustumCulled = false; // espalhados pelo pátio inteiro: a caixa da malha não acompanha as instâncias
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    parent.add(this.mesh);
    this.cones = layout.map(() => ({}));
    this.tmp = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), axis: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
    this.knocked = 0;
    this.reset();
  }

  // Todos de pé de novo, no lugar marcado.
  reset() {
    this.layout.forEach((spot, i) => {
      Object.assign(this.cones[i], {
        x: spot.x, z: spot.z, y: 0, vx: 0, vz: 0, vy: 0,
        yaw: spot.yaw ?? (i * 2.4) % (Math.PI * 2), spin: 0,
        tilt: 0, tiltV: 0, fallX: 1, fallZ: 0, moving: false, down: false,
      });
    });
    this.knocked = 0;
    this.dirty = true;
    this.update(0);
  }

  // Cones que o carro atravessou neste passo. Devolve o toque mais forte { speed, x, z } ou null.
  collide(c) {
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), lx = fz, lz = -fx;
    const reach = CAR_HALF_LENGTH + 1;
    let hit = null;
    for (const k of this.cones) {
      const dx = k.x - c.x, dz = k.z - c.z;
      if (Math.abs(dx) > reach || Math.abs(dz) > reach || k.y > 0.6) continue;
      const lat = dx * lx + dz * lz, lon = dx * fx + dz * fz;
      const pl = CAR_HALF_WIDTH + CONE_RADIUS - Math.abs(lat), pf = CAR_HALF_LENGTH + CONE_RADIUS - Math.abs(lon);
      if (pl <= 0 || pf <= 0) continue;
      // Sai pelo lado mais raso (pela lateral ou pela frente/traseira do carro).
      let nx, nz, depth;
      if (pl < pf) { const s = Math.sign(lat) || 1; nx = lx * s; nz = lz * s; depth = pl; } else { const s = Math.sign(lon) || 1; nx = fx * s; nz = fz * s; depth = pf; }
      // Velocidade do carro no ponto do toque (v + ω × r)
      const vpx = c.vx + c.r * dz, vpz = c.vz - c.r * dx;
      const vn = vpx * nx + vpz * nz - (k.vx * nx + k.vz * nz);
      k.x += nx * depth;
      k.z += nz * depth;
      if (vn <= 0.05) continue;
      // Arrastado junto e jogado para fora; forte, sobe e tomba no sentido em que foi empurrado.
      // Um pouco espalhado para os lados: o para-choque não é reto e o cone escorrega na borda.
      const kick = 1.15 + Math.random() * 0.35, scatter = (Math.random() - 0.5) * vn * 0.5;
      k.vx = vpx * 0.55 + nx * vn * kick - nz * scatter;
      k.vz = vpz * 0.55 + nz * vn * kick + nx * scatter;
      if (vn > 2) {
        k.vy = Math.max(k.vy, Math.min(5, 0.6 + vn * 0.2) * (0.7 + Math.random() * 0.5));
        k.spin = (Math.random() - 0.5) * vn * 1.6;
        k.tiltV = Math.max(k.tiltV, 3 + vn * 0.9);
        const l = Math.hypot(k.vx, k.vz) || 1;
        k.fallX = k.vx / l; k.fallZ = k.vz / l;
        if (!k.down) { k.down = true; this.knocked++; }
      } else k.tiltV = Math.max(k.tiltV, vn * 1.5); // raspão: só balança
      k.moving = true;
      if (!hit || vn > hit.speed) hit = { speed: vn, x: k.x, z: k.z };
    }
    return hit;
  }

  // Menor distância da lateral do carro a um cone de pé (para o bônus de passar rente).
  nearest(c) {
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), lx = fz, lz = -fx;
    let best = Infinity;
    for (const k of this.cones) {
      if (k.down) continue;
      const dx = k.x - c.x, dz = k.z - c.z;
      if (Math.abs(dx) > 8 || Math.abs(dz) > 8) continue;
      const lat = Math.abs(dx * lx + dz * lz) - CAR_HALF_WIDTH, lon = Math.abs(dx * fx + dz * fz) - CAR_HALF_LENGTH;
      best = Math.min(best, Math.hypot(Math.max(0, lat), Math.max(0, lon)) - CONE_RADIUS);
    }
    return best;
  }

  update(dt) {
    const { m, q, q2, p, s, axis, up } = this.tmp;
    let changed = this.dirty;
    this.dirty = false;
    this.cones.forEach((k, i) => {
      if (k.moving && dt > 0) {
        k.vy -= GRAVITY * dt;
        k.x += k.vx * dt; k.z += k.vz * dt; k.y += k.vy * dt;
        k.yaw += k.spin * dt;
        k.tilt += k.tiltV * dt;
        if (k.down) {
          // Tombado: no ar gira solto; no chão assenta deitado para o lado mais perto (π/2 + kπ).
          if (k.y <= 0.02) {
            const rest = Math.round((k.tilt - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2;
            k.tilt += (rest - k.tilt) * Math.min(1, dt * 14);
            k.tiltV *= Math.exp(-dt * 12);
          }
        } else {
          // De pé: mola de volta à vertical (balanço de um cone de borracha).
          k.tiltV += (-k.tilt * 60 - k.tiltV * 5) * dt;
        }
        const b = this.bounds;
        if (b && k.y < 1.2) {
          const r = CONE_RADIUS;
          if (k.x < b.minX + r) { k.x = b.minX + r; k.vx = Math.abs(k.vx) * 0.35; }
          if (k.x > b.maxX - r) { k.x = b.maxX - r; k.vx = -Math.abs(k.vx) * 0.35; }
          if (k.z < b.minZ + r) { k.z = b.minZ + r; k.vz = Math.abs(k.vz) * 0.35; }
          if (k.z > b.maxZ - r) { k.z = b.maxZ - r; k.vz = -Math.abs(k.vz) * 0.35; }
        }
        if (k.y <= 0) {
          k.y = 0;
          if (k.vy < -1) k.vy = -k.vy * 0.3; else k.vy = 0;
          const f = Math.exp(-dt * (k.down ? 3.5 : 6)); // deitado desliza e rola mais longe
          k.vx *= f; k.vz *= f; k.spin *= Math.exp(-dt * 3);
        }
        const resting = k.down ? Math.abs(Math.cos(k.tilt)) < 0.01 : Math.abs(k.tilt) < 0.01;
        if (k.y === 0 && Math.hypot(k.vx, k.vz) < 0.05 && Math.abs(k.tiltV) < 0.05 && resting) {
          k.vx = k.vz = k.vy = k.spin = k.tiltV = 0;
          if (!k.down) k.tilt = 0;
          k.moving = false;
        }
        changed = true;
      }
      if (!changed) return;
      // Inclina em torno do eixo horizontal perpendicular à queda, com o pé do cone como pivô.
      axis.set(k.fallZ, 0, -k.fallX);
      q.setFromAxisAngle(axis, k.tilt).multiply(q2.setFromAxisAngle(up, k.yaw));
      const lift = Math.abs(Math.sin(k.tilt)) * 0.16;
      p.set(k.x, k.y + lift + 0.005, k.z);
      m.compose(p, q, s);
      this.mesh.setMatrixAt(i, m);
    });
    if (changed) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
