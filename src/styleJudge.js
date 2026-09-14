// Julgamento de estilo por curva (como os juízes de drift): ângulo, linha e fumaça viram uma nota
// de D a SS no fim de cada curva, com bônus de pontos. Módulo puro (sem three.js).
import { ROAD_HALF_WIDTH } from './track.js';

export const JUDGE = {
  minCurv: 1 / 90,     // 1/m: raio menor que 90 m conta como curva
  mergeGap: 10,        // amostras: curvas do mesmo lado separadas por menos que isso viram uma só
  minLength: 8,        // amostras (~16 m)
  entry: 10,           // amostras antes da curva que contam para a entrada
  exit: 5,             // amostras depois
  minCoverage: 0.6,    // fração da curva percorrida para valer nota
  minDrift: 0.35,      // fração da curva de lado para valer nota
  angleLow: 10, angleHigh: 45, // graus: nota zero / nota cheia de ângulo
  smokeFull: 0.8,
  weights: { angle: 0.45, line: 0.3, smoke: 0.25 },
};

export const GRADES = [
  { grade: 'SS', min: 86, bonus: 1200 },
  { grade: 'S', min: 72, bonus: 700 },
  { grade: 'A', min: 58, bonus: 350 },
  { grade: 'B', min: 44, bonus: 150 },
  { grade: 'C', min: 30, bonus: 0 },
  { grade: 'D', min: -Infinity, bonus: 0 },
];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Curvas da pista a partir da curvatura suavizada: [{ id, start, end, apex, sign }] (índices podem dar a volta).
export function findCorners(track, P = JUDGE) {
  const { N, curv } = track;
  const bent = (j) => Math.abs(curv[(j + N) % N]) > P.minCurv;
  // Começa num trecho reto para não partir uma curva ao meio na virada do índice.
  let origin = 0;
  while (origin < N && bent(origin)) origin++;
  const runs = [];
  let cur = null;
  for (let k = 1; k <= N; k++) {
    const j = (origin + k) % N;
    if (bent(j)) {
      const sign = Math.sign(curv[j]);
      if (cur && cur.sign === sign && k - cur.lastK <= P.mergeGap) { cur.lastK = k; cur.endK = k; }
      else { cur = { sign, startK: k, endK: k, lastK: k }; runs.push(cur); }
    }
  }
  return runs
    .filter((r) => r.endK - r.startK + 1 >= P.minLength)
    .map((r, id) => {
      let apex = r.startK, peak = 0;
      for (let k = r.startK; k <= r.endK; k++) {
        const c = Math.abs(curv[(origin + k) % N]);
        if (c > peak) { peak = c; apex = k; }
      }
      const startK = r.startK - P.entry, endK = r.endK + P.exit;
      return {
        id: id + 1, sign: r.sign, length: endK - startK + 1,
        start: (origin + startK + N) % N, end: (origin + endK) % N, apex: (origin + apex) % N,
        apexT: (apex - startK) / (endK - startK), radius: 1 / peak,
      };
    });
}

export class StyleJudge {
  constructor(track, P = JUDGE) {
    this.P = P;
    this.setTrack(track);
  }

  setTrack(track) {
    this.track = track;
    this.corners = findCorners(track, this.P);
    this.cornerAt = new Int16Array(track.N).fill(-1);
    for (const [i, c] of this.corners.entries()) {
      // Em chicanes a saída de uma curva encosta na entrada da próxima: a primeira fica com o trecho comum.
      for (let k = 0; k < c.length; k++) { const j = (c.start + k) % track.N; if (this.cornerAt[j] < 0) this.cornerAt[j] = i; }
    }
    this.reset();
  }

  reset() {
    this.current = null;
    this.events = [];
    this.counts = { SS: 0, S: 0, A: 0, B: 0, C: 0, D: 0 };
  }

  // s: { idx, lateral (m, + = esquerda), angle (graus), speed (m/s), smoke 0..1 (pneu traseiro × velocidade), drifting, failed (batida/combo perdido) }
  update(dt, s) {
    const i = this.cornerAt[s.idx];
    const cur = this.current;
    if (cur && i !== cur.index) this.finish();
    if (i < 0) return;
    const corner = this.corners[i];
    const t = ((s.idx - corner.start + this.track.N) % this.track.N) / (corner.length - 1);
    if (!this.current) {
      if (t > 0.4) return; // entrou no meio (volta para a pista, largada): não julga esta curva
      this.current = { index: i, corner, dist: 0, drift: 0, angle: 0, smoke: 0, line: [0, 0, 0], lineW: [0, 0, 0], maxT: 0, failed: false };
    }
    const c = this.current;
    const w = Math.max(0, s.speed) * dt;
    c.dist += w;
    c.maxT = Math.max(c.maxT, t);
    if (s.failed) c.failed = true;
    if (s.drifting) {
      c.drift += w;
      c.angle += Math.min(s.angle, 70) * w;
      c.smoke += clamp01(s.smoke) * w;
    }
    // Linha: por fora na entrada, rente à parte de dentro no ápice, abrindo por fora na saída.
    const inner = s.lateral * corner.sign; // + = lado de dentro da curva
    const reach = ROAD_HALF_WIDTH - 2.5;
    const zone = t < corner.apexT - 0.18 ? 0 : t < corner.apexT + 0.18 ? 1 : 2;
    const closeness = clamp01(0.15 + (zone === 1 ? inner : -inner) / reach);
    c.line[zone] += closeness * w;
    c.lineW[zone] += w;
  }

  finish() {
    const c = this.current;
    this.current = null;
    if (!c) return;
    const P = this.P, corner = c.corner;
    const expected = corner.length * this.track.ds;
    if (c.maxT < 0.9 || c.dist < expected * P.minCoverage) return; // não fez a curva inteira
    const driftFrac = c.drift / Math.max(1e-6, c.dist);
    if (c.failed) {
      this.push({ corner: corner.id, grade: 'D', score: 0, failed: true, angle: 0, line: 0, smoke: 0, bonus: 0 });
      return;
    }
    if (driftFrac < P.minDrift) return; // passou na aderência: sem nota
    const avg = (v) => v / Math.max(1e-6, c.drift);
    const angle = clamp01((avg(c.angle) - P.angleLow) / (P.angleHigh - P.angleLow));
    const smoke = clamp01(avg(c.smoke) / P.smokeFull);
    const zoneLine = c.line.map((v, k) => (c.lineW[k] > 0 ? v / c.lineW[k] : 0));
    const line = zoneLine[0] * 0.3 + zoneLine[1] * 0.45 + zoneLine[2] * 0.25;
    const W = P.weights;
    const score = (W.angle * angle + W.line * line + W.smoke * smoke) * (0.6 + 0.4 * driftFrac) * 100;
    const g = GRADES.find((x) => score >= x.min);
    this.push({ corner: corner.id, grade: g.grade, score, angle, line, smoke, bonus: g.bonus, failed: false });
  }

  push(ev) {
    this.counts[ev.grade]++;
    this.events.push({ type: 'grade', ...ev });
  }
}
