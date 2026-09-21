// Som ambiente de cada pista, sintetizado na hora (nenhum arquivo de áudio, como o motor e a trilha).
// Camadas contínuas (cigarras, vento, água, maquinário) e eventos esparsos (corvo, sino da passagem de
// nível quando o trem passa, buzina de navio, batida do portêiner). Tudo pendurado num barramento só,
// com volume próprio em CONFIGURAÇÕES › ÁUDIO › AMBIENTE.

const rand = (a, b) => a + Math.random() * (b - a);

export class Ambience {
  constructor(ctx, out, noiseBuffer) {
    this.ctx = ctx;
    this.out = out;
    this.noise = noiseBuffer;
    this.layers = [];   // camadas contínuas: { gain, target, update? }
    this.sources = [];  // ruídos e osciladores contínuos da cena (param no clear: senão seguem rodando no áudio)
    this.events = [];   // eventos esparsos: { timer, fire() }
    this.scene = null;
    this.time = 0;
  }

  // --- Blocos de síntese ----------------------------------------------------------------------------
  noiseThrough(type, freq, q = 0.7) {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.out);
    src.start();
    this.sources.push(src);
    return { src, filter, gain };
  }

  // Oscilador lento ligado a um parâmetro (rajadas de vento, respiração das cigarras).
  lfo(param, { freq, depth, center }) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    const amp = ctx.createGain();
    amp.gain.value = depth;
    param.value = center;
    osc.connect(amp).connect(param);
    osc.start();
    this.sources.push(osc);
    return osc;
  }

  // --- Camadas --------------------------------------------------------------------------------------
  // Cigarras: ruído agudo picotado por um tremolo rápido, com o coro indo e voltando devagar.
  cicadas(level) {
    for (const [freq, q, trem, vol] of [[4600, 5, 41, 0.6], [5600, 7, 53, 0.45], [6600, 9, 67, 0.3]]) {
      const n = this.noiseThrough('bandpass', freq, q);
      const chop = this.ctx.createGain();
      n.gain.disconnect();
      n.gain.connect(chop).connect(this.out);
      this.lfo(chop.gain, { freq: trem, depth: 0.5, center: 0.5 });
      n.gain.gain.value = level * vol;
      this.lfo(n.gain.gain, { freq: rand(0.05, 0.11), depth: level * vol * 0.6, center: level * vol });
      this.layers.push({ gain: n.gain });
    }
  }

  // Vento na mata: ruído grave com o corte e o volume respirando em rajadas.
  wind(level, { cutoff = 620, leaves = 0.5 } = {}) {
    const low = this.noiseThrough('lowpass', cutoff, 0.6);
    low.gain.gain.value = level;
    this.lfo(low.gain.gain, { freq: 0.06, depth: level * 0.7, center: level });
    this.lfo(low.filter.frequency, { freq: 0.09, depth: cutoff * 0.4, center: cutoff });
    this.layers.push({ gain: low.gain });
    if (leaves > 0) {
      const hiss = this.noiseThrough('bandpass', 2600, 1.2);
      hiss.gain.gain.value = level * leaves;
      this.lfo(hiss.gain.gain, { freq: 0.13, depth: level * leaves * 0.9, center: level * leaves * 0.8 });
      this.layers.push({ gain: hiss.gain });
    }
  }

  // Água escorrendo na valeta: chiado fino contínuo mais gotas soltas.
  water(level) {
    const flow = this.noiseThrough('bandpass', 3400, 0.9);
    flow.gain.gain.value = level;
    this.lfo(flow.gain.gain, { freq: 0.23, depth: level * 0.35, center: level });
    this.layers.push({ gain: flow.gain });
    this.every([0.25, 1.4], () => this.drop(level));
  }

  // Zumbido grave do pátio do porto (guindastes e navios parados).
  machinery(level) {
    const hum = this.noiseThrough('lowpass', 110, 1.4);
    hum.gain.gain.value = level;
    this.lfo(hum.gain.gain, { freq: 0.05, depth: level * 0.4, center: level });
    this.layers.push({ gain: hum.gain });
  }

  // --- Eventos --------------------------------------------------------------------------------------
  every([min, max], fire) {
    this.events.push({ timer: rand(min, max), min, max, fire });
  }

  // Gota d'água: estalo curto de banda estreita.
  drop(level) {
    const { ctx } = this;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(rand(900, 2600), t);
    f.frequency.exponentialRampToValueAtTime(rand(1800, 4200), t + 0.06);
    f.Q.value = 14;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level * 1.6, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(f).connect(g).connect(this.out);
    src.start(t);
    src.stop(t + 0.12);
  }

  // Corvo: duas ou três notas roucas caindo de tom.
  crow(level) {
    const { ctx } = this;
    let t = ctx.currentTime + rand(0, 0.3);
    const caws = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < caws; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const f0 = rand(380, 470);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.62, t + 0.3);
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1250;
      band.Q.value = 2.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      osc.connect(band).connect(g).connect(this.out);
      osc.start(t);
      osc.stop(t + 0.36);
      t += rand(0.42, 0.6);
    }
  }

  // Batida metálica do pátio de contêineres.
  clank(level) {
    const { ctx } = this;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.8, 1.6));
    g.connect(this.out);
    const base = rand(160, 260);
    for (const mult of [1, 2.76, 5.4, 8.9]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = base * mult * rand(0.98, 1.02);
      const p = ctx.createGain();
      p.gain.value = 1 / (mult * 1.6);
      osc.connect(p).connect(g);
      osc.start(t);
      osc.stop(t + 1.8);
    }
  }

  // Buzina de navio: duas notas graves batendo juntas, com ataque lento.
  shipHorn(level) {
    const { ctx } = this;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.5);
    g.gain.setValueAtTime(level, t + 2.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 700;
    g.connect(this.out);
    for (const f of [98, 116, 147]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f * rand(0.995, 1.005);
      osc.connect(low).connect(g);
      osc.start(t);
      osc.stop(t + 3.8);
    }
  }

  // Sino da passagem de nível: duas notas alternando enquanto o trem passa.
  crossingDing(level, high) {
    const { ctx } = this;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    g.connect(this.out);
    for (const [mult, vol] of [[1, 1], [2.02, 0.5], [3.03, 0.25]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = (high ? 880 : 660) * mult;
      const p = ctx.createGain();
      p.gain.value = vol;
      osc.connect(p).connect(g);
      osc.start(t);
      osc.stop(t + 0.5);
    }
  }

  // --- Montagem por pista ---------------------------------------------------------------------------
  // trackId: wangan | fujimi | hakone. timeId: horário/clima escolhido.
  setScene(trackId, timeId) {
    const key = `${trackId}:${timeId}`;
    if (key === this.scene) return;
    this.scene = key;
    this.clear();
    const night = timeId === 'noite';
    if (trackId === 'fujimi') {
      // Entardecer é a hora das cigarras; de noite elas dão lugar aos grilos e ao vento.
      if (timeId === 'tarde') { this.cicadas(0.2); this.wind(0.03, { leaves: 0.7 }); }
      else if (night) { this.cicadas(0.055); this.wind(0.04, { cutoff: 480, leaves: 0.5 }); }
      else this.wind(0.06, { cutoff: 400, leaves: 0.35 }); // manhã com neblina: só o vento no vale
      this.every([14, 50], () => this.crow(0.16));
    } else if (trackId === 'hakone') {
      this.wind(night ? 0.07 : 0.095, { cutoff: 560, leaves: 0.8 });
      this.water(0.045);
      this.every([20, 70], () => this.crow(0.12));
    } else {
      this.machinery(0.1);
      this.every([9, 26], () => this.clank(0.14));
      this.every([45, 110], () => this.shipHorn(0.18));
    }
  }

  // Sino da passagem de nível enquanto o trem está na reta (info.train), e nada quando ele some.
  update(dt, { train = 0 } = {}) {
    this.time += dt;
    for (const e of this.events) {
      e.timer -= dt;
      if (e.timer <= 0) { e.timer = rand(e.min, e.max); e.fire(); }
    }
    if (train > 0) {
      this.bellTimer = (this.bellTimer ?? 0) - dt;
      if (this.bellTimer <= 0) {
        this.bellTimer = 0.42;
        this.bellHigh = !this.bellHigh;
        this.crossingDing(0.14 * train, this.bellHigh);
      }
    } else this.bellTimer = 0;
  }

  clear() {
    for (const l of this.layers) l.gain.disconnect();
    for (const s of this.sources) { try { s.stop(); } catch { /* já parado */ } s.disconnect(); }
    this.sources = [];
    this.layers = [];
    this.events = [];
  }
}
