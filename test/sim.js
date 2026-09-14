// Testes headless: física de drift, paredes, pontuação, voltas e pilotagem de teclado.
import { CAR, createCar, stepCar } from '../src/physics.js';
import { buildTrack, FUJIMI_POINTS, nearestIndex, carSurfaces, lateralOffset, SURFACES, ROAD_HALF_WIDTH, WALL_OFFSET } from '../src/track.js';
import { botInput } from '../src/bot.js';
import { collideWalls, CAR_HALF_LENGTH } from '../src/walls.js';
import { DriftScorer, DRIFT } from '../src/drift.js';
import { DriftDriver } from '../src/ai.js';
import { collideCars } from '../src/traffic.js';
import { gridSlot, RIVALS } from '../src/race.js';
import { LapTimer } from '../src/laps.js';
import { applyDifficulty } from '../src/difficulty.js';

const DT = 1 / 240;
const PACE_ANALOG = 0.7;   // ritmo do bot analógico nos testes de volta
const PACE_KEYBOARD = 0.55; // ritmo do bot com entradas de teclado
const DEG = 180 / Math.PI;
const asphalt = SURFACES.asphalt;
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failures++; };

const approach = (v, t, r) => (v < t ? Math.min(t, v + r) : Math.max(t, v - r));
// Mesmas rampas do teclado no jogo (src/input.js).
function keyboard() {
  const k = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
  return (want) => {
    k.throttle = approach(k.throttle, want.throttle, DT * (want.throttle ? 5 : 8));
    k.brake = approach(k.brake, want.brake || 0, DT * (want.brake ? 7 : 10));
    k.handbrake = want.handbrake || 0;
    const rev = want.steer !== 0 && k.steer !== 0 && Math.sign(want.steer) !== Math.sign(k.steer);
    k.steer = approach(k.steer, want.steer, DT * (want.steer === 0 ? 4.5 : rev ? 7 : 2.8));
    return k;
  };
}

const track = buildTrack();
const cityTrack = track;
const startPose = (i) => createCar(track.x[i], track.z[i], Math.atan2(track.tx[i], track.tz[i]));

// 1) Motor e freio
{
  const c = createCar();
  let t = 0, t100 = null;
  for (; t < 40; t += DT) {
    stepCar(c, { throttle: 1, brake: 0, steer: 0 }, DT, asphalt, asphalt);
    if (t100 === null && c.speed * 3.6 >= 100) t100 = t;
  }
  check(t100 > 3.5 && t100 < 7, `0-100 km/h em ${t100?.toFixed(2)} s`);
  check(Math.abs(c.x) < 0.5, `anda reto em aceleração máxima (desvio ${c.x.toFixed(3)} m)`);

  const b = createCar();
  b.vz = 100 / 3.6;
  let d = 0;
  for (let i = 0; i < 240 * 10 && (i === 0 || b.speed > 0.05); i++) {
    const z0 = b.z;
    stepCar(b, { throttle: 0, brake: 1, steer: 0 }, DT, asphalt, asphalt);
    d += b.z - z0;
  }
  check(d > 30 && d < 48, `frenagem 100-0 em ${d.toFixed(1)} m`);
}

// 2) Drift controlável no teclado com a assistência
function driftRun(v0, gear, fn, dur = 8, assist = true) {
  const c = createCar();
  c.vz = v0; c.gear = gear; c.driftAssist = assist;
  const keys = keyboard();
  let sum = 0, n = 0, spun = false;
  for (let t = 0; t < dur; t += DT) {
    stepCar(c, keys(fn(t)), DT, asphalt, asphalt);
    const a = Math.abs(c.driftAngle) * DEG;
    if (t > dur / 2 && c.speed > 3) { sum += a; n++; }
    if (a > 110 && c.speed > 3) spun = true;
  }
  return { avg: sum / Math.max(1, n), spun, kmh: c.speed * 3.6 };
}
for (const [name, v0, gear, fn, dur] of [
  ['donut em 2ª', 11, 2, () => ({ throttle: 1, steer: 1 })],
  ['acelerador cheio em curva de 3ª', 19, 3, () => ({ throttle: 1, steer: 1 })],
  ['puxada de freio de mão a 80 km/h', 22, 3, (t) => ({ throttle: t > 0.8 ? 1 : 0, steer: 1, handbrake: t > 0.2 && t < 0.7 ? 1 : 0 })],
  ['transições esquerda/direita', 19, 3, (t) => ({ throttle: 1, steer: Math.floor(t / 1.5) % 2 ? -1 : 1 }), 9],
]) {
  const r = driftRun(v0, gear, fn, dur);
  check(!r.spun && r.avg > 20 && r.avg < 65, `${name}: ângulo médio ${r.avg.toFixed(0)}°, sem rodar (${r.kmh.toFixed(0)} km/h)`);
}

// 3) Paredes
{
  const s = 100;
  const c = createCar(track.x[s], track.z[s], Math.atan2(track.nx[s], track.nz[s])); // de frente para a parede esquerda
  c.vx = Math.sin(c.yaw) * 27.8; c.vz = Math.cos(c.yaw) * 27.8;
  let idx = s, impact = 0, maxLat = 0;
  for (let t = 0; t < 2; t += DT) {
    stepCar(c, { throttle: 0, brake: 0, steer: 0 }, DT, asphalt, SURFACES.sidewalk);
    idx = nearestIndex(track, c.x, c.z, idx);
    const h = collideWalls(c, track, idx);
    if (h) impact = Math.max(impact, h.speed);
    maxLat = Math.max(maxLat, lateralOffset(track, idx, c.x, c.z));
  }
  check(impact > 20, `batida de frente a 100 km/h detectada (impacto ${impact.toFixed(1)} m/s)`);
  check(maxLat + CAR_HALF_LENGTH < WALL_OFFSET + 0.2, `não atravessa a parede (frente chegou a ${(maxLat + CAR_HALF_LENGTH).toFixed(2)} m, parede em ${WALL_OFFSET} m)`);
  check(c.speed * 3.6 < 30, `batida tira a velocidade (${(c.speed * 3.6).toFixed(0)} km/h depois)`);

  // Raspando de lado: desliza ao longo da parede sem entrar nela.
  const g = startPose(20);
  const yaw = g.yaw + 0.25; // aponta levemente para a esquerda
  g.x += track.nx[20] * (WALL_OFFSET - 3); g.z += track.nz[20] * (WALL_OFFSET - 3);
  g.vx = Math.sin(yaw) * 22; g.vz = Math.cos(yaw) * 22;
  let gi = 20, worst = 0, hits = 0;
  for (let t = 0; t < 1.5; t += DT) {
    stepCar(g, { throttle: 0.3, brake: 0, steer: 0 }, DT, asphalt, asphalt);
    gi = nearestIndex(track, g.x, g.z, gi);
    if (collideWalls(g, track, gi)) hits++;
    worst = Math.max(worst, Math.abs(lateralOffset(track, gi, g.x, g.z)));
  }
  check(hits > 0 && worst < WALL_OFFSET && g.speed > 10, `raspão de lado: ${hits} contatos, continua andando a ${(g.speed * 3.6).toFixed(0)} km/h`);
}

// 4) Pontuação
{
  const feed = (sc, secs, state) => { for (let t = 0; t < secs; t += 1 / 60) sc.update(1 / 60, state); };
  const drifting = { angle: 0.6, speed: 22, onGrass: false, wallImpact: 0, wallDistance: 5 };
  const straight = { angle: 0, speed: 22, onGrass: false, wallImpact: 0, wallDistance: 5 };

  const a = new DriftScorer();
  feed(a, 4, drifting);
  check(a.active && a.points > 300 && a.mult === 1.5, `drift de 4 s a 34°/80 km/h: ${Math.round(a.points)} pts, x${a.mult}`);
  feed(a, 1.5, straight);
  check(!a.active && a.total > 450, `combo fecha depois da tolerância e soma ${a.total} pts`);

  const b = new DriftScorer();
  feed(b, 1, drifting);
  feed(b, 1, { ...drifting, angle: -0.6 });
  check(b.mult === 1.5 && b.events.some((e) => e.label === 'TRANSIÇÃO'), 'transição de lado dá bônus e +0,5 no multiplicador');

  for (const [reason, state] of [['wall', { ...drifting, wallImpact: 3 }], ['grass', { ...drifting, onGrass: true }], ['spin', { ...drifting, angle: 2.2 }]]) {
    const s = new DriftScorer();
    feed(s, 2, drifting);
    s.update(1 / 60, state);
    check(s.total === 0 && s.events.some((e) => e.type === 'lost' && e.reason === reason), `perde o combo por ${reason}`);
  }
}

// 5) Voltas com o bot (analógico) + cronômetro e fantasma
{
  const start = track.N - 10;
  const c = startPose(start);
  const timer = new LapTimer(track);
  const scorer = new DriftScorer();
  let idx = start, t = 0, frame = 0, walls = 0, off = 0;
  while (timer.lap < 4 && t < 300) {
    const [sf, sr] = carSurfaces(track, c, idx, CAR.a, CAR.b);
    stepCar(c, botInput(c, track, idx, { pace: PACE_ANALOG }), DT, sf, sr);
    t += DT;
    idx = nearestIndex(track, c.x, c.z, idx);
    if (collideWalls(c, track, idx)) walls++;
    if (Math.abs(lateralOffset(track, idx, c.x, c.z)) > ROAD_HALF_WIDTH + 1) off += DT;
    if (++frame % 4 === 0) {
      scorer.update(4 * DT, { angle: c.driftAngle, speed: c.speed, onGrass: false, wallImpact: 0 });
      timer.update(4 * DT, c, idx, () => scorer.startLap() + 1); // +1: toda volta conta, mesmo sem drift do bot
    }
  }
  check(timer.lap === 4, `bot completou ${timer.lap - 1} voltas em ${t.toFixed(0)} s (${track.length.toFixed(0)} m de pista)`);
  check(walls === 0 && off < 0.5, `bot sem tocar paredes (${walls}) e sem sair da pista (${off.toFixed(1)} s)`);
  check(timer.lastLap && timer.lastLap.time > 35 && timer.lastLap.time < 80, `tempo de volta ${timer.lastLap?.time.toFixed(2)} s`);
  const lapSamples = timer.events.filter((e) => e.type === 'lap').at(-1)?.samples;
  check(lapSamples && lapSamples.length / 3 > 20 * 30, `trajetória da volta gravada com ${lapSamples ? lapSamples.length / 3 : 0} amostras (vai para o ranking)`);
}

// 6) Volta pilotando "de teclado" (Normal e Fácil)
for (const level of ['normal', 'facil']) {
  const start = track.N - 10;
  const c = startPose(start);
  applyDifficulty(c, level);
  const keys = keyboard();
  let idx = start, prev = start, t = 0, frame = 0, laps = 0, walls = 0, spins = 0;
  let want = { throttle: 0, brake: 0, steer: 0 };
  while (laps < 3 && t < 300) {
    if (frame++ % 4 === 0) {
      const b = botInput(c, track, idx, { pace: PACE_KEYBOARD });
      want = { steer: Math.abs(b.steer) > 0.25 ? Math.sign(b.steer) : 0, throttle: b.throttle > 0.5 ? 1 : 0, brake: b.brake > 0.3 ? 1 : 0 };
    }
    const [sf, sr] = carSurfaces(track, c, idx, CAR.a, CAR.b);
    stepCar(c, keys(want), DT, sf, sr);
    t += DT;
    idx = nearestIndex(track, c.x, c.z, idx);
    if (collideWalls(c, track, idx)) walls++;
    if (Math.abs(c.driftAngle) * DEG > 110 && c.speed > 3) spins++;
    if (prev > track.N * 0.8 && idx < track.N * 0.2) laps++;
    prev = idx;
  }
  check(laps >= 3 && walls === 0 && spins === 0, `volta com teclado (${level}): ${laps - 1} voltas completas, ${walls} contatos com parede, ${spins} passos rodando`);
}

// 7) Ré: segurar o freio parado engata em qualquer câmbio, com limite de velocidade
for (const automatic of [true, false]) {
  const c = createCar();
  c.vz = 8.3;
  c.automatic = automatic;
  const keys = keyboard();
  for (let t = 0; t < 6; t += DT) stepCar(c, keys({ throttle: 0, brake: 1, steer: 0 }), DT, asphalt, asphalt);
  check(c.gear === -1 && c.u * 3.6 < -35 && c.u * 3.6 > -45,
    `ré no câmbio ${automatic ? 'automático' : 'manual'}: freia, para e anda de ré a ${(-c.u * 3.6).toFixed(0)} km/h`);
  for (let t = 0; t < 4; t += DT) stepCar(c, keys({ throttle: 1, brake: 0, steer: 0 }), DT, asphalt, asphalt);
  check(c.gear >= 1 && c.u > 3, `  acelerar depois da ré para, engata a 1ª e sai para frente (${(c.u * 3.6).toFixed(0)} km/h)`);
}

// 8) Dificuldade Fácil: o esterço escolhe o ângulo
{
  const run = (fn, dur, v0 = 17, gear = 3) => {
    const c = createCar();
    applyDifficulty(c, 'facil');
    c.vz = v0; c.gear = gear;
    const keys = keyboard();
    const angles = [];
    let spun = false;
    for (let t = 0; t < dur; t += DT) {
      stepCar(c, keys(fn(t)), DT, asphalt, asphalt);
      const a = Math.abs(c.driftAngle) * DEG;
      angles.push([t, a]);
      if (a > 110 && c.speed > 3) spun = true;
    }
    const between = (t0, t1) => angles.filter(([t]) => t >= t0 && t < t1).map(([, a]) => a);
    const avg = (xs) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
    return { c, spun, between, avg };
  };

  const hold = run((t) => ({ throttle: t < 4 ? 1 : 0.3, steer: t < 4 ? 1 : 0 }), 5.5);
  const held = hold.between(1.5, 4);
  check(!hold.spun && hold.avg(held) > 35 && hold.avg(held) < 50 && Math.max(...held) - Math.min(...held) < 6,
    `Fácil: esterço todo + acelerador segura ${hold.avg(held).toFixed(0)}° (variação ${(Math.max(...held) - Math.min(...held)).toFixed(1)}°)`);
  const after = hold.between(5, 5.5);
  check(Math.max(...after) < 8, `Fácil: soltar o esterço endireita o carro em 1 s (${Math.max(...after).toFixed(1)}° depois)`);

  const grip = run(() => ({ throttle: 0, steer: 1 }), 2.5);
  check(Math.max(...grip.between(0, 2.5)) < 20, `Fácil: curva sem acelerador fica na aderência (máx. ${Math.max(...grip.between(0, 2.5)).toFixed(0)}°)`);

  const sw = run((t) => ({ throttle: 1, steer: Math.floor(t / 2) % 2 ? -1 : 1 }), 8);
  check(!sw.spun && sw.c.speed * 3.6 < 140, `Fácil: transições sem rodar e sem disparar a velocidade (${(sw.c.speed * 3.6).toFixed(0)} km/h)`);
}

// 9) Rivais de IA: sozinhos pontuam sem bater; em grupo de 8 todos completam a corrida
function aiRace(count, laps, track = cityTrack) {
  const racers = Array.from({ length: count }, (_, i) => {
    const slot = gridSlot(track, i);
    const car = createCar(slot.x, slot.z, slot.yaw);
    applyDifficulty(car, 'facil');
    return {
      car, idx: slot.idx, scorer: new DriftScorer(), timer: new LapTimer(track, { persist: false }),
      driver: new DriftDriver(car, track, { skill: RIVALS[i % RIVALS.length].skill, lane: slot.lane * 0.6, seed: 97 + i * 31 }),
      walls: 0, contacts: 0, done: false, impact: 0, carImpact: 0,
    };
  });
  const cars = racers.map((r) => r.car);
  for (const r of racers) r.timer.startAt(r.idx); // grid já depois da linha
  for (let t = 0; t < 70 * laps && racers.some((r) => !r.done); t += DT) {
    for (const r of racers) {
      const inp = r.driver.update(r.idx, DT, cars);
      const [sf, sr] = carSurfaces(track, r.car, r.idx, CAR.a, CAR.b);
      stepCar(r.car, inp, DT, sf, sr);
      r.idx = nearestIndex(track, r.car.x, r.car.z, r.idx);
      const hit = collideWalls(r.car, track, r.idx);
      r.impact = hit ? hit.speed : 0;
      if (hit && hit.speed > 1.2) r.walls++;
    }
    for (const c of collideCars(cars)) for (const k of [c.a, c.b]) { racers[k].carImpact = c.speed; if (c.speed > DRIFT.carImpact) racers[k].contacts++; }
    for (const r of racers) {
      if (!r.done) {
        r.scorer.update(DT, { angle: r.car.driftAngle, speed: r.car.speed, onGrass: false, wallImpact: r.impact, carImpact: r.carImpact, wallDistance: 9 });
        r.timer.update(DT, r.car, r.idx, () => r.scorer.startLap());
        if (r.timer.lap > laps) r.done = true;
      }
      r.scorer.events.length = 0; r.timer.events.length = 0; r.carImpact = 0;
    }
  }
  return racers;
}
{
  const [solo] = aiRace(1, 2);
  check(solo.done && solo.walls <= 1 && solo.scorer.total > 5000,
    `IA sozinha: 2 voltas, ${solo.walls} batida(s) na parede, ${Math.round(solo.scorer.total)} pts`);
  const pack = aiRace(8, 2);
  const finished = pack.filter((r) => r.done).length;
  const walls = pack.reduce((s, r) => s + r.walls, 0), contacts = pack.reduce((s, r) => s + r.contacts, 0);
  check(finished === 8 && walls <= 8, `IA em grupo de 8: ${finished}/8 completaram 2 voltas (${walls} batidas na parede, ${contacts} batidas entre carros)`);
}

// 10) Estrada de Fujimi: o traçado cabe o grid e a IA completa as voltas sem bater
{
  const fujimi = buildTrack(FUJIMI_POINTS);
  let tightest = 0;
  for (let j = 0; j < fujimi.N; j++) tightest = Math.max(tightest, Math.abs(fujimi.curv[j]));
  check(fujimi.length > 1100 && 1 / tightest > 18, `Fujimi: ${fujimi.length.toFixed(0)} m, curva mais fechada com raio de ${(1 / tightest).toFixed(0)} m`);
  const [solo] = aiRace(1, 2, fujimi);
  check(solo.done && solo.walls === 0, `Fujimi: IA sozinha fez 2 voltas com ${solo.walls} batida(s) na parede`);
  const pack = aiRace(8, 1, fujimi);
  const walls = pack.reduce((sum, r) => sum + r.walls, 0);
  check(pack.every((r) => r.done) && walls <= 4, `Fujimi: grupo de 8 completou a volta (${walls} batidas na parede)`);
}

// 11) Julgamento de estilo: curvas detectadas; drift ideal tira SS, passagem tímida tira nota baixa
{
  const { StyleJudge, findCorners } = await import('../src/styleJudge.js');
  const fujimi = buildTrack(FUJIMI_POINTS);
  const counts = [findCorners(track).length, findCorners(fujimi).length];
  check(counts[0] >= 6 && counts[1] >= 6, `curvas detectadas: porto ${counts[0]}, Fujimi ${counts[1]}`);
  const pass = (angle, lineGood, smoke) => {
    const judge = new StyleJudge(track);
    const c = judge.corners[2];
    for (let k = -3; k <= c.length + 3; k++) {
      const j = (c.start + k + track.N) % track.N, t = k / (c.length - 1);
      const zone = t < c.apexT - 0.18 ? -1 : t < c.apexT + 0.18 ? 1 : -1;
      const lateral = lineGood ? zone * c.sign * (ROAD_HALF_WIDTH - 1) : 0;
      for (let n = 0; n < 12; n++) judge.update(1 / 120, { idx: j, lateral, angle, speed: 18, smoke, drifting: true, failed: false });
    }
    return judge.events[0];
  };
  const best = pass(48, true, 1), weak = pass(14, false, 0.2);
  check(best?.grade === 'SS' && weak && ['C', 'D'].includes(weak.grade),
    `notas: drift ideal ${best?.grade} (${best?.score.toFixed(0)}), drift tímido ${weak?.grade} (${weak?.score.toFixed(0)})`);
}

// 12) Ranking de voltas: guarda as 10 melhores por pista e carro, com o fantasma de cada uma
{
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const { loadRanking, submitLap, pickGhost, unpackGhost } = await import('../src/ranking.js');
  const samples = [1.23, -4.56, 0.785, 2.5, -4.1, 0.8];
  const positions = [];
  for (let i = 0; i < 12; i++) positions.push(submitLap('wangan', 'seiran', { points: 1000 + ((i * 7919) % 5000), time: 50 + i }, samples));
  const list = loadRanking('wangan', 'seiran');
  const sorted = list.every((e, i) => i === 0 || list[i - 1].points >= e.points);
  const ghost = unpackGhost(pickGhost(list, 'best').ghost);
  const other = loadRanking('wangan', 'kaze180').length + loadRanking('fujimi', 'seiran').length;
  check(list.length === 10 && sorted && other === 0 && Math.abs(ghost[0] - 1.2) < 1e-9 && Math.abs(ghost[2] - 0.79) < 1e-9 && pickGhost(list, 'none') === null,
    `ranking: ${list.length} voltas ordenadas, posições ao entrar ${positions.join(',')}, fantasma ${ghost.slice(0, 3).join(' ')}`);
  delete globalThis.localStorage;
}

console.log(failures ? `\n${failures} falha(s)` : '\ntudo certo');
process.exit(failures ? 1 : 0);
