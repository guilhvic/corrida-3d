// Gera um .wav do som do motor pilotando o carro na física do jogo, para ouvir fora do navegador.
// Uso: node tools/render-engine.js [saida.wav] [perfil: i4t | i6t | rotary]
import { writeFileSync } from 'node:fs';
import { createCar, stepCar } from '../src/physics.js';
import { SURFACES } from '../src/track.js';
import { EngineDSP } from '../src/engine-dsp.js';

const SR = 44100;
const DT = 1 / 240;
const out = process.argv[2] || 'motor-demo.wav';

// [início (s), fim (s), acelerador, descrição]
const script = [
  [0, 2.5, 0, 'marcha lenta'],
  [2.5, 2.9, 1, 'acelerada parado'],
  [2.9, 3.6, 0, ''],
  [3.6, 4.0, 1, 'acelerada parado'],
  [4.0, 5.0, 0, ''],
  [5.0, 15.0, 1, 'acelerador cheio passando marchas'],
  [15.0, 17.5, 0, 'tira o pé (válvula de alívio + estalos)'],
  [17.5, 21.5, 0.55, 'meio acelerador'],
  [21.5, 23.0, 0, 'desacelera'],
];
const total = script[script.length - 1][1];

const car = createCar();
const dsp = new EngineDSP(SR, 7, { profile: process.argv[3] || 'i4t' });
const samples = new Float32Array(Math.round(total * SR));
const block = new Float32Array(Math.round(SR * DT));
const segments = script.map(([a, b, , label]) => ({ a, b, label, peak: 0, sumSq: 0, n: 0, rpmMax: 0 }));

let written = 0;
for (let t = 0; t < total; t += DT) {
  const seg = script.findIndex(([a, b]) => t >= a && t < b);
  const throttle = script[seg]?.[2] ?? 0;
  stepCar(car, { throttle, brake: 0, steer: 0, handbrake: 0 }, DT, SURFACES.asphalt, SURFACES.asphalt);
  dsp.setTarget(car.rpm, car.limiter ? 0 : car.throttle);
  dsp.process(block);
  const s = segments[seg];
  for (let i = 0; i < block.length && written < samples.length; i++, written++) {
    samples[written] = block[i];
    if (s) { s.peak = Math.max(s.peak, Math.abs(block[i])); s.sumSq += block[i] ** 2; s.n++; }
  }
  if (s) s.rpmMax = Math.max(s.rpmMax, car.rpm);
}

// WAV PCM 16 bits mono
const data = Buffer.alloc(44 + samples.length * 2);
data.write('RIFF', 0); data.writeUInt32LE(36 + samples.length * 2, 4); data.write('WAVE', 8);
data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
data.write('data', 36); data.writeUInt32LE(samples.length * 2, 40);
let clipped = 0, nans = 0;
for (let i = 0; i < samples.length; i++) {
  const v = samples[i];
  if (!Number.isFinite(v)) nans++;
  if (Math.abs(v) >= 1) clipped++;
  data.writeInt16LE(Math.round(clamp(v) * 32767), 44 + i * 2);
}
function clamp(v) { return Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0; }
writeFileSync(out, data);

for (const s of segments) {
  if (!s.label) continue;
  const rms = Math.sqrt(s.sumSq / Math.max(1, s.n));
  console.log(`${s.a.toFixed(1).padStart(5)}-${s.b.toFixed(1).padEnd(5)} ${s.label.padEnd(42)} pico ${s.peak.toFixed(2)}  rms ${rms.toFixed(3)}  até ${Math.round(s.rpmMax)} rpm`);
}
console.log(`\n${out}: ${total} s, ${clipped} amostras estouradas, ${nans} inválidas`);
