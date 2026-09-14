// Gera um .wav estéreo de uma música eurobeat do jogo, para ouvir fora do navegador.
// Uso: node tools/render-music.js [saida.wav] [música 0-5] [segundos=90] [início em compassos=0]
import { writeFileSync } from 'node:fs';
import { MusicDSP, SONGS } from '../src/music-dsp.js';

const SR = 44100;
const out = process.argv[2] || 'musica.wav';
const index = Number(process.argv[3] ?? 0);
const seconds = Number(process.argv[4] ?? 90);
const skipBars = Number(process.argv[5] ?? 0);

const dsp = new MusicDSP(SR, { song: index });
const song = dsp.song;
const total = Math.round(seconds * SR);
const L = new Float32Array(total), R = new Float32Array(total);
const block = 512;
const bl = new Float32Array(block), br = new Float32Array(block);

// Pula compassos iniciais (para ouvir direto o refrão, por exemplo)
const skipSamples = Math.round(skipBars * 16 * dsp.stepSamples);
for (let done = 0; done < skipSamples; done += block) dsp.process(bl, br);

const t0 = performance.now();
let peak = 0, sumSq = 0, bad = 0;
for (let n = 0; n < total; n += block) {
  dsp.process(bl, br);
  for (let i = 0; i < block && n + i < total; i++) {
    L[n + i] = bl[i]; R[n + i] = br[i];
    if (!Number.isFinite(bl[i]) || !Number.isFinite(br[i])) bad++;
    peak = Math.max(peak, Math.abs(bl[i]), Math.abs(br[i]));
    sumSq += bl[i] * bl[i] + br[i] * br[i];
  }
}
const ms = performance.now() - t0;

const data = Buffer.alloc(44 + total * 4);
data.write('RIFF', 0); data.writeUInt32LE(36 + total * 4, 4); data.write('WAVE', 8);
data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22);
data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
data.write('data', 36); data.writeUInt32LE(total * 4, 40);
const clamp = (v) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
for (let i = 0; i < total; i++) {
  data.writeInt16LE(Math.round(clamp(L[i]) * 32767), 44 + i * 4);
  data.writeInt16LE(Math.round(clamp(R[i]) * 32767), 46 + i * 4);
}
writeFileSync(out, data);
console.log(`${song.name}: ${song.bpm} BPM, ${song.bars} compassos (${(song.bars * 16 * dsp.stepSamples / SR / 60).toFixed(1)} min), seções ${song.sections.map((s) => `${s.name}:${s.bars}`).join(' ')}`);
console.log(`${out}: ${seconds} s, pico ${peak.toFixed(2)}, rms ${Math.sqrt(sumSq / (total * 2)).toFixed(3)}, ${bad} amostras inválidas, ${(ms / (seconds * 1000) * 100).toFixed(1)}% do tempo real`);
void SONGS;
