import * as THREE from 'three';
import { CAR, ENV, createCar, resetCar, stepCar, shift, paramsOf, setCarParams } from './physics.js';
import { nearestIndex, lateralOffset, carSurfaces, followGround, groundAt, SURFACES, WALL_OFFSET } from './track.js';
import { collideWalls, collideRect, CAR_HALF_LENGTH, CAR_HALF_WIDTH } from './walls.js';
import { DriftScorer, DRIFT } from './drift.js';
import { buildWorld } from './world.js';
import { buildFujimiWorld } from './worldFujimi.js';
import { buildHakoneWorld } from './worldHakone.js';
import { buildLotWorld } from './lot.js';
import { createCarModel } from './carModel.js';
import { DebrisField, shardGeometry } from './debris.js';
import { CarPreview } from './carPreview.js';
import { Input } from './input.js';
import { LapTimer, formatPoints } from './laps.js';
import { Hud } from './hud.js';
import { CarAudio } from './audio.js';
import { SkidMarks } from './skids.js';
import { Particles } from './particles.js';
import { DriftTrail } from './driftTrail.js';
import { StyleJudge } from './styleJudge.js';
import { ReplayRecorder, ReplayDirector, IntroDirector } from './replay.js';
import { Announcer } from './announcer.js';
import { DriftDriver } from './ai.js';
import { loadGarage, garageLook } from './garage.js';
import { loadRanking, submitLap, pickGhost, unpackGhost } from './ranking.js';
import { ProfileTracker, garageUnlocks } from './profile.js';
import { upgradedParams } from './shop.js';
import { rewardOf } from './achievements.js';
import { FreeCamera } from './freeCam.js';
import { PS2Pipeline } from './ps2.js';
import { DIFFICULTIES, DIFFICULTY_ORDER, applyDifficulty, loadDifficulty, saveDifficulty } from './difficulty.js';
import { installMist, fogUniforms } from './fog.js';
import { DebugPanel } from './debug.js';
import { Menu, savedSettings, RANDOM } from './menu.js';
import { carById, trackById, timeOf, TRACKS, PRACTICE } from './catalog.js';
import { Rivals } from './rivals.js';
import { gridSlot, MAX_RACERS } from './race.js';
import { t, setLang, getLang, onLangChange } from './i18n.js';
import { loadConfig } from './settings.js';

// Idioma antes de qualquer texto aparecer (tela de carregamento incluída)
setLang(loadConfig().lang);

// Antes de qualquer material ser compilado.
installMist();
let mistOn = true;
try { mistOn = localStorage.getItem('corrida3d.nevoa') !== '0'; } catch { /* sem storage */ }

const STEP = 1 / 240;
const CAMERAS = ['Perseguição', 'Perseguição distante', 'Capô', 'Cockpit'];
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
const WORLDS = { city: buildWorld, fujimi: buildFujimiWorld, hakone: buildHakoneWorld, lot: buildLotWorld };
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
  loadingEl.querySelector('.load-name').textContent = trackDef ? t(trackDef.name) : 'CORRIDA 3D';
  loadingEl.querySelector('.load-time').textContent = time ? t(time.name) : '';
  loadingEl.querySelector('.load-tip').textContent = t('Dica: {tip}', { tip: t(LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)]) });
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
    announcer.say('medal', { priority: 0 });
    const reward = rewardOf(a.id);
    hud.toast(`${t('Medalha {medal}: {name}', { medal: t(a.medal), name: a.name })}${reward ? ` · ${t('libera {slot}', { slot: reward.slotName })}` : ''}`, 'best', 3600);
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

// Compila os shaders do cenário como eles vão ser desenhados na corrida: com o carro (e o farol dele, que conta
// como luz) na cena e no alvo linear do pós-processamento. A captura do reflexo esconde o carro, e sem isto a
// primeira largada em cada pista recompilava o cenário inteiro (um tranco de meio segundo ou mais).
function compileWorld(w) {
  const shown = world.root.visible;
  world.root.visible = w === world;
  w.root.visible = true;
  renderer.setRenderTarget(pipeline.sceneTarget);
  try { renderer.compile(scene, camera); } catch { /* compila na hora, como antes */ }
  renderer.setRenderTarget(null);
  if (w !== world) w.root.visible = false;
  world.root.visible = shown;
}

// Na tela de carregamento inicial: monta as outras pistas e desenha cada horário uma vez (sobe texturas e
// compila os shaders). Depois disso trocar de pista ou de clima no menu é instantâneo.
function prebuildWorlds() {
  for (const def of [...TRACKS, PRACTICE]) {
    const entry = worldCache.get(def.id) || buildTrackWorld(def, def.times[0].id);
    for (const time of def.times) {
      entry.world.setTime(time.id);
      captureEnv(entry.world, entry.track);
      compileWorld(entry.world);
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
// state: lataria a aplicar no lugar da salva (o replay remonta o carro como estava na largada)
function setPlayerCar(id, force = false, state = null) {
  const def = carById(id);
  if (def.id === playerCarId && !force) return;
  playerCarId = def.id;
  const garage = loadGarage(def.id, garageUnlocks(profile.profile));
  // Acerto com a preparação do BODYSHOP e com o peso dos kits de carroceria da garagem
  setCarParams(car, upgradedParams(def, profile.profile.upgrades?.[def.id], garage));
  audio.setEngine(def.engine);
  audio.setEngineTune(profile.profile.upgrades?.[def.id]?.motor || 0); // turbo maior: mais chiado e mais estouros
  carModel?.dispose();
  ghostModel?.dispose();
  const look = garageLook(garage);
  carModel = createCarModel({ design: def.design, look, breakable: true });
  driftTrail.setColor(look.trail);
  carModel.setEnvMap(envTarget.texture);
  carModel.update(car);
  scene.add(carModel.root);
  loadCarDamage(def.id, state);
  warmCrashShaders();
  ghostModel = createCarModel({ design: def.design, ghost: true });
  ghostModel.root.visible = false;
  scene.add(ghostModel.root);
  carPreview.setCar(def.design, look); // vitrine do menu
}
// Vitrine do carro no cartão do singleplayer (contexto WebGL próprio, só desenha nessa tela).
const carPreview = new CarPreview(document.getElementById('car-preview'));
// Vitrine do BODYSHOP: o carro em foco, com a peça escolhida já aplicada.
const shopPreview = new CarPreview(document.getElementById('shop-preview'));
let showGhost = true;

// Danos do carro do jogador: amassados por batida (frente/traseira/lados) e riscos de raspar a mureta.
// A lataria fica como ficou: o dano é salvo no perfil e só some pagando o reparo na garagem.
const damage = { front: 0, rear: 0, left: 0, right: 0, scratchL: 0, scratchR: 0 };
function resetDamage() { for (const k of Object.keys(damage)) damage[k] = 0; }
// Lataria salva do carro atual: zonas, amassados localizados e peças que já foram arrancadas.
function loadCarDamage(carId, state = null) {
  resetDamage();
  const saved = state ?? ProfileTracker.damageOf(profile.profile, carId);
  if (!saved) return;
  for (const k of Object.keys(damage)) damage[k] = saved[k] || 0;
  carModel.setHits(saved.hits || []);
  for (const name of saved.broken || []) carModel.removeSilently(name);
}
function saveCarDamage() {
  profile.saveDamage(playerCarId, { ...damage, hits: carModel.getHits(), broken: carModel.brokenParts() });
}
// c/zones: o carro e a lataria que apanham (o jogador por padrão; os rivais também amassam).
function addDamage(hit, dt, scrape, c = car, zones = damage) {
  // Ponto de contato no referencial do carro: x+ = esquerda, z+ = frente.
  const dx = hit.x - c.x, dz = hit.z - c.z;
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
  const lz = dx * fx + dz * fz, lx = dx * fz - dz * fx;
  const dent = Math.max(0, hit.speed - 0.9) * 0.09;
  if (dent > 0) {
    if (Math.abs(lz) > 1.2) zones[lz > 0 ? 'front' : 'rear'] = Math.min(1, zones[lz > 0 ? 'front' : 'rear'] + dent);
    else zones[lx > 0 ? 'left' : 'right'] = Math.min(1, zones[lx > 0 ? 'left' : 'right'] + dent * 0.8);
  }
  if (scrape && Math.abs(lz) <= 2.0) {
    const key = lx > 0 ? 'scratchL' : 'scratchR';
    zones[key] = Math.min(1, zones[key] + c.speed * dt * 0.012 + dent * 0.5);
  }
}

// --- Batidas: amassado no ponto, peças que soltam e destroços ------------------------------------------
const debris = new DebrisField(scene);
debris.groundAt = (x, z) => groundAt(track, nearestIndex(track, x, z, idx, 40), x, z);
let crashCooldown = 0; // s: o contato dura vários quadros; uma batida forte vale uma vez
let backfire = 0;      // labareda do estouro no escapamento (decai em alguns centésimos)
const shardMats = {
  glass: new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  red: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.12, 0.1), transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
};
const tmpV = new THREE.Vector3();

// Joga um pedaço para longe do carro: segue o embalo, sai na direção da batida e sobe um pouco.
// pose: o carro de verdade na corrida, ou o carro gravado no replay (x, z, y, vx, vz).
function fling(object, radius, hit, speed, pose, spread = 1) {
  const up = 1.2 + speed * 0.1 + Math.random() * 1.5;
  const push = (1.2 + speed * 0.14) * (0.6 + Math.random() * 0.8);
  const v = new THREE.Vector3(
    pose.vx * 0.7 + hit.nx * push + (Math.random() - 0.5) * 2.5 * spread,
    up,
    pose.vz * 0.7 + hit.nz * push + (Math.random() - 0.5) * 2.5 * spread,
  );
  const w = new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 18);
  debris.add(object, { velocity: v, spin: w, radius });
}

// Lascas de pintura ou cacos de vidro no ponto da batida.
function shards(hit, speed, count, material, pose, size = 0.12) {
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(shardGeometry(size * (0.5 + Math.random())), material);
    m.position.set(hit.x, (pose.y || 0) + 0.35 + Math.random() * 0.4, hit.z);
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    fling(m, 0.02, hit, speed * 0.8, pose, 1.6);
  }
}

// Decide o que uma batida faz (amassado, peças, faróis, lanternas) sem mexer em nada ainda: o mesmo
// evento serve para a corrida e para o replay, que reaplica as batidas no tempo em que aconteceram.
// hit: { x, z, nx, nz } no mundo (normal saindo da parede/do outro carro, na direção do nosso).
// who: 0 = jogador, k = k-ésimo rival (a batida dele também vai para o replay).
function crashEvent(hit, speed, c = car, model = carModel, zones = damage, who = 0) {
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
  const dx = hit.x - c.x, dz = hit.z - c.z;
  const lz = dx * fx + dz * fz, lx = dx * fz - dz * fx;
  // Normal no referencial do carro, sempre apontando para dentro dele (é para lá que a chapa afunda).
  let nlx = hit.nx * fz - hit.nz * fx, nlz = hit.nx * fx + hit.nz * fz;
  if (nlx * -lx + nlz * -lz < 0) { nlx = -nlx; nlz = -nlz; }
  const len = Math.hypot(nlx, nlz) || 1;

  // De lado é pela direção da batida, não só pelo ponto: deslizando de lado contra a mureta o contato
  // mais forte costuma cair na quina, mas quem apanha é a porta.
  const lateral = Math.abs(nlx) > Math.abs(nlz) * 1.2;
  const front = !lateral && lz > 1.2, rear = !lateral && lz < -1.3, side = lateral || Math.abs(lz) < 1.15;
  const partZ = lateral ? Math.max(-1.1, Math.min(1.1, lz)) : lz;
  const parts = [];
  // Peças pequenas perto do ponto: quanto mais longe, mais forte precisa ser a batida.
  for (const b of model.breakablesNear({ x: lx, z: partZ }, 1.1 + speed * 0.03)) {
    if (speed > b.hp * 3 + b.distance * 4) parts.push(b.name);
  }
  // Painéis: para-choque numa batida firme, capô só de frente e forte, porta numa batida de lado.
  if (front && (speed > 9 || (zones.front > 0.8 && speed > 5))) parts.push('para-choque-diant');
  if (front && speed > 14) parts.push('capo');
  if (rear && (speed > 9 || (zones.rear > 0.8 && speed > 5))) parts.push('para-choque-tras');
  if (side && speed > 11) parts.push(lx > 0 ? 'porta-esq' : 'porta-dir');
  return {
    t: recorder.duration,
    who,
    hit: { x: hit.x, z: hit.z, nx: hit.nx, nz: hit.nz },
    speed,
    dent: {
      local: { x: lx, y: 0.55, z: lz }, dir: { x: nlx / len, y: -0.08, z: nlz / len },
      depth: Math.min(0.16, (speed - 2) * 0.012 + 0.01), radius: Math.min(0.95, 0.3 + speed * 0.035),
    },
    parts,
    // Farol do lado que bateu (os escamoteáveis saem como peça; os fixos só apagam e quebram o vidro)
    headlight: front && speed > 7 ? (lx > 0 ? 'farol-esq' : 'farol-dir') : null,
    rearLamps: rear && speed > 6,
    frontGlass: front && speed > 7,
    zones: null,
  };
}

// Aplica um evento de batida no carro: amassa, solta peças, quebra faróis e lanternas e espalha cacos.
// live: na corrida (com som e aviso); no replay só o visual.
function applyCrash(ev, pose, live, model = carModel) {
  model.addHit(ev.dent.local, ev.dent.dir, ev.dent.depth, ev.dent.radius);
  let lost = 0, glass = 0;
  for (const name of ev.parts) {
    const piece = model.detach(name);
    if (!piece) continue;
    fling(piece.object, piece.radius, ev.hit, ev.speed, pose);
    lost++;
  }
  if (ev.headlight && model.breakHeadlight(ev.headlight)) glass++;
  if (ev.rearLamps && model.breakRearLamps()) { shards(ev.hit, ev.speed, 8, shardMats.red, pose, 0.07); glass++; }
  if (ev.frontGlass) { shards(ev.hit, ev.speed, 5, shardMats.glass, pose, 0.06); glass++; }
  // Lascas de pintura em toda batida forte.
  shards(ev.hit, ev.speed, Math.min(10, Math.floor(ev.speed / 2.5)), model.shardMaterial, pose, 0.1);
  if (!live) return;
  // Vidro de rival quebrando: mais baixo quanto mais longe da câmera.
  const near = ev.who ? Math.max(0, 1 - Math.hypot(ev.hit.x - camera.position.x, ev.hit.z - camera.position.z) / 40) : 1;
  if (glass && near > 0) audio.glass(Math.min(1, ev.speed / 14) * near);
  if (lost && !ev.who) hud.toast(t(lost > 1 ? '{n} peças arrancadas' : 'Peça arrancada', { n: lost }), 'bad', 1400);
}

// Batidas da corrida atual (o replay reaplica) e como o carro estava na largada.
let crashLog = [];
let raceStartCar = null;
const carState = () => ({ ...damage, hits: carModel.getHits(), broken: carModel.brokenParts() });

// Pré-compila os shaders que só aparecem numa batida (cacos, painel arrancado, cofre do motor): sem isso a
// primeira batida da corrida dá um soluço enquanto a placa de vídeo compila.
function warmCrashShaders() {
  if (!carModel || typeof renderer === 'undefined') return;
  const undo = carModel.warmup();
  const temp = new THREE.Group();
  for (const m of [shardMats.glass, shardMats.red, carModel.shardMaterial]) temp.add(new THREE.Mesh(shardGeometry(0.05), m));
  temp.position.set(car.x, (car.y || 0) - 50, car.z); // fora da vista
  scene.add(temp);
  // Compila para o alvo em que a cena é desenhada de verdade (linear, do pós-processamento): compilado para a
  // tela o shader sai numa variante de cor diferente e a batida compila outra vez.
  renderer.setRenderTarget(pipeline.sceneTarget);
  try { renderer.compile(scene, camera); } catch { /* compila na hora, como antes */ }
  renderer.setRenderTarget(null);
  temp.removeFromParent();
  temp.traverse((o) => o.geometry?.dispose());
  undo();
}

function crash(hit, speed, who = 0) {
  const e = who ? rivals.list[who - 1] : null;
  const c = e ? e.car : car, model = e ? e.model : carModel, zones = e ? e.zones : damage;
  const ev = crashEvent(hit, speed, c, model, zones, who);
  ev.zones = { ...zones }; // zonas de amassado/risco depois desta batida (o replay as recoloca)
  applyCrash(ev, c, true, model);
  crashLog.push(ev);
  // Batida do jogador: sacode a câmera e borra a imagem num estalo
  if (!who) {
    addTrauma(Math.min(0.6, 0.15 + speed * 0.035));
    blurKick = Math.min(0.05, blurKick + speed * 0.003);
  }
}

// Batidas dos rivais do quadro: amassam, soltam peças e entram no replay (uma forte por vez, como o jogador).
function rivalCrashes(simDt) {
  rivals.list.forEach((e, i) => {
    e.crashCooldown = Math.max(0, e.crashCooldown - simDt);
    const hits = [e.wallHit, e.carHit].filter(Boolean);
    for (const h of hits) addDamage(h, simDt, h === e.wallHit || h.speed < 3, e.car, e.zones);
    const worst = hits.sort((p, q) => q.speed - p.speed)[0];
    if (worst && worst.speed > 2.2 && e.crashCooldown <= 0) { crash(worst, worst.speed, i + 1); e.crashCooldown = 0.25; }
  });
}
const NO_DAMAGE = { front: 0, rear: 0, left: 0, right: 0, scratchL: 0, scratchR: 0 };

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
  rewindReplayCar();
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

// Replay: o carro volta a como estava na largada e as batidas acontecem de novo no tempo certo.
function rewindReplayCar() {
  debris.clear();
  if (raceStartCar) setPlayerCar(playerCarId, true, raceStartCar);
  rivals.repairAll();
  replay.crashIdx = 0;
  replay.zones = { ...(raceStartCar ?? damage) };
  replay.rivalZones = {};
}

function stopReplay() {
  if (!replay.playing) return;
  replay.playing = false;
  // Fim do replay: o carro volta a como terminou a corrida (é o que está salvo no perfil).
  debris.clear();
  setPlayerCar(playerCarId, true);
  replayTag.hidden = true;
  if (camera.view?.enabled) { camera.clearViewOffset(); camera.updateProjectionMatrix(); }
  driftTrail.clear();
}

function updateReplay(dt) {
  replay.t += dt;
  if (replay.t >= recorder.duration) { replay.t = 0; driftTrail.clear(); director.reset(); rewindReplayCar(); }
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
  while (replay.crashIdx < crashLog.length && crashLog[replay.crashIdx].t <= replay.t) {
    const ev = crashLog[replay.crashIdx++];
    const rival = ev.who ? rivals.list[ev.who - 1] : null;
    if (ev.who && (!rival || !others[ev.who - 1])) continue;
    applyCrash(ev, rival ? others[ev.who - 1] : me, false, rival ? rival.model : carModel);
    if (rival) replay.rivalZones[ev.who] = ev.zones; else replay.zones = ev.zones;
  }
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
  replayTag.dataset.camera = t(director.name);
}
const hud = new Hud(track);
const audio = new CarAudio();
const announcer = new Announcer();
// Música começa na primeira interação (o navegador só libera o áudio depois de um gesto)
const unlockAudio = () => { audio.start(); if (audio.ctx) audio.suspend(race.phase === 'menu' || paused); };
// Som preso tocando: o AudioWorklet do motor e da música não para junto com a animação. Some a página
// (outra aba, janela escondida, painel do navegador fechado) e ele cala; ao voltar, volta como estava.
document.addEventListener('visibilitychange', () => audio.setPageVisible(!document.hidden, race.phase === 'menu' || paused));
// Fechar, recarregar ou sair da página: fecha o áudio de vez (com bfcache, só suspende para poder voltar).
addEventListener('pagehide', (e) => (e.persisted ? audio.setPageVisible(false, true) : audio.dispose()));
addEventListener('beforeunload', () => audio.dispose());
addEventListener('pointerdown', unlockAudio, { once: true });
addEventListener('keydown', unlockAudio, { once: true });
// A troca de música não avisa em tela (só a tecla K, quando é o jogador que liga a trilha).
audio.setRain(!!world.atmosphere.rain);
let padName = null;
const input = new Input({
  onPadConnected: (name) => { padName = name; hud.toast(t('{name} conectado', { name: t(name) }), 'info', 1800); },
  onPadDisconnected: (name) => { padName = null; hud.toast(t('{name} desconectado', { name: t(name) }), 'bad', 1800); if (!paused) pauseGame(); },
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
// Tremor: "trauma" de 0 a 1 somado nas batidas. A amplitude segue o quadrado (raspão quase não treme, pancada
// sacode) e anda por ruído suave, não por sorteio a cada quadro; em alta velocidade entra um zumbido fino.
let trauma = 0;
let shakeClock = 0;
const shakeOffset = new THREE.Vector3(); // deslocamento do quadro anterior (tirado antes de seguir o carro)
const addTrauma = (v) => { trauma = Math.min(1, trauma + v); };
const wobble = (t, seed) => Math.sin(t + seed) * 0.5 + Math.sin(t * 2.31 + seed * 1.7) * 0.3 + Math.sin(t * 4.13 + seed * 2.9) * 0.2;
// Desfoque de movimento: pancada extra na batida e a direção em que a câmera olhava no quadro anterior.
let blurKick = 0;
const prevLook = new THREE.Vector3();
const prevCamPos = new THREE.Vector3();
const blurShift = new THREE.Vector2();
let blurReady = false;
const camTarget = new THREE.Vector3();
const tmp = new THREE.Vector3();
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const cockpitQuat = new THREE.Quaternion();
const cockpitLook = new THREE.Quaternion();
const cockpitEuler = new THREE.Euler(0, 0, 0, 'YXZ');
let cockpitSlip = 0; // em drift o piloto olha um pouco para onde o carro vai

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
  camera.position.sub(shakeOffset); // o tremor do quadro anterior não entra na suavização da câmera
  shakeOffset.set(0, 0, 0);
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  const cy = car.y || 0, slope = Math.tan(car.pitch || 0);
  if (camMode === 3 && carModel && !garageView) {
    // Cockpit: nos olhos do piloto, com a rolagem e a arfagem da carroceria; a órbita vira "olhar em volta".
    carModel.root.updateMatrixWorld(true);
    carModel.eye.getWorldPosition(camera.position);
    carModel.body.getWorldQuaternion(cockpitQuat);
    const slip = car.speed > 4 && car.u > 0 ? Math.atan2(Math.sin(Math.atan2(car.vx, car.vz) - car.yaw), Math.cos(Math.atan2(car.vx, car.vz) - car.yaw)) : 0;
    cockpitSlip += (THREE.MathUtils.clamp(slip * 0.45, -0.5, 0.5) - cockpitSlip) * (1 - Math.exp(-dt * 4));
    cockpitEuler.set(-0.06 + orbit.pitch * 0.6, Math.PI + orbit.yaw + cockpitSlip, 0);
    camera.quaternion.copy(cockpitQuat).multiply(cockpitLook.setFromEuler(cockpitEuler));
    camera.fov = 66 + config.fov;
  } else if (camMode === 2) {
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
  applyShake(dt, rumble);
  // Na garagem a imagem anda para a esquerda: o carro aparece à direita do cartão de opções.
  if (garageView && innerWidth > 720) camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.2, 0, innerWidth, innerHeight);
  else if (camera.view?.enabled) camera.clearViewOffset();
  camera.updateProjectionMatrix();
}

// Tremor na câmera já posicionada: batida (trauma²), zumbido de alta velocidade e trepidação da calçada.
// No cockpit o corpo balança menos que a câmera de fora (o piloto está preso ao banco).
function applyShake(dt, rumble) {
  const amount = paused ? 0 : config.shake ?? 1;
  if (!paused) { shakeClock += dt; trauma = Math.max(0, trauma - dt * 1.1); }
  if (!amount) return;
  const hit = trauma * trauma * amount * (camMode === 3 ? 0.6 : 1);
  const buzz = amount * (Math.max(0, Math.min(1, (car.speed - 26) / 34)) * 0.35 + (rumble ? Math.min(0.5, car.speed * 0.02) : 0));
  const tq = shakeClock * 22, tb = shakeClock * 41;
  const ox = wobble(tq, 1) * 0.22 * hit + wobble(tb, 7) * 0.008 * buzz;
  const oy = wobble(tq, 2) * 0.16 * hit + wobble(tb, 8) * 0.012 * buzz;
  if (ox || oy) {
    const before = tmp.copy(camera.position);
    camera.translateX(ox);
    camera.translateY(oy);
    shakeOffset.subVectors(camera.position, before);
  }
  camera.rotateX(wobble(tq, 3) * 0.03 * hit + wobble(tb, 9) * 0.0025 * buzz);
  camera.rotateY(wobble(tq, 4) * 0.03 * hit);
  camera.rotateZ(wobble(tq, 5) * 0.055 * hit + wobble(tb, 10) * 0.002 * buzz);
}

// Desfoque de movimento do quadro: radial com a velocidade do carro (mais forte nas câmeras de dentro, que andam
// junto) e na direção em que a imagem andou na tela desde o quadro anterior (curva, drift, tremor da batida).
function motionBlur(dt, live) {
  const amount = config.motionBlur ?? 1;
  const look = tmp.set(0, 0, -100).applyQuaternion(camera.quaternion);
  let radial = 0;
  blurShift.set(0, 0);
  if (live && amount > 0 && blurReady && dt > 0) {
    const inside = camMode >= 2 ? 1.25 : 1;
    radial = amount * (Math.max(0, Math.min(1, (car.speed - 18) / 42)) ** 1.5 * 0.055 * inside + blurKick);
    // Onde o centro do quadro anterior foi parar na tela agora = quanto a imagem girou neste quadro.
    if (camera.position.distanceToSquared(prevCamPos) < 25) {
      camera.updateMatrixWorld(); // a matriz de vista só é refeita no render: sem isto projetaria com a do quadro anterior
      const p = prevLook.clone().add(camera.position).project(camera);
      if (p.z < 1) {
        const shutter = Math.min(4, (1 / 60) / dt); // exposição de 1/60 s: o mesmo borrão em 30, 60 ou 144 quadros/s
        blurShift.set(p.x * 0.5, p.y * 0.5).multiplyScalar(shutter * amount * 0.8);
        const l = blurShift.length();
        if (l > 0.045) blurShift.multiplyScalar(0.045 / l);
        if (l < 0.0015) blurShift.set(0, 0);
      }
    }
  }
  prevLook.copy(look);
  prevCamPos.copy(camera.position);
  blurReady = true;
  blurKick = Math.max(0, blurKick - dt * 0.12);
  return radial;
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
  audio.setAmbience(trackId, timeId); // cigarras, vento, guindaste... conforme a pista e o horário
  captureEnv();
  if (!trackChanged) return; // só mudou o horário
  timer.setTrack(track);
  judge.setTrack(track);
  director.setTrack(track);
  hud.setTrack(track);
  rivals.setTrack(track);
  applyRanking();
  skids.clear();
  debris.clear();
  placeOnGrid();
}

function placeOnGrid() {
  if (track.lot) {
    rivals.setup(0, difficulty);
    const { spawn } = track.lot;
    resetCar(car, spawn.x, spawn.z, spawn.yaw);
    idx = nearestIndex(track, car.x, car.z);
    followGround(car, track, idx);
    world.cones?.reset();
    skids.last.clear();
    driftTrail.clear();
    return;
  }
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
  return { name: t('VOCÊ'), css: PLAYER_CSS, points: scorer.total + scorer.comboValue, lap: timer.lap, player: true, finished: race.phase === 'finished' };
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
  crashLog = [];
  raceStartCar = carState();
  race.rankBest = 0;
  scorer.resetRace();
  judge.reset();
  placeOnGrid();
  timer.startAt(idx);
  applyRanking();
  skids.clear();
  debris.clear();
  hud.countdown('');
  race.time = 0;
  race.results = [];
  race.bestLap = false;
  orbit.yaw = 0; orbit.pitch = 0; orbit.idle = 99;
  camYaw = car.yaw;
  acc = 0;
}

function startRace(settings) {
  // Treino: ao sair, o fundo do menu volta para a pista em que se estava.
  if (settings.track === PRACTICE.id && trackId !== PRACTICE.id) race.returnTo = { track: trackId, time: timeId };
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
  if (profile.race) { saveCarDamage(); profile.abandon(); } // batida de corrida abandonada também fica na lataria
  if (track.lot) {
    // Treino: a lataria de antes fica guardada e volta ao reiniciar (R) e ao sair. Nada conta para o perfil.
    if (race.practiceBase) restorePracticeCar(); else race.practiceBase = carState();
    race.laps = 0;
    race.racers = 1;
  }
  resetRaceState();
  car.automatic = config.gearbox === 'auto';
  if (car.automatic && car.gear === 0) car.gear = 1;
  if (!track.lot) profile.startRace({ track: trackId, time: timeId, car: playerCarId, laps: race.laps, racers: race.racers, difficulty });
  raceAchievements.length = 0;
  menu.hide();
  if (track.lot) {
    // Sem contagem nem sobrevoo: já sai andando.
    race.phase = 'running';
    hud.countdown('');
    hud.toast(t('Treino livre · R volta para a saída e arruma os cones'), 'info', 3200);
    paused = false;
    audio.start();
    audio.suspend(false);
    return;
  }
  // Sobrevoo de TV antes da contagem (não no reinício)
  if (config.intro && !settings.restart) startIntro();
  else startCountdown();
  paused = false;
  audio.start();
  audio.suspend(false);
}

// Treino: devolve a lataria guardada ao entrar. Só remonta o modelo se alguma peça tiver caído (é o que custa).
function restorePracticeCar() {
  const base = race.practiceBase;
  if (!base) return;
  if (carModel.brokenParts().length !== (base.broken || []).length) setPlayerCar(playerCarId, true, base);
  else {
    for (const k of Object.keys(damage)) damage[k] = base[k] || 0;
    carModel.setHits(base.hits || []);
  }
  debris.clear();
}

function resetPractice() {
  restorePracticeCar();
  scorer.resetCombo();
  placeOnGrid();
  skids.clear();
  crashCooldown = 0;
  camYaw = car.yaw;
  orbit.yaw = 0; orbit.pitch = 0; orbit.idle = 99;
  hud.toast(t('De volta à saída'), 'info', 1200);
}

// --- Sobrevoo antes da largada --------------------------------------------------------------------------------
let intro = null;
const introTag = document.getElementById('intro-tag');
function startIntro() {
  race.phase = 'intro';
  intro = new IntroDirector(track, gridSlot(track, Math.floor(Math.max(0, race.racers - 1) / 2)).idx);
  const def = trackById(trackId), time = timeOf(def, timeId);
  introTag.querySelector('.intro-jp').textContent = `${def.jp} · ${time.jp}`;
  introTag.querySelector('.intro-name').textContent = t(def.name);
  introTag.querySelector('.intro-time').textContent = t(time.name);
  introTag.hidden = false;
  document.body.classList.add('intro');
  announcer.say('welcome', { priority: 1, params: { track: def.jp } });
}

function startCountdown() {
  intro = null;
  introTag.hidden = true;
  document.body.classList.remove('intro');
  race.phase = 'countdown';
  race.countdown = 3;
  race.countShown = 0;
  camYaw = car.yaw;
}

function pauseGame() {
  if (race.phase === 'menu' || paused) return;
  announcer.stop();
  paused = true;
  const standings = rivals.standings(playerRow());
  menu.showPause({
    practice: track.lot ? { cones: world.cones?.knocked ?? 0 } : null,
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
  if (profile.race) { saveCarDamage(); profile.abandon(); } // batida de corrida abandonada também fica na lataria
  if (race.phase === 'intro') startCountdown();
  announcer.stop();
  race.phase = 'menu';
  if (track.lot) {
    // Sai do treino: carro como estava antes de entrar e o menu de volta na pista de antes.
    if (race.practiceBase) restorePracticeCar();
    race.practiceBase = null;
    const back = race.returnTo ?? { track: TRACKS[0].id };
    race.racers = menu.settings.racers;
    switchTrack(back.track, back.time);
  }
  resetRaceState();
  paused = true;
  menu.show('main');
  audio.suspend(true);
}

function finishRace() {
  race.phase = 'finished';
  race.finishTimer = 3;
  hud.popup(t('CHEGADA'), 'bank');
  const standings = rivals.standings({ ...playerRow(), points: scorer.total, finished: true });
  announcer.say(standings.length > 1 && standings[0].player ? 'win' : 'finish', { priority: 2, cooldown: 0 });
}

function showResults() {
  paused = true;
  audio.suspend(true);
  rivals.bankAll();
  const finalStandings = rivals.standings({ ...playerRow(), points: scorer.total, finished: true });
  const position = finalStandings.findIndex((r) => r.player) + 1;
  profile.finish({ position, racers: finalStandings.length, total: scorer.total });
  // Prêmio em ¥ e a lataria como ficou: o conserto é pago na garagem.
  const prize = ProfileTracker.prize({ total: scorer.total, position, racers: finalStandings.length });
  profile.earn(prize);
  saveCarDamage();
  profile.save();
  const repair = ProfileTracker.repairCost({ ...damage, broken: carModel.brokenParts() });
  // O replay só começa depois de salvar: ele rebobina o carro para como estava na largada.
  startReplay();
  announceAchievements();
  menu.showResults({
    achievements: [...raceAchievements],
    laps: race.results, total: scorer.total, bestCombo: scorer.best, time: race.time, difficulty, bestLap: race.bestLap, grades: { ...judge.counts }, rankBest: race.rankBest,
    standings: rivals.standings({ ...playerRow(), points: scorer.total, finished: true }),
    prize, repair,
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
  if (race.phase === 'intro' && intro?.done) startCountdown();
  if (race.phase === 'countdown') {
    race.countdown -= dt;
    const n = Math.ceil(race.countdown);
    if (race.countdown > 0) {
      hud.countdown(String(n));
      if (n !== race.countShown) { race.countShown = n; announcer.say(['one', 'two', 'three'][n - 1] ?? 'three', { priority: 2, cooldown: 0 }); }
    } else {
      race.phase = 'running';
      race.goTimer = 0.9;
      hud.countdown(t('JÁ!'));
      announcer.say('go', { priority: 2, cooldown: 0 });
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
  if (announce) hud.toast(t('Dificuldade: {level}', { level: t(DIFFICULTIES[key].label) }), 'info', 1600);
}

const menu = new Menu({
  difficulty,
  onStart: startRace,
  onResume: resumeGame,
  // Reiniciar repete a pista e o horário que saíram no sorteio; "correr de novo" no resultado sorteia outra vez
  onRestart: () => startRace({ laps: race.laps, racers: race.racers, car: playerCarId, track: trackId, time: timeId, restart: true }),
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
  // Bipe do menu (o áudio só existe depois do primeiro gesto do jogador; antes disso fica mudo)
  onNav: (kind) => audio.uiBlip(kind),
  // BODYSHOP: paga e entrega. Preparação no carro atual vale na hora (física e ficha).
  onBuy: (item) => {
    if (!profile.spend(item.price)) return false;
    if (item.kind === 'car') profile.giveCar(item.id);
    if (item.kind === 'upgrade') profile.setUpgrade(item.car, item.id, item.level + 1);
    if (item.kind === 'part') profile.giveItem(item.key);
    profile.save();
    if (item.kind === 'upgrade' && item.car === playerCarId) {
      setCarParams(car, upgradedParams(carById(playerCarId), profile.profile.upgrades[playerCarId], loadGarage(playerCarId, garageUnlocks(profile.profile))));
      audio.setEngineTune(profile.profile.upgrades[playerCarId]?.motor || 0);
    }
    audio.start();
    return true;
  },
  onShopPreview: (carId, look) => shopPreview.setCar(carById(carId).design, look ? garageLook(look) : garageLook(loadGarage(carId, garageUnlocks(profile.profile)))),
  // Garagem: paga o conserto e a lataria volta ao zero.
  onRepair: (cost) => {
    if (!profile.spend(cost)) return false;
    resetDamage();
    profile.saveDamage(playerCarId, { ...damage, hits: [], broken: [] });
    profile.save();
    setPlayerCar(playerCarId, true); // remonta: peças arrancadas voltam
    debris.clear();
    return true;
  },
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
  announcer.volume = cfg.narrator * cfg.master;
  announcer.enabled = cfg.narrator > 0;
  if (getLang() !== cfg.lang) setLang(cfg.lang);
  if (audio.musicOn !== cfg.musicOn) audio.setMusicOn(cfg.musicOn);
  pipeline.crt = cfg.crt;
  if (mistOn !== cfg.mist) { mistOn = cfg.mist; applyAtmosphere(); }
  if (resolutionChanged) { pipeline.targetHeight = cfg.resolution; pipeline.setSize(innerWidth, innerHeight); }
  showGhost = cfg.ghost;
  hud.setOptions({ units: cfg.units, fps: cfg.fps, minimap: cfg.minimap, grades: cfg.grades });
  document.body.style.setProperty('--hud-scale', cfg.hudScale); // tamanho dos painéis na corrida
  input.rumbleEnabled = cfg.rumble;
  driftTrail.enabled = cfg.driftTrail;
  rivals.showNames = cfg.names;
  setFullscreen(cfg.fullscreen);
}

// Tela cheia: o navegador só deixa entrar a partir de um gesto do jogador (tecla F11 ou clique no menu);
// fora disso o pedido é recusado em silêncio e a opção volta sozinha pelo fullscreenchange.
function setFullscreen(on) {
  if (!!document.fullscreenElement === on) return;
  // Recusado (sem gesto ou bloqueado pela página que hospeda o jogo): a opção volta para DESLIGADO.
  if (on) document.documentElement.requestFullscreen?.().catch(() => menu.setConfig({ fullscreen: false }));
  else document.exitFullscreen?.().catch(() => { /* já saiu */ });
}
addEventListener('fullscreenchange', () => {
  const on = !!document.fullscreenElement;
  if (config.fullscreen !== on) menu.setConfig({ fullscreen: on });
});
// Troca de idioma: menus e textos gerados de novo (o HTML fixo é traduzido pelo i18n.js)
onLangChange(() => {
  if (menu.visible) menu.render();
  updateNarratorNote();
  hud.standings(race.phase === 'menu' ? [] : rivals.standings(playerRow()));
});

// Aviso nas configurações quando o sistema não tem voz japonesa para o narrador
const narratorNote = document.getElementById('narrator-note');
function updateNarratorNote() {
  narratorNote.hidden = announcer.available;
  narratorNote.textContent = t('Narrador sem voz: o sistema não tem voz japonesa instalada. No Windows: Configurações › Hora e idioma › Fala › Adicionar vozes › Japonês.');
}
announcer.onVoices = updateNarratorNote;
updateNarratorNote();
applyConfig(config);
setDifficulty(difficulty);
race.racers = menu.settings.racers;
race.laps = menu.settings.laps;
placeOnGrid();
menu.show('main');

// --- Debug (tecla B) ------------------------------------------------------------------------------
const debug = new DebugPanel(car);
const debugInfo = { input: null, surfaces: null, fps: 60, scorer };
if (debug.loadedCount) hud.toast(t(debug.loadedCount > 1 ? 'Acerto de debug carregado ({n} ajustes)' : 'Acerto de debug carregado ({n} ajuste)', { n: debug.loadedCount }), 'info', 2600);

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
  // Tela cheia vale em qualquer tela (o menu e a pausa saem antes do resto dos atalhos).
  if (a.fullscreen) {
    const on = !document.fullscreenElement;
    menu.setConfig({ fullscreen: on });
    hud.toast(t(on ? 'Tela cheia' : 'Em janela'), 'info', 1000);
  }
  if (a.music) {
    audio.start();
    menu.setConfig({ musicOn: !config.musicOn });
    hud.toast(audio.musicOn ? `${t('Música ligada')}${audio.song ? ` · ♪ ${audio.song.name}` : ''}` : t('Música desligada'), 'info', 1800);
  }
  if (a.nextSong) { audio.start(); audio.nextSong(); }
  if (a.freeCam) toggleFreeCam();
  if (freeCam.active) {
    if (a.pause || a.back) toggleFreeCam(false);
    if (a.mist || a.crt) { /* efeitos visuais seguem valendo */ } else return;
  }
  if (a.difficulty) setDifficulty(DIFFICULTY_ORDER[(DIFFICULTY_ORDER.indexOf(difficulty) + 1) % DIFFICULTY_ORDER.length], !paused);
  if (paused) { menu.handle(a); return; }
  if (race.phase === 'intro' && (a.confirm || a.back || a.pause)) { startCountdown(); return; }
  if (a.pause) { pauseGame(); return; }
  if (a.camera) { camMode = (camMode + 1) % CAMERAS.length; hud.toast(t('Câmera: {name}', { name: t(CAMERAS[camMode]) }), 'info', 1200); }
  if (a.transmission) {
    car.automatic = !car.automatic;
    if (car.automatic && car.gear === 0) car.gear = 1;
    hud.toast(t(car.automatic ? 'Câmbio automático' : 'Câmbio manual (Q / E)'), 'info', 1400);
  }
  for (const [action, dir] of [['shiftUp', 1], ['shiftDown', -1]]) {
    if (!a[action]) continue;
    if (car.automatic) { car.automatic = false; hud.toast(t('Câmbio manual'), 'info', 1400); }
    shift(car, dir);
  }
  if (a.mute) { audio.setMuted(!audio.muted); hud.toast(t(audio.muted ? 'Som desligado' : 'Som ligado'), 'info', 1000); }
  if (a.crt) {
    menu.setConfig({ crt: !config.crt });
    hud.toast(t(config.crt ? 'Efeito CRT ligado' : 'Efeito CRT desligado'), 'info', 1200);
  }
  if (a.mist) {
    menu.setConfig({ mist: !config.mist });
    hud.toast(t(config.mist ? 'Névoa ligada' : 'Névoa desligada'), 'info', 1200);
  }
  if (a.ghost) { menu.setConfig({ ghost: !config.ghost }); hud.toast(t(config.ghost ? 'Fantasma visível' : 'Fantasma oculto'), 'info', 1000); }
  if (a.tcs) { car.tcs = !car.tcs; hud.toast(t(car.tcs ? 'Controle de tração ligado (atrapalha o drift)' : 'Controle de tração desligado'), 'info', 1600); }
  if (a.abs) { car.abs = !car.abs; hud.toast(t(car.abs ? 'ABS ligado' : 'ABS desligado'), car.abs ? 'info' : 'bad', 1400); }
  if (a.driftAssist) {
    car.driftAssist = !car.driftAssist;
    hud.toast(t(car.driftAssist ? 'Assistência de drift ligada' : 'Assistência de drift desligada'), car.driftAssist ? 'info' : 'bad', 1600);
  }
  if (a.reset && race.phase === 'running' && track.lot) { resetPractice(); return; }
  if (a.reset && race.phase === 'running') {
    scorer.resetCombo();
    placeOnTrack(nearestIndex(track, car.x, car.z, idx));
  }
}

// Distância da lateral do carro mais próxima até uma parede (usa os 4 cantos).
function wallDistance() {
  if (track.lot) {
    // Estacionamento: mureta mais próxima ou cone de pé mais próximo (passar rente a um cone também vale).
    const { rect } = track.lot;
    const reach = Math.max(CAR_HALF_LENGTH, CAR_HALF_WIDTH);
    const walls = Math.min(car.x - rect.minX, rect.maxX - car.x, car.z - rect.minZ, rect.maxZ - car.z) - reach;
    return Math.min(walls, world.cones ? world.cones.nearest(car) : Infinity);
  }
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw), lx = fz, lz = -fx;
  let best = Infinity;
  for (const [ox, oz] of [[CAR_HALF_WIDTH, CAR_HALF_LENGTH], [-CAR_HALF_WIDTH, CAR_HALF_LENGTH], [CAR_HALF_WIDTH, -CAR_HALF_LENGTH], [-CAR_HALF_WIDTH, -CAR_HALF_LENGTH]]) {
    const px = car.x + lx * ox + fx * oz, pz = car.z + lz * ox + fz * oz;
    best = Math.min(best, WALL_OFFSET - Math.abs(lateralOffset(track, nearestIndex(track, px, pz, idx, 6), px, pz)));
  }
  return best;
}

// demo: carro da tela de título pilotado pela IA (sem pontos, danos, vibração nem replay)
function simulate(dt, demoMode = false) {
  let inp = demoMode ? demo.driver.update(idx, dt, []) : input.update(dt);
  if (race.phase === 'finished') inp = { throttle: 0, brake: 0.25, steer: 0, handbrake: 0 }; // passou da chegada: freia sozinho
  acc += dt;
  let steps = 0;
  let impact = null;
  let carHit = null;
  let coneHit = null;
  let sf = SURFACES.asphalt, sr = SURFACES.asphalt;
  const lot = track.lot;
  while (acc >= STEP && steps < 48) {
    // No estacionamento é tudo asfalto até a mureta; as muretas são as bordas retas do pátio.
    if (!lot) [sf, sr] = carSurfaces(track, car, idx, paramsOf(car).a, paramsOf(car).b);
    stepCar(car, inp, STEP, sf, sr);
    idx = nearestIndex(track, car.x, car.z, idx);
    followGround(car, track, idx);
    const hit = lot ? collideRect(car, lot.rect) : collideWalls(car, track, idx);
    if (hit && (!impact || hit.speed > impact.speed)) impact = hit;
    if (lot && world.cones) {
      const ch = world.cones.collide(car);
      if (ch && (!coneHit || ch.speed > coneHit.speed)) coneHit = ch;
    }
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

  // Cone derrubado: pancada oca de plástico, no lugar do cone
  if (coneHit && coneHit.speed > 0.6) {
    audio.impact(Math.min(2.5, 0.4 + coneHit.speed * 0.12), coneHit);
    if (coneHit.speed > 3) addTrauma(0.05);
  }

  // Pontuação (só com a corrida valendo)
  if (race.phase === 'running') {
    race.time += simDt;
    if (impact && impact.speed > DRIFT.wallImpact && !race.wallContact && !lot) profile.wallHit();
    race.wallContact = !!impact;
    const onGrass = sf === SURFACES.offroad && sr === SURFACES.offroad;
    scorer.update(simDt, {
      angle: car.driftAngle, speed: car.speed, onGrass,
      wallImpact: impact ? impact.speed : 0, carImpact: carHit ? carHit.speed : 0, wallDistance: wallDistance(),
    });
    // Na última volta o combo em andamento é somado ao cruzar a linha. (No treino não há volta.)
    if (!lot) timer.update(simDt, car, idx, () => {
      if (race.laps && timer.lap === race.laps) scorer.bank();
      return scorer.startLap();
    });
  }

  if (demoMode) {
    demo.scorer.update(simDt, { angle: car.driftAngle, speed: car.speed, onGrass: false, wallImpact: impact ? impact.speed : 0, carImpact: 0, wallDistance: 5 });
    for (const ev of demo.scorer.events.splice(0)) if (ev.type === 'bank') driftTrail.flash('bank');
  }

  let comboLost = false;
  for (const ev of scorer.events.splice(0)) {
    if (ev.type === 'bank') {
      hud.popup(`+${formatPoints(ev.points)}`, 'bank'); driftTrail.flash('bank'); profile.bank(ev.points);
      if (ev.points >= 12000) announcer.say('greatDrift', { priority: 1, cooldown: 3 });
      else if (ev.points >= 2500) announcer.say('niceDrift', { priority: 0, cooldown: 5 });
    } else if (ev.type === 'bonus') hud.bonus(ev.label.startsWith('NOTA ') ? t('NOTA {grade}', { grade: ev.label.slice(5) }) : t(ev.label), ev.points);
    else if (ev.type === 'lost') {
      hud.popup(t(LOST_REASON[ev.reason]), 'lost'); input.hit(0.7, 260); driftTrail.flash('lost'); comboLost = true;
      announcer.say(ev.reason === 'spin' ? 'spin' : 'crash', { priority: 1, cooldown: 3 });
    }
  }
  // Música e narrador acompanham o multiplicador: camadas no x3 e no x5
  if (race.phase === 'running') {
    const level = scorer.active ? (scorer.mult >= 5 ? 2 : scorer.mult >= 3 ? 1 : 0) : 0;
    audio.setMusicCombo(level, comboLost);
    if (level === 2 && !race.maxCalled) { race.maxCalled = true; announcer.say('maxCombo', { priority: 1, cooldown: 0 }); }
    if (!scorer.active) race.maxCalled = false;
  }
  for (const ev of timer.events.splice(0)) {
    const { samples, ...lap } = ev;
    race.results.push(lap);
    profile.lap(ev.points);
    // Ranking de voltas por pista e carro (com o fantasma desta volta)
    const rank = submitLap(trackId, playerCarId, { points: ev.points, time: ev.time, difficulty, timeOfDay: timeId }, samples);
    if (rank) { race.rankBest = race.rankBest ? Math.min(race.rankBest, rank) : rank; hud.toast(t('Volta no ranking: {rank}º lugar', { rank }), 'best', 2600); }
    if (ev.best) race.bestLap = true;
    if (race.laps && ev.lap >= race.laps) { finishRace(); continue; }
    const lastLap = race.laps && ev.lap === race.laps - 1;
    const lastLapNext = lastLap ? ` · ${t('ÚLTIMA VOLTA')}` : '';
    if (ev.best) hud.toast(`${t('Melhor volta: {points} pts', { points: formatPoints(ev.points) })}${lastLapNext}`, 'best', 3000);
    else hud.toast(`${t('Volta: {points} pts', { points: formatPoints(ev.points) })}${lastLapNext}`, lastLapNext ? 'best' : 'info', 2400);
    if (lastLap) announcer.say('finalLap', { priority: 2, cooldown: 0 });
    else if (ev.best && ev.lap > 1) announcer.say('bestLap', { priority: 1 });
  }

  if (!demoMode) rivalCrashes(simDt);
  rivals.score(simDt, race.laps, race.phase === 'running');
  rivals.effects(simDt, skids, particles, camera);

  // Batida em outro carro: faíscas no ponto de contato
  const groundY = car.y || 0;
  if (carHit && carHit.speed > 0.8) {
    particles.sparks(carHit.x, carHit.z, carHit.nx, carHit.nz, carHit.speed, groundY, car.vx * 0.5, car.vz * 0.5);
    audio.impact(carHit.speed);
    if (carHit.speed > 1.5 && !demoMode) { addTrauma(Math.min(0.5, carHit.speed * 0.045)); input.hit(Math.min(1, 0.25 + carHit.speed * 0.08), 200); }
  }

  // Batida / raspão na parede
  if (impact && !demoMode) addDamage(impact, simDt, true);
  if (carHit && carHit.speed > 0.5 && !demoMode) addDamage({ ...carHit, x: carHit.x, z: carHit.z }, simDt, carHit.speed < 3);
  crashCooldown = Math.max(0, crashCooldown - simDt);
  if (!demoMode && crashCooldown <= 0) {
    const worst = impact && (!carHit || impact.speed >= carHit.speed) ? impact : carHit;
    if (worst && worst.speed > 2.2) { crash(worst, worst.speed); crashCooldown = 0.25; }
  }
  if (impact) {
    const strength = impact.speed;
    if (strength > 0.6) {
      particles.sparks(impact.x, impact.z, impact.nx, impact.nz, strength, groundY, car.vx, car.vz);
      audio.impact(strength);
    }
    // Raspando: jato contínuo de faíscas enquanto encosta andando
    particles.grind(impact.x, impact.z, impact.nx, impact.nz, car.vx, car.vz, simDt, groundY);
    sparkLight.position.set(impact.x + impact.nx * 0.6, groundY + 0.5, impact.z + impact.nz * 0.6);
    if (strength > 1.5 && !demoMode) {
      addTrauma(Math.min(0.55, strength * 0.05));
      input.hit(Math.min(1, 0.25 + strength * 0.08), 200);
    }
  }

  // Estouros no escapamento: tirando o pé em giro alto, o motor preparado cospe fogo pela ponta do escapamento.
  // O estalo em si é do som do motor (engine-dsp.js); aqui é só a labareda, na mesma condição.
  const tune = profile.profile.upgrades?.[playerCarId]?.motor || 0;
  backfire = Math.max(0, backfire - simDt * 14);
  if (tune > 0 && !demoMode && inp.throttle < 0.05 && car.rpm > 3400 - tune * 300 && car.speed > 5) {
    if (Math.random() < simDt * (1.5 + tune * 3.5)) backfire = 0.6 + Math.random() * 0.4;
  }
  carModel.setBackfire(backfire);

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

  // Nota de estilo por curva (curvas da pista: no estacionamento não há)
  if (race.phase === 'running' && simDt > 0 && !lot) {
    judge.update(simDt, {
      idx, lateral: lateralOffset(track, idx, car.x, car.z), angle: Math.abs(car.driftAngle) * 57.2958, speed: car.speed,
      smoke: rearSkid * Math.min(1, car.speed / 25), drifting: scorer.active && scorer.idle === 0,
      failed: comboLost || (impact && impact.speed > DRIFT.wallImpact) || (carHit && carHit.speed > DRIFT.carImpact),
    });
    for (const ev of judge.events.splice(0)) {
      profile.grade(ev.grade);
      if (ev.grade === 'SS') announcer.say('gradeSS', { priority: 2, cooldown: 0.5 });
      else if (ev.grade === 'S') announcer.say('gradeS', { priority: 1, cooldown: 1 });
      hud.grade(ev);
      scorer.styleBonus(ev.grade, ev.bonus);
    }
  }

  // Grava o replay (jogador primeiro, depois os rivais na ordem da lista)
  if (simDt > 0 && !demoMode && !lot) {
    recorder.record(simDt, [
      { car, skid: rearSkid, mult: scorer.active ? scorer.mult : 0 },
      ...rivals.list.map((e) => ({ car: e.car, skid: skidOf(e.car), mult: 0 })),
    ]);
  }

  const tarmac = sf === SURFACES.asphalt || sr === SURFACES.asphalt;
  audio.update(car, tarmac ? Math.max(rearSkid, frontSkid) : 0, rumble);
  if (!demoMode) input.rumble(tarmac ? rearSkid * 0.35 : 0.15 * Math.min(1, car.speed / 15), rumble ? 0.35 : 0);
}

// --- Tela de título: o carro do jogador faz drift sozinho pela pista, filmado pelas câmeras de TV -----------------
const demo = { active: false, driver: null, scorer: new DriftScorer() };
const DEMO_SCREENS = new Set(['main', 'profile', 'config', 'controls']);
function startDemo() {
  demo.active = true;
  rivals.clear();
  applyDifficulty(car, 'facil'); // a IA pilota com o controle de ângulo
  car.automatic = true;
  if (car.gear < 1) car.gear = 1;
  demo.driver = new DriftDriver(car, track, { skill: 0.95, lane: 0, seed: 1 + Math.floor(Math.random() * 9999) });
  demo.scorer.resetRace();
  skids.clear();
  driftTrail.clear();
  director.setTrack(track);
  acc = 0;
}
function stopDemo() {
  demo.active = false;
  setDifficulty(difficulty);
  placeOnGrid();
  skids.clear();
  driftTrail.clear();
  if (camera.view?.enabled) { camera.clearViewOffset(); camera.updateProjectionMatrix(); }
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;

  updatePadStatus(dt);
  handleActions();
  if (!freeCam.active) updateRace(dt);
  const wantDemo = race.phase === 'menu' && DEMO_SCREENS.has(menu.current) && !freeCam.active;
  if (wantDemo !== demo.active) (wantDemo ? startDemo : stopDemo)();
  if (demo.active) simulate(dt, true);
  if (!paused && !freeCam.active && (race.phase === 'running' || race.phase === 'finished')) simulate(dt * debug.timeScale);

  if (replay.playing && menu.current !== 'results' && !freeCam.active) stopReplay();
  if (replay.playing) updateReplay(dt);
  else {
    carModel.update(car);
    driftTrail.update((paused && !demo.active) || freeCam.active ? 0 : dt, car, carModel.tailLights, demo.active ? demo.scorer : scorer, camera);
    rivals.updateVisuals(camera);
  }
  carModel.setDamage(replay.playing && replay.zones ? replay.zones : damage);
  rivals.list.forEach((e, i) => e.model.setDamage(replay.playing ? (replay.rivalZones?.[i + 1] ?? NO_DAMAGE) : e.zones));
  debris.update(paused && !replay.playing ? 0 : dt);
  world.cones?.update(paused ? 0 : dt);
  // A vitrine do menu só gira enquanto a tela do singleplayer está à vista.
  if (menu.visible && menu.current === 'single') carPreview.update(dt);
  if (menu.visible && menu.current === 'bodyshop') shopPreview.update(dt);
  if (!paused && !freeCam.active) audio.updateRivals(rivals.list, camera, dt);
  // Ambiente: o sino toca enquanto o trem de Fujimi passa perto, e o eco cresce entre os muros de Hakone.
  if (!paused) {
    const tr = world?.train;
    const trainNear = tr ? Math.max(0, 1 - Math.hypot(tr.x - car.x, tr.z - car.z) / 220) : 0;
    audio.updateAmbience(dt, { train: trainNear });
    // Hakone corre entre muros de pedra: sempre tem um eco de fundo, e ele cresce quando o carro encosta.
    audio.setEcho(trackId === 'hakone' ? 0.35 + 0.65 * Math.max(0, 1 - wallDistance() / 4) : 0);
  }
  const pose = showGhost && !replay.playing ? timer.ghostPose() : null;
  ghostModel.root.visible = !!pose;
  if (pose) {
    ghostGround.x = pose.x; ghostGround.z = pose.z; ghostGround.yaw = pose.yaw;
    groundPose(ghostGround);
    ghostModel.setPose(pose.x, pose.z, pose.yaw, ghostGround.y, ghostGround.pitch);
  }

  let cut = false;
  if (freeCam.active) freeCam.update(dt);
  else if (demo.active) {
    director.update(dt, camera, car);
    // Na tela de título o carro aparece à direita do cartão
    if (menu.current === 'main' && innerWidth > 720) camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.2, 0, innerWidth, innerHeight);
    else if (camera.view?.enabled) camera.clearViewOffset();
    camera.updateProjectionMatrix();
  } else if (race.phase === 'intro' && intro) {
    if (!paused) cut = intro.update(dt, camera).cut;
  } else if (!replay.playing) {
    if (!paused && race.phase !== 'countdown') updateOrbit(dt);
    updateCamera(paused ? 0.016 : dt, rumble && !paused);
  }
  particles.update((paused && !replay.playing && !demo.active) || freeCam.active ? 0 : dt, camera, pipeline.internalHeight);
  // Luz das faíscas: acende com as que nasceram neste quadro e apaga rápido, tremendo
  sparkGlow = Math.max(sparkGlow * Math.exp(-dt * 14), Math.min(1, particles.sparkLevel / 6));
  particles.sparkLevel = 0;
  sparkLight.intensity = sparkGlow * (14 + Math.random() * 10);
  updateLampLights();
  world.update(now / 1000, camera);
  fogUniforms.uFogTime.value = now / 1000;
  debugInfo.fps = fps;
  debug.update(dt, debugInfo);
  hud.update(car, timer, scorer, { fps, ghost: pose, padName, totalLaps: race.laps, rivals: rivals.list, cones: world.cones });
  race.standingsTimer -= dt;
  if (race.standingsTimer <= 0) {
    race.standingsTimer = 0.25;
    hud.standings(race.phase === 'menu' ? [] : rivals.standings(playerRow()));
  }
  // Rastro cresce com a velocidade, como nos jogos de corrida da época.
  // Música: cheia na corrida, abafada nos menus e na pausa
  audio.setMusicIntensity(freeCam.active ? 0.55 : menu.current === 'results' ? 0.7 : race.phase === 'intro' ? 0.8 : race.phase === 'menu' ? 0.5 : paused ? 0.3 : 1);
  if (race.phase !== 'running') audio.setMusicCombo(0);
  const trail = cut ? 0 : paused && !demo.active ? 0.05 : 0.06 + Math.min(0.16, car.speed * 0.004);
  // Desfoque só com o carro na mão do jogador (nem menu, nem pausa, nem replay ou câmera livre)
  const live = !cut && !paused && !freeCam.active && !replay.playing && (race.phase === 'running' || race.phase === 'finished');
  const radial = motionBlur(dt, live);
  pipeline.render(scene, camera, { trail: trail * config.trail, radial, shift: live ? blurShift : null });
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
    hud.toast(t('Carro personalizado carregado'), 'info', 2000);
  } catch (err) {
    console.warn('Não foi possível carregar assets/carro.glb', err);
  }
}
loadCustomCar();

// Acesso pelo console para depuração e ajuste de acerto (ex.: game.CAR.counterSteer = 0.7).
window.game = { frame: (now) => frame(now), get carModel() { return carModel; }, debris, car, damage, profile, announcer, demo, get intro() { return intro; }, particles, skids, recorder, replay, director, showResults, timer, scorer, judge, hud, driftTrail, freeCam, toggleFreeCam, get track() { return track; }, get world() { return world; }, switchTrack, CAR, scene, camera, pipeline, debug, race, menu, startRace, rivals, audio };

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
