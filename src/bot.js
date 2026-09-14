// Piloto automático simples: pure pursuit para direção e perfil de velocidade pela curvatura.
import { CAR } from './physics.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function botInput(car, track, idx, { pace = 0.9, lateralTarget = 0 } = {}) {
  const { N, x, z, nx, nz, curv, ds } = track;
  const speed = car.speed;

  const look = Math.max(3, Math.round((5 + speed * 0.42) / ds));
  const j = (idx + look) % N;
  const tx = x[j] + nx[j] * lateralTarget, tz = z[j] + nz[j] * lateralTarget;
  const err = wrap(Math.atan2(tx - car.x, tz - car.z) - car.yaw);
  const maxSteer = CAR.maxSteerLow + (CAR.maxSteerHigh - CAR.maxSteerLow) * clamp(speed / 55, 0, 1);
  const steer = clamp((err * 1.6 - car.r * 0.08) / maxSteer, -1, 1);

  const decel = 8.5 * pace;
  let allowed = Infinity;
  const ahead = Math.round(220 / ds);
  for (let k = 0; k < ahead; k += 2) {
    const c = Math.abs(curv[(idx + k) % N]);
    const vCorner = c > 1e-4 ? Math.sqrt(CAR.mu * 9.81 * pace / c) : 90;
    const dist = k * ds;
    allowed = Math.min(allowed, Math.sqrt(vCorner * vCorner + 2 * decel * dist));
  }

  const diff = allowed - speed;
  return {
    steer,
    throttle: clamp(diff * 0.5, 0, 1),
    brake: clamp(-diff * 0.8, 0, 1),
    handbrake: 0,
  };
}
