// Replay da corrida: gravação do estado de todos os carros (30 Hz) e um "diretor de TV" que escolhe câmeras
// externas (beira da pista com zoom, helicóptero, lateral baixa, frontal e órbita) para mostrar no fundo do resultado.
import * as THREE from 'three';
import { nearestIndex, lateralOffset, WALL_OFFSET } from './track.js';

export const REPLAY_HZ = 30;
const STRIDE = 10; // x, z, yaw, esterço, giro da roda, freio, fumaça, acel. lateral, ângulo de drift, multiplicador

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class ReplayRecorder {
  constructor() { this.reset(0); }

  reset(count) {
    this.data = Array.from({ length: count }, () => []);
    this.frames = 0;
    this.acc = 0;
  }

  get duration() { return Math.max(0, this.frames - 1) / REPLAY_HZ; }

  // entries: [{ car, skid (0..1), mult (0 = sem combo) }], sempre na mesma ordem (jogador primeiro)
  record(dt, entries) {
    if (entries.length !== this.data.length) this.reset(entries.length);
    this.acc += dt;
    const step = 1 / REPLAY_HZ;
    // Primeiro quadro na hora; depois a cada 1/30 s de corrida
    while (this.frames === 0 || this.acc >= step) {
      if (this.frames > 0) this.acc -= step;
      entries.forEach(({ car: c, skid, mult }, i) => {
        this.data[i].push(c.x, c.z, c.yaw, c.steer, c.wheelSpin, c.brake, skid, c.ay, c.driftAngle, mult);
      });
      this.frames++;
    }
  }

  // Estado do carro i no tempo t, interpolado; out ganha também velocidade (vx, vz, speed).
  sample(i, t, out) {
    const d = this.data[i];
    if (!d || this.frames < 2) return null;
    const f = Math.min(Math.max(0, t * REPLAY_HZ), this.frames - 1.001);
    const k = Math.floor(f), w = f - k;
    const a = k * STRIDE, b = (k + 1) * STRIDE;
    const lerp = (o) => d[a + o] + (d[b + o] - d[a + o]) * w;
    out.x = lerp(0); out.z = lerp(1);
    out.yaw = d[a + 2] + wrapAngle(d[b + 2] - d[a + 2]) * w;
    out.steer = lerp(3); out.wheelSpin = lerp(4); out.brake = lerp(5); out.skid = lerp(6);
    out.ay = lerp(7); out.ax = 0; out.driftAngle = lerp(8); out.mult = w < 0.5 ? d[a + 9] : d[b + 9];
    out.vx = (d[b] - d[a]) * REPLAY_HZ; out.vz = (d[b + 1] - d[a + 1]) * REPLAY_HZ;
    out.speed = Math.hypot(out.vx, out.vz);
    return out;
  }
}

// Planos em sequência, com mais câmeras de pista (cara de transmissão de TV).
const SHOTS = [
  { kind: 'trackside', name: 'CÂMERA DA PISTA', max: 7 },
  { kind: 'heli', name: 'HELICÓPTERO', max: 5 },
  { kind: 'trackside', name: 'CÂMERA DA PISTA', max: 7 },
  { kind: 'side', name: 'LATERAL', max: 4.5 },
  { kind: 'trackside', name: 'CÂMERA DA PISTA', max: 7 },
  { kind: 'orbit', name: 'ÓRBITA', max: 5 },
  { kind: 'front', name: 'FRONTAL', max: 3.5 },
];

export class ReplayDirector {
  constructor(track) {
    this.setTrack(track);
  }

  setTrack(track) {
    this.track = track;
    this.reset();
  }

  reset() {
    this.index = -1;
    this.shot = null;
    this.time = 0;
    this.idx = -1;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.side = 1;
  }

  get name() { return this.shot?.name ?? ''; }

  next(car) {
    this.index = (this.index + 1) % SHOTS.length;
    this.shot = SHOTS[this.index];
    this.time = 0;
    this.side = Math.random() < 0.5 ? 1 : -1;
    const { track } = this;
    if (this.shot.kind === 'trackside') {
      // Câmera parada à frente, fora da mureta, do lado de fora da curva mais próxima
      const ahead = (this.idx + Math.round((28 + Math.random() * 22) / track.ds)) % track.N;
      let bend = 0;
      for (let k = -8; k <= 8; k++) bend += track.curv[(ahead + k + track.N) % track.N];
      const sd = bend > 0 ? -1 : bend < 0 ? 1 : this.side;
      const off = WALL_OFFSET + 2 + Math.random() * 2;
      this.pos.set(track.x[ahead] + track.nx[ahead] * sd * off, 2.6 + Math.random() * 2.5, track.z[ahead] + track.nz[ahead] * sd * off);
    } else {
      this.pos.set(car.x, 3, car.z);
    }
    this.look.set(car.x, 0.8, car.z);
  }

  // car: estado do carro em foco ({ x, z, yaw, vx, vz, speed })
  update(dt, camera, car) {
    const { track } = this;
    this.idx = nearestIndex(track, car.x, car.z, this.idx);
    this.time += dt;
    if (!this.shot) this.next(car);
    const shot = this.shot;
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    const move = car.speed > 3 ? Math.atan2(car.vx, car.vz) : car.yaw;
    const mx = Math.sin(move), mz = Math.cos(move);
    const dist = Math.hypot(this.pos.x - car.x, this.pos.z - car.z);

    let fov = 55, smooth = 1 - Math.exp(-dt * 4);
    const target = new THREE.Vector3();
    if (shot.kind === 'trackside') {
      // Parada; zoom para manter o carro do mesmo tamanho. Troca quando o carro já passou e se afastou.
      target.copy(this.pos);
      smooth = 1;
      fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(3.6 / Math.max(1, dist))), 9, 62);
      const toCam = (this.pos.x - car.x) * mx + (this.pos.z - car.z) * mz;
      if ((toCam < -10 && dist > 32) || dist > 90) this.time = shot.max;
    } else if (shot.kind === 'heli') {
      target.set(car.x - mx * 16 + mz * 7 * this.side, 13, car.z - mz * 16 - mx * 7 * this.side);
      fov = 48;
      smooth = 1 - Math.exp(-dt * 1.5);
    } else if (shot.kind === 'side') {
      // Carrinho de câmera baixo andando junto, do lado com mais espaço até a mureta
      const lat = lateralOffset(track, this.idx, car.x, car.z);
      const nx = track.nx[this.idx], nz = track.nz[this.idx];
      const sd = lat > 0 ? -1 : 1;
      const slide = Math.sin(this.time * 0.6) * 2.5;
      target.set(car.x + nx * sd * 4.2 + mx * slide, 0.75, car.z + nz * sd * 4.2 + mz * slide);
      fov = 58;
      smooth = 1 - Math.exp(-dt * 6);
    } else if (shot.kind === 'orbit') {
      const a = this.time * 0.55 + (this.side > 0 ? 0 : Math.PI);
      target.set(car.x + Math.sin(a) * 8.5, 2.3, car.z + Math.cos(a) * 8.5);
      fov = 52;
      smooth = 1 - Math.exp(-dt * 5);
    } else {
      target.set(car.x + fx * 7.5 + fz * 1.2 * this.side, 1.0, car.z + fz * 7.5 - fx * 1.2 * this.side);
      fov = 50;
      smooth = 1 - Math.exp(-dt * 7);
    }
    // Não deixa câmeras móveis atravessarem a mureta da cidade
    if (shot.kind !== 'trackside') {
      const j = nearestIndex(track, target.x, target.z, this.idx, 20);
      const lat = lateralOffset(track, j, target.x, target.z);
      const limit = WALL_OFFSET - 0.6;
      if (target.y < 4 && Math.abs(lat) > limit) {
        const push = (Math.abs(lat) - limit) * Math.sign(lat);
        target.x -= track.nx[j] * push; target.z -= track.nz[j] * push;
      }
    }
    if (this.time < dt * 1.5 || shot.kind === 'trackside') this.pos.copy(target); // corte seco na troca de plano
    else this.pos.lerp(target, smooth);

    this.look.lerp(new THREE.Vector3(car.x + mx * Math.min(3, car.speed * 0.12), 0.75, car.z + mz * Math.min(3, car.speed * 0.12)), this.time < dt * 1.5 ? 1 : 1 - Math.exp(-dt * 8));
    camera.position.copy(this.pos);
    camera.lookAt(this.look);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    if (this.time >= shot.max) this.next(car);
  }
}
