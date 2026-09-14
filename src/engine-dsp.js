// Síntese de motor amostra a amostra, com perfis: 4 cilindros turbo (tipo SR20DET), 6 em linha turbo
// (tipo RB26/2JZ) e rotativo de 2 rotores (tipo 13B).
// Pulsos de combustão por cilindro -> ressonância do escapamento (guias de onda) -> timbre -> saturação,
// mais ronco de admissão, assobio do turbo, válvula de alívio e estalos na desaceleração.
// Módulo puro: roda no AudioWorklet do jogo e no Node (tools/render-engine.js).

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Biquad (fórmulas do "Audio EQ Cookbook"), forma direta I.
class Biquad {
  constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.x1 = this.x2 = this.y1 = this.y2 = 0; }
  set(type, sr, freq, q, gainDb = 0) {
    const w = TAU * clamp(freq, 10, sr * 0.45) / sr, cw = Math.cos(w), sw = Math.sin(w);
    const alpha = sw / (2 * q), A = Math.pow(10, gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lowpass') {
      b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
    } else if (type === 'bandpass') {
      b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
    } else if (type === 'peaking') {
      b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A;
    } else { // highshelf
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) + (A - 1) * cw + s); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - s);
      a0 = (A + 1) - (A - 1) * cw + s; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - s;
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// Filtro pente com realimentação amortecida: um trecho de cano do escapamento.
class Waveguide {
  constructor(sr, seconds, feedback, damping) {
    this.buf = new Float32Array(Math.max(1, Math.round(sr * seconds)));
    this.i = 0; this.fb = feedback; this.damp = damping; this.lp = 0;
  }
  process(x) {
    const delayed = this.buf[this.i];
    this.lp = delayed * (1 - this.damp) + this.lp * this.damp;
    const y = x + this.lp * this.fb;
    this.buf[this.i] = y;
    this.i = (this.i + 1) % this.buf.length;
    return y;
  }
}

// firings: ignições por ciclo de 720° · gains: desequilíbrio entre cilindros · width: largura do pulso [lenta, alta]
// shape: 'sine' (pulso de pistão) ou 'box' (janela longa do rotor) · jitter: irregularidade · lope: falhas em marcha lenta
// pipe: comprimento do escapamento · body: ressonância (Hz, dB) · bright: abertura do timbre · drive: saturação
// turbo: assobio e válvula de alívio · pops: estalos ao desacelerar · intake: sopro de admissão · redline: giro de referência · level: volume
export const ENGINE_PROFILES = {
  i4t: {
    name: '4 CIL. TURBO', firings: 4, gains: [1, 0.9, 1.07, 0.95], width: [0.1, 0.22], shape: 'sine', jitter: 0.14, lope: 0,
    pipe: 1, body: [115, 6], bright: 1, drive: 1, turbo: 1, pops: 0.045, intake: 0.06, redline: 7500, level: 1,
  },
  i6t: {
    name: '6 EM LINHA TURBO', firings: 6, gains: [1, 0.97, 1.03, 0.98, 1.02, 0.99], width: [0.16, 0.3], shape: 'sine', jitter: 0.05, lope: 0,
    pipe: 1.3, body: [92, 7.5], bright: 0.85, drive: 0.85, turbo: 1.25, pops: 0.03, intake: 0.05, redline: 7500, level: 0.95,
  },
  rotary: {
    name: 'ROTATIVO 2 ROTORES', firings: 4, gains: [1, 0.98, 1, 0.98], width: [0.34, 0.5], shape: 'box', jitter: 0.08, lope: 0.9,
    pipe: 0.72, body: [190, 5], bright: 1.35, drive: 1.5, turbo: 0, pops: 0.12, intake: 0.09, redline: 8000, level: 0.55,
  },
};

export class EngineDSP {
  // pipeScale muda o comprimento do escapamento (timbre de cada carro): > 1 = mais grave.
  constructor(sampleRate, seed = 7, { pipeScale = 1, profile = 'i4t' } = {}) {
    const sr = (this.sr = sampleRate);
    const P = (this.profile = ENGINE_PROFILES[profile] || ENGINE_PROFILES.i4t);
    pipeScale *= P.pipe;
    this.rand = mulberry32(seed);
    this.targetRpm = 900; this.targetLoad = 0;
    this.rpm = 900; this.load = 0;
    this.crank = 0;                 // fração do ciclo de 720°
    this.cylinder = 0;
    this.cylGain = P.gains;
    this.jitter = P.gains.map(() => 1);
    this.pop = 0;
    this.boost = 0; this.bov = 0; this.lastLoad = 0; this.whistlePhase = 0;

    this.pipeA = new Waveguide(sr, 0.0034 * pipeScale, 0.5, 0.3);
    this.pipeB = new Waveguide(sr, 0.0081 * pipeScale, 0.36, 0.55);
    this.body = new Biquad().set('peaking', sr, P.body[0] / pipeScale * P.pipe, 0.9, P.body[1]);
    this.tone = new Biquad();
    this.tone2 = new Biquad();
    this.shelf = new Biquad().set('highshelf', sr, 2400, 0.7, -9);
    this.intake = new Biquad();
    this.bovFilter = new Biquad().set('bandpass', sr, 2600, 1.1);
    this.dcX = 0; this.dcY = 0;
    this.counter = 0;
    this.updateFilters();
  }

  setTarget(rpm, load) {
    this.targetRpm = clamp(rpm, 0, 12000);
    this.targetLoad = clamp(load, 0, 1);
  }

  updateFilters() {
    const cutoff = (380 + this.load * 1500 + this.rpm * 0.16) * this.profile.bright;
    this.tone.set('lowpass', this.sr, cutoff, 0.6);
    this.tone2.set('lowpass', this.sr, cutoff * 1.6, 0.5);
    this.intake.set('bandpass', this.sr, 700 + this.rpm * 0.12, 0.8);
  }

  process(out) {
    const sr = this.sr, rand = this.rand, P = this.profile;
    for (let n = 0; n < out.length; n++) {
      // Suaviza parâmetros (~10 ms de rotação, ~20 ms de carga).
      this.rpm += (this.targetRpm - this.rpm) * (100 / sr);
      this.load += (this.targetLoad - this.load) * (50 / sr);
      if (++this.counter >= 64) { this.counter = 0; this.updateFilters(); }

      const rpm = this.rpm, load = this.load;
      const rpmNorm = clamp(rpm / P.redline, 0, 1);

      // Virabrequim: N ignições igualmente espaçadas por ciclo de 720° (no rotativo, 2 por volta do eixo x 2 rotores).
      this.crank += (rpm / 120) / sr;
      if (this.crank >= 1) this.crank -= 1;
      const c = this.crank * P.firings;
      const cyl = Math.floor(c);
      const f = c - cyl;
      if (cyl !== this.cylinder) {
        this.cylinder = cyl;
        this.jitter[cyl] = 1 + (rand() - 0.5) * (P.jitter - load * 0.06);
        // Rotativo em baixa: queima irregular ("brap brap") que some com giro e carga.
        const lope = P.lope * clamp(1 - (rpm - 900) / 2200, 0, 1) * (1 - load);
        if (lope > 0 && rand() < 0.35 * lope) this.jitter[cyl] *= 0.15 + rand() * 0.5;
        // Estalo no escapamento ao desacelerar em giro alto.
        if (load < 0.06 && rpm > 2800 && rand() < P.pops) this.pop = 0.5 + rand() * 0.5;
      }

      // Pulso de combustão: estreito em marcha lenta (batida), largo em giro alto (tom contínuo).
      const width = P.width[0] + (P.width[1] - P.width[0]) * rpmNorm;
      let pulse = 0;
      if (P.shape === 'box') {
        // Janela de escape longa do rotor: subida e descida rápidas, platô no meio (zumbido áspero)
        if (f < width) pulse = Math.min(1, Math.sin((Math.PI * f) / width) * 2.2);
        else if (f < width * 1.5) pulse = -0.45 * Math.sin((Math.PI * (f - width)) / (width * 0.5));
      } else if (f < width) pulse = Math.sin((Math.PI * f) / width) ** 2;
      else if (f < width * 1.8) pulse = -0.28 * Math.sin((Math.PI * (f - width)) / (width * 0.8)) ** 2;
      const amp = this.cylGain[cyl] * this.jitter[cyl] * (0.42 + 0.58 * load);
      const noise = rand() * 2 - 1;
      let excitation = pulse * amp * (1 + noise * (0.18 + 0.3 * load));

      if (this.pop > 0.001) {
        excitation += noise * this.pop * 1.4;
        this.pop *= Math.exp(-1 / (0.006 * sr));
      }

      // Escapamento, corpo e timbre
      let y = this.pipeB.process(this.pipeA.process(excitation));
      y = this.body.process(y);
      y = this.tone2.process(this.tone.process(y));
      y = this.shelf.process(y);
      // Remove componente contínua e satura de leve (mais "grão" sob carga).
      const dc = y - this.dcX + 0.995 * this.dcY;
      this.dcX = y; this.dcY = dc;
      let engine = Math.tanh(dc * (0.55 + 0.25 * load) * P.drive) * 0.75 / Math.sqrt(P.drive);

      // Admissão: sopro de ar sob carga.
      engine += this.intake.process(noise) * load * rpmNorm * P.intake;

      // Turbo: enche com carga e giro, esvazia rápido.
      const boostTarget = P.turbo && load > 0.45 && rpm > 2800 ? clamp((rpm - 2800) / 3200, 0, 1) * load : 0;
      this.boost += (boostTarget - this.boost) * ((boostTarget > this.boost ? 1.6 : 5) / sr);
      this.whistlePhase += (1600 + this.boost * 3800) / sr;
      if (this.whistlePhase > 1) this.whistlePhase -= 1;
      engine += Math.sin(TAU * this.whistlePhase) * this.boost * 0.009 * P.turbo;

      // Válvula de alívio: tirar o pé com o turbo cheio.
      if (this.lastLoad > 0.4 && load < 0.2 && this.boost > 0.35 && this.bov < 0.05) this.bov = this.boost;
      this.lastLoad = load;
      if (this.bov > 0.001) {
        engine += this.bovFilter.process(noise) * this.bov * 0.35;
        this.bov *= Math.exp(-1 / (0.16 * sr));
      }

      out[n] = engine * P.level;
    }
  }
}
