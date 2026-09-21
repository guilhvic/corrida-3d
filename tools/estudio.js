// Estúdio de carros: o carro parado na largada de uma pista, com câmera orbital e ângulos prontos.
// Serve para comparar os modelos em alta resolução (ou com o pós-processamento de PS2 do jogo).
// Parâmetros: ?car=kaze180|seiran|kaminari86|tsubame&track=wangan|fujimi|hakone&time=...&view=tras34&ps2=0
import * as THREE from 'three';
import { createCarModel } from '../src/carModel.js';
import { buildWorld } from '../src/world.js';
import { buildFujimiWorld } from '../src/worldFujimi.js';
import { buildHakoneWorld } from '../src/worldHakone.js';
import { TRACKS, trackById, timeOf, CARS } from '../src/catalog.js';
import { followGround } from '../src/track.js';
import { installMist, fogUniforms } from '../src/fog.js';
import { PS2Pipeline } from '../src/ps2.js';
import { PAINTS, RIMS, RIM_COLORS, garageLook, DEFAULT_GARAGE } from '../src/garage.js';

installMist();
const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const pipeline = new PS2Pipeline(renderer);
pipeline.crt = false;
let usePs2 = params.get('ps2') === '1';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 3000);
function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  pipeline.setSize(w, h);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
}
addEventListener('resize', resize);

const WORLDS = { city: buildWorld, fujimi: buildFujimiWorld, hakone: buildHakoneWorld };
const trackDef = trackById(params.get('track') || 'wangan');
const timeId = timeOf(trackDef, params.get('time')).id;
const track = trackDef.build();
const world = WORLDS[trackDef.world](scene, track, { time: timeId });
world.setTime(timeId);
const atm = world.atmosphere;
fogUniforms.uMistAmount.value = atm.mist;
fogUniforms.uMistColor.value.copy(atm.mistColor);
fogUniforms.uMistDensity.value = atm.mistDensity ?? 0.034;
fogUniforms.uMistFalloff.value = atm.mistFalloff ?? 0.34;
fogUniforms.uMistBase.value = atm.mistBase ?? 0;

// Carro parado um pouco à frente da largada
const car = { x: 0, z: 0, y: 0, yaw: 0, pitch: 0, ay: 0, ax: 0, steer: 0, wheelSpin: 0, brake: 0, gx: 0, gz: 0 };
const startIdx = Number(params.get('idx') || 12);
function placeCar() {
  const i = startIdx % track.N;
  car.x = track.x[i]; car.z = track.z[i];
  car.yaw = Math.atan2(track.tx[i], track.tz[i]);
  followGround(car, track, i);
}
placeCar();

const envTarget = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
const envCamera = new THREE.CubeCamera(0.5, 2500, envTarget);
envCamera.position.set(track.x[0], (track.y?.[0] ?? 0) + 2.5, track.z[0]);
world.update(0, envCamera);
envCamera.update(renderer, scene);
envTarget.texture.needsPMREMUpdate = true;
world.setEnvMap?.(envTarget.texture);

// Fundo neutro de estúdio (?fundo=estudio): esconde o cenário, mantém o reflexo dele na pintura
const studioGroup = new THREE.Group();
studioGroup.add(new THREE.HemisphereLight(0xb8c4d8, 0x202024, 1.4));
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 7, 5); studioGroup.add(key);
const rim = new THREE.DirectionalLight(0x9fb8ff, 1.2); rim.position.set(-5, 3, -6); studioGroup.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: 0x3a3b3f, roughness: 0.85 }));
floor.rotation.x = -Math.PI / 2; studioGroup.add(floor);
scene.add(studioGroup);
function setBackdrop(mode) {
  const studioMode = mode === 'estudio';
  world.root.visible = !studioMode;
  studioGroup.visible = studioMode;
  scene.background = studioMode ? new THREE.Color(0x55585f) : null;
  floor.position.set(car.x, car.y + 0.001, car.z);
}

const lampLights = Array.from({ length: 6 }, () => { const l = new THREE.PointLight(0xffa040, 0, 34, 1.4); scene.add(l); return l; });
function updateLamps() {
  if (!world.lamps) return;
  const sorted = world.lamps.map((lamp) => ({ lamp, d: (lamp.position.x - car.x) ** 2 + (lamp.position.z - car.z) ** 2 })).sort((a, b) => a.d - b.d);
  lampLights.forEach((light, i) => {
    const s = sorted[i];
    if (!s) { light.intensity = 0; return; }
    light.position.copy(s.lamp.position);
    light.color.copy(s.lamp.color);
    light.intensity = (atm.lampIntensity ?? 140) * Math.max(0, 1 - Math.sqrt(s.d) / 90);
  });
}

let carId = params.get('car') || 'kaze180';
let look = garageLook({ ...DEFAULT_GARAGE, paint: params.get('paint') || 'original', rims: params.get('rims') || 'original', rimColor: params.get('rimColor') || 'original', wing: params.get('wing') || 'original' });
let model = null;
function buildCar() {
  model?.dispose();
  const def = CARS.find((c) => c.id === carId) || CARS[0];
  const t0 = performance.now();
  model = createCarModel({ design: def.design, look });
  const ms = performance.now() - t0;
  model.setEnvMap(envTarget.texture);
  scene.add(model.root);
  let tris = 0, meshes = 0;
  model.root.traverse((o) => { if (o.isMesh && o.visible) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  window.studio.stats = { build: Math.round(ms), meshes, tris: Math.round(tris) };
  document.getElementById('info').textContent = `${def.name} · ${Math.round(ms)} ms · ${meshes} malhas · ${Math.round(tris / 1000)}k tri · arraste: girar · roda: zoom · P: PS2`;
}

// Câmera orbital em volta do carro (az 0 = de frente, graus)
const VIEWS = {
  frente34: { az: 35, el: 12, dist: 6.2 },
  tras34: { az: 150, el: 12, dist: 6.2 },
  lado: { az: 90, el: 3, dist: 6.8 },
  frente: { az: 0, el: 6, dist: 6 },
  tras: { az: 180, el: 8, dist: 6 },
  cima: { az: 120, el: 55, dist: 7 },
  perseguicao: { az: 180, el: 14, dist: 7.5, target: 0.9 },
  roda: { az: 62, el: 4, dist: 2.3, target: 0.35, offZ: 1.0 },
  farol: { az: 25, el: 8, dist: 2.6, target: 0.6, offZ: 1.8 },
  lanterna: { az: 160, el: 8, dist: 2.6, target: 0.7, offZ: -1.9 },
  interior: { az: 70, el: 22, dist: 2.4, target: 0.9, offZ: -0.3 },
  baixo: { az: 40, el: -2, dist: 5, target: 0.4 },
};
const orbit = { az: 150, el: 12, dist: 6.2, target: 0.6, offZ: 0 };
function setView(name) {
  Object.assign(orbit, { target: 0.6, offZ: 0 }, VIEWS[name] || VIEWS.tras34);
}
setView(params.get('view') || 'tras34');
setBackdrop(params.get('fundo') || 'cidade');

let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  orbit.az -= (e.clientX - drag.x) * 0.4;
  orbit.el = THREE.MathUtils.clamp(orbit.el + (e.clientY - drag.y) * 0.3, -10, 85);
  drag = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => { orbit.dist = THREE.MathUtils.clamp(orbit.dist * (1 + Math.sign(e.deltaY) * 0.1), 1, 30); });
addEventListener('keydown', (e) => { if (e.key === 'p' || e.key === 'P') usePs2 = !usePs2; });

// Câmera livre relativa ao carro: studio.free = { pos: [lateral, altura, frente], look: [lateral, altura, frente] }
function placeCamera() {
  if (window.studio?.free) {
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    const at = ([l, y, f]) => [car.x + fz * l + fx * f, car.y + y, car.z - fx * l + fz * f];
    camera.position.set(...at(window.studio.free.pos));
    camera.lookAt(...at(window.studio.free.look));
    return;
  }
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  const cx = car.x + fx * orbit.offZ, cz = car.z + fz * orbit.offZ;
  const a = THREE.MathUtils.degToRad(orbit.az) + car.yaw, e = THREE.MathUtils.degToRad(orbit.el);
  camera.position.set(cx + Math.sin(a) * Math.cos(e) * orbit.dist, car.y + orbit.target + Math.sin(e) * orbit.dist, cz + Math.cos(a) * Math.cos(e) * orbit.dist);
  camera.lookAt(cx, car.y + orbit.target, cz);
}

function frame() {
  car.steer = Number(params.get('steer') || 0);
  model.update(car);
  updateLamps();
  placeCamera();
  world.update(1 / 60, camera);
  if (usePs2) pipeline.render(scene, camera, { trail: 0 });
  else { renderer.setRenderTarget(null); renderer.render(scene, camera); }
}
function loop() { if (!window.__sheet) frame(); requestAnimationFrame(loop); }

// Barra de botões
const bar = document.getElementById('bar');
const button = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; bar.append(b); return b; };
const select = (list, value, fn) => {
  const s = document.createElement('select');
  for (const o of list) s.append(new Option(o.name, o.id));
  s.value = value;
  s.onchange = () => fn(s.value);
  bar.append(s);
};
select(CARS.map((c) => ({ id: c.id, name: c.name })), carId, (v) => { carId = v; buildCar(); });
select(PAINTS, params.get('paint') || 'original', (v) => { look = { ...look, color: PAINTS.find((p) => p.id === v).color, finish: PAINTS.find((p) => p.id === v).finish }; buildCar(); });
select(RIMS, 'original', (v) => { look = { ...look, rims: v === 'original' ? null : v }; buildCar(); });
select(RIM_COLORS, 'original', (v) => { look = { ...look, rimColor: RIM_COLORS.find((p) => p.id === v).color }; buildCar(); });
for (const name of Object.keys(VIEWS)) button(name, () => setView(name));
button('PS2', () => { usePs2 = !usePs2; });

window.studio = {
  THREE, scene, camera, renderer, orbit, car, VIEWS,
  get model() { return model; },
  setView, frame, setBackdrop,
  // Folha com vários ângulos de uma vez (views: nomes de VIEWS ou objetos { az, el, dist, target, offZ })
  sheet(views = ['frente34', 'tras34', 'lado', 'frente'], cols = 2) {
    const w = innerWidth, h = innerHeight, rowsN = Math.ceil(views.length / cols);
    const cw = Math.floor(w / cols), ch = Math.floor(h / rowsN);
    model.update(car); updateLamps();
    renderer.setRenderTarget(null);
    renderer.setScissorTest(true);
    views.forEach((v, i) => {
      Object.assign(orbit, { target: 0.6, offZ: 0 }, typeof v === 'string' ? VIEWS[v] : v);
      camera.aspect = cw / ch; camera.updateProjectionMatrix();
      placeCamera();
      const x = (i % cols) * cw, y = h - (Math.floor(i / cols) + 1) * ch;
      renderer.setViewport(x, y, cw, ch); renderer.setScissor(x, y, cw, ch);
      world.update(1 / 60, camera);
      renderer.render(scene, camera);
    });
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    window.__sheet = true;
  },
  shot(view, dist) { window.__sheet = false; setView(view); if (dist) orbit.dist = dist; frame(); frame(); },
  setCar(id) { carId = id; buildCar(); frame(); },
  setLook(l) { look = { ...look, ...l }; buildCar(); frame(); },
  ps2(on) { usePs2 = on; frame(); },
  rebuild() { buildCar(); frame(); },
};

resize();
buildCar();
loop();
