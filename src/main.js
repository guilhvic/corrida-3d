import * as THREE from 'three';
import { CAR, ENV, createCar, resetCar, stepCar, shift, paramsOf, setCarParams } from './physics.js';
import { nearestIndex, lateralOffset, carSurfaces, followGround, groundAt, SURFACES, WALL_OFFSET } from './track.js';
import { collideWalls, CAR_HALF_LENGTH, CAR_HALF_WIDTH } from './walls.js';
import { DriftScorer, DRIFT } from './drift.js';
import { buildWorld } from './world.js';
import { buildFujimiWorld } from './worldFujimi.js';
import { buildHakoneWorld } from './worldHakone.js';
import { createCarModel } from './carModel.js';
import { Input } from './input.js';
import { LapTimer, formatPoints } from './laps.js';
import { Hud } from './hud.js';
import { CarAudio } from './audio.js';
import { SkidMarks } from './skids.js';
import { Particles } from './particles.js';
import { DriftTrail } from './driftTrail.js';
import { StyleJudge } from './styleJudge.js';
import { ReplayRecorder, ReplayDirector } from './replay.js';
import { loadGarage, garageLook } from './garage.js';
import { loadRanking, submitLap, pickGhost, unpackGhost } from './ranking.js';
import { ProfileTracker } from './profile.js';
import { rewardOf } from './achievements.js';
import { FreeCamera } from './freeCam.js';
import { PS2Pipeline } from './ps2.js';
import { DIFFICULTIES, DIFFICULTY_ORDER, applyDifficulty, loadDifficulty, saveDifficulty } from './difficulty.js';
import { installMist, fogUniforms } from './fog.js';
import { DebugPanel } from './debug.js';
import { Menu, savedSettings, RANDOM } from './menu.js';
import { carById, trackById, timeOf, TRACKS } from './catalog.js';
import { Rivals } from './rivals.js';
import { gridSlot, MAX_RACERS } from './race.js';

// Antes de qualquer material ser compilado.
installMist();
let mistOn = true;
try { mistOn = localStorage.getItem('corrida3d.nevoa') !== '0'; } catch { /* sem storage */ }

const STEP = 1 / 240;
const CAMERAS = ['Perseguição', 'Perseguição distante', 'Capô'];
const LOST_REASON = { wall: 'BATEU NA PAREDE', car: 'BATEU NO CARRO', grass: 'FORA DA RUA', spin: 'RODOU' };
const LAMP_LIGHTS = 6; // luzes dinâmicas reaproveitadas nos postes mais próximos

// --- Renderização -----------------------------------------------------------------------
const canvas = document.getElementById('game');
// Sem antialias nem sombras reais: o visual é de PS2 (serrilhado suave, sombra "bolha").
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const pipeline = new PS2Pipeline(renderer);
pipeline.setSize(innerWidth, innerHeight);
try { pipeline.crt = localStorage.getItem('corrida3d.crt') !== '0'; } catch { /* sem storage: CRT ligado */ }

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2000);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  pipeline.setSize(innerWidth, innerHeight);
});

// --- Mundo -----------------------------------------------------------------------------------
// Cada pista monta o seu cenário uma vez e fica em cache (escondido quando não está em uso).
// Horário e clima só trocam luz, céu e efeitos (world.setTime): nada é remontado.
const WORLDS = { city: buildWorld, fujimi: buildFujimiWorld, hakone: buildHakoneWorld };
let track = null;
let world = null;
let trackId = null;
let timeId = null;

function applyAtmosphere() {
  ENV.grip = world.atmosphere.grip ?? 1; // chuva: menos aderência para todos (jogador e IA)
  fogUniforms.uMistAmount.value = mistOn ? world.atmosphere.mist : 0;
  fogUniforms.uMistColor.value.copy(world.atmosphere.mistColor);
  fogUniforms.uMistDensity.value = world.atmosphere.mistDensity ?? 0.034;
  fogUniforms.uMistFalloff.value = world.atmosphere.mistFalloff ?? 0.34;
  fogUniforms.uMistBase.value = world.atmosphere.mistBase ?? 0; // serra: a névoa mora no vale
  skids?.setWet(!!world.atmosphere.rain);
}

const worldCache = new Map(); // id da pista -> { track, world }

function buildTrackWorld(def, time) {
  const t = def.build();
  const w = WORLDS[def.world](scene, t, { time });
  w.root.visible = false;
  const entry = { track: t, world: w };
  worldCache.set(def.id, entry);
  return entry;
}

// Mostra o mundo da pista (montando se ainda não existir) no horário pedido. Devolve true se a pista mudou.
function createWorld(id, time) {
  const def = trackById(id);
  const tid = timeOf(def, time).id;
  const entry = worldCache.get(def.id) || buildTrackWorld(def, tid);
  if (world && world !== entry.world) world.root.visible = false;
  const trackChanged = entry.track !== track;
  world = entry.world;
  track = entry.track;
  trackId = def.id;
  timeId = tid;
  world.root.visible = true;
  world.setTime(timeId);
  applyAtmosphere();
  return trackChanged;
}
createWorld(savedSettings().track, savedSettings().time);

// --- Tela de carregamento: aparece antes de montar um cenário (a montagem trava a página por ~1 s) ---
const LOADING_TIPS = [
  'Trocar de lado sem perder o drift soma +0,5 no multiplicador.',
  'Rente à parede os pontos valem 1,5x, mas encostar zera o combo.',
  'Cada curva recebe uma nota de ângulo, linha e fumaça: SS dá bônus.',
  'Na chuva a aderência cai: entre nas curvas mais devagar.',
  'Na garagem dá para trocar pintura, rodas, aerofólio e a cor do rastro.',
  'No ranking dá para escolher contra qual fantasma correr.',
  'Tecla F: câmera livre para passear pelo mapa.',
  'Na serra a descida embala o carro: freie antes dos grampos.',
  'Cada medalha do perfil libera uma pintura, roda, adesivo ou rastro na garagem.',
  'Raspar na mureta solta faíscas; bater de verdade zera o combo.',
];
const loadingEl = document.getElementById('loading');
let loadingChain = Promise.resolve();
function showLoading(trackDef, time) {
  loadingEl.querySelector('.load-jp').textContent = trackDef ? `${trackDef.jp} · ${time?.jp ?? ''}` : '湾岸ドリフト';
  loadingEl.querySelector('.load-name').textContent = trackDef ? trackDef.name : 'CORRIDA 3D';
  loadingEl.querySelector('.load-time').textContent = time ? time.name : '';
  loadingEl.querySelector('.load-tip').textContent = `Dica: ${LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)]}`;
  loadingEl.hidden = false;
}
// Mostra a tela, espera ela ser pintada (2 quadros) e só então roda o trabalho pesado. Chamadas seguidas entram em fila.
function withLoading(trackDef, time, work) {
  loadingChain = loadingChain.then(() => new Promise((resolve) => {
    showLoading(trackDef, time);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try { work(); } finally {
        setTimeout(() => { loadingEl.hidden = true; resolve(); }, 120);
      }
    }));
  }));
  return loadingChain;
}
showLoading(trackById(trackId), timeOf(trackById(trackId), timeId));

// Os postes são muitos; só os mais próximos do carro recebem uma PointLight de verdade.
const lampLights = Array.from({ length: LAMP_LIGHTS }, () => {
  const light = new THREE.PointLight(0xffa040, 0, 34, 1.4);
  scene.add(light);
  return light;
});
function updateLampLights() {
  const sorted = world.lamps
    .map((lamp) => ({ lamp, d: (lamp.position.x - car.x) ** 2 + (lamp.position.z - car.z) ** 2 }))
    .sort((a, b) => a.d - b.d);
  lampLights.forEach((light, i) => {
    if (!sorted[i]) { light.intensity = 0; return; }
    const { lamp, d } = sorted[i];
    light.position.copy(lamp.position);
    light.color.copy(lamp.color);
    // Some suavemente com a distância para não "estalar" quando troca de poste.
    light.intensity = (world.atmosphere.lampIntensity ?? 140) * Math.max(0, 1 - Math.sqrt(d) / 90);
  });
}

const car = createCar();
// Perfil do piloto e conquistas (estatísticas de carreira, medalhas que liberam itens da garagem)
const profile = new ProfileTracker();
let achievementTimer = 0;
const raceAchievements = [];
function announceAchievements() {
  for (const a of profile.checkAchievements()) {
    raceAchievements.push(a);
    const reward = rewardOf(a.id);
    hud.toast(`Medalha ${a.medal}: ${a.name}${reward ? ` · libera ${reward.slotName}` : ''}`, 'best', 3600);
  }
}
let carModel = null;
let ghostModel = null;
let playerCarId = null;
let difficulty = loadDifficulty(); // aplicada ao carro em setDifficulty, mais abaixo

// Reflexo do cenário na pintura: captura o ambiente na largada, só com o mundo visível (sem carros nem efeitos).
const envTarget = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
const envCamera = new THREE.CubeCamera(0.5, 2500, envTarget);
function captureEnv(w = world, t = track) {
  const hidden = scene.children.filter((o) => o !== w.root && o.visible && !o.isLight);
  hidden.forEach((o) => { o.visible = false; });
  const wasVisible = w.root.visible;
  w.root.visible = true;
  envCamera.position.set(t.x[0], (t.y?.[0] ?? 0) + 2.5, t.z[0]);
  w.update(0, envCamera);
  envCamera.update(renderer, scene);
  w.root.visible = wasVisible;
  hidden.forEach((o) => { o.visible = true; });
  w.setEnvMap?.(envTarget.texture);
}

// Na tela de carregamento inicial: monta as outras pistas e desenha cada horário uma vez (sobe texturas e
// compila os shaders). Depois disso trocar de pista ou de clima no menu é instantâneo.
function prebuildWorlds() {
  for (const def of TRACKS) {
    const entry = worldCache.get(def.id) || buildTrackWorld(def, def.times[0].id);
    for (const time of def.times) {
      entry.world.setTime(time.id);
      captureEnv(entry.world, entry.track);
    }
  }
  world.setTime(timeId);
  applyAtmosphere();
  captureEnv();
}
captureEnv();
const rivals = new Rivals(scene, track, envTarget.texture);
const PLAYER_CSS = '#ffb13b';

// Carro do jogador: acerto próprio + modelo 3D (e o fantasma com a mesma carroceria).
function setPlayerCar(id, force = false) {
  const def = carById(id);
  if (def.id === playerCarId && !force) return;
  playerCarId = def.id;
  setCarParams(car, def.params);
  audio.setEngine(def.engine);
  carModel?.dispose();
  ghostModel?.dispose();
  const look = garageLook(loadGarage(def.id, profile.unlocked));
  carModel = createCarModel({ design: def.design, look });
  driftTrail.setColor(look.trail);
  carModel.setEnvMap(envTarget.texture);
  carModel.update(car);
  scene.add(carModel.root);
  ghostModel = createCarModel({ design: def.design, ghost: true });
  ghostModel.root.visible = false;
  scene.add(ghostModel.root);
}
let showGhost = true;

// Danos do carro do jogador: amassados por batida (frente/traseira/lados) e riscos de raspar a mureta.
const damage = { front: 0, rear: 0, left: 0, right: 0, scratchL: 0, scratchR: 0 };
function resetDamage() { for (const k of Object.keys(damage)) damage[k] = 0; }
function addDamage(hit, dt, scrape) {
  // Ponto de contato no referencial do carro: x+ = esquerda, z+ = frente.
  const dx = hit.x - car.x, dz = hit.z - car.z;
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  const lz = dx * fx + dz * fz, lx = dx * fz - dz * fx;
  const dent = Math.max(0, hit.speed - 0.9) * 0.09;
  if (dent > 0) {
    if (Math.abs(lz) > 1.2) damage[lz > 0 ? 'front' : 'rear'] = Math.min(1, damage[lz > 0 ? 'front' : 'rear'] + dent);
    else damage[lx > 0 ? 'left' : 'right'] = Math.min(1, damage[lx > 0 ? 'left' : 'right'] + dent * 0.8);
  }
  if (scrape && Math.abs(lz) <= 2.0) {
    const key = lx > 0 ? 'scratchL' : 'scratchR';
    damage[key] = Math.min(1, damage[key] + car.speed * dt * 0.012 + dent * 0.5);
  }
}

var skids = new SkidMarks(scene); // var: applyAtmosphere roda antes desta linha na montagem inicial
skids.setWet(!!world.atmosphere.rain);
// Luz laranja das faíscas: pisca no ponto do raspão, mais forte quanto mais faísca
const sparkLight = new THREE.PointLight(0xff8a30, 0, 9, 1.6);
scene.add(sparkLight);
let sparkGlow = 0;
const particles = new Particles(scene);
const driftTrail = new DriftTrail(scene);
const timer = new LapTimer(track);
const scorer = new DriftScorer();
const judge = new StyleJudge(track);

// --- Replay: grava a corrida e mostra com câmeras de TV no fundo do resultado ---------------------------------
const REPLAY_MIN_FRAMES = 60;
const recorder = new ReplayRecorder();
const director = new ReplayDirector(track);
const replay = { playing: false, t: 0, proxies: [], smokeAcc: 0 };
const replayTag = document.getElementById('replay-tag');
const skidOf = (c) => (c.speed > 3 ? Math.min(1, Math.max(0, (Math.abs(c.slipR) - 0.12) * 4) + c.wheelspin * 0.6) : 0);

function startReplay() {
  if (recorder.frames < REPLAY_MIN_FRAMES) return;
  replay.playing = true;
  replay.t = 0;
  replay.proxies = recorder.data.map(() => ({}));
  director.reset();
  driftTrail.clear();
  ghostModel.root.visible = false;
  replayTag.hidden = false;
}

// Altura e inclinação de um carro gravado (replay) ou do fantasma, a partir da pista
function groundPose(p) {
  if (!track.y) { p.y = 0; p.pitch = 0; return p; }
  p.idx = nearestIndex(track, p.x, p.z, p.idx ?? -1);
  followGround(p, track, p.idx);
  return p;
}

function stopReplay() {
  if (!replay.playing) return;
  replay.playing = false;
  replayTag.hidden = true;
  if (camera.view?.enabled) { camera.clearViewOffset(); camera.updateProjectionMatrix(); }
  driftTrail.clear();
}

function updateReplay(dt) {
  replay.t += dt;
  if (replay.t >= recorder.duration) { replay.t = 0; driftTrail.clear(); director.reset(); }
  const [me, ...others] = replay.proxies;
  recorder.sample(0, replay.t, me);
  groundPose(me);
  carModel.update(me);
  rivals.list.forEach((e, i) => {
    const p = others[i];
    if (!p || !recorder.sample(i + 1, replay.t, p)) return;
    groundPose(p);
    e.model.update(p);
    const d = Math.hypot(p.x - camera.position.x, p.z - camera.position.z);
    e.model.setDetail(d < 28);
    e.label.visible = false;
  });
  // Fumaça das rodas traseiras gravada
  for (const p of replay.proxies) {
    if (!(p.skid > 0.25) || p.speed < 3) continue;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), lx = fz, lz = -fx;
    for (const side of [0.8, -0.8]) {
      const count = p.skid * dt * 11 * (0.4 + Math.min(1, p.speed / 25));
      for (let k = Math.floor(count + Math.random()); k > 0; k--) particles.smoke(p.x + lx * side - fx * 1.35, p.z + lz * side - fz * 1.35, p.vx, p.vz, p.skid, p.y || 0);
    }
  }
  driftTrail.update(dt, me, carModel.tailLights, { active: me.mult > 0, angle: Math.abs(me.driftAngle) * 57.2958, idle: 0, mult: me.mult || 1 }, camera);
  if (!freeCam.active) {
    director.update(dt, camera, me);
    // O carro em foco aparece à direita do cartão de resultado
    if (innerWidth > 720) { camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.22, 0, innerWidth, innerHeight); camera.updateProjectionMatrix(); }
  }
  replayTag.dataset.camera = director.name;
}
const hud = new Hud(track);
const audio = new CarAudio();
// Música começa na primeira interação (o navegador só libera o áudio depois de um gesto)
const unlockAudio = () => { audio.start(); if (audio.ctx) audio.suspend(race.phase === 'menu' || paused); };
addEventListener('pointerdown', unlockAudio, { once: true });
addEventListener('keydown', unlockAudio, { once: true });
audio.onSong = (song) => hud.toast(`♪ ${song.name} · ${song.bpm} BPM`, 'info', 2600);
audio.setRain(!!world.atmosphere.rain);
let padName = null;
const input = new Input({
  onPadConnected: (name) => { padName = name; hud.toast(`${name} conectado`, 'info', 1800); },
  onPadDisconnected: (name) => { padName = null; hud.toast(`${name} desconectado`, 'bad', 1800); if (!paused) pauseGame(); },
});
// O navegador só entrega o controle à janela focada.
addEventListener('pointerdown', () => window.focus());

// Detecção por consulta + diagnóstico ao vivo na tela inicial.
const padStatus = document.getElementById('pad-status');
let padStatusTimer = 0;
function updatePadStatus(dt) {
  input.pollConnection();
  padStatusTimer -= dt;
  if (!paused || padStatusTimer > 0) return;
  padStatusTimer = 0.1;
  menu.setPad(padName);
  padStatus.textContent = input.diagnostics();
  padStatus.dataset.ok = padName ? 'yes' : 'no';
}

let idx = 0;
let acc = 0;
function placeOnTrack(i) {
  const j = (i + track.N) % track.N;
  resetCar(car, track.x[j], track.z[j], Math.atan2(track.tx[j], track.tz[j]));
  idx = j;
  followGround(car, track, idx);
  skids.last.clear();
  driftTrail.clear();
}

// --- Câmera ------------------------------------------------------------------------------------
let camMode = 0;
let camYaw = car.yaw;
let shake = 0;
const camTarget = new THREE.Vector3();
const tmp = new THREE.Vector3();
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

// Órbita livre: analógico direito (ou arrastar com o mouse) gira 360° em volta do carro e sobe/desce.
// A câmera fica onde foi deixada e volta para trás do carro 1,5 s depois de soltar, se o carro estiver andando.
const orbit = { yaw: 0, pitch: 0, idle: 99 };
let dragging = false;
canvas.addEventListener('pointerdown', (e) => { dragging = true; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging || paused) return;
  orbit.yaw -= e.movementX * 0.006;
  orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + e.movementY * 0.004, -0.35, 0.9);
  orbit.idle = 0;
});

function updateOrbit(dt) {
  const stick = input.lookStick();
  if (stick.x || stick.y) {
    orbit.yaw -= stick.x * 3.2 * dt;
    orbit.pitch = THREE.MathUtils.clamp(orbit.pitch - stick.y * 1.4 * dt, -0.35, 0.9);
    orbit.idle = 0;
  } else if (!dragging) orbit.idle += dt;
  orbit.yaw = Math.atan2(Math.sin(orbit.yaw), Math.cos(orbit.yaw));
  if (orbit.idle > 1.5 && car.speed > 3) {
    const k = 1 - Math.exp(-dt * 2.5);
    orbit.yaw -= orbit.yaw * k;
    orbit.pitch -= orbit.pitch * k;
  }
}

function updateCamera(dt, rumble) {
  if (window.game?.freeCamera) return; // depuração: câmera posicionada pelo console
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  const cy = car.y || 0, slope = Math.tan(car.pitch || 0);
  if (camMode === 2) {
    // No capô a órbita vira "olhar em volta".
    const lookYaw = car.yaw + orbit.yaw;
    camera.position.set(car.x + fx * 0.9, cy + 1.08 + slope * 0.9, car.z + fz * 0.9);
    camera.lookAt(car.x + fx * 0.9 + Math.sin(lookYaw) * 12, cy + 0.95 + slope * 12.9 * Math.max(0, Math.cos(orbit.yaw)) + orbit.pitch * 6, car.z + fz * 0.9 + Math.cos(lookYaw) * 12);
    camera.fov = 70 + config.fov;
  } else {
    const far = camMode === 1 && !garageView;
    const dist = garageView ? 5.4 : far ? 10 : 6.6, height = garageView ? 1.5 : far ? 3.8 : 2.4;
    // Em drift a câmera segue mais a direção da velocidade que o bico do carro.
    const velYaw = car.speed > 4 && car.u > 0 ? Math.atan2(car.vx, car.vz) : car.yaw;
    camYaw = lerpAngle(camYaw, lerpAngle(car.yaw, velYaw, 0.6), 1 - Math.exp(-dt * 5));
    const yaw = camYaw + orbit.yaw;
    const flat = dist * Math.cos(orbit.pitch * 0.6);
    tmp.set(car.x - Math.sin(yaw) * flat, height + Math.sin(orbit.pitch) * dist, car.z - Math.cos(yaw) * flat);
    // Rampa: sobe junto com o carro e nunca fica abaixo do asfalto atrás dele
    if (track.y) {
      const behind = groundAt(track, nearestIndex(track, tmp.x, tmp.z, idx, 12), tmp.x, tmp.z);
      tmp.y += Math.max(cy, behind);
    }
    // Girando com o analógico a câmera acompanha na hora; senão, suaviza.
    camera.position.lerp(tmp, orbit.idle < 0.2 ? 1 : 1 - Math.exp(-dt * 12));
    const ahead = 3 * Math.max(0, Math.cos(orbit.yaw));
    camTarget.set(car.x + Math.sin(camYaw) * ahead, cy + 1.0 + slope * ahead, car.z + Math.cos(camYaw) * ahead);
    camera.lookAt(camTarget);
    camera.fov = 62 + config.fov + Math.min(14, car.speed * 0.22);
  }
  const jitter = (rumble ? Math.min(0.05, car.speed * 0.002) : 0) + shake;
  if (jitter > 0) {
    camera.position.x += (Math.random() - 0.5) * jitter;
    camera.position.y += (Math.random() - 0.5) * jitter;
  }
  shake = Math.max(0, shake - dt * 1.5);
  // Na garagem a imagem anda para a esquerda: o carro aparece à direita do cartão de opções.
  if (garageView && innerWidth > 720) camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.2, 0, innerWidth, innerHeight);
  else if (camera.view?.enabled) camera.clearViewOffset();
  camera.updateProjectionMatrix();
}

// --- Corrida e menus ---------------------------------------------------------------------------
// Fases: menu (tela inicial, carro parado), countdown, running, finished (passou da chegada, ainda rodando).
const race = { phase: 'menu', racers: 1, standingsTimer: 0, laps: 3, countdown: 0, goTimer: 0, finishTimer: 0, time: 0, results: [], bestLap: false };
let paused = true;
let garageView = false;

// Troca de pista ou de horário (menu): novo cenário, reflexo, recorde/fantasma, minimapa e rivais na pista nova.
const needsWorld = (id, time) => trackById(id).id !== trackId || timeOf(trackById(id), time).id !== timeId;
const needsBuild = (id) => !worldCache.has(trackById(id).id); // só isto pede tela de carregamento
function switchTrack(id, time) {
  if (!needsWorld(id, time)) return;
  const trackChanged = createWorld(id, time);
  audio.setRain(!!world.atmosphere.rain);
  captureEnv();
  if (!trackChanged) return; // só mudou o horário
  timer.setTrack(track);
  judge.setTrack(track);
  director.setTrack(track);
  hud.setTrack(track);
  rivals.setTrack(track);
  applyRanking();
  skids.clear();
  placeOnGrid();
}

function placeOnGrid() {
  const rivalCount = race.racers - 1;
  rivals.setup(rivalCount, difficulty);
  // Sozinho: no centro da rua, na última posição do grid.
  const slot = rivalCount === 0 ? gridSlot(track, MAX_RACERS - 1, 0) : gridSlot(track, rivalCount);
  resetCar(car, slot.x, slot.z, slot.yaw);
  idx = slot.idx;
  followGround(car, track, idx);
  skids.last.clear();
  driftTrail.clear();
}

function playerRow() {
  return { name: 'VOCÊ', css: PLAYER_CSS, points: scorer.total + scorer.comboValue, lap: timer.lap, player: true, finished: race.phase === 'finished' };
}

// Fantasma e melhor volta vêm do ranking da pista + carro atuais (a escolha fica nas configurações do menu).
function applyRanking() {
  const list = loadRanking(trackId, playerCarId);
  const entry = pickGhost(list, menu?.settings.ghost ?? 'best');
  timer.ghost = unpackGhost(entry?.ghost);
  timer.bestLap = list[0] ? { points: list[0].points, time: list[0].time } : null;
  race.ghostEntry = entry ? { ...entry, position: list.indexOf(entry) + 1 } : null;
}

function resetRaceState() {
  stopReplay();
  recorder.reset(0);
  resetDamage();
  race.rankBest = 0;
  scorer.resetRace();
  judge.reset();
  placeOnGrid();
  timer.startAt(idx);
  applyRanking();
  skids.clear();
  hud.countdown('');
  race.time = 0;
  race.results = [];
  race.bestLap = false;
  orbit.yaw = 0; orbit.pitch = 0; orbit.idle = 99;
  camYaw = car.yaw;
  acc = 0;
}

function startRace(settings) {
  if (settings.track && needsBuild(settings.track)) {
    const def = trackById(settings.track);
    withLoading(def, timeOf(def, settings.time), () => { switchTrack(settings.track, settings.time); beginRace(settings); });
    return;
  }
  if (settings.track) switchTrack(settings.track, settings.time);
  beginRace(settings);
}

function beginRace(settings) {
  camMode = config.camera;
  if (settings.car) setPlayerCar(settings.car);
  race.laps = settings.laps;
  race.racers = settings.racers ?? race.racers;
  resetRaceState();
  car.automatic = config.gearbox === 'auto';
  if (car.automatic && car.gear === 0) car.gear = 1;
  if (profile.race) profile.abandon();
  profile.startRace({ track: trackId, time: timeId, car: playerCarId, laps: race.laps, racers: race.racers, difficulty });
  raceAchievements.length = 0;
  race.phase = 'countdown';
  race.countdown = 3;
  menu.hide();
  paused = false;
  audio.start();
  audio.suspend(false);
}

function pauseGame() {
  if (race.phase === 'menu' || paused) return;
  paused = true;
  const standings = rivals.standings(playerRow());
  menu.showPause({
    lap: timer.lap, laps: race.laps, total: scorer.total + scorer.comboValue, time: race.time,
    position: standings.findIndex((r) => r.player) + 1, racers: standings.length,
  });
  audio.suspend(true);
}

function resumeGame() {
  paused = false;
  menu.hide();
  audio.start();
  audio.suspend(false);
}

function quitToMenu() {
  if (profile.race) profile.abandon();
  race.phase = 'menu';
  resetRaceState();
  paused = true;
  menu.show('main');
  audio.suspend(true);
}

function finishRace() {
  race.phase = 'finished';
  race.finishTimer = 3;
  hud.popup('CHEGADA', 'bank');
}

function showResults() {
  paused = true;
  startReplay();
  audio.suspend(true);
  rivals.bankAll();
  const finalStandings = rivals.standings({ ...playerRow(), points: scorer.total, finished: true });
  profile.finish({ position: finalStandings.findIndex((r) => r.player) + 1, racers: finalStandings.length, total: scorer.total });
  announceAchievements();
  menu.showResults({
    achievements: [...raceAchievements],
    laps: race.results, total: scorer.total, bestCombo: scorer.best, time: race.time, difficulty, bestLap: race.bestLap, grades: { ...judge.counts }, rankBest: race.rankBest,
    standings: rivals.standings({ ...playerRow(), points: scorer.total, finished: true }),
  });
}

// Contagem regressiva, chegada e câmera da tela inicial.
function updateRace(dt) {
  if (race.phase === 'menu') {
    orbit.yaw = Math.atan2(Math.sin(orbit.yaw + dt * 0.25), Math.cos(orbit.yaw + dt * 0.25));
    orbit.pitch = 0.2;
    orbit.idle = 0;
    return;
  }
  if (paused) return;
  if (race.phase === 'countdown') {
    race.countdown -= dt;
    if (race.countdown > 0) hud.countdown(String(Math.ceil(race.countdown)));
    else {
      race.phase = 'running';
      race.goTimer = 0.9;
      hud.countdown('JÁ!');
    }
  }
  if (race.goTimer > 0) {
    race.goTimer -= dt;
    if (race.goTimer <= 0) hud.countdown('');
  }
  if (race.phase === 'finished') {
    race.finishTimer -= dt;
    if (race.finishTimer <= 0) showResults();
  }
}

// --- Dificuldade ---------------------------------------------------------------------------------
function setDifficulty(key, announce = false) {
  difficulty = key;
  applyDifficulty(car, key);
  saveDifficulty(key);
  menu.setDifficulty(key);
  if (announce) hud.toast(`Dificuldade: ${DIFFICULTIES[key].label}`, 'info', 1600);
}

const menu = new Menu({
  difficulty,
  onStart: startRace,
  onResume: resumeGame,
  // Reiniciar repete a pista e o horário que saíram no sorteio; "correr de novo" no resultado sorteia outra vez
  onRestart: () => startRace({ laps: race.laps, racers: race.racers, car: playerCarId, track: trackId, time: timeId }),
  // Na tela inicial o grid mostra quantos vão correr.
  onSettings: (settings) => {
    if (race.phase !== 'menu') return;
    // Aleatória: o fundo do menu fica na pista atual (o sorteio é na largada)
    const id = settings.track === RANDOM ? trackId : settings.track;
    const time = settings.time === RANDOM ? (trackById(id).id === trackId ? timeId : undefined) : settings.time;
    if (needsBuild(id)) {
      const def = trackById(id);
      withLoading(def, timeOf(def, time), () => switchTrack(id, time));
    } else switchTrack(id, time);
    setPlayerCar(settings.car);
    applyRanking();
    race.racers = settings.racers;
    placeOnGrid();
  },
  onQuit: quitToMenu,
  onDifficulty: (key) => setDifficulty(key),
  onConfig: (cfg) => applyConfig(cfg),
  // Garagem: remonta o carro com o visual novo; na tela da garagem os rivais somem e a câmera chega perto.
  onGarage: (carId) => setPlayerCar(carId, true),
  onScreen: (name) => {
    garageView = name === 'garage';
    for (const e of rivals.list) e.model.root.visible = !garageView;
  },
});
setPlayerCar(menu.settings.car);
applyRanking();

// --- Configurações gerais (tela CONFIGURAÇÕES e teclas de atalho) --------------------------------------------
let config = menu.config;
function applyConfig(cfg) {
  const resolutionChanged = pipeline.targetHeight !== cfg.resolution;
  config = cfg;
  audio.setVolumes(cfg);
  if (audio.musicOn !== cfg.musicOn) audio.setMusicOn(cfg.musicOn);
  pipeline.crt = cfg.crt;
  if (mistOn !== cfg.mist) { mistOn = cfg.mist; applyAtmosphere(); }
  if (resolutionChanged) { pipeline.targetHeight = cfg.resolution; pipeline.setSize(innerWidth, innerHeight); }
  showGhost = cfg.ghost;
  hud.setOptions({ units: cfg.units, fps: cfg.fps, minimap: cfg.minimap, grades: cfg.grades });
  input.rumbleEnabled = cfg.rumble;
  driftTrail.enabled = cfg.driftTrail;
  rivals.showNames = cfg.names;
}
applyConfig(config);
setDifficulty(difficulty);
race.racers = menu.settings.racers;
race.laps = menu.settings.laps;
placeOnGrid();
menu.show('main');

// --- Debug (tecla B) ------------------------------------------------------------------------------
const debug = new DebugPanel(car);
const debugInfo = { input: null, surfaces: null, fps: 60, scorer };
if (debug.loadedCount) hud.toast(`Acerto de debug carregado (${debug.loadedCount} ajuste${debug.loadedCount > 1 ? 's' : ''})`, 'info', 2600);

// --- Câmera livre (F ou botão no debug): corrida congelada, menus e HUD escondidos ----------------------
const freeCam = new FreeCamera(camera, canvas, input);
const freeCamHint = document.getElementById('freecam-hint');
let freeCamMenu = null; // tela de menu aberta ao entrar, para voltar a ela
freeCam.onSpeed = (speed) => { freeCamHint.dataset.speed = `${Math.round(speed)} m/s`; };
function toggleFreeCam(on = !freeCam.active) {
  if (on === freeCam.active) return;
  if (on) {
    freeCamMenu = menu.current;
    menu.hide();
    freeCam.enable();
    freeCam.onSpeed(freeCam.speed);
    audio.suspend(true);
  } else {
    freeCam.disable();
    if (freeCamMenu) menu.show(freeCamMenu);
    else audio.suspend(false);
    freeCamMenu = null;
  }
  document.body.classList.toggle('freecam', freeCam.active);
  freeCamHint.hidden = !freeCam.active;
}
debug.onFreeCam = () => toggleFreeCam();

// --- Loop ----------------------------------------------------------------------------------------
const ghostGround = { x: 0, z: 0, yaw: 0, y: 0, pitch: 0, idx: -1 };
let last = performance.now();
let fps = 60;
let rumble = false;

function handleActions() {
  const a = input.consumeActions();
  if (a.debug) debug.toggle();
  if (a.music) {
    audio.start();
    menu.setConfig({ musicOn: !config.musicOn });
    hud.toast(audio.musicOn ? `Música ligada${audio.song ? ` · ♪ ${audio.song.name}` : ''}` : 'Música desligada', 'info', 1800);
  }
  if (a.nextSong) { audio.start(); audio.nextSong(); }
  if (a.freeCam) toggleFreeCam();
  if (freeCam.active) {
    if (a.pause || a.back) toggleFreeCam(false);
    if (a.mist || a.crt) { /* efeitos visuais seguem valendo */ } else return;
  }
  if (a.difficulty) setDifficulty(DIFFICULTY_ORDER[(DIFFICULTY_ORDER.indexOf(difficulty) + 1) % DIFFICULTY_ORDER.length], !paused);
  if (paused) { menu.handle(a); return; }
  if (a.pause) { pauseGame(); return; }
  if (a.camera) { camMode = (camMode + 1) % CAMERAS.length; hud.toast(`Câmera: ${CAMERAS[camMode]}`, 'info', 1200); }
  if (a.transmission) {
    car.automatic = !car.automatic;
    if (car.automatic && car.gear === 0) car.gear = 1;
    hud.toast(car.automatic ? 'Câmbio automático' : 'Câmbio manual (Q / E)', 'info', 1400);
  }
  for (const [action, dir] of [['shiftUp', 1], ['shiftDown', -1]]) {
    if (!a[action]) continue;
    if (car.automatic) { car.automatic = false; hud.toast('Câmbio manual', 'info', 1400); }
    shift(car, dir);
  }
  if (a.mute) { audio.setMuted(!audio.muted); hud.toast(audio.muted ? 'Som desligado' : 'Som ligado', 'info', 1000); }
  if (a.crt) {
    menu.setConfig({ crt: !config.crt });
    hud.toast(config.crt ? 'Efeito CRT ligado' : 'Efeito CRT desligado', 'info', 1200);
  }
  if (a.mist) {
    menu.setConfig({ mist: !config.mist });
    hud.toast(config.mist ? 'Névoa ligada' : 'Névoa desligada', 'info', 1200);
  }
  if (a.ghost) { menu.setConfig({ ghost: !config.ghost }); hud.toast(config.ghost ? 'Fantasma visível' : 'Fantasma oculto', 'info', 1000); }
  if (a.tcs) { car.tcs = !car.tcs; hud.toast(`Controle de tração ${car.tcs ? 'ligado (atrapalha o drift)' : 'desligado'}`, 'info', 1600); }
  if (a.abs) { car.abs = !car.abs; hud.toast(`ABS ${car.abs ? 'ligado' : 'desligado'}`, car.abs ? 'info' : 'bad', 1400); }
  if (a.driftAssist) {
    car.driftAssist = !car.driftAssist;
    hud.toast(`Assistência de drift ${car.driftAssist ? 'ligada' : 'desligada'}`, car.driftAssist ? 'info' : 'bad', 1600);
  }
  if (a.reset && race.phase === 'running') {
    scorer.resetCombo();
    placeOnTrack(nearestIndex(track, car.x, car.z, idx));
  }
}

// Distância da lateral do carro mais próxima até uma parede (usa os 4 cantos).
function wallDistance() {
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw), lx = fz, lz = -fx;
  let best = Infinity;
  for (const [ox, oz] of [[CAR_HALF_WIDTH, CAR_HALF_LENGTH], [-CAR_HALF_WIDTH, CAR_HALF_LENGTH], [CAR_HALF_WIDTH, -CAR_HALF_LENGTH], [-CAR_HALF_WIDTH, -CAR_HALF_LENGTH]]) {
    const px = car.x + lx * ox + fx * oz, pz = car.z + lz * ox + fz * oz;
    best = Math.min(best, WALL_OFFSET - Math.abs(lateralOffset(track, nearestIndex(track, px, pz, idx, 6), px, pz)));
  }
  return best;
}

function simulate(dt) {
  let inp = input.update(dt);
  if (race.phase === 'finished') inp = { throttle: 0, brake: 0.25, steer: 0, handbrake: 0 }; // passou da chegada: freia sozinho
  acc += dt;
  let steps = 0;
  let impact = null;
  let carHit = null;
  let sf = SURFACES.asphalt, sr = SURFACES.asphalt;
  while (acc >= STEP && steps < 48) {
    [sf, sr] = carSurfaces(track, car, idx, paramsOf(car).a, paramsOf(car).b);
    stepCar(car, inp, STEP, sf, sr);
    idx = nearestIndex(track, car.x, car.z, idx);
    followGround(car, track, idx);
    const hit = collideWalls(car, track, idx);
    if (hit && (!impact || hit.speed > impact.speed)) impact = hit;
    for (const c of rivals.step(STEP, car)) {
      if (c.a === 0 && (!carHit || c.speed > carHit.speed)) carHit = c; // o jogador é sempre o índice 0
      else if (c.speed > 2) audio.impact(Math.min(4, c.speed * 0.6), c); // batida entre rivais, no lugar dela
    }
    acc -= STEP;
    steps++;
  }
  if (steps === 48) acc = 0;
  rumble = sf === SURFACES.sidewalk || sr === SURFACES.sidewalk;
  debugInfo.input = inp;
  debugInfo.surfaces = [sf, sr];
  const simDt = steps * STEP;

  // Pontuação (só com a corrida valendo)
  if (race.phase === 'running') {
    race.time += simDt;
    if (impact && impact.speed > DRIFT.wallImpact && !race.wallContact) profile.wallHit();
    race.wallContact = !!impact;
    const onGrass = sf === SURFACES.offroad && sr === SURFACES.offroad;
    scorer.update(simDt, {
      angle: car.driftAngle, speed: car.speed, onGrass,
      wallImpact: impact ? impact.speed : 0, carImpact: carHit ? carHit.speed : 0, wallDistance: wallDistance(),
    });
    // Na última volta o combo em andamento é somado ao cruzar a linha.
    timer.update(simDt, car, idx, () => {
      if (race.laps && timer.lap === race.laps) scorer.bank();
      return scorer.startLap();
    });
  }

  let comboLost = false;
  for (const ev of scorer.events.splice(0)) {
    if (ev.type === 'bank') { hud.popup(`+${formatPoints(ev.points)}`, 'bank'); driftTrail.flash('bank'); profile.bank(ev.points); }
    else if (ev.type === 'bonus') hud.bonus(ev.label, ev.points);
    else if (ev.type === 'lost') { hud.popup(LOST_REASON[ev.reason], 'lost'); input.hit(0.7, 260); driftTrail.flash('lost'); comboLost = true; }
  }
  for (const ev of timer.events.splice(0)) {
    const { samples, ...lap } = ev;
    race.results.push(lap);
    profile.lap(ev.points);
    // Ranking de voltas por pista e carro (com o fantasma desta volta)
    const rank = submitLap(trackId, playerCarId, { points: ev.points, time: ev.time, difficulty, timeOfDay: timeId }, samples);
    if (rank) { race.rankBest = race.rankBest ? Math.min(race.rankBest, rank) : rank; hud.toast(`Volta no ranking: ${rank}º lugar`, 'best', 2600); }
    if (ev.best) race.bestLap = true;
    if (race.laps && ev.lap >= race.laps) { finishRace(); continue; }
    const lastLapNext = race.laps && ev.lap === race.laps - 1 ? ' · ÚLTIMA VOLTA' : '';
    if (ev.best) hud.toast(`Melhor volta: ${formatPoints(ev.points)} pts${lastLapNext}`, 'best', 3000);
    else hud.toast(`Volta: ${formatPoints(ev.points)} pts${lastLapNext}`, lastLapNext ? 'best' : 'info', 2400);
  }

  rivals.score(simDt, race.laps, race.phase === 'running');
  rivals.effects(simDt, skids, particles, camera);

  // Batida em outro carro: faíscas no ponto de contato
  const groundY = car.y || 0;
  if (carHit && carHit.speed > 0.8) {
    particles.sparks(carHit.x, carHit.z, carHit.nx, carHit.nz, carHit.speed, groundY, car.vx * 0.5, car.vz * 0.5);
    audio.impact(carHit.speed);
    if (carHit.speed > 1.5) { shake = Math.min(0.4, shake + carHit.speed * 0.03); input.hit(Math.min(1, 0.25 + carHit.speed * 0.08), 200); }
  }

  // Batida / raspão na parede
  if (impact) addDamage(impact, simDt, true);
  if (carHit && carHit.speed > 0.5) addDamage({ ...carHit, x: carHit.x, z: carHit.z }, simDt, carHit.speed < 3);
  if (impact) {
    const strength = impact.speed;
    if (strength > 0.6) {
      particles.sparks(impact.x, impact.z, impact.nx, impact.nz, strength, groundY, car.vx, car.vz);
      audio.impact(strength);
    }
    // Raspando: jato contínuo de faíscas enquanto encosta andando
    particles.grind(impact.x, impact.z, impact.nx, impact.nz, car.vx, car.vz, simDt, groundY);
    sparkLight.position.set(impact.x + impact.nx * 0.6, groundY + 0.5, impact.z + impact.nz * 0.6);
    if (strength > 1.5) {
      shake = Math.min(0.4, shake + strength * 0.03);
      input.hit(Math.min(1, 0.25 + strength * 0.08), 200);
    }
  }

  // Fumaça, marcas de pneu e chiado
  const moving = car.speed > 3;
  const rearSkid = moving ? Math.min(1, Math.max(0, (Math.abs(car.slipR) - 0.12) * 4) + car.wheelspin * 0.6 + (inp.handbrake && car.speed > 5 ? 0.5 : 0)) : 0;
  const frontSkid = moving ? Math.min(1, Math.max(0, (Math.abs(car.slipF) - 0.14) * 4) + car.lockup * 2) : 0;
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw), lx = fz, lz = -fx;
  const { a: axleF, b: axleR } = paramsOf(car);
  const wheels = [['fl', 0.8, axleF, frontSkid, sf], ['fr', -0.8, axleF, frontSkid, sf], ['rl', 0.8, -axleR, rearSkid, sr], ['rr', -0.8, -axleR, rearSkid, sr]];
  for (const [key, ox, oz, amount, surf] of wheels) {
    const wx = car.x + lx * ox + fx * oz, wz = car.z + lz * ox + fz * oz, wy = groundY + Math.sin(car.pitch || 0) * oz;
    const onTarmac = surf === SURFACES.asphalt;
    skids.add(key, wx, wz, lx, lz, amount > 0.3 && onTarmac, amount, wy);
    // Chuva: spray d'água levantado pelas rodas traseiras
    if (world.atmosphere.rain && key[0] === 'r' && car.speed > 8 && Math.random() < simDt * car.speed * 0.5) particles.smoke(wx, wz, car.vx, car.vz, 0.15, wy);
    if (onTarmac && amount > 0.25 && key[0] === 'r') {
      const count = amount * simDt * 13 * (0.4 + Math.min(1, car.speed / 25));
      for (let k = Math.floor(count + Math.random()); k > 0; k--) particles.smoke(wx, wz, car.vx, car.vz, amount, wy);
    }
  }
  // Perfil: distância, ângulo e drift mais longo; medalhas conferidas uma vez por segundo
  if (race.phase === 'running' && simDt > 0) {
    profile.drive(simDt, { speed: car.speed, angle: Math.abs(car.driftAngle) * 57.2958, combo: scorer.active, drifting: scorer.active && scorer.idle === 0 });
    profile.tick(simDt);
    achievementTimer += simDt;
    if (achievementTimer > 1) { achievementTimer = 0; announceAchievements(); }
  }

  // Nota de estilo por curva
  if (race.phase === 'running' && simDt > 0) {
    judge.update(simDt, {
      idx, lateral: lateralOffset(track, idx, car.x, car.z), angle: Math.abs(car.driftAngle) * 57.2958, speed: car.speed,
      smoke: rearSkid * Math.min(1, car.speed / 25), drifting: scorer.active && scorer.idle === 0,
      failed: comboLost || (impact && impact.speed > DRIFT.wallImpact) || (carHit && carHit.speed > DRIFT.carImpact),
    });
    for (const ev of judge.events.splice(0)) {
      profile.grade(ev.grade);
      hud.grade(ev);
      scorer.styleBonus(ev.grade, ev.bonus);
    }
  }

  // Grava o replay (jogador primeiro, depois os rivais na ordem da lista)
  if (simDt > 0) {
    recorder.record(simDt, [
      { car, skid: rearSkid, mult: scorer.active ? scorer.mult : 0 },
      ...rivals.list.map((e) => ({ car: e.car, skid: skidOf(e.car), mult: 0 })),
    ]);
  }

  const tarmac = sf === SURFACES.asphalt || sr === SURFACES.asphalt;
  audio.update(car, tarmac ? Math.max(rearSkid, frontSkid) : 0, rumble);
  input.rumble(tarmac ? rearSkid * 0.35 : 0.15 * Math.min(1, car.speed / 15), rumble ? 0.35 : 0);
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;

  updatePadStatus(dt);
  handleActions();
  if (!freeCam.active) updateRace(dt);
  if (!paused && !freeCam.active && (race.phase === 'running' || race.phase === 'finished')) simulate(dt * debug.timeScale);

  if (replay.playing && menu.current !== 'results' && !freeCam.active) stopReplay();
  if (replay.playing) updateReplay(dt);
  else {
    carModel.update(car);
    driftTrail.update(paused || freeCam.active ? 0 : dt, car, carModel.tailLights, scorer, camera);
    rivals.updateVisuals(camera);
  }
  carModel.setDamage(damage);
  if (!paused && !freeCam.active) audio.updateRivals(rivals.list, camera, dt);
  const pose = showGhost && !replay.playing ? timer.ghostPose() : null;
  ghostModel.root.visible = !!pose;
  if (pose) {
    ghostGround.x = pose.x; ghostGround.z = pose.z; ghostGround.yaw = pose.yaw;
    groundPose(ghostGround);
    ghostModel.setPose(pose.x, pose.z, pose.yaw, ghostGround.y, ghostGround.pitch);
  }

  if (freeCam.active) freeCam.update(dt);
  else if (!replay.playing) {
    if (!paused && race.phase !== 'countdown') updateOrbit(dt);
    updateCamera(paused ? 0.016 : dt, rumble && !paused);
  }
  particles.update((paused && !replay.playing) || freeCam.active ? 0 : dt, camera, pipeline.internalHeight);
  // Luz das faíscas: acende com as que nasceram neste quadro e apaga rápido, tremendo
  sparkGlow = Math.max(sparkGlow * Math.exp(-dt * 14), Math.min(1, particles.sparkLevel / 6));
  particles.sparkLevel = 0;
  sparkLight.intensity = sparkGlow * (14 + Math.random() * 10);
  updateLampLights();
  world.update(now / 1000, camera);
  fogUniforms.uFogTime.value = now / 1000;
  debugInfo.fps = fps;
  debug.update(dt, debugInfo);
  hud.update(car, timer, scorer, { fps, ghost: pose, padName, difficulty: DIFFICULTIES[difficulty].label, totalLaps: race.laps, rivals: rivals.list });
  race.standingsTimer -= dt;
  if (race.standingsTimer <= 0) {
    race.standingsTimer = 0.25;
    hud.standings(race.phase === 'menu' ? [] : rivals.standings(playerRow()));
  }
  // Rastro cresce com a velocidade, como nos jogos de corrida da época.
  // Música: cheia na corrida, abafada nos menus e na pausa
  audio.setMusicIntensity(freeCam.active ? 0.55 : menu.current === 'results' ? 0.7 : race.phase === 'menu' ? 0.45 : paused ? 0.3 : 1);
  pipeline.render(scene, camera, { trail: (paused ? 0.05 : 0.06 + Math.min(0.16, car.speed * 0.004)) * config.trail });
  requestAnimationFrame(frame);
}

// Carro personalizado opcional: corrida-3d/assets/carro.glb (+ assets/carro.json com { "rotacaoGraus": 180 }).
async function loadCustomCar() {
  try {
    const head = await fetch('assets/carro.glb', { method: 'HEAD' });
    if (!head.ok) return;
    const [{ GLTFLoader }, config] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      fetch('assets/carro.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    const gltf = await new GLTFLoader().loadAsync('assets/carro.glb');
    carModel.useGltf(gltf.scene, config);
    hud.toast('Carro personalizado carregado', 'info', 2000);
  } catch (err) {
    console.warn('Não foi possível carregar assets/carro.glb', err);
  }
}
loadCustomCar();

// Acesso pelo console para depuração e ajuste de acerto (ex.: game.CAR.counterSteer = 0.7).
window.game = { car, damage, profile, particles, skids, recorder, replay, director, showResults, timer, scorer, judge, hud, driftTrail, freeCam, toggleFreeCam, get track() { return track; }, switchTrack, CAR, scene, camera, pipeline, debug, race, menu, startRace, rivals, audio };

// Posiciona a câmera antes do primeiro frame para não "voar" até o carro.
camera.position.set(car.x - Math.sin(car.yaw) * 6.6, 2.4, car.z - Math.cos(car.yaw) * 6.6);
requestAnimationFrame(frame);
// A tela de carregamento inicial já está pintada: aproveita para montar e aquecer todos os cenários.
requestAnimationFrame(() => requestAnimationFrame(() => {
  const t0 = performance.now();
  prebuildWorlds();
  console.info(`Cenários prontos em ${Math.round(performance.now() - t0)} ms`);
  loadingEl.hidden = true;
}));
