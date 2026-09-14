// Voltas: contagem com validação por setores e tempo de volta. Grava a trajetória de cada volta (20 Hz);
// o ranking (ranking.js) guarda as melhores e devolve o fantasma escolhido em `ghost`.

const GHOST_HZ = 20;

export class LapTimer {
  // persist: false para os rivais (não grava trajetória).
  constructor(track, { persist = true } = {}) {
    this.persist = persist;
    this.lap = 0;            // 0 = volta de saída
    this.time = 0;
    this.lastLap = null;     // { time, points }
    this.bestLap = null;     // { time, points }
    this.sectors = [false, false];
    this.prevIdx = -1;
    this.samples = [];
    this.ghost = null;
    this.events = [];
    this.setTrack(track);
  }

  setTrack(track) {
    this.track = track;
    this.bestLap = null;
    this.ghost = null;
    this.reset();
  }

  // Nova corrida: zera a contagem, mantém recorde e fantasma.
  reset() {
    this.lap = 0;
    this.time = 0;
    this.lastLap = null;
    this.sectors = [false, false];
    this.prevIdx = -1;
    this.samples = [];
    this.events = [];
  }

  // Largada já depois da linha: conta a partir da volta 1 sem volta de saída.
  startAt(idx) {
    this.reset();
    this.lap = 1;
    this.prevIdx = idx;
  }

  // lapPoints(): devolve e zera os pontos somados na volta que está terminando.
  update(dt, car, idx, lapPoints) {
    const { N } = this.track;
    this.time += dt;
    const prev = this.prevIdx;
    this.prevIdx = idx;
    if (prev < 0) return;

    if (idx > N / 3 && idx < N / 2) this.sectors[0] = true;
    if (idx > (2 * N) / 3 && idx < (5 * N) / 6 && this.sectors[0]) this.sectors[1] = true;

    const crossedForward = prev > N * 0.8 && idx < N * 0.2;
    const crossedBackward = prev < N * 0.2 && idx > N * 0.8;
    if (crossedBackward) this.sectors = [false, false];

    if (crossedForward && (this.lap === 0 || (this.sectors[0] && this.sectors[1]))) {
      const points = lapPoints();
      if (this.lap > 0) this.finishLap(points);
      this.lap++;
      this.time = 0;
      this.sectors = [false, false];
      this.samples = [];
    }

    if (this.lap > 0 && this.persist) {
      const want = Math.floor(this.time * GHOST_HZ);
      while (this.samples.length / 3 <= want) this.samples.push(car.x, car.z, car.yaw);
    }
  }

  finishLap(points) {
    const lap = { lap: this.lap, time: this.time, points };
    this.lastLap = lap;
    const isBest = points > 0 && (this.bestLap === null || points > this.bestLap.points);
    this.events.push({ type: 'lap', ...lap, best: isBest, samples: this.persist ? this.samples.slice() : null });
    if (isBest) this.bestLap = lap;
  }

  ghostPose() {
    if (!this.ghost || this.lap === 0) return null;
    const f = this.time * GHOST_HZ;
    const i = Math.floor(f), n = this.ghost.length / 3;
    if (i + 1 >= n) return null;
    const w = f - i, g = this.ghost;
    const dyaw = Math.atan2(Math.sin(g[(i + 1) * 3 + 2] - g[i * 3 + 2]), Math.cos(g[(i + 1) * 3 + 2] - g[i * 3 + 2]));
    return {
      x: g[i * 3] + (g[(i + 1) * 3] - g[i * 3]) * w,
      z: g[i * 3 + 1] + (g[(i + 1) * 3 + 1] - g[i * 3 + 1]) * w,
      yaw: g[i * 3 + 2] + dyaw * w,
    };
  }
}

export function formatTime(t) {
  if (t === null || t === undefined) return '--:--.---';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

export const formatPoints = (p) => Math.round(p).toLocaleString('pt-BR');
