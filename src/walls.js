// Colisão carro x paredes laterais da pista, com impulso de corpo rígido 2D
// (restituição + atrito de raspagem). As paredes ficam a ±WALL_OFFSET do eixo da pista.
import { paramsOf } from './physics.js';
import { nearestIndex, lateralOffset, WALL_OFFSET } from './track.js';

export const CAR_HALF_LENGTH = 2.3;
export const CAR_HALF_WIDTH = 0.93;
// Ajustável pelo painel de debug.
export const WALL = { restitution: 0.25, friction: 0.45 };

// Pontos de contato no referencial do carro [lateral (+esq), longitudinal (+frente)].
const PROBES = [
  [CAR_HALF_WIDTH, CAR_HALF_LENGTH], [-CAR_HALF_WIDTH, CAR_HALF_LENGTH],
  [CAR_HALF_WIDTH, -CAR_HALF_LENGTH], [-CAR_HALF_WIDTH, -CAR_HALF_LENGTH],
  [CAR_HALF_WIDTH, 0], [-CAR_HALF_WIDTH, 0], [0, CAR_HALF_LENGTH], [0, -CAR_HALF_LENGTH],
  [CAR_HALF_WIDTH, 1.2], [-CAR_HALF_WIDTH, 1.2], [CAR_HALF_WIDTH, -1.2], [-CAR_HALF_WIDTH, -1.2],
];

// Resolve penetração e aplica impulsos. Devolve a maior velocidade de impacto (m/s) e onde foi, ou null.
export function collideWalls(c, track, idx) {
  const { mass: m, inertia: I } = paramsOf(c);
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
  const lx = fz, lz = -fx;
  let hit = null;

  for (const [ox, oz] of PROBES) {
    const rx = lx * ox + fx * oz, rz = lz * ox + fz * oz; // braço do CG ao ponto (mundo)
    const px = c.x + rx, pz = c.z + rz;
    const j = nearestIndex(track, px, pz, idx, 8);
    const lat = lateralOffset(track, j, px, pz);
    const depth = Math.abs(lat) - WALL_OFFSET;
    if (depth <= 0) continue;

    // Normal da parede apontando para dentro da pista.
    const s = -Math.sign(lat);
    const h = wallImpulse(c, m, I, rx, rz, track.nx[j] * s, track.nz[j] * s, depth, px, pz);
    if (h && (!hit || h.speed > hit.speed)) hit = h;
  }
  return hit;
}

// Paredes retas de um recinto retangular (estacionamento): { minX, maxX, minZ, maxZ } é a área livre por dentro.
export function collideRect(c, rect) {
  const { mass: m, inertia: I } = paramsOf(c);
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
  const lx = fz, lz = -fx;
  let hit = null;
  for (const [ox, oz] of PROBES) {
    const rx = lx * ox + fx * oz, rz = lz * ox + fz * oz;
    const px = c.x + rx, pz = c.z + rz;
    for (const [depth, nx, nz] of [[rect.minX - px, 1, 0], [px - rect.maxX, -1, 0], [rect.minZ - pz, 0, 1], [pz - rect.maxZ, 0, -1]]) {
      if (depth <= 0) continue;
      const h = wallImpulse(c, m, I, rx, rz, nx, nz, depth, px, pz);
      if (h && (!hit || h.speed > hit.speed)) hit = h;
    }
  }
  return hit;
}

// Um ponto do carro (braço rx, rz a partir do CG) entrou depth metros numa parede de normal (nx, nz), que aponta
// para o lado livre: tira o carro de dentro e aplica o impulso da batida. Devolve o impacto ou null.
function wallImpulse(c, m, I, rx, rz, nx, nz, depth, px, pz) {
  // Tira o carro de dentro da parede.
  c.x += nx * depth;
  c.z += nz * depth;

  // Velocidade do ponto de contato: v + ω × r (ω em torno de +Y).
  const vpx = c.vx + c.r * rz, vpz = c.vz - c.r * rx;
  const vn = vpx * nx + vpz * nz;
  if (vn >= 0) return null; // já se afastando

  const rn = rz * nx - rx * nz; // (r × n)_y
  // Lataria absorve: quanto mais forte a batida, menos o carro quica (a energia vai para o amassado).
  const e = WALL.restitution * Math.max(0.25, 1 - Math.max(0, -vn - 4) / 14);
  const jn = -(1 + e) * vn / (1 / m + (rn * rn) / I);
  c.vx += (jn * nx) / m;
  c.vz += (jn * nz) / m;
  c.r += (jn * rn) / I;

  // Atrito tangencial (raspar na parede freia e gira o carro).
  const tx = -nz, tz = nx;
  const vt = (c.vx + c.r * rz) * tx + (c.vz - c.r * rx) * tz;
  const rt = rz * tx - rx * tz;
  let jt = -vt / (1 / m + (rt * rt) / I);
  jt = Math.max(-WALL.friction * jn, Math.min(WALL.friction * jn, jt));
  c.vx += (jt * tx) / m;
  c.vz += (jt * tz) / m;
  c.r += (jt * rt) / I;

  return { speed: -vn, x: px, z: pz, nx, nz };
}
