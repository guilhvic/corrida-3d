// Colisão carro x carro: cada carro é aproximado por três círculos ao longo do comprimento,
// com impulso de corpo rígido 2D (mesma ideia da parede). Módulo puro (sem three.js).
import { paramsOf } from './physics.js';

const OFFSETS = [1.45, 0, -1.45];  // m ao longo do carro (frente +)
const RADIUS = 0.95;
const RESTITUTION = 0.2;
const FRICTION = 0.3;

// Devolve os contatos do passo: [{ a, b, speed, x, z }] (a/b = índices em cars).
export function collideCars(cars) {
  const contacts = [];
  for (let a = 0; a < cars.length; a++) {
    for (let b = a + 1; b < cars.length; b++) {
      const A = cars[a], B = cars[b];
      if ((A.x - B.x) ** 2 + (A.z - B.z) ** 2 > 36) continue;
      const PA = paramsOf(A), PB = paramsOf(B);
      const fa = [Math.sin(A.yaw), Math.cos(A.yaw)], fb = [Math.sin(B.yaw), Math.cos(B.yaw)];
      let contact = null;
      for (const oa of OFFSETS) {
        for (const ob of OFFSETS) {
          const ax = A.x + fa[0] * oa, az = A.z + fa[1] * oa;
          const bx = B.x + fb[0] * ob, bz = B.z + fb[1] * ob;
          const dx = ax - bx, dz = az - bz;
          const dist = Math.hypot(dx, dz);
          const depth = RADIUS * 2 - dist;
          if (depth <= 0 || dist < 1e-4) continue;
          if (!contact || depth > contact.depth) contact = { depth, nx: dx / dist, nz: dz / dist, px: (ax + bx) / 2, pz: (az + bz) / 2 };
        }
      }
      if (!contact) continue;
      const { nx, nz, px, pz, depth } = contact;

      // Separa metade para cada lado.
      A.x += nx * depth * 0.5; A.z += nz * depth * 0.5;
      B.x -= nx * depth * 0.5; B.z -= nz * depth * 0.5;

      const rax = px - A.x, raz = pz - A.z, rbx = px - B.x, rbz = pz - B.z;
      const vax = A.vx + A.r * raz, vaz = A.vz - A.r * rax;
      const vbx = B.vx + B.r * rbz, vbz = B.vz - B.r * rbx;
      const vn = (vax - vbx) * nx + (vaz - vbz) * nz;
      if (vn >= 0) continue;

      const rna = raz * nx - rax * nz, rnb = rbz * nx - rbx * nz;
      const jn = (-(1 + RESTITUTION) * vn) / (1 / PA.mass + 1 / PB.mass + (rna * rna) / PA.inertia + (rnb * rnb) / PB.inertia);
      A.vx += (jn * nx) / PA.mass; A.vz += (jn * nz) / PA.mass; A.r += (jn * rna) / PA.inertia;
      B.vx -= (jn * nx) / PB.mass; B.vz -= (jn * nz) / PB.mass; B.r -= (jn * rnb) / PB.inertia;

      // Atrito tangencial (raspão entre os carros)
      const tx = -nz, tz = nx;
      const vt = (A.vx + A.r * raz - (B.vx + B.r * rbz)) * tx + (A.vz - A.r * rax - (B.vz - B.r * rbx)) * tz;
      const rta = raz * tx - rax * tz, rtb = rbz * tx - rbx * tz;
      let jt = -vt / (1 / PA.mass + 1 / PB.mass + (rta * rta) / PA.inertia + (rtb * rtb) / PB.inertia);
      jt = Math.max(-FRICTION * jn, Math.min(FRICTION * jn, jt));
      A.vx += (jt * tx) / PA.mass; A.vz += (jt * tz) / PA.mass; A.r += (jt * rta) / PA.inertia;
      B.vx -= (jt * tx) / PB.mass; B.vz -= (jt * tz) / PB.mass; B.r -= (jt * rtb) / PB.inertia;

      contacts.push({ a, b, speed: -vn, x: px, z: pz, nx, nz });
    }
  }
  return contacts;
}
