// AudioWorklet da música: toca o eurobeat procedural (MusicDSP) em estéreo.
// Mensagens: { type: 'intensity', value } · { type: 'next' } · { type: 'song', index }. Avisa a música atual com { type: 'song', name, index, bpm }.
import { MusicDSP } from './music-dsp.js';

class MusicProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { song = 0, intensity = 1 } = options?.processorOptions || {};
    this.dsp = new MusicDSP(sampleRate, { song });
    this.dsp.setIntensity(intensity);
    this.dsp.intensity = intensity;
    const announce = (s) => this.port.postMessage({ type: 'song', index: s.index, name: s.name, bpm: s.bpm });
    this.dsp.onSong = announce;
    announce(this.dsp.song);
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'intensity') this.dsp.setIntensity(m.value);
      else if (m.type === 'next') this.dsp.nextSong();
      else if (m.type === 'song') this.dsp.loadSong(m.index);
    };
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const left = out[0], right = out[1] || (this.mono ||= new Float32Array(left.length));
    this.dsp.process(left, right);
    return true;
  }
}

registerProcessor('music', MusicProcessor);
