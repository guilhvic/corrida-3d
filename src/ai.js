// Piloto de IA que corre e pontua de drift. Usa o controle de ângulo do nível Fácil:
// o esterço escolhe o ângulo do carro em relação à velocidade, e a IA esterça para a
// direção da velocidade seguir a pista. Módulo puro (sem three.js); ajustado em tools/ai-lab.js.
import { paramsOf, ENV } from './physics.js';
import { ROAD_HALF_WIDTH, lateralOffset } from './track.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const AI = {
  lookBase: 6.4,        // m à frente para mirar
  lookPerSpeed: 0.5,    // s: olha mais longe quanto mais rápido
  headingGain: 3.5,     // esterço por rad de erro na direção da velocidade
  yawDamp: 0.084,       // amortecimento pela guinada
  driftCurv: 1 / 83,    // curvatura (1/m) a partir da qual a curva é feita de lado
  driftBias: 0.43,      // esterço extra para o lado da curva (segura o ângulo)
  driftThrottle: 0.635, // acelerador base no drift
  cornerPace: 0.91,     // fração da aderência usada na velocidade de curva
  decel: 6.8,           // m/s² planejados para frear antes da curva
  brakeZone: 0,         // m/s acima do permitido para começar a frear
  brakeGain: 0.36,
  predictT: 1,          // s de previsão da posição lateral
  edgeGain: 0.6,        // esterço por metro além do limite
  wetCare: 0.6,         // cautela extra na chuva (expoente sobre a perda de aderência)
  edgeMargin: 1.9,      // m de folga até o meio-fio
  topSpeed: 36,         // m/s
  followRange: 30,      // m: carros à frente considerados
  followGap: 12,         // m de distância mínima atrás de outro carro
};

export class DriftDriver {
  // skill 0..1: ritmo e precisão. lane: faixa preferida (m, + = esquerda).
  constructor(car, track, { skill = 0.8, lane = 0, seed = 1 } = {}) {
    this.car = car;
    this.track = track;
    this.skill = skill;
    this.lane = lane;
    this.laneNow = lane;
    this.seed = seed;
    this.noise = 0;
    this.noiseTimer = 0;
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
    this.stuck = 0;    // s parado querendo andar
    this.recover = 0;  // s restantes de manobra de ré
  }

  random() {
    // xorshift: cada piloto tem sua sequência, reproduzível nos testes
    let s = this.seed | 0 || 1;
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    this.seed = s;
    return ((s >>> 0) % 10000) / 10000;
  }

  // others: outros carros ({ x, z, vx, vz }) para desviar e não encostar atrás.
  update(idx, dt, others = []) {
    const { car, track } = this;
    const { N, x, z, nx, nz, curv, ds } = track;
    const P = AI;
    const speed = car.speed;
    const pace = 0.88 + 0.05 * this.skill; // ritmo de curva quase igual: mais que isso bate na mureta
    const at = (d) => (idx + Math.round(d / ds) + N) % N;

    // Tremidinha humana no esterço, pior com menos habilidade.
    this.noiseTimer -= dt;
    if (this.noiseTimer <= 0) {
      this.noiseTimer = 0.25 + this.random() * 0.35;
      this.noise = (this.random() - 0.5) * 0.1 * (1.2 - this.skill);
    }

    // Tráfego: desvia de quem está à frente e segura distância de quem está na mesma linha.
    let lane = this.lane;
    let followLimit = Infinity;
    const tx0 = track.tx[idx], tz0 = track.tz[idx];
    for (const o of others) {
      if (o === car) continue;
      const dx = o.x - car.x, dz = o.z - car.z;
      const along = dx * tx0 + dz * tz0;
      if (along < -1 || along > P.followRange) continue;
      const side = dx * nx[idx] + dz * nz[idx]; // + = à esquerda
      if (Math.abs(side) < 3) {
        if (along < 20) lane = side > 0 ? Math.min(lane, side - 3.4) : Math.max(lane, side + 3.4);
        // Só segue quem está claramente à frente: lado a lado os dois frariam um pelo outro e travariam.
        if (along > 3) {
          const otherSpeed = o.vx * tx0 + o.vz * tz0;
          const gap = along - 4.6;
          const wanted = P.followGap + speed * 0.6;
          // Carro parado ou rodado à frente: não espera, só desvia (a não ser colado nele).
          const floor = gap < 1 ? 2 : 6;
          if (gap < wanted) followLimit = Math.min(followLimit, Math.max(floor, otherSpeed + (gap - wanted * 0.6) * 0.9));
        }
      }
    }
    const laneLimit = ROAD_HALF_WIDTH - 2.5;
    this.laneNow += (clamp(lane, -laneLimit, laneLimit) - this.laneNow) * Math.min(1, dt * 1.5);

    // Curvatura logo à frente decide se a curva é feita de lado.
    let kAhead = 0;
    for (let d = 4; d <= 20; d += 2) kAhead += curv[at(d)];
    kAhead /= 9;
    const inCorner = Math.abs(kAhead) > P.driftCurv;

    const look = P.lookBase + speed * P.lookPerSpeed;
    const j = at(look);
    const lat = this.laneNow * (inCorner ? 0.3 : 1);
    const tx = x[j] + nx[j] * lat, tz = z[j] + nz[j] * lat;
    const velYaw = speed > 4 ? Math.atan2(car.vx, car.vz) : car.yaw;
    const err = wrap(Math.atan2(tx - car.x, tz - car.z) - velYaw);

    // Perfil de velocidade: curvas à frente + frenagem planejada. Na chuva a IA tira mais do que a perda de aderência.
    const wetGrip = ENV.grip ** (1 + P.wetCare);
    let allowed = P.topSpeed * pace;
    const grade = track.grade;
    for (let d = 0; d < 160; d += 4) {
      const k = at(d);
      const c = Math.abs(curv[k]);
      // Descida: a gravidade tira parte da frenagem (subida ajuda a frear)
      const decel = Math.max(2, P.decel * ENV.grip + (grade ? grade[k] * 9.81 : 0));
      const vCorner = c > 1e-4 ? Math.sqrt((paramsOf(car).mu * wetGrip * 9.81 * P.cornerPace * pace) / c) : 90;
      allowed = Math.min(allowed, Math.sqrt(vCorner * vCorner + 2 * decel * d));
    }
    allowed = Math.max(0, Math.min(allowed, followLimit));
    const diff = allowed - speed;

    let steer = err * P.headingGain - car.r * P.yawDamp;
    let throttle, brake = 0;
    if (diff < -P.brakeZone) {
      throttle = 0;
      brake = clamp(-diff * P.brakeGain, 0, 1);
    } else if (inCorner && speed > 9) {
      if (!car.driftMode) { steer = Math.sign(kAhead); throttle = 1; } // chute de entrada
      else {
        steer += Math.sign(kAhead) * P.driftBias * (0.6 + 0.4 * this.skill); // mais habilidade = mais ângulo
        throttle = clamp(P.driftThrottle * ENV.grip ** P.wetCare + diff * 0.1, 0.25, 1);
      }
    } else {
      throttle = clamp(diff * 0.5, 0, 1);
    }

    // Previsão da posição lateral: corrige antes de encostar na mureta.
    const off = lateralOffset(track, idx, car.x, car.z);
    const latVel = car.vx * nx[idx] + car.vz * nz[idx];
    const pred = off + latVel * P.predictT;
    const edge = Math.abs(pred) - (ROAD_HALF_WIDTH - P.edgeMargin);
    if (edge > 0) steer -= Math.sign(pred) * edge * P.edgeGain;

    const inp = this.input;
    // Encalhado (virado na mureta ou enroscado em outro carro): dá ré esterçando para o outro lado.
    this.stuck = speed < 1.5 && throttle > 0.3 ? this.stuck + dt : 0;
    if (this.stuck > 1.5) { this.recover = 1.4; this.stuck = 0; }
    if (this.recover > 0) {
      this.recover -= dt;
      inp.steer = -clamp(err * 2, -1, 1);
      inp.throttle = 0;
      inp.brake = 1; // parado, segurar o freio engata a ré
      inp.handbrake = 0;
      return inp;
    }
    inp.steer = clamp(steer + this.noise, -1, 1);
    inp.throttle = throttle;
    inp.brake = brake;
    inp.handbrake = 0;
    return inp;
  }
}
