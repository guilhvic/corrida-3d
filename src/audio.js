// Som sintetizado com WebAudio: motor (EngineDSP num AudioWorklet), pneus cantando, vento e batidas,
// e a trilha eurobeat procedural (MusicDSP num AudioWorklet). Efeitos e música têm barramentos separados:
// na pausa e nos menus os efeitos calam e a música segue, abafada.
// Rivais: uma voz posicional por carro (motor + pneus) com o ouvinte na câmera.
import { EngineDSP } from './engine-dsp.js';

export class CarAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.workletReady = false;
    this.voices = [];
    this.lastCam = null;
    this.profile = 'i4t';
    this.musicOn = true;
    try { this.musicOn = localStorage.getItem('corrida3d.musica') !== '0'; } catch { /* sem storage */ }
    this.musicIntensity = 0.45;
    this.volumes = { master: 0.8, music: 0.6, engine: 0.8, rivals: 0.7, effects: 0.8 };
    this.onSong = null;
    this.song = null;
  }

  // --- Música ---------------------------------------------------------------------------------------------
  startMusic() {
    const ctx = this.ctx;
    ctx.audioWorklet.addModule(new URL('./music-worklet.js', import.meta.url)).then(() => {
      const first = Math.floor(Math.random() * 6);
      this.music = new AudioWorkletNode(ctx, 'music', { outputChannelCount: [2], processorOptions: { song: first, intensity: this.musicIntensity } });
      this.music.port.onmessage = (e) => {
        if (e.data.type !== 'song') return;
        this.song = e.data;
        if (this.musicOn) this.onSong?.(e.data);
      };
      this.music.connect(this.musicGain);
    }).catch((err) => console.warn('Música indisponível', err));
  }

  setMusicIntensity(v) {
    if (Math.abs(v - this.musicIntensity) < 0.01) return;
    this.musicIntensity = v;
    this.music?.port.postMessage({ type: 'intensity', value: v });
  }

  // Camadas da música pelo combo: 0 nada, 1 (x3), 2 (x5). lost: perdeu o combo
  setMusicCombo(level, lost = false) {
    if (level === this.musicCombo && !lost) return;
    this.musicCombo = level;
    this.music?.port.postMessage({ type: 'combo', level, lost });
  }

  setMusicOn(on) {
    this.musicOn = on;
    try { localStorage.setItem('corrida3d.musica', on ? '1' : '0'); } catch { /* sem storage */ }
    this.applyVolumes();
  }

  // Volumes da tela de configurações (0..1 cada)
  setVolumes(v) {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, V = this.volumes;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.75 * V.master, t, 0.05);
    this.musicGain.gain.setTargetAtTime(this.musicOn ? 0.5 * V.music : 0, t, 0.2);
    this.engineGain.gain.setTargetAtTime(0.55 * V.engine, t, 0.05);
    this.rivalBus.gain.setTargetAtTime(V.rivals, t, 0.05);
    this.fx.gain.setTargetAtTime(V.effects, t, 0.05);
  }

  nextSong() {
    if (!this.musicOn) this.setMusicOn(true);
    this.music?.port.postMessage({ type: 'next' });
  }

  // Motor do carro do jogador (perfil de ENGINE_PROFILES). Troca a voz na hora se o áudio já estiver rodando.
  setEngine(profile) {
    if (profile === this.profile) return;
    this.profile = profile;
    if (!this.ctx || !this.workletReady) return;
    this.engineNode?.disconnect();
    this.createEngineNode();
  }

  createEngineNode() {
    const ctx = this.ctx;
    const node = (this.engineNode = new AudioWorkletNode(ctx, 'engine', { outputChannelCount: [1], processorOptions: { profile: this.profile } }));
    node.connect(this.engineGain);
    this.engine = {
      set: (rpm, load, t) => {
        node.parameters.get('rpm').setTargetAtTime(rpm, t, 0.01);
        node.parameters.get('load').setTargetAtTime(load, t, 0.015);
      },
    };
  }

  start() {
    // Botão de controle nem sempre conta como gesto do usuário: tenta retomar a cada chamada.
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const ctx = (this.ctx = new AudioContext());
    this.noiseBuffer = null;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.5 : 0;
    this.musicGain.connect(this.master);
    this.fx = ctx.createGain(); // pneus, vento, zebra, chuva e batidas
    this.fx.connect(this.sfx);

    // Motor: síntese física num AudioWorklet (thread de áudio). Sem suporte, roda o mesmo DSP num ScriptProcessor.
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.55;
    this.engineGain.connect(this.sfx);
    this.engine = null;
    if (!ctx.audioWorklet) this.startScriptEngine();
    else ctx.audioWorklet.addModule(new URL('./engine-worklet.js', import.meta.url))
      .then(() => {
        this.workletReady = true;
        this.createEngineNode();
        this.startMusic();
      })
      .catch(() => this.startScriptEngine());

    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = noise;
    const makeNoise = (type, freq, q) => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.fx);
      src.start();
      return g;
    };
    this.skidGain = makeNoise('bandpass', 1100, 2.5);
    this.rivalBus = ctx.createGain();
    this.rivalBus.gain.value = 1;
    this.rivalBus.connect(this.sfx);
    this.windGain = makeNoise('lowpass', 500, 0.5);
    this.rainGain = makeNoise('highpass', 1800, 0.4);
    this.rainLow = makeNoise('lowpass', 300, 0.6);
    this.setRain(this.raining);
    this.rumbleGain = makeNoise('lowpass', 120, 1);
    this.applyVolumes();
  }

  startScriptEngine() {
    const dsp = new EngineDSP(this.ctx.sampleRate, 7, { profile: this.profile });
    const node = this.ctx.createScriptProcessor(1024, 0, 1);
    node.onaudioprocess = (e) => dsp.process(e.outputBuffer.getChannelData(0));
    node.connect(this.engineGain);
    this.engine = { set: (rpm, load) => dsp.setTarget(rpm, load) };
  }

  // Chuva: chiado agudo contínuo mais um ronco grave de fundo.
  setRain(on) {
    this.raining = on;
    if (!this.ctx || !this.rainGain) return;
    const t = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.4);
    this.rainLow.gain.setTargetAtTime(on ? 0.09 : 0, t, 0.4);
  }

  setMuted(m) {
    this.muted = m;
    this.applyVolumes();
  }

  suspend(paused) {
    if (!this.ctx) return;
    // Só os efeitos calam: a música continua (o jogo abafa pela intensidade)
    if (this.ctx.state === 'suspended' && !paused) this.ctx.resume();
    this.sfx.gain.setTargetAtTime(paused ? 0 : 1, this.ctx.currentTime, 0.04);
  }

  // Pancada: estouro de ruído grave com decaimento rápido. Com at = { x, z } sai da posição da batida.
  impact(strength, at = null) {
    if (!this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx, t = ctx.currentTime;
    let dest = this.fx;
    if (at) {
      dest = new PannerNode(ctx, { panningModel: 'equalpower', distanceModel: 'inverse', refDistance: 4, rolloffFactor: 1.4, positionX: at.x, positionY: 0.5, positionZ: at.z });
      dest.connect(this.fx);
      setTimeout(() => dest.disconnect(), 600);
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 300 + strength * 90;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(1, 0.15 + strength * 0.08), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random());
    src.stop(t + 0.4);
  }

  createVoice(i, profile = 'i4t') {
    const ctx = this.ctx;
    const panner = new PannerNode(ctx, {
      panningModel: 'equalpower', distanceModel: 'inverse', refDistance: 5, rolloffFactor: 1.3, maxDistance: 500,
    });
    panner.connect(this.rivalBus);
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(panner);
    // Cada rival com escapamento de comprimento diferente: timbres distintos no pelotão.
    const node = new AudioWorkletNode(ctx, 'engine', {
      outputChannelCount: [1], processorOptions: { seed: 101 + i * 17, pipeScale: 0.9 + ((i * 37) % 5) * 0.05, profile },
    });
    node.connect(out);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1000 + i * 45;
    f.Q.value = 2.5;
    const skid = ctx.createGain();
    skid.gain.value = 0;
    src.connect(f).connect(skid).connect(panner);
    src.start(0, Math.random() * 1.5);
    return { panner, out, node, skid, profile };
  }

  // rivals: entradas de Rivals.list ({ car }); camera: posição/orientação do ouvinte.
  updateRivals(rivals, camera, dt) {
    if (!this.ctx || !this.workletReady || !this.noiseBuffer) return;
    const ctx = this.ctx, t = ctx.currentTime, L = ctx.listener;
    const p = camera.position;
    const e = camera.matrixWorld.elements; // colunas: x, y, z (a câmera olha para -z)
    const set = (param, value) => param.setTargetAtTime(value, t, 0.02);
    if (L.positionX) {
      set(L.positionX, p.x); set(L.positionY, p.y); set(L.positionZ, p.z);
      set(L.forwardX, -e[8]); set(L.forwardY, -e[9]); set(L.forwardZ, -e[10]);
      set(L.upX, e[4]); set(L.upY, e[5]); set(L.upZ, e[6]);
    } else {
      L.setPosition(p.x, p.y, p.z);
      L.setOrientation(-e[8], -e[9], -e[10], e[4], e[5], e[6]);
    }
    // Velocidade da câmera para o efeito Doppler (o WebAudio não faz mais sozinho).
    const cam = this.lastCam || { x: p.x, z: p.z };
    const cvx = (p.x - cam.x) / Math.max(dt, 1e-3), cvz = (p.z - cam.z) / Math.max(dt, 1e-3);
    this.lastCam = { x: p.x, z: p.z };

    rivals.forEach((rival, i) => {
      // Voz por rival com o motor do carro dele (recria se o carro daquela vaga mudou)
      if (this.voices[i] && this.voices[i].profile !== (rival.engine || 'i4t')) {
        this.voices[i].out.disconnect(); this.voices[i].node.disconnect(); this.voices[i].skid.disconnect(); this.voices[i] = null;
      }
      const v = (this.voices[i] ||= this.createVoice(i, rival.engine || 'i4t'));
      const c = rival.car;
      v.panner.positionX.setTargetAtTime(c.x, t, 0.02);
      v.panner.positionY.setTargetAtTime(0.5, t, 0.02);
      v.panner.positionZ.setTargetAtTime(c.z, t, 0.02);
      const dx = c.x - p.x, dz = c.z - p.z, dist = Math.max(1, Math.hypot(dx, dz));
      const away = ((c.vx - cvx) * dx + (c.vz - cvz) * dz) / dist; // + = se afastando
      const doppler = Math.min(1.25, Math.max(0.8, 343 / (343 + away)));
      v.node.parameters.get('rpm').setTargetAtTime(c.rpm * doppler, t, 0.02);
      v.node.parameters.get('load').setTargetAtTime(c.limiter ? 0 : c.throttle, t, 0.03);
      const squeal = c.speed > 3 ? Math.min(1, Math.max(0, (Math.abs(c.slipR) - 0.12) * 4) + c.wheelspin * 0.6) : 0;
      v.skid.gain.setTargetAtTime(squeal * 0.08, t, 0.05);
      v.out.gain.setTargetAtTime(0.4, t, 0.1);
    });
    for (let i = rivals.length; i < this.voices.length; i++) {
      this.voices[i].out.gain.setTargetAtTime(0, t, 0.05);
      this.voices[i].skid.gain.setTargetAtTime(0, t, 0.05);
    }
  }

  update(car, skid, onRumble) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // No corte de giro a carga cai a zero: o motor "engasga" como um limitador de verdade.
    this.engine?.set(car.rpm, car.limiter ? 0 : car.throttle, t);
    this.skidGain.gain.setTargetAtTime(Math.min(1, skid) * 0.07, t, 0.05);
    this.windGain.gain.setTargetAtTime(Math.min(1, car.speed / 70) * 0.12, t, 0.1);
    this.rumbleGain.gain.setTargetAtTime(onRumble ? Math.min(1, car.speed / 20) * 0.5 : 0, t, 0.03);
  }
}
