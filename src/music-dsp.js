// Eurobeat procedural: compõe e toca músicas originais amostra a amostra (sem arquivos de áudio).
// Cada música sai de uma semente: tom, andamento, progressões, melodia do refrão, arpejo e timbres.
// Estrutura: intro, verso, pré-refrão (virada + subida), refrão, break, verso, pré, refrão, refrão modulado, final.
// Módulo puro: roda no AudioWorklet do jogo e no Node (tools/render-music.js).

const TAU = Math.PI * 2;
const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Músicas do jogo (nomes fictícios). A semente define todo o resto.
export const SONGS = [
  { name: 'MIDNIGHT WANGAN', seed: 1987 },
  { name: 'FUJIMI HEAT', seed: 4411 },
  { name: 'NEON DRIFTER', seed: 7302 },
  { name: 'TOUGE FEVER', seed: 2596 },
  { name: 'SPEED OF LIGHTS', seed: 8814 },
  { name: 'CRAZY CORNER', seed: 5150 },
];

// --- Teoria: menor natural; acordes como [grau em semitons, qualidade] ------------------------------------
const SCALE = [0, 2, 3, 5, 7, 8, 10];
const VERSE_PROGS = [
  [[0, 'm'], [8, 'M'], [10, 'M'], [0, 'm']],
  [[0, 'm'], [10, 'M'], [8, 'M'], [10, 'M']],
  [[8, 'M'], [10, 'M'], [7, 'm'], [0, 'm']],
  [[0, 'm'], [5, 'm'], [10, 'M'], [3, 'M']],
];
const PRE_PROGS = [
  [[5, 'm'], [7, 'm'], [8, 'M'], [10, 'M']],
  [[8, 'M'], [10, 'M'], [8, 'M'], [7, 'M']],
  [[5, 'm'], [10, 'M'], [8, 'M'], [7, 'M']],
];
const CHORUS_PROGS = [
  [[8, 'M'], [10, 'M'], [7, 'm'], [0, 'm']],
  [[5, 'm'], [10, 'M'], [3, 'M'], [8, 'M']],
  [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']],
  [[8, 'M'], [10, 'M'], [0, 'm'], [0, 'm']],
];
// Ritmos de 2 compassos (32 semicolcheias) para a melodia do refrão
const RHYTHMS = [
  [0, 2, 4, 6, 8, 11, 14, 16, 18, 20, 22, 24, 27, 30],
  [0, 3, 6, 8, 10, 12, 14, 16, 19, 22, 24, 28],
  [0, 2, 3, 6, 8, 10, 11, 14, 16, 18, 19, 22, 24, 26, 28],
  [0, 4, 6, 8, 10, 12, 14, 16, 20, 22, 24, 26, 28, 30],
  [0, 2, 4, 7, 10, 12, 14, 16, 18, 20, 23, 26, 28],
];
const CADENCE = [0, 2, 4, 6, 8, 10, 12, 16];
// Padrões dos acordes de supersaw (16 passos)
const STABS = {
  verse: [2, 6, 10, 14],
  chorus: [[0, 3, 6, 10, 12, 14], [0, 3, 6, 8, 11, 14], [0, 2, 6, 10, 12, 14]],
  pre: [0, 3, 6, 8, 10, 12, 14],
};
const ARPS = [[0, 1, 2, 3, 2, 1, 0, 1], [0, 2, 1, 3, 2, 4, 3, 1], [0, 1, 2, 1, 3, 2, 4, 2], [3, 2, 1, 0, 1, 2, 3, 4]];

const chordTones = ([root, q]) => [root, root + (q === 'M' ? 4 : 3), root + 7];

// Grau da escala (inteiro, atravessa oitavas) -> semitons; no V maior o 7º grau sobe (sensível).
function degToSemi(deg, raised7 = false) {
  const oct = Math.floor(deg / 7), i = ((deg % 7) + 7) % 7;
  return oct * 12 + (raised7 && i === 6 ? 11 : SCALE[i]);
}
function isChordTone(deg, chord) {
  const semi = ((degToSemi(deg, chord[0] === 7 && chord[1] === 'M') % 12) + 12) % 12;
  return chordTones(chord).some((t) => (t % 12) === semi);
}
function nearestChordTone(deg, chord, dir = 0) {
  for (let d = 0; d < 4; d++) {
    for (const s of dir >= 0 ? [d, -d] : [-d, d]) if (isChordTone(deg + s, chord)) return deg + s;
  }
  return deg;
}

// Melodia de 8 compassos: motivo A, A adaptado aos acordes, A, e cadência terminando na tônica.
function makeMelody(rand, prog, { sparse = false, base = 7 } = {}) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const rhythm = pick(RHYTHMS).filter((s, i) => !sparse || i % 2 === 0 || s % 8 === 0);
  const chordAt = (bar) => prog[bar % prog.length];
  // Motivo: passeio pela escala com notas do acorde nos tempos fortes e saltos ocasionais
  let deg = nearestChordTone(base + 2, chordAt(0));
  const motif = rhythm.map((step) => {
    const chord = chordAt(Math.floor(step / 16));
    if (step % 4 === 0) deg = nearestChordTone(deg + Math.round((rand() - 0.5) * 3), chord, rand() - 0.5);
    else deg += pick([-2, -1, -1, 1, 1, 2, 0]);
    if (rand() < 0.08 && step % 8 === 0) deg += pick([3, -3, 7]);
    deg = Math.max(base - 3, Math.min(base + 9, deg));
    return deg;
  });
  const notes = [];
  const place = (degs, steps, barOffset, fit) => {
    let shift = 0;
    if (fit) { const first = degs[0]; shift = nearestChordTone(first, chordAt(barOffset)) - first; }
    steps.forEach((step, i) => {
      const chord = chordAt(barOffset + Math.floor(step / 16));
      let d = degs[i] + shift;
      if (step % 8 === 0) d = nearestChordTone(d, chord);
      const next = i + 1 < steps.length ? steps[i + 1] : 32;
      notes.push({ step: barOffset * 16 + step, len: Math.max(1, next - step), deg: d, raised: chord[0] === 7 && chord[1] === 'M' });
    });
  };
  place(motif, rhythm, 0, false);
  place(motif, rhythm, 2, true);
  place(motif, rhythm, 4, false);
  // Cadência: desce para a tônica e segura
  let c = motif[Math.floor(motif.length / 2)];
  const cad = CADENCE.map((step, i) => {
    if (i === CADENCE.length - 1) return base + (rand() < 0.5 ? 0 : 7) - (c > base + 5 ? 0 : 0);
    c += step % 4 === 0 ? pick([-1, -2, 1]) : pick([-1, 1]);
    return Math.max(base - 2, Math.min(base + 8, c));
  });
  cad[cad.length - 1] = nearestChordTone(base + (rand() < 0.5 ? 0 : 2), chordAt(7));
  place(cad, CADENCE, 6, false);
  return notes;
}

export function generateSong(index) {
  const def = SONGS[((index % SONGS.length) + SONGS.length) % SONGS.length];
  const rand = mulberry32(def.seed);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const key = 38 + Math.floor(rand() * 8);           // tônica do baixo: D (38) a A (45)
  const bpm = 154 + Math.floor(rand() * 8);
  const verse = pick(VERSE_PROGS), pre = pick(PRE_PROGS), chorus = pick(CHORUS_PROGS);
  const chorusMel = makeMelody(rand, chorus, { base: 7 });
  const verseMel = makeMelody(rand, verse, { sparse: true, base: 4 });
  const stabChorus = pick(STABS.chorus);
  const arp = pick(ARPS);
  const leadWave = rand() < 0.5 ? 'saw' : 'square';
  const S = (name, bars, chords, f = {}) => ({ name, bars, chords, keyShift: 0, ...f });
  const sections = [
    S('intro', 4, verse, { pad: true, arp: true, hats: true, filterRise: true }),
    S('intro2', 4, verse, { kick: true, bass: true, hats: true, openHat: true, arp: true, crash: true, pad: true }),
    S('verse', 16, verse, { kick: true, snare: true, hats: true, openHat: true, bass: true, stabs: STABS.verse, stabLevel: 0.6, arp: true, lead: verseMel, leadLevel: 0.65, crash: true }),
    S('pre', 8, pre, { kick: true, snare: true, hats: true, bass: true, stabs: STABS.pre, stabLevel: 0.95, pad: true, riser: true, fill: true }),
    S('chorus', 16, chorus, { kick: true, snare: true, hats: true, openHat: true, bass: true, stabs: stabChorus, stabLevel: 1.5, pad: true, padLevel: 0.7, arp: true, lead: chorusMel, leadLevel: 1.45, crash: true, brass: true }),
    S('break', 8, verse, { pad: true, arp: true, hats: true, bassHold: true, riser: true, crash: true }),
    S('verse2', 8, verse, { kick: true, snare: true, hats: true, openHat: true, bass: true, stabs: STABS.verse, stabLevel: 0.6, arp: true, lead: verseMel, leadLevel: 0.65, crash: true }),
    S('pre2', 8, pre, { kick: true, snare: true, hats: true, bass: true, stabs: STABS.pre, stabLevel: 0.95, pad: true, riser: true, fill: true }),
    S('chorus2', 16, chorus, { kick: true, snare: true, hats: true, openHat: true, bass: true, stabs: stabChorus, stabLevel: 1.5, pad: true, padLevel: 0.7, arp: true, lead: chorusMel, leadLevel: 1.45, crash: true, brass: true }),
    S('chorus3', 16, chorus, { kick: true, snare: true, hats: true, openHat: true, bass: true, stabs: stabChorus, stabLevel: 1.5, pad: true, padLevel: 0.7, arp: true, lead: chorusMel, leadLevel: 1.45, crash: true, brass: true, keyShift: 2 }),
    S('outro', 8, chorus, { kick: true, hats: true, openHat: true, bass: true, arp: true, pad: true, filterFall: true, keyShift: 2 }),
  ];
  return { ...def, index, key, bpm, sections, arp, leadWave, bars: sections.reduce((s, x) => s + x.bars, 0) };
}

// --- Blocos de síntese ---------------------------------------------------------------------------------
class SVF {
  constructor() { this.ic1 = 0; this.ic2 = 0; this.a1 = 1; this.a2 = 0; this.a3 = 0; this.k = 1; this.bp = 0; }
  set(fc, q, sr) {
    const g = Math.tan(Math.PI * Math.min(Math.max(fc, 20), sr * 0.45) / sr);
    this.k = 1 / q; this.a1 = 1 / (1 + g * (g + this.k)); this.a2 = g * this.a1; this.a3 = g * this.a2;
  }
  lp(x) {
    const v3 = x - this.ic2, v1 = this.a1 * this.ic1 + this.a2 * v3, v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2; this.bp = v1;
    return v2;
  }
  hp(x) { const low = this.lp(x); return x - this.k * this.bp - low; }
}

// Dente de serra com PolyBLEP (sem o chiado de aliasing das serras "cruas")
function saw(phase, inc) {
  let v = 2 * phase - 1;
  if (phase < inc) { const t = phase / inc; v -= t + t - t * t - 1; } else if (phase > 1 - inc) { const t = (phase - 1) / inc; v -= t * t + t + t + 1; }
  return v;
}
function pulse(phase, inc, width) {
  let p2 = phase + (1 - width); if (p2 >= 1) p2 -= 1;
  return saw(phase, inc) - saw(p2, inc);
}

const DETUNE = [-0.12, -0.055, 0, 0.055, 0.12];

class ChordVoice {
  constructor() { this.phases = DETUNE.map(() => Math.random()); this.filter = new SVF(); this.env = 0; this.gate = 0; this.active = false; this.age = 0; }
  on(note, { attack, decay, sustain, release, len, cutoff, level, sr }) {
    this.incs = DETUNE.map((d) => midiHz(note + d) / sr);
    Object.assign(this, { attack, decay, sustain, release, level, cutoff, gate: len, t: 0, active: true, age: 0, stage: 0 });
  }
  // Escreve em this.l / this.r (sem criar arrays por amostra)
  process(sr, counter) {
    this.l = 0; this.r = 0;
    if (!this.active) return;
    const dt = 1 / sr;
    this.t += dt;
    if (this.t < this.gate) {
      if (this.t < this.attack) this.env = this.t / this.attack;
      else this.env += (this.sustain - this.env) * (dt / this.decay);
    } else {
      this.env *= Math.exp(-dt / this.release);
      if (this.env < 1e-4) { this.active = false; return; }
    }
    if ((counter & 15) === 0) this.filter.set(this.cutoff * (0.35 + 0.65 * Math.min(1, this.env * 1.4)), 0.9, sr);
    let l = 0, r = 0;
    for (let i = 0; i < 5; i++) {
      this.phases[i] += this.incs[i]; if (this.phases[i] >= 1) this.phases[i] -= 1;
      const v = saw(this.phases[i], this.incs[i]);
      if (i % 2 === 0) l += v; else r += v;
      if (i === 2) { l += v * 0.5; r += v * 0.5; }
    }
    const f = this.filter.lp((l + r) * 0.5) * this.env * this.level;
    const width = (l - r) * 0.04 * this.env * this.level;
    this.l = f * 0.9 + width; this.r = f * 0.9 - width;
  }
}

export class MusicDSP {
  constructor(sampleRate, { song = 0 } = {}) {
    this.sr = sampleRate;
    this.rand = mulberry32(99);
    this.intensity = 1; this.intensityTarget = 1;
    this.playing = true;
    this.onSong = null;
    // Bateria
    this.kick = { t: 9, amp: 0, ph: 0, env: 0 };
    this.snare = { t: 9, amp: 0, ph: 0, filter: new SVF() };
    this.snare.filter.set(1900, 0.7, sampleRate);
    this.hat = { t: 9, amp: 0, decay: 0.03, filter: new SVF() };
    this.hat.filter.set(7500, 0.7, sampleRate);
    this.crash = { t: 9, amp: 0, filter: new SVF() };
    this.crash.filter.set(5200, 0.6, sampleRate);
    // Baixo, arpejo, lead, acordes, subida de ruído
    this.bass = { ph: 0, inc: 0, t: 9, gate: 0, level: 0, filter: new SVF(), cut: 400 };
    this.arpV = { ph: 0, inc: 0, t: 9, level: 0, filter: new SVF(), pan: 0 };
    this.lead = { ph1: 0, ph2: 0, ph3: 0, freq: 440, target: 440, t: 9, gate: 0, env: 0, level: 0, filter: new SVF() };
    this.chords = Array.from({ length: 14 }, () => new ChordVoice());
    this.riser = { t: 9, len: 0, filter: new SVF() };
    // Efeitos: delay pingue-pongue e reverb curto (Schroeder)
    this.delayL = new Float32Array(Math.round(sampleRate * 1.2)); this.delayR = new Float32Array(this.delayL.length); this.dIdx = 0;
    const scale = sampleRate / 44100;
    this.combs = [1116, 1188, 1277, 1356].map((n) => ({ buf: new Float32Array(Math.round(n * scale)), i: 0, lp: 0 }));
    this.allpass = [556, 441].map((n) => ({ buf: new Float32Array(Math.round(n * scale)), i: 0 }));
    this.master = [new SVF(), new SVF()];
    this.counter = 0;
    this.loadSong(song);
  }

  loadSong(index) {
    this.song = generateSong(index);
    this.stepSamples = (this.sr * 60) / this.song.bpm / 4;
    this.sampleInStep = 0;
    this.stepInBar = -1;
    this.section = 0;
    this.barInSection = 0;
    this.delayTime = Math.round(this.stepSamples * 3);
    this.onSong?.(this.song);
  }

  nextSong() { this.loadSong(this.song.index + 1); }
  setIntensity(v) { this.intensityTarget = Math.max(0, Math.min(1, v)); }

  // --- Sequenciador (chamado a cada semicolcheia) -------------------------------------------------------
  step() {
    this.stepInBar++;
    if (this.stepInBar >= 16) {
      this.stepInBar = 0;
      this.barInSection++;
      if (this.barInSection >= this.song.sections[this.section].bars) {
        this.barInSection = 0;
        this.section++;
        if (this.section >= this.song.sections.length) { this.nextSong(); this.stepInBar = 0; }
      }
    }
    const song = this.song, sec = song.sections[this.section], s = this.stepInBar, bar = this.barInSection;
    const key = song.key + sec.keyShift;
    const chord = sec.chords[bar % sec.chords.length];
    const lastBar = bar === sec.bars - 1;
    const sr = this.sr, stepSec = this.stepSamples / sr;

    if (s === 0 && bar === 0 && sec.crash) this.trigger(this.crash, 0.55);
    // Bateria
    const fillZone = sec.fill && lastBar && s >= 8;
    if (sec.kick && s % 4 === 0 && !(fillZone && s >= 12)) { this.kick.t = 0; this.kick.amp = 1; }
    if (sec.snare && (s === 4 || s === 12) && !fillZone) this.trigger(this.snare, 0.8);
    if (fillZone) this.trigger(this.snare, 0.35 + ((s - 8) / 8) * 0.6); // virada em semicolcheias crescendo
    if (sec.hats) {
      if (sec.openHat && s % 4 === 2) { this.hat.t = 0; this.hat.amp = 0.5; this.hat.decay = 0.14; }
      else if (s % 2 === 0 || sec.name.startsWith('chorus')) { this.hat.t = 0; this.hat.amp = s % 4 === 0 ? 0.22 : 0.14; this.hat.decay = 0.028; }
    }
    // Baixo em oitavas (colcheias) ou nota longa no break
    const root = key + chord[0];
    if (sec.bass && s % 2 === 0) {
      const b = this.bass;
      b.inc = midiHz(root + (s % 4 === 2 ? 12 : 0)) / sr; b.t = 0; b.gate = stepSec * 1.6; b.level = 0.4;
    }
    if (sec.bassHold && s === 0) { const b = this.bass; b.inc = midiHz(root) / sr; b.t = 0; b.gate = stepSec * 15; b.level = 0.38; }
    // Acordes de supersaw: stabs no ritmo da seção; pad segurando o compasso
    const tones = chordTones(chord).map((t) => key + 24 + t);
    if (sec.stabs && sec.stabs.includes(s)) {
      const brass = sec.brass && s === 0;
      const lv = sec.stabLevel ?? 1;
      for (const n of tones) this.chordOn(n, { attack: 0.003, decay: 0.08, sustain: 0.7, release: 0.09, len: stepSec * (brass ? 1.8 : 0.9), cutoff: (brass ? 6500 : 4200) * (0.8 + 0.2 * lv), level: (brass ? 0.1 : 0.075) * lv });
    }
    if (sec.pad && s === 0) {
      for (const n of [...tones, tones[0] + 12]) this.chordOn(n, { attack: 0.25, decay: 0.6, sustain: 0.8, release: 0.5, len: stepSec * 15.5, cutoff: 2200, level: 0.045 * (sec.padLevel ?? 1) });
    }
    // Arpejo em semicolcheias pelas notas do acorde (duas oitavas)
    if (sec.arp) {
      const pool = [...tones, tones[0] + 12, tones[1] + 12];
      const a = this.arpV;
      a.inc = midiHz(pool[song.arp[s % song.arp.length] % pool.length] + 12) / sr; a.t = 0; a.level = 0.09; a.pan = s % 2 ? 0.35 : -0.35;
    }
    // Lead: melodia gravada por passo absoluto dentro de um ciclo de 8 compassos
    if (sec.lead) {
      const abs = (bar % 8) * 16 + s;
      const note = sec.lead.find((n) => n.step === abs);
      if (note) {
        const L = this.lead;
        L.target = midiHz(key + 24 + degToSemi(note.deg, note.raised));
        if (L.env < 0.05) L.freq = L.target;
        L.t = 0; L.gate = stepSec * note.len * 0.92; L.level = 0.15 * (sec.leadLevel ?? 1);
      }
    }
    // Subida de ruído nos 2 últimos compassos do pré-refrão / break
    if (sec.riser && bar === sec.bars - 2 && s === 0) { this.riser.t = 0; this.riser.len = stepSec * 32; }
  }

  trigger(v, amp) { v.t = 0; v.amp = amp; }

  chordOn(note, opts) {
    let voice = this.chords.find((c) => !c.active);
    if (!voice) voice = this.chords.reduce((a, b) => (a.t > b.t ? a : b));
    voice.on(note, { ...opts, sr: this.sr });
  }

  // --- Áudio -----------------------------------------------------------------------------------------------
  process(outL, outR) {
    const sr = this.sr, dt = 1 / sr, rand = this.rand;
    for (let n = 0; n < outL.length; n++) {
      this.counter++;
      if (this.playing && ++this.sampleInStep >= this.stepSamples) { this.sampleInStep -= this.stepSamples; this.step(); }
      if (this.stepInBar < 0 && this.playing) this.step();
      this.intensity += (this.intensityTarget - this.intensity) * 0.00004;
      const noise = rand() * 2 - 1;
      const sec = this.song.sections[this.section];

      // Bumbo: seno com queda rápida de afinação + clique
      let drums = 0;
      const k = this.kick;
      if (k.amp > 0) {
        const f = 44 + 110 * Math.exp(-k.t * 40);
        k.ph += f * dt; if (k.ph > 1) k.ph -= 1;
        k.env = Math.exp(-k.t * 6.5);
        drums += (Math.sin(TAU * k.ph) * k.env + (k.t < 0.003 ? noise * 0.5 * (1 - k.t / 0.003) : 0)) * k.amp * 0.8;
        k.t += dt; if (k.t > 0.5) k.amp = 0;
      } else k.env *= 0.999;
      // Caixa: tom + ruído filtrado, com "palmas" (três batidas rápidas)
      const sn = this.snare;
      let snareOut = 0;
      if (sn.amp > 0) {
        sn.ph += 190 * dt;
        const clap = sn.t < 0.03 ? (Math.floor(sn.t / 0.01) % 2 === 0 ? 1 : 0.35) : 1;
        snareOut = (Math.sin(TAU * sn.ph) * Math.exp(-sn.t * 30) * 0.5 + sn.filter.lp(noise) * 2.2 * Math.exp(-sn.t * 12) * clap) * sn.amp * 0.42;
        sn.t += dt; if (sn.t > 0.5) sn.amp = 0;
      }
      drums += snareOut;
      const h = this.hat;
      let hatOut = 0;
      if (h.amp > 0) { hatOut = h.filter.hp(noise) * Math.exp(-h.t / h.decay) * h.amp * 0.5; h.t += dt; if (h.t > h.decay * 8) h.amp = 0; }
      const cr = this.crash;
      let crashOut = 0;
      if (cr.amp > 0) { crashOut = cr.filter.hp(noise) * Math.exp(-cr.t * 1.6) * cr.amp * 0.28; cr.t += dt; if (cr.t > 3) cr.amp = 0; }

      // Pumping: tudo que é harmônico abaixa com o bumbo
      const duck = 1 - 0.55 * k.env;

      // Baixo
      const b = this.bass;
      let bassOut = 0;
      if (b.level > 0) {
        b.ph += b.inc; if (b.ph >= 1) b.ph -= 1;
        const env = b.t < b.gate ? 1 : Math.exp(-(b.t - b.gate) * 60);
        if ((this.counter & 15) === 0) b.filter.set(260 + 1600 * Math.exp(-b.t * 14), 1.6, sr);
        bassOut = b.filter.lp(saw(b.ph, b.inc) * 0.7 + pulse(b.ph, b.inc, 0.5) * 0.3) * env * b.level;
        b.t += dt; if (env < 1e-3) b.level = 0;
      }
      // Arpejo (pulso estreito, pluck)
      const a = this.arpV;
      let arpL = 0, arpR = 0;
      if (a.level > 0) {
        a.ph += a.inc; if (a.ph >= 1) a.ph -= 1;
        const env = Math.exp(-a.t * 16);
        if ((this.counter & 15) === 0) a.filter.set(900 + 5200 * Math.exp(-a.t * 20), 1.2, sr);
        const v = a.filter.lp(pulse(a.ph, a.inc, 0.3)) * env * a.level;
        arpL = v * (1 - a.pan) * 0.7; arpR = v * (1 + a.pan) * 0.7;
        a.t += dt; if (env < 1e-3) a.level = 0;
      }
      // Lead com glide e vibrato
      const L = this.lead;
      let leadOut = 0;
      if (L.level > 0) {
        L.freq += (L.target - L.freq) * 0.0022;
        const vib = 1 + Math.sin(TAU * 5.6 * L.t) * 0.006 * Math.min(1, Math.max(0, (L.t - 0.18) * 4));
        const f = L.freq * vib;
        const i1 = (f * 1.004) / sr, i2 = (f * 0.996) / sr, i3 = (f * 0.5) / sr;
        L.ph1 += i1; if (L.ph1 >= 1) L.ph1 -= 1;
        L.ph2 += i2; if (L.ph2 >= 1) L.ph2 -= 1;
        L.ph3 += i3; if (L.ph3 >= 1) L.ph3 -= 1;
        const target = L.t < L.gate ? 1 : 0;
        L.env += (target - L.env) * (target ? 0.004 : 0.0012);
        if ((this.counter & 15) === 0) L.filter.set(2400 + 3800 * L.env, 1.1, sr);
        const osc = this.song.leadWave === 'saw'
          ? saw(L.ph1, i1) + saw(L.ph2, i2) + pulse(L.ph3, i3, 0.5) * 0.5
          : pulse(L.ph1, i1, 0.5) + saw(L.ph2, i2) * 0.6 + pulse(L.ph3, i3, 0.25) * 0.4;
        leadOut = L.filter.lp(osc) * L.env * L.level;
        L.t += dt;
      }
      // Acordes
      let chL = 0, chR = 0;
      for (const c of this.chords) { if (!c.active) continue; c.process(sr, this.counter); chL += c.l; chR += c.r; }
      // Subida de ruído
      const rs = this.riser;
      let riserOut = 0;
      if (rs.t < rs.len) {
        const p = rs.t / rs.len;
        if ((this.counter & 31) === 0) rs.filter.set(300 + 7000 * p * p, 2, sr);
        riserOut = rs.filter.lp(noise) * p * p * 0.35;
        rs.t += dt;
      }

      // Delay pingue-pongue (lead e arpejo) e reverb (caixa, acordes, lead)
      const D = this.delayL.length, dI = this.dIdx, rI = (dI - this.delayTime + D) % D;
      const dl = this.delayL[rI], dr = this.delayR[rI];
      this.delayL[dI] = leadOut * 0.28 + (arpL + arpR) * 0.12 + dr * 0.38;
      this.delayR[dI] = dl * 0.5;
      this.dIdx = (dI + 1) % D;
      const revIn = snareOut * 0.5 + (chL + chR) * 0.12 + leadOut * 0.18;
      let rev = 0;
      for (const cmb of this.combs) {
        const y = cmb.buf[cmb.i];
        cmb.lp = y * 0.7 + cmb.lp * 0.3;
        cmb.buf[cmb.i] = revIn + cmb.lp * 0.8;
        cmb.i = (cmb.i + 1) % cmb.buf.length;
        rev += y;
      }
      for (const ap of this.allpass) {
        const y = ap.buf[ap.i];
        ap.buf[ap.i] = rev + y * 0.5;
        ap.i = (ap.i + 1) % ap.buf.length;
        rev = y - rev * 0.5;
      }
      rev *= 0.12;

      const harmonicL = (bassOut + chL + arpL + leadOut) * duck;
      const harmonicR = (bassOut + chR + arpR + leadOut) * duck;
      let l = drums + hatOut * 0.8 + crashOut + riserOut + harmonicL + dl * 0.9 + rev;
      let r = drums + hatOut * 1.1 + crashOut + riserOut + harmonicR + dr * 0.9 + rev;

      // Intro abrindo o filtro; final fechando. Intensidade (menus) abafa e abaixa.
      let filterMul = 1;
      if (sec.filterRise) filterMul = 0.08 + 0.92 * ((this.barInSection * 16 + Math.max(0, this.stepInBar)) / (sec.bars * 16)) ** 2;
      if (sec.filterFall) filterMul = 1 - 0.9 * ((this.barInSection * 16 + Math.max(0, this.stepInBar)) / (sec.bars * 16));
      if ((this.counter & 31) === 0) {
        const cut = (600 + 17400 * this.intensity ** 2) * filterMul;
        this.master[0].set(cut, 0.75, sr); this.master[1].set(cut, 0.75, sr);
      }
      const gain = 0.62 * (0.55 + 0.45 * this.intensity);
      l = Math.tanh(this.master[0].lp(l) * gain * 1.2) * 0.8;
      r = Math.tanh(this.master[1].lp(r) * gain * 1.2) * 0.8;
      outL[n] = l;
      outR[n] = r;
    }
  }
}
