// Laboratório da IA: simula corredores de IA na pista, sem navegador, e mostra ritmo, pontos e batidas.
// Uso: node tools/ai-lab.js [bots=1] [voltas=3] [skill=0.8]   (TRACK=fujimi|hakone CAR=seiran para variar)
import { createCar, stepCar, setCarParams, ENV } from '../src/physics.js';
import { carById } from '../src/catalog.js';
import { buildTrack, FUJIMI_POINTS, HAKONE_POINTS, nearestIndex, carSurfaces, followGround, SURFACES } from '../src/track.js';
import { collideWalls } from '../src/walls.js';
import { DriftScorer } from '../src/drift.js';
import { LapTimer } from '../src/laps.js';
import { applyDifficulty } from '../src/difficulty.js';
import { DriftDriver } from '../src/ai.js';
import { collideCars } from '../src/traffic.js';
import { gridSlot, RIVALS } from '../src/race.js';

const DT = 1 / 240;
if (process.env.GRIP) ENV.grip = Number(process.env.GRIP); // chuva: GRIP=0.8
const [bots = 1, laps = 3, skill = 0.8] = process.argv.slice(2).map(Number);
const TRACK_POINTS = { fujimi: FUJIMI_POINTS, hakone: HAKONE_POINTS };
const track = buildTrack(TRACK_POINTS[process.env.TRACK]);
const racers = [];
for (let i = 0; i < bots; i++) {
  const slot = gridSlot(track, i);
  const car = createCar(slot.x, slot.z, slot.yaw);
  setCarParams(car, carById(process.env.CAR || RIVALS[i % RIVALS.length].car).params);
  applyDifficulty(car, 'facil');
  const s = skill - (i % 4) * 0.05;
  racers.push({
    car, idx: slot.idx, scorer: new DriftScorer(), timer: new LapTimer(track), driver: new DriftDriver(car, track, { skill: s, lane: slot.lane, seed: 7 + i * 13 }),
    walls: 0, carHits: 0, drift: 0, spins: 0, lost: {}, finished: null, stuck: 0,
  });
}
for (const r of racers) { r.timer.bestLap = null; r.timer.startAt(r.idx); }

let t = 0;
const limit = 90 * laps + 60;
for (; t < limit && racers.some((r) => r.finished === null); t += DT) {
  for (const r of racers) {
    const others = racers.filter((o) => o !== r).map((o) => o.car);
    const inp = r.driver.update(r.idx, DT, others);
    const [sf, sr] = carSurfaces(track, r.car, r.idx, r.car.params.a, r.car.params.b);
    stepCar(r.car, inp, DT, sf, sr); // depois da chegada continua andando (volta de desaceleração)
    r.idx = nearestIndex(track, r.car.x, r.car.z, r.idx);
    followGround(r.car, track, r.idx); // rampa (só nas pistas com altura)
    const hit = collideWalls(r.car, track, r.idx);
    r.impact = hit ? hit.speed : 0;
    if (hit && hit.speed > 1.2) {
      r.walls++;
      if (process.env.DEBUG) console.log(`parede idx=${r.idx} (${track.x[r.idx].toFixed(0)}, ${track.z[r.idx].toFixed(0)}) v=${r.car.speed.toFixed(1)} impacto=${hit.speed.toFixed(1)}`);
    }
  }
  const contacts = collideCars(racers.map((r) => r.car));
  for (const c of contacts) {
    for (const k of [c.a, c.b]) { racers[k].impact = Math.max(racers[k].impact, c.speed); if (c.speed > 1.2) racers[k].carHits++; }
  }
  for (const r of racers) {
    if (r.finished !== null) continue;
    r.scorer.update(DT, { angle: r.car.driftAngle, speed: r.car.speed, onGrass: false, wallImpact: r.impact, wallDistance: 9 });
    for (const ev of r.scorer.events.splice(0)) if (ev.type === 'lost') r.lost[ev.reason] = (r.lost[ev.reason] || 0) + 1;
    if (r.scorer.active) r.drift += DT;
    r.timer.update(DT, r.car, r.idx, () => { if (r.timer.lap === laps) r.scorer.bank(); return r.scorer.startLap(); });
    for (const ev of r.timer.events.splice(0)) if (ev.lap >= laps) r.finished = t;
    r.stuck = r.car.speed < 2 ? r.stuck + DT : 0;
    if (r.stuck > 4) {
      r.finished = -1;
      if (process.env.DEBUG) console.log(`travou #${racers.indexOf(r) + 1} t=${t.toFixed(1)} idx=${r.idx} volta=${r.timer.lap} beta=${(r.car.driftAngle * 57.3).toFixed(0)} yaw-pista=${((Math.atan2(Math.sin(r.car.yaw - Math.atan2(track.tx[r.idx], track.tz[r.idx])), Math.cos(r.car.yaw - Math.atan2(track.tx[r.idx], track.tz[r.idx])))) * 57.3).toFixed(0)} inp=${JSON.stringify(r.driver.input)} vizinhos=${racers.filter((o) => o !== r && Math.hypot(o.car.x - r.car.x, o.car.z - r.car.z) < 15).length}`);
    }
  }
}

const pad = (v, n) => String(v).padStart(n);
console.log(`pista ${track.length.toFixed(0)} m · ${bots} bot(s) · ${laps} volta(s) · skill ${skill}`);
console.log(' #  skill  chegada   pontos  drift%  paredes  carros  perdas');
racers.forEach((r, i) => {
  const time = r.finished === null ? 'não chegou' : r.finished < 0 ? 'TRAVOU' : `${r.finished.toFixed(1)} s`;
  console.log(`${pad(i + 1, 2)}  ${r.driver.skill.toFixed(2)}  ${pad(time, 10)}  ${pad(Math.round(r.scorer.total), 6)}  ${pad(Math.round((100 * r.drift) / Math.max(1, r.finished > 0 ? r.finished : t)), 5)}%  ${pad(r.walls, 7)}  ${pad(r.carHits, 6)}  ${JSON.stringify(r.lost)}`);
});
