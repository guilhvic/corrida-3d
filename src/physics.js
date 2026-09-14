// Modelo de veículo planar (bicicleta com duas "rodas" por eixo somadas):
// pneus com fórmula de Pacejka simplificada, círculo de atrito, transferência de carga
// longitudinal, motor com curva de torque, câmbio, freios, arrasto e downforce.
// Módulo puro (sem three.js). Convenção: frente = (sin yaw, cos yaw), esquerda = (cos yaw, -sin yaw).

// Acerto de drift: tração traseira com torque sobrando, traseira menos aderente,
// pneu que perde aderência de forma progressiva e muito ângulo de esterço.
// Clima: multiplica a aderência de todos os pisos (chuva < 1). Global, fora do CAR, para não entrar no acerto salvo.
export const ENV = { grip: 1 };

export const CAR = {
  gravity: 9.81,         // m/s²
  mass: 1250,            // kg
  inertia: 1700,         // kg·m² (yaw)
  a: 1.3,                // CG -> eixo dianteiro (m)
  b: 1.4,                // CG -> eixo traseiro (m)
  cgHeight: 0.45,
  wheelRadius: 0.33,
  mu: 1.1,               // atrito de pico no asfalto
  rearGrip: 0.95,        // traseira um pouco mais solta que a dianteira
  pacB: 16, pacC: 1.25,  // pico ~9° de deriva, ~92% da aderência deslizando (progressivo)
  torqueCurve: [[0, 220], [1000, 250], [2500, 340], [4000, 410], [5500, 430], [6500, 415], [7500, 370], [8000, 330]],
  torqueScale: 1,        // multiplica a curva de torque inteira
  idleRpm: 900,
  redline: 7800,
  gears: [3.1, 2.1, 1.55, 1.2, 1.0, 0.85],
  reverseRatio: 3.2,
  reverseMaxSpeed: 11,   // m/s (~40 km/h): corta o torque da ré acima disso
  finalDrive: 4.1,
  efficiency: 0.9,
  upshiftRpm: 7300,
  downshiftRpm: 3600,
  shiftTime: 0.14,
  brakeForce: 14000,     // N total
  brakeBias: 0.68,       // fração na dianteira
  handbrakeForce: 6000,
  tcsLimit: 0.85,        // fração da tração disponível liberada pelo controle de tração
  absLimit: 0.95,        // fração da aderência dianteira liberada pelo ABS
  absLimitRear: 0.7,     // traseira mais conservadora: estabilidade na frenagem
  dragK: 0.39,           // 0.5·rho·Cd·A
  downforceK: 0.2,
  maxSteerLow: 0.75,     // rad de esterço pedido pelo jogador em baixa velocidade
  maxSteerHigh: 0.3,     // ... e a ~160 km/h
  maxLock: 1.0,          // batente da direção (~57°)
  steerRate: 5,          // rad/s
  // Assistência de drift
  counterSteer: 0.9,     // fração do ângulo de deslize somada ao esterço (rodas apontam para onde o carro vai)
  driftAngleSoft: 0.8,   // rad (~46°): a partir daqui a assistência segura a rotação
  stabilityK: 60000,     // N·m por rad acima do limite
  stabilityDamp: 5000,   // N·m por rad/s girando para o lado que aumenta o ângulo
  // Controle de ângulo (dificuldade Fácil): o esterço escolhe o ângulo de drift e o jogo o mantém.
  easyMaxAngle: 0.7,     // rad (~40°) com esterço todo
  easyEntrySpeed: 10,    // m/s (36 km/h) para entrar de lado só esterçando + acelerando
  easyKp: 30,            // ganho do erro de ângulo (1/s²)
  easyKd: 10,            // amortecimento da variação do ângulo (1/s)
  easyMaxTorque: 30000,  // N·m
  speedHold: 1.2,        // m/s² de empurrão ao longo da velocidade para não morrer no drift
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

export function createCar(x = 0, z = 0, yaw = 0) {
  return {
    x, z, yaw, vx: 0, vz: 0, r: 0,
    // Telemetria do último passo (painel de debug): forças em N, ângulos em rad, torques em N·m.
    tel: {
      Fzf: 0, Fzr: 0, FxF: 0, FxR: 0, FyF: 0, FyR: 0, gripF: 0, gripR: 0, alphaF: 0, alphaR: 0,
      drive: 0, torque: 0, drag: 0, down: 0, Mz: 0, assistMz: 0, hold: 0, maxSteer: 0, steerTarget: 0,
    },
    steer: 0, gear: 1, rpm: CAR.idleRpm, automatic: true,
    tcs: false, abs: true, driftAssist: true, tcsActive: false, absActive: false,
    angleControl: 0, driftMode: false, prevBeta: 0, // controle de ângulo (0 = desligado, 1 = total)
    driftAngle: 0, // ângulo entre a direção do carro e a da velocidade (rad, + = velocidade à esquerda)
    shiftTimer: 0, reverseTimer: 0, reverseByBrake: false, limiter: false,
    ax: 0, ay: 0, u: 0, v: 0, speed: 0,
    slipF: 0, slipR: 0, wheelspin: 0, lockup: 0,
    throttle: 0, brake: 0, wheelSpin: 0, wheelSpinRate: 0,
  };
}

// Acerto próprio de um carro: herda de CAR tudo o que não for sobrescrito
// (ajustes do painel de debug em CAR continuam valendo para o resto).
export function setCarParams(c, overrides = {}) {
  c.params = Object.assign(Object.create(CAR), overrides);
  return c.params;
}

export const paramsOf = (c) => c.params || CAR;

export function resetCar(c, x, z, yaw) {
  Object.assign(c, { x, z, yaw, vx: 0, vz: 0, r: 0, steer: 0, gear: 1, rpm: CAR.idleRpm, ax: 0, ay: 0, shiftTimer: 0, driftMode: false, prevBeta: 0, reverseByBrake: false, reverseTimer: 0 });
}

function gearRatio(gear, P = CAR) {
  if (gear > 0) return P.gears[gear - 1] * P.finalDrive;
  if (gear < 0) return -P.reverseRatio * P.finalDrive;
  return 0;
}

function engineTorque(rpm, P = CAR) {
  const t = P.torqueCurve;
  if (rpm <= t[0][0]) return t[0][1] * P.torqueScale;
  for (let i = 1; i < t.length; i++) {
    if (rpm <= t[i][0]) {
      const [r0, v0] = t[i - 1], [r1, v1] = t[i];
      return lerp(v0, v1, (rpm - r0) / (r1 - r0)) * P.torqueScale;
    }
  }
  return t[t.length - 1][1] * P.torqueScale;
}

const pacejka = (alpha, P) => Math.sin(P.pacC * Math.atan(P.pacB * alpha));

// Troca manual (Q/E). Devolve true se a marcha mudou.
export function shift(c, dir) {
  const P = paramsOf(c);
  const target = clamp(c.gear + dir, -1, P.gears.length);
  if (target === c.gear) return false;
  if (target === -1 && c.u > 2) return false;
  if (target > 0 && dir < 0) {
    const rpm = Math.abs(c.u / P.wheelRadius * gearRatio(target, P)) * 60 / (2 * Math.PI);
    if (rpm > P.redline * 1.03) return false; // protege o motor
  }
  c.gear = target;
  c.reverseByBrake = false;
  c.shiftTimer = P.shiftTime;
  return true;
}

// surfF/surfR: { grip, roll } sob o eixo dianteiro/traseiro.
export function stepCar(c, input, dt, surfF, surfR) {
  const P = paramsOf(c), m = P.mass, L = P.a + P.b, G = P.gravity;
  const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
  const u = c.vx * sy + c.vz * cy;       // velocidade longitudinal
  const v = c.vx * cy - c.vz * sy;       // velocidade lateral (+ = esquerda)
  const speed = Math.hypot(c.vx, c.vz);

  // --- Ré -----------------------------------------------------------------------------
  // Em qualquer câmbio: parado, segurar o freio engata a ré e o freio vira o "acelerador" dela;
  // parado de ré, acelerar volta para a 1ª. Ré engatada pela troca manual (Q/LB) usa os pedais normais.
  let throttle = input.throttle, brake = input.brake;
  const stopped = Math.abs(u) < 0.8;
  if (c.gear >= 0 && stopped && input.brake > 0.1 && input.throttle < 0.05) {
    c.reverseTimer += dt;
    if (c.reverseTimer > 0.35) { c.gear = -1; c.reverseByBrake = true; c.reverseTimer = 0; }
  } else if (c.gear === -1 && c.reverseByBrake && stopped && input.throttle > 0.1 && input.brake < 0.05) {
    c.gear = 1; c.reverseByBrake = false; c.reverseTimer = 0;
  } else c.reverseTimer = 0;
  if (c.gear === -1 && c.reverseByBrake) [throttle, brake] = [brake, throttle];
  if (c.automatic && c.gear === 0) c.gear = 1;

  // --- Direção ------------------------------------------------------------------
  const maxSteer = lerp(P.maxSteerLow, P.maxSteerHigh, clamp(speed / 45, 0, 1));
  const beta = u > 0.5 ? Math.atan2(v, u) : 0;
  let steerTarget = input.steer * maxSteer;
  // Contra-esterço automático: com o carro de lado, as rodas já apontam para a direção da velocidade
  // e o jogador esterça em relação a ela (é o que torna o drift controlável no teclado).
  if (c.driftAssist) steerTarget += P.counterSteer * beta * clamp((speed - 3) / 6, 0, 1);
  steerTarget = clamp(steerTarget, -P.maxLock, P.maxLock);
  const ds = P.steerRate * dt;
  c.steer += clamp(steerTarget - c.steer, -ds, ds);

  // --- Motor ----------------------------------------------------------------------
  const ratio = gearRatio(c.gear, P);
  const wheelRpm = Math.abs(u / P.wheelRadius) * 60 / (2 * Math.PI);
  let rpmTarget;
  if (ratio === 0) {
    rpmTarget = P.idleRpm + throttle * (P.redline - P.idleRpm);
  } else {
    rpmTarget = Math.max(wheelRpm * Math.abs(ratio), P.idleRpm);
    // Embreagem patinando na saída: o motor não cai abaixo de uma rotação de arrancada.
    if (Math.abs(u) < 8) rpmTarget = Math.max(rpmTarget, P.idleRpm + throttle * 2800);
  }
  c.rpm += (rpmTarget - c.rpm) * Math.min(1, dt * 18);
  c.limiter = c.rpm >= P.redline;

  if (c.shiftTimer > 0) c.shiftTimer -= dt;
  if (c.automatic && c.gear >= 1 && c.shiftTimer <= 0) {
    if (c.rpm > P.upshiftRpm && c.gear < P.gears.length && throttle > 0.2) {
      c.gear++; c.shiftTimer = P.shiftTime;
    } else if (c.gear > 1 && c.rpm < P.downshiftRpm &&
      c.rpm * P.gears[c.gear - 2] / P.gears[c.gear - 1] < P.upshiftRpm - 800) {
      c.gear--; c.shiftTimer = P.shiftTime * 0.7;
    }
  }

  let driveForce = 0;
  if (ratio !== 0 && c.shiftTimer <= 0) {
    const reverseLimited = c.gear === -1 && -u > P.reverseMaxSpeed;
    const torque = c.limiter || reverseLimited ? 0 : throttle * engineTorque(c.rpm, P);
    driveForce = torque * ratio * P.efficiency / P.wheelRadius;
    if (throttle < 0.05) {
      const engineBrake = (25 + c.rpm * 0.005) * Math.abs(ratio) * P.efficiency / P.wheelRadius;
      driveForce -= Math.sign(u) * engineBrake * clamp(Math.abs(u) / 3, 0, 1) * 0.7;
    }
  }

  // --- Cargas verticais ------------------------------------------------------------
  const down = P.downforceK * u * u;
  const transfer = m * c.ax * P.cgHeight / L;
  const Fzf = Math.max(800, m * G * P.b / L + down * 0.45 - transfer);
  const Fzr = Math.max(800, m * G * P.a / L + down * 0.55 + transfer);
  const muF = P.mu * surfF.grip * ENV.grip, muR = P.mu * P.rearGrip * surfR.grip * ENV.grip;

  // --- Ângulos de deriva ------------------------------------------------------------------
  const cs = Math.cos(c.steer), sn = Math.sin(c.steer);
  const vyF = v + P.a * c.r, vyR = v - P.b * c.r;
  const uF = u * cs + vyF * sn, vF = vyF * cs - u * sn;
  const alphaF = Math.atan2(vF, Math.max(Math.abs(uF), 3));
  const alphaR = Math.atan2(vyR, Math.max(Math.abs(u), 3));

  const FxFmax = muF * Fzf, FxRmax = muR * Fzr;
  // Força longitudinal que ainda cabe no círculo de atrito depois da lateral pedida pelo pneu.
  const room = (max, alpha) => max * Math.sqrt(Math.max(0, 1 - pacejka(alpha, P) ** 2));

  // --- Controle de tração: corta torque antes de a traseira perder aderência ----------------
  c.tcsActive = false;
  if (c.tcs && throttle > 0.05 && driveForce * Math.sign(ratio) > 0) {
    const limit = room(FxRmax, alphaR) * P.tcsLimit;
    if (Math.abs(driveForce) > limit) {
      driveForce = Math.sign(driveForce) * limit;
      c.tcsActive = true;
    }
  }

  // --- Forças longitudinais ----------------------------------------------------------
  const hand = input.handbrake || 0;
  let brakeF = brake * P.brakeForce * P.brakeBias;
  let brakeR = brake * P.brakeForce * (1 - P.brakeBias);
  // ABS por eixo: a dianteira não trava (continua esterçando) e a traseira guarda
  // aderência lateral para não escapar quando o peso vai para a frente.
  c.absActive = false;
  if (c.abs && brake > 0.05) {
    const limF = room(FxFmax, alphaF) * P.absLimit;
    const limR = room(FxRmax, alphaR) * P.absLimitRear;
    if (brakeF > limF) { brakeF = limF; c.absActive = true; }
    if (brakeR > limR) { brakeR = limR; c.absActive = true; }
  }
  const stopForce = Math.abs(u) * m / dt; // nunca inverter o sentido só com freio
  const scale = Math.min(1, stopForce / Math.max(1, brakeF + brakeR + hand * P.handbrakeForce));
  let FxF = -Math.sign(u) * brakeF * scale;
  let FxR = driveForce - Math.sign(u) * (brakeR + hand * P.handbrakeForce) * scale;

  c.lockup = Math.max(0, Math.abs(FxF) / FxFmax - 1);
  c.wheelspin = throttle > 0.1 ? Math.max(0, Math.abs(FxR) / FxRmax - 1) : 0;
  FxF = clamp(FxF, -FxFmax, FxFmax);
  FxR = clamp(FxR, -FxRmax, FxRmax);

  // --- Forças laterais -----------------------------------------------------------------
  // Pneu patinando/travado ainda guarda um pouco de aderência lateral (uso máx. 95%).
  const lateralRoom = (Fx, max) => max * Math.sqrt(1 - Math.min(0.95, Math.abs(Fx) / max) ** 2);
  const FyFmax = lateralRoom(FxF, FxFmax);
  const FyRmax = lateralRoom(FxR, FxRmax) * (1 - 0.6 * hand);
  const FyF = -FyFmax * pacejka(alphaF, P);
  const FyR = -FyRmax * pacejka(alphaR, P);

  // --- Resistências -------------------------------------------------------------------------
  const drag = P.dragK * u * Math.abs(u);
  const rolling = (surfF.roll + surfR.roll) * 0.5 * m * G * Math.sign(u) * clamp(Math.abs(u), 0, 1);

  // --- Soma no referencial do carro e integração ---------------------------------------------
  const Fx = FxR + FxF * cs - FyF * sn - drag - rolling;
  const Fy = FyR + FxF * sn + FyF * cs - 40 * v; // leve arrasto lateral
  let Mz = P.a * (FyF * cs + FxF * sn) - P.b * FyR - 400 * c.r;
  const tireMz = Mz;

  // Anti-rodada: acima do ângulo limite puxa o bico para a direção da velocidade.
  if (c.driftAssist && u > 1 && speed > 4) {
    const excess = Math.abs(beta) - P.driftAngleSoft;
    if (excess > 0) {
      Mz += Math.sign(beta) * excess * P.stabilityK;
      if (Math.sign(c.r) === -Math.sign(beta)) Mz -= c.r * P.stabilityDamp * Math.min(1, excess * 4);
    }
  }

  // Controle de ângulo: esterço todo + acelerador entra de lado; o ângulo segue o esterço;
  // esterço no centro endireita. Um PD no ângulo de deslize gera o torque.
  let hold = 0;
  if (c.angleControl > 0 && u > 2) {
    const wantsDrift = Math.abs(input.steer) > 0.6 && throttle > 0.4 && speed > P.easyEntrySpeed;
    if (!c.driftMode && (wantsDrift || Math.abs(beta) > 0.2)) c.driftMode = true;
    if (c.driftMode && ((Math.abs(beta) < 0.06 && Math.abs(input.steer) < 0.3) || speed < 4)) c.driftMode = false;
    if (c.driftMode) {
      // esquerda (+) = bico à esquerda da velocidade = beta negativo. Sem acelerador o ângulo pedido
      // cai para 1/4: aliviar o pé fecha o drift e vira curva normal.
      const target = -input.steer * P.easyMaxAngle * clamp(throttle * 1.6, 0.25, 1);
      const betaRate = (beta - c.prevBeta) / dt;
      const torque = -P.inertia * (P.easyKp * (target - beta) - P.easyKd * betaRate);
      Mz += clamp(torque, -P.easyMaxTorque, P.easyMaxTorque) * c.angleControl;
      if (throttle > 0.2) hold = throttle * m * P.speedHold * c.angleControl;
    }
  } else c.driftMode = false;
  c.prevBeta = beta;

  const t = c.tel;
  t.Fzf = Fzf; t.Fzr = Fzr; t.FxF = FxF; t.FxR = FxR; t.FyF = FyF; t.FyR = FyR;
  t.gripF = FxFmax; t.gripR = FxRmax; t.alphaF = alphaF; t.alphaR = alphaR;
  t.drive = driveForce; t.torque = ratio !== 0 ? throttle * engineTorque(c.rpm, P) : 0;
  t.drag = drag; t.down = down; t.Mz = Mz; t.assistMz = Mz - tireMz; t.hold = hold;
  t.maxSteer = maxSteer; t.steerTarget = steerTarget;

  const holdX = speed > 1 ? (hold * c.vx) / speed : 0, holdZ = speed > 1 ? (hold * c.vz) / speed : 0;
  c.vx += ((Fx * sy + Fy * cy) + holdX) / m * dt;
  c.vz += ((Fx * cy - Fy * sy) + holdZ) / m * dt;
  c.r += Mz / P.inertia * dt;
  c.yaw += c.r * dt;
  c.x += c.vx * dt;
  c.z += c.vz * dt;

  c.ax += (Fx / m - c.ax) * Math.min(1, dt * 8);
  c.ay += (Fy / m - c.ay) * Math.min(1, dt * 8);
  c.u = u; c.v = v; c.speed = speed;
  c.driftAngle = speed > 1 ? Math.atan2(v, u) : 0; // passa de 90° quando o carro roda
  c.slipF = alphaF; c.slipR = alphaR;
  c.throttle = throttle; c.brake = brake;

  // Rotação visual das rodas (patinando gira mais rápido).
  c.wheelSpinRate = u / P.wheelRadius + Math.sign(ratio || 1) * c.wheelspin * 40;
  c.wheelSpin += c.wheelSpinRate * dt;
}

export { gearRatio, engineTorque };
