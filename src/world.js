// Cidade à noite com cara de PS2: texturas pequenas, luz "pintada" no chão, neon e janelas acesas.
import * as THREE from 'three';
import { ROAD_HALF_WIDTH, SIDEWALK_WIDTH, WALL_OFFSET } from './track.js';
import { lightConeMaterial } from './fog.js';
import { buildNeonDistrict } from './neon.js';
import { Rain } from './rain.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { roadTextures, paverTextures, curbTextures, tireMarksTexture, roadWordTexture, tactileTexture } from './textures.js';
import {
  facadeTextures, FACADE_TILE, shopTextures, signTextures, barrierTextures, roofTextures, acTexture, foliageTexture,
  stoneTextures, railingTexture, poleTexture, manholeTexture, grateTexture,
} from './cityTextures.js';
import {
  Buckets, buildStorefronts, balconyModule, waterTankGeometry, penthouseGeometry, antennaGeometry, streetLampGeometry,
  utilityPoleGeometry, signalHeadGeometry, treeGeometry, frontMatrix,
} from './cityProps.js';
import { buildPort, PORT } from './port.js';

const WALL_HEIGHT = 0.9;
const WALL_THICKNESS = 0.5;
const SIDEWALK_HEIGHT = 0.12;
const LAMP_SPACING = 32;
// Fontes japonesas do sistema (Windows/macOS/Linux) para os textos da cidade.
export const JP_FONT = '"Yu Gothic", "Meiryo", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Noto Sans JP", sans-serif';

// Aleatório com semente: a cidade é igual em todo carregamento.
export function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvasTexture(w, h, draw, { repeat = true, nearest = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (nearest) { tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestMipmapLinearFilter; }
  return tex;
}

export function noise(ctx, w, h, base, spread, count, rand, size = 1) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const v = (rand() - 0.5) * spread;
    ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    ctx.fillRect(rand() * w, rand() * h, size, size);
  }
}

export function glowTexture() {
  return canvasTexture(64, 64, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  }, { repeat: false });
}

// Faixa contínua ao longo da pista entre dois pontos (lateral, altura) da seção transversal.
// `facing`: -1 = normal para o centro da rua, 0 = para cima, 1 = para fora.
export function ribbon(track, side, [offA, yA], [offB, yB], facing, uScale, vSpan = 1) {
  const { N, x, z, nx, nz, ds } = track;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= N; j++) {
    const i = j % N;
    pos.push(x[i] + nx[i] * offA * side, yA, z[i] + nz[i] * offA * side);
    pos.push(x[i] + nx[i] * offB * side, yB, z[i] + nz[i] * offB * side);
    uv.push((j * ds) / uScale, 0, (j * ds) / uScale, vSpan);
  }
  const p = (k) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  const normal = new THREE.Vector3().subVectors(p(1), p(0)).cross(new THREE.Vector3().subVectors(p(2), p(0)));
  const want = facing === 0 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(nx[0] * side * facing, 0, nz[0] * side * facing);
  const flip = normal.dot(want) < 0;
  for (let j = 0; j < N; j++) {
    const a = j * 2, b = a + 1, c = a + 2, d = a + 3;
    if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function nearestIndexBrute(track, px, pz) {
  let best = 0, bestD = Infinity;
  for (let j = 0; j < track.N; j++) {
    const d = (track.x[j] - px) ** 2 + (track.z[j] - pz) ** 2;
    if (d < bestD) { bestD = d; best = j; }
  }
  return best;
}

// Frente da máquina de refrigerante: fileiras de latinhas e painel iluminado.
export function vendingTexture(rand) {
  const colors = ['#d8262c', '#1f6fd1', '#f2b51c', '#2aa34a', '#f5f5f5', '#7b3fc4'];
  const tint = rand() < 0.5 ? '#e9f3ff' : '#fff1e0';
  return canvasTexture(32, 64, (ctx, w, h) => {
    ctx.fillStyle = tint; ctx.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
      ctx.fillRect(3 + c * 5.4, 6 + r * 8, 4, 6);
    }
    ctx.fillStyle = '#333'; ctx.fillRect(4, 42, w - 8, 3);
    ctx.fillStyle = '#111'; ctx.fillRect(4, 52, w - 8, 8);
  }, { repeat: false, nearest: true });
}

// Junta malhas estáticas que usam o mesmo material numa só (um draw call por material).
// Ignora instâncias, malhas com vários materiais, com filhos ou marcadas como dinâmicas.
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  const visit = (o) => {
    if (o.userData.dynamic) return; // grupos que se movem (e tudo dentro deles) ficam de fora
    o.children.forEach(visit);
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.children.length) return;
    const g = o.geometry;
    const key = `${o.material.uuid}|${g.index ? 'i' : 'n'}|${Object.keys(g.attributes).sort().join(',')}|${o.renderOrder}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  };
  visit(root);
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map((o) => o.geometry.clone().applyMatrix4(o.matrixWorld));
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, list[0].material);
    mesh.renderOrder = list[0].renderOrder;
    root.add(mesh);
    for (const o of list) o.removeFromParent();
  }
}

// Distância ao eixo da pista (busca bruta; só roda na montagem da cena).
export function distanceToTrack(track, px, pz) {
  let best = Infinity;
  for (let j = 0; j < track.N; j += 2) best = Math.min(best, (track.x[j] - px) ** 2 + (track.z[j] - pz) ** 2);
  return Math.sqrt(best);
}

const NEON_WORDS = ['ホテル', '居酒屋', '24時間', 'カラオケ', 'ラーメン', 'パチンコ', 'ゲーセン', '寿司', '薬局', '焼肉', '喫茶', 'スナック', '整備工場', '牛丼', 'バー'];
const NEON_COLORS = ['#ff3fb4', '#35f2ff', '#7dff5a', '#ffd23f', '#ff4a3d', '#b36bff'];

function neonTexture(word, color, vertical = false) {
  const chars = [...word];
  const w = vertical ? 64 : 256, h = vertical ? Math.max(128, chars.length * 56 + 16) : 64;
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = 'rgba(8,6,14,0.92)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.font = `900 ${vertical ? 44 : 40}px ${JP_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    if (vertical) chars.forEach((ch, i) => ctx.fillText(ch, w / 2, (h - chars.length * 56) / 2 + 28 + i * 56));
    else ctx.fillText(word, w / 2, h / 2 + 2, w - 20);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, 0, w, h);
  }, { repeat: false });
}

// Libera geometrias, materiais e texturas de um mundo ao trocar de pista.
export function disposeTree(root) {
  const textures = new Set();
  root.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [o.material].flat().filter(Boolean)) {
      for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value?.isTexture) textures.add(u.value);
      m.dispose();
    }
  });
  textures.forEach((t) => t.dispose());
  root.removeFromParent();
}

// Horários da cidade. A geometria é a mesma: setTime só troca neblina, céu, asfalto, prédios ao fundo e a chuva.
const CITY_TIMES = {
  noite: { fog: [0x140d22, 0.0105], mist: [0.065, 0.047, 0.065], horizon: [0.23, 0.10, 0.26], zenith: [0.012, 0.014, 0.04],
    road: { specular: 0x70747f, shininess: 70, reflectivity: 0, color: 0xffffff }, towers: 0.6, stars: true, rain: false, grip: 1 },
  chuva: { fog: [0x151a23, 0.0165], mist: [0.055, 0.06, 0.075], horizon: [0.1, 0.11, 0.14], zenith: [0.01, 0.012, 0.018],
    road: { specular: 0xb4bccb, shininess: 120, reflectivity: 0.3, color: 0x9a9ea6 }, towers: 0.4, stars: false, rain: true, grip: 0.8 },
};

// time: 'noite' (padrão) ou 'chuva' (chuva forte: asfalto espelhado, névoa mais fechada e menos aderência)
export function buildWorld(scene, track, { time = 'noite' } = {}) {
  const rand = mulberry32(1987);
  const root = new THREE.Group();
  root.name = 'mundo:cidade';
  scene.add(root);
  const { N, x, z, nx, nz, tx, tz, ds } = track;

  // --- Céu, neblina e luz ambiente ----------------------------------------------------------
  const fog = new THREE.FogExp2(0x140d22, 0.0105);
  const mistColor = new THREE.Color();
  const skyUniforms = { horizon: { value: new THREE.Color() }, zenith: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 16, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 horizon, zenith; varying vec3 vDir; void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        gl_FragColor = vec4(mix(horizon, zenith, pow(h, 0.45)), 1.0); }`,
    }),
  );
  sky.renderOrder = -1;
  root.add(sky);

  const starPos = [];
  for (let i = 0; i < 500; i++) {
    const v = new THREE.Vector3(rand() - 0.5, rand() * 0.8 + 0.2, rand() - 0.5).normalize().multiplyScalar(1400);
    starPos.push(v.x, v.y, v.z);
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3)),
    new THREE.PointsMaterial({ color: 0x8890b0, size: 1.5, sizeAttenuation: false, fog: false }),
  );
  root.add(stars);

  root.add(new THREE.HemisphereLight(0x5060a0, 0x100810, 0.9));
  const moon = new THREE.DirectionalLight(0x8a9cff, 0.35);
  moon.position.set(-200, 300, 100);
  root.add(moon);

  // --- Chão da cidade -------------------------------------------------------------------------
  const groundTex = canvasTexture(64, 64, (ctx, w, h) => noise(ctx, w, h, '#26252b', 0.25, 700, rand, 2));
  groundTex.repeat.set(300, 300);
  // O chão da cidade termina no cais; dali para leste é a baía (port.js)
  const groundW = PORT.quayX + 1200;
  groundTex.repeat.set(groundW / 8, 300);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundW, 2400), new THREE.MeshLambertMaterial({ map: groundTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.x = PORT.quayX - groundW / 2;
  root.add(ground);

  // --- Asfalto molhado --------------------------------------------------------------------------------
  // Ladrilho de 14 x 16 m gerado por pixel (textures.js): cor, relevo e brilho coerentes,
  // então a luz dos postes "granula" no agregado e espelha nas poças e na sarjeta.
  const asphalt = roadTextures();
  const road = new THREE.Mesh(
    ribbon(track, 1, [-ROAD_HALF_WIDTH, 0.02], [ROAD_HALF_WIDTH, 0.02], 0, 16),
    new THREE.MeshPhongMaterial({
      map: asphalt.map, normalMap: asphalt.normalMap, specularMap: asphalt.specularMap,
      specular: 0x70747f, shininess: 70, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
      // Na chuva o asfalto vira espelho: reflete o ambiente capturado (neon e postes); no seco reflectivity 0
      combine: THREE.MixOperation, reflectivity: 0,
    }),
  );
  // A textura corre ao longo da rua: troca u/v.
  const ruv = road.geometry.attributes.uv;
  for (let i = 0; i < ruv.count; i++) { const u = ruv.getX(i), v = ruv.getY(i); ruv.setXY(i, v, u); }
  root.add(road);

  // --- Calçadas e muretas -------------------------------------------------------------------------
  const pavers = paverTextures();
  const sidewalkMat = new THREE.MeshPhongMaterial({ map: pavers.map, normalMap: pavers.normalMap, specularMap: pavers.specularMap, specular: 0x555a66, shininess: 40 });
  const curb = curbTextures();
  const curbMat = new THREE.MeshPhongMaterial({ map: curb.map, normalMap: curb.normalMap, specularMap: curb.specularMap, specular: 0x444444, shininess: 25 });
  const barrier = barrierTextures();
  const wallMat = new THREE.MeshPhongMaterial({ map: barrier.map, normalMap: barrier.normalMap, specularMap: barrier.specularMap, specular: 0x3a3a3a, shininess: 18 });
  const wallTopMat = new THREE.MeshPhongMaterial({ map: barrier.map, normalMap: barrier.normalMap, color: 0xb8b4ac, specular: 0x222222, shininess: 12 });
  for (const side of [1, -1]) {
    root.add(new THREE.Mesh(ribbon(track, side, [ROAD_HALF_WIDTH, 0], [ROAD_HALF_WIDTH, SIDEWALK_HEIGHT], -1, 2), curbMat));
    const walk = new THREE.Mesh(ribbon(track, side, [ROAD_HALF_WIDTH, SIDEWALK_HEIGHT], [WALL_OFFSET, SIDEWALK_HEIGHT], 0, 2, SIDEWALK_WIDTH / 2), sidewalkMat);
    root.add(walk);
    root.add(new THREE.Mesh(ribbon(track, side, [WALL_OFFSET, 0], [WALL_OFFSET, WALL_HEIGHT], -1, 3), wallMat));
    root.add(new THREE.Mesh(ribbon(track, side, [WALL_OFFSET, WALL_HEIGHT], [WALL_OFFSET + WALL_THICKNESS, WALL_HEIGHT], 0, 3), wallTopMat));
    root.add(new THREE.Mesh(ribbon(track, side, [WALL_OFFSET + WALL_THICKNESS, WALL_HEIGHT], [WALL_OFFSET + WALL_THICKNESS, 0], 1, 3), wallTopMat));
  }

  // --- Placas de seta no lado de fora das esquinas ------------------------------------------------------
  const chevronTex = canvasTexture(32, 32, (ctx, w, h) => {
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd21a';
    ctx.beginPath();
    ctx.moveTo(8, 4); ctx.lineTo(18, 4); ctx.lineTo(28, 16); ctx.lineTo(18, 28); ctx.lineTo(8, 28); ctx.lineTo(18, 16);
    ctx.fill();
  }, { repeat: false, nearest: true });
  const chevronGeo = new THREE.PlaneGeometry(1.4, 1.1);
  const chevronMats = [1, -1].map((dir) => {
    const t = chevronTex.clone();
    t.needsUpdate = true;
    if (dir < 0) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; }
    return new THREE.MeshBasicMaterial({ map: t, color: 0xbbbbbb });
  });
  for (let j = 0; j < N; j += 4) {
    const k = (j + 6) % N;
    const bend = tx[k] * nx[j] + tz[k] * nz[j]; // > 0: a rua dobra para a esquerda
    if (Math.abs(bend) < 0.28) continue;
    const side = bend > 0 ? -1 : 1; // lado de fora
    // A seta desenhada aponta para +u; na mureta direita (side -1) o +u do plano aponta para trás.
    const sign = new THREE.Mesh(chevronGeo, chevronMats[side > 0 ? 0 : 1]);
    sign.position.set(x[j] + nx[j] * side * (WALL_OFFSET + 0.25), WALL_HEIGHT + 0.65, z[j] + nz[j] * side * (WALL_OFFSET + 0.25));
    sign.lookAt(x[j], WALL_HEIGHT + 0.65, z[j]);
    root.add(sign);
  }

  // --- Postes: luz "pintada" no chão + brilho na lâmpada ------------------------------------------------
  const glow = glowTexture();
  const lamps = [];
  const poleMat = new THREE.MeshPhongMaterial({ color: 0x4a4d54, specular: 0x333333, shininess: 30 });
  const lampGeos = {};
  const poolGeo = new THREE.PlaneGeometry(1, 1);
  poolGeo.rotateX(-Math.PI / 2);
  const lampConeGeo = new THREE.CylinderGeometry(0.25, 4.8, 6.85, 20, 1, true);
  const poolMat = new THREE.MeshBasicMaterial({ map: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  // Um conjunto de materiais por tipo de lâmpada (sódio quente / LED frio), compartilhado por todos os postes.
  const lampStyles = {};
  const lampStyle = (warm) => {
    const id = warm ? 'warm' : 'cool';
    if (!lampStyles[id]) {
      const color = new THREE.Color(warm ? 0xffa040 : 0xbfe4ff);
      const pool = poolMat.clone();
      pool.color = color.clone().multiplyScalar(0.55);
      lampStyles[id] = {
        color,
        head: new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2) }),
        flare: new THREE.SpriteMaterial({ map: glow, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
        pool,
        cone: lightConeMaterial(color, warm ? 0.24 : 0.18),
      };
    }
    return lampStyles[id];
  };
  let side = 1;
  for (let s = 6; s < track.length; s += LAMP_SPACING) {
    const j = Math.floor(s / ds) % N;
    side = -side;
    const px = x[j] + nx[j] * side * (WALL_OFFSET + WALL_THICKNESS + 0.5);
    const pz = z[j] + nz[j] * side * (WALL_OFFSET + WALL_THICKNESS + 0.5);
    const warm = rand() < 0.8;
    const style = lampStyle(warm);
    const color = style.color;
    const hx = x[j] + nx[j] * side * (WALL_OFFSET - 2.2), hz = z[j] + nz[j] * side * (WALL_OFFSET - 2.2);
    // Coluna, braço curvo e luminária apontando para a rua (o braço sai em +X do poste)
    const reach = Math.hypot(hx - px, hz - pz) - 0.3;
    const lampGeo = lampGeos[Math.round(reach * 10)] ||= streetLampGeometry(reach, 7.1);
    const yaw = Math.atan2(-(hz - pz), hx - px);
    const pole = new THREE.Mesh(lampGeo.pole, poleMat);
    pole.position.set(px, 0, pz);
    pole.rotation.y = yaw;
    root.add(pole);
    const head = new THREE.Mesh(lampGeo.lens, style.head);
    head.position.set(px, 0, pz);
    head.rotation.y = yaw;
    root.add(head);
    const flare = new THREE.Sprite(style.flare);
    flare.position.set(hx, 6.8, hz);
    flare.scale.setScalar(3.2);
    root.add(flare);
    const pool = new THREE.Mesh(poolGeo, style.pool);
    pool.position.set(x[j] + nx[j] * side * (ROAD_HALF_WIDTH - 2.5), 0.05, z[j] + nz[j] * side * (ROAD_HALF_WIDTH - 2.5));
    pool.scale.set(15, 1, 15);
    root.add(pool);
    // Cone de luz na névoa, da lâmpada até o chão
    const cone = new THREE.Mesh(lampConeGeo, style.cone);
    cone.position.set(hx, 6.85 / 2, hz);
    root.add(cone);
    lamps.push({ position: new THREE.Vector3(hx, 6.6, hz), color });
  }

  // --- Prédios ---------------------------------------------------------------------------------------
  // Estilos de fachada (cityTextures.js): 0 apartamentos, 1 escritório, 2 concreto velho, 3 azulejo marrom, 4 galpão
  const STYLE_IDS = ['mansion', 'office', 'zakkyo', 'brick', 'warehouse'];
  const facades = STYLE_IDS.map((id, k) => facadeTextures(id, 11 + k));
  const MANSION = 0, OFFICE = 1, ZAKKYO = 2, BRICK = 3, WAREHOUSE = 4;
  const buckets = facades.map(() => ({ pos: [], uv: [], idx: [], roofPos: [], roofIdx: [] }));
  const neonPlanes = [];
  const roofUnits = [];

  // Térreo: lojas acesas, portas de aço fechadas e loja de conveniência (atlas de 4 fachadas de 8 m).
  const GROUND_FLOOR = 3.8;
  const shops = shopTextures();
  const signs = signTextures();
  const stone = stoneTextures();
  const cityBuckets = new Buckets();
  let shopGlassMat = null;
  const balconies = [];   // matrizes dos módulos de varanda
  const drainpipes = [];  // [x, z, altura]
  const copings = [];     // rufos das platibandas
  const shopBucket = { pos: [], uv: [], idx: [] };
  const parapetBucket = { pos: [], uv: [], idx: [] };
  const acUnits = [];
  const billboards = [];
  const fronts = []; // fachadas voltadas para a rua (neon.js decora)

  function addBuilding(cx, cz, yaw, w, d, h, style, frontSign, roadside = false) {
    const b = buckets[style], f = facades[style];
    const c = Math.cos(yaw), s = Math.sin(yaw);
    // Cantos no plano (largura ao longo de "ex", profundidade ao longo de "ez").
    const ex = [c, -s], ez = [s, c];
    const corner = (i, k) => [cx + ex[0] * w / 2 * i + ez[0] * d / 2 * k, cz + ex[1] * w / 2 * i + ez[1] * d / 2 * k];
    const ring = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
    // Deslocamentos inteiros de vão/andar: as varandas em 3D caem alinhadas com as portas da textura
    const uo = Math.floor(rand() * FACADE_TILE.bays) / FACADE_TILE.bays, vo = Math.floor(rand() * FACADE_TILE.floors) / FACADE_TILE.floors;
    const so = Math.floor(rand() * 8) / 8;
    const quad = (bucket, ax, az, bx, bz, y0, y1, u0, u1, v0, v1) => {
      const base = bucket.pos.length / 3;
      bucket.pos.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az);
      // u cresce para a direita de quem olha a fachada de fora (textos e números sem espelhar)
      bucket.uv.push(u1, v0, u0, v0, u0, v1, u1, v1);
      bucket.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    for (let e = 0; e < 4; e++) {
      const [ax, az] = ring[e], [bx, bz] = ring[(e + 1) % 4];
      const len = Math.hypot(bx - ax, bz - az);
      // térreo da frente das fachadas de rua vira lojas em 3D (cityProps.js)
      // laterais e fundos: base de pedra escura (sem vitrine)
      if (!(roadside && e === 0)) quad(shopBucket, ax, az, bx, bz, 0, GROUND_FLOOR, so * 4, so * 4 + len / 4, 0, GROUND_FLOOR / 2);
      quad(b, ax, az, bx, bz, GROUND_FLOOR, h, uo, uo + len / f.tileW, vo, vo + (h - GROUND_FLOOR) / f.tileH);
      quad(parapetBucket, ax, az, bx, bz, h, h + 0.9, 0, len / 4, 0, 1); // mureta do telhado
      copings.push([ax, az, bx, bz, h + 0.9]);
    }
    if (roadside) {
      const front = { cx, cz, yaw, w, d, h, ex, ez };
      fronts.push(front);
      const floors = Math.floor((h - GROUND_FLOOR) / 3.4);
      // Canos de descida nos cantos da frente
      for (const k of [-1, 1]) {
        if (rand() < 0.6) drainpipes.push([cx + ex[0] * k * (w / 2 - 0.2) - ez[0] * (d / 2 + 0.12), cz + ex[1] * k * (w / 2 - 0.2) - ez[1] * (d / 2 + 0.12), h + 0.9]);
      }
      if (style === MANSION) {
        front.balcony = true;
        // Varandas por andar e vão (vão 0 começa no canto esquerdo, onde u = uo)
        const M = frontMatrix(front);
        const bays = Math.floor(w / 3.2);
        for (let fl = 0; fl < floors; fl++) {
          for (let k = 0; k < bays; k++) {
            const lx = -w / 2 + 1.6 + k * 3.2;
            balconies.push(M.clone().multiply(new THREE.Matrix4().makeTranslation(lx, GROUND_FLOOR + fl * 3.4 + 0.02, 0)));
          }
        }
      }
      // Condensadores de ar-condicionado pendurados na fachada da frente
      for (let fl = 0; fl < floors; fl++) {
        for (let col = -w / 2 + 1.6; col < w / 2 - 1; col += 3.2) {
          if (style === MANSION || style === OFFICE || rand() > 0.22) continue;
          acUnits.push({
            x: cx + ex[0] * col - ez[0] * (d / 2 + 0.22), z: cz + ex[1] * col - ez[1] * (d / 2 + 0.22),
            y: GROUND_FLOOR + fl * 3.4 + 0.55, yaw,
          });
        }
      }
      if (!frontSign && h < 32 && rand() < 0.3) billboards.push({ x: cx - ez[0] * d * 0.2, z: cz - ez[1] * d * 0.2, y: h, yaw, w: Math.min(w * 0.8, 10) });
    }
    const rb = b.roofPos.length / 3;
    for (const [px, pz] of ring) b.roofPos.push(px, h, pz);
    b.roofIdx.push(rb, rb + 2, rb + 1, rb, rb + 3, rb + 2);
    // Caixas d'água e condensadores no telhado
    const units = 1 + Math.floor(rand() * 4);
    for (let k = 0; k < units; k++) {
      const i = (rand() - 0.5) * 0.6, kk = (rand() - 0.5) * 0.6;
      const r = rand();
      const kind = r < 0.25 ? 'tank' : r < 0.4 && w > 10 && d > 10 ? 'penthouse' : r < 0.55 ? 'antenna' : 'ac';
      roofUnits.push({ x: cx + ex[0] * w * i + ez[0] * d * kk, z: cz + ex[1] * w * i + ez[1] * d * kk, y: h, yaw: yaw + (kind === 'ac' ? Math.floor(rand() * 4) * Math.PI / 2 : 0), kind });
    }

    if (frontSign) {
      const vertical = rand() < 0.35;
      const word = NEON_WORDS[Math.floor(rand() * NEON_WORDS.length)];
      const color = NEON_COLORS[Math.floor(rand() * NEON_COLORS.length)];
      const sw = vertical ? 1.6 : Math.min(w * 0.7, 7), sh = vertical ? 6 : 1.8;
      const y = 3.5 + rand() * Math.max(0.5, Math.min(h - 6, 8));
      neonPlanes.push({ word, color, sw, sh, vertical, x: cx - ez[0] * (d / 2 + 0.15), z: cz - ez[1] * (d / 2 + 0.15), y, yaw });
    }
  }

  const clearance = WALL_OFFSET + WALL_THICKNESS + 3;
  const fits = (cx, cz, w, d, yaw) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const [i, k] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const px = cx + c * w / 2 * i + s * d / 2 * k, pz = cz - s * w / 2 * i + c * d / 2 * k;
      if (distanceToTrack(track, px, pz) < clearance) return false;
    }
    return true;
  };

  // Fileira de frente para a rua, dos dois lados.
  for (const sd of [1, -1]) {
    let s = 0;
    while (s < track.length) {
      const w = 9 + rand() * 16, d = 10 + rand() * 12;
      const j = Math.floor((s + w / 2) / ds) % N;
      const off = clearance + 0.5 + d / 2;
      const cx = x[j] + nx[j] * sd * off, cz = z[j] + nz[j] * sd * off;
      // Frente (lado -ez) virada para a rua.
      const yaw = Math.atan2(nx[j] * sd, nz[j] * sd);
      if (fits(cx, cz, w, d, yaw)) {
        const tall = rand() < 0.15;
        const portSide = cx > 118;
        const r = rand();
        const style = tall ? OFFICE : portSide && r < 0.45 ? WAREHOUSE : r < 0.42 ? MANSION : r < 0.62 ? ZAKKYO : r < 0.8 ? BRICK : OFFICE;
        const hh = style === WAREHOUSE ? 8 + rand() * 6 : tall ? 35 + rand() * 30 : 7 + rand() * 22;
        addBuilding(cx, cz, yaw, w, d, hh, style, style !== WAREHOUSE && rand() < 0.45, true);
      }
      s += w + 1 + rand() * 3;
    }
  }
  // Miolo dos quarteirões e entorno.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let j = 0; j < N; j++) {
    minX = Math.min(minX, x[j]); maxX = Math.max(maxX, x[j]);
    minZ = Math.min(minZ, z[j]); maxZ = Math.max(maxZ, z[j]);
  }
  for (let gx = minX - 160; gx < maxX + 160; gx += 26) {
    for (let gz = minZ - 160; gz < maxZ + 160; gz += 26) {
      const w = 12 + rand() * 12, d = 12 + rand() * 12;
      const cx = gx + (rand() - 0.5) * 6, cz = gz + (rand() - 0.5) * 6;
      if (cx > PORT.yardX0 - 14) continue; // pátio de contêineres e cais
      if (!fits(cx, cz, w + 4, d + 4, 0)) continue;
      const far = distanceToTrack(track, cx, cz) > 90;
      addBuilding(cx, cz, 0, w, d, (far ? 20 : 8) + rand() * (far ? 60 : 30), [OFFICE, ZAKKYO, BRICK, MANSION][Math.floor(rand() * 4)], false);
    }
  }

  const roofTex = roofTextures();
  const roofMat = new THREE.MeshPhongMaterial({ map: roofTex.map, normalMap: roofTex.normalMap, specularMap: roofTex.specularMap, specular: 0x3a3e44, shininess: 40, side: THREE.DoubleSide });
  buckets.forEach((b, i) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    geo.setIndex(b.idx);
    geo.computeVertexNormals();
    const f = facades[i];
    root.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
      map: f.map, normalMap: f.normalMap, specularMap: f.specularMap, emissiveMap: f.emissiveMap,
      emissive: 0xffffff, emissiveIntensity: 1.0, specular: 0x5a6068, shininess: 55, side: THREE.DoubleSide,
    })));
    const roof = new THREE.BufferGeometry();
    roof.setAttribute('position', new THREE.Float32BufferAttribute(b.roofPos, 3));
    roof.setAttribute('uv', new THREE.Float32BufferAttribute(b.roofPos.flatMap((v, k) => (k % 3 === 1 ? [] : [v / 12])), 2));
    roof.setIndex(b.roofIdx);
    roof.computeVertexNormals();
    root.add(new THREE.Mesh(roof, roofMat));
  });
  {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(shopBucket.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(shopBucket.uv, 2));
    geo.setIndex(shopBucket.idx);
    geo.computeVertexNormals();
    root.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ map: stone.map, normalMap: stone.normalMap, specularMap: stone.specularMap, color: 0xd8d4cc, specular: 0x555555, shininess: 50, side: THREE.DoubleSide })));
  }
  {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(parapetBucket.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(parapetBucket.uv, 2));
    geo.setIndex(parapetBucket.idx);
    geo.computeVertexNormals();
    root.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ map: barrier.map, normalMap: barrier.normalMap, color: 0x8a8680, specular: 0x222222, shininess: 10, side: THREE.DoubleSide })));
    // Rufos por cima das platibandas
    const copingGeos = copings.map(([ax, az, bx, bz, y]) => {
      const len = Math.hypot(bx - ax, bz - az);
      const g = new THREE.BoxGeometry(len + 0.3, 0.14, 0.42).toNonIndexed();
      g.rotateY(-Math.atan2(bz - az, bx - ax)).translate((ax + bx) / 2, y + 0.07, (az + bz) / 2);
      return g;
    });
    const copingMesh = new THREE.Mesh(mergeGeometries(copingGeos), new THREE.MeshLambertMaterial({ color: 0x9a978f }));
    copingGeos.forEach((g) => g.dispose());
    copingMesh.userData.dynamic = true;
    root.add(copingMesh);

    const acTex = acTexture();
    const acGeoFacade = new THREE.BoxGeometry(0.85, 0.6, 0.4);
    const acFacade = new THREE.InstancedMesh(acGeoFacade, new THREE.MeshLambertMaterial({ map: acTex }), acUnits.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    acUnits.forEach((a, i) => acFacade.setMatrixAt(i, m4.compose(p.set(a.x, a.y, a.z), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, a.yaw), one)));
    root.add(acFacade);

    // Outdoors iluminados nos telhados (marcas fictícias)
    const ads = [
      ['ターボオイル', '高回転に強い', '#b3121b', '#ffd23f'],
      ['ネオ喫茶', '24時間営業', '#2a1a12', '#ffb36b'],
      ['ゼータタイヤ', '雨の日もしっかりグリップ', '#0f2f6b', '#ffffff'],
      ['ラジオ 88.5', '夜通し放送中', '#4b0f5c', '#35f2ff'],
      ['雲ラーメン', '創業1991年', '#f1e7d2', '#b3121b'],
    ];
    const adTextures = ads.map(([brand, tag, bg, fg]) => canvasTexture(256, 96, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, bg); g.addColorStop(1, '#000');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = fg; ctx.font = "900 44px " + JP_FONT; ctx.textAlign = 'center';
      ctx.fillText(brand, w / 2, 54, 236);
      ctx.font = "700 17px " + JP_FONT; ctx.fillText(tag, w / 2, 80, 236);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, w - 4, h - 4);
    }, { repeat: false }));
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x2c2e33 });
    for (const bb of billboards) {
      const group = new THREE.Group();
      group.position.set(bb.x, bb.y, bb.z);
      group.rotation.y = bb.yaw + Math.PI;
      const bh = bb.w * 0.375;
      const board = new THREE.Mesh(new THREE.PlaneGeometry(bb.w, bh), new THREE.MeshBasicMaterial({ map: adTextures[Math.floor(rand() * ads.length)], color: new THREE.Color(1.25, 1.25, 1.25) }));
      board.position.set(0, 1.8 + bh / 2, 0);
      group.add(board);
      const back = new THREE.Mesh(new THREE.BoxGeometry(bb.w + 0.3, bh + 0.3, 0.2), frameMat);
      back.position.set(0, 1.8 + bh / 2, -0.12);
      group.add(back);
      for (const px of [-bb.w * 0.3, bb.w * 0.3]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.8, 0.25), frameMat);
        post.position.set(px, 0.9, -0.2);
        group.add(post);
      }
      root.add(group);
    }
  }
  {
    const acGeo = new THREE.BoxGeometry(1.6, 1.1, 1.2);
    acGeo.translate(0, 0.55, 0);
    const kinds = {
      ac: new THREE.InstancedMesh(acGeo, new THREE.MeshLambertMaterial({ map: acTexture() }), roofUnits.length),
      tank: new THREE.InstancedMesh(waterTankGeometry(), new THREE.MeshPhongMaterial({ color: 0x8e9aa0, specular: 0x333333, shininess: 25 }), roofUnits.length),
      penthouse: new THREE.InstancedMesh(penthouseGeometry(), new THREE.MeshPhongMaterial({ map: barrier.map, color: 0x9a968e, shininess: 5 }), roofUnits.length),
      antenna: new THREE.InstancedMesh(antennaGeometry(), new THREE.MeshLambertMaterial({ color: 0x6c6e72 }), roofUnits.length),
    };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    const counts = { ac: 0, tank: 0, penthouse: 0, antenna: 0 };
    for (const r of roofUnits) {
      m4.compose(p.set(r.x, r.y, r.z), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, r.yaw), one);
      kinds[r.kind].setMatrixAt(counts[r.kind]++, m4);
    }
    for (const [k, mesh] of Object.entries(kinds)) { mesh.count = counts[k]; root.add(mesh); }

    // Varandas (módulo instanciado com vários materiais)
    const mod = balconyModule();
    const railTex = railingTexture();
    const balconyParts = [
      ['concrete', new THREE.MeshPhongMaterial({ map: barrier.map, color: 0xc8c2b8, shininess: 8 })],
      ['railing', new THREE.MeshPhongMaterial({ map: railTex, transparent: true, alphaTest: 0.05, specular: 0x8899aa, shininess: 80, side: THREE.DoubleSide, depthWrite: false })],
      ['divider', new THREE.MeshLambertMaterial({ color: 0xe2e0d8 })],
      ['ac', new THREE.MeshLambertMaterial({ map: acTexture() })],
    ];
    for (const [key, mat] of balconyParts) {
      const g = mergeGeometries(mod[key].map((x) => (x.index ? x.toNonIndexed() : x)));
      const inst = new THREE.InstancedMesh(g, mat, Math.max(1, balconies.length));
      balconies.forEach((mm, i) => inst.setMatrixAt(i, mm));
      inst.count = balconies.length;
      if (key === 'railing') inst.renderOrder = 1;
      root.add(inst);
    }
    // Canos de descida
    const pipeGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 8).translate(0, 0.5, 0);
    const pipes = new THREE.InstancedMesh(pipeGeo, new THREE.MeshPhongMaterial({ color: 0x9a9c98, specular: 0x444444, shininess: 30 }), Math.max(1, drainpipes.length));
    drainpipes.forEach(([px, pz, ph], i) => pipes.setMatrixAt(i, m4.compose(p.set(px, 0, pz), q.identity(), new THREE.Vector3(1, ph, 1))));
    pipes.count = drainpipes.length;
    root.add(pipes);

    // Térreo em 3D das fachadas de rua
    buildStorefronts(cityBuckets, fronts, rand, GROUND_FLOOR);
    cityBuckets.build(root, {
      shop: new THREE.MeshPhongMaterial({ map: shops.map, emissiveMap: shops.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.05, specular: 0x222222, shininess: 20 }),
      stone: new THREE.MeshPhongMaterial({ map: stone.map, normalMap: stone.normalMap, specularMap: stone.specularMap, specular: 0x777777, shininess: 70 }),
      stoneDark: new THREE.MeshLambertMaterial({ color: 0x1e1d1c }),
      metal: new THREE.MeshPhongMaterial({ color: 0x55585c, specular: 0x444444, shininess: 30, side: THREE.DoubleSide }),
      alu: new THREE.MeshPhongMaterial({ color: 0xb4b8bd, specular: 0xaaaaaa, shininess: 90 }),
      shopGlass: shopGlassMat = new THREE.MeshPhongMaterial({ color: 0x1a2230, specular: 0xb0c0d0, shininess: 140, transparent: true, opacity: 0.22, depthWrite: false, combine: THREE.MixOperation, reflectivity: 0.25 }),
      sign: new THREE.MeshPhongMaterial({ map: signs.map, emissiveMap: signs.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.2 }),
      awning: new THREE.MeshLambertMaterial({ map: signs.map, side: THREE.DoubleSide }),
    });
  }

  // --- Postes de fiação com fios caídos, máquinas de refrigerante e semáforos piscando ---------------------
  const wireMat = new THREE.LineBasicMaterial({ color: 0x0c0c10 });
  const wireSegments = [];
  const vendingBodyGeo = new THREE.BoxGeometry(0.9, 1.8, 0.7);
  const vendingBodyMat = new THREE.MeshLambertMaterial({ color: 0xd8dde2 });
  const vendingFrontGeo = new THREE.PlaneGeometry(0.8, 1.7);
  const vendingFronts = Array.from({ length: 4 }, () => new THREE.MeshBasicMaterial({ map: vendingTexture(rand), color: new THREE.Color(1.3, 1.3, 1.3) }));
  const upGeos = [utilityPoleGeometry(false), utilityPoleGeometry(true)];
  const upMats = {
    concrete: new THREE.MeshLambertMaterial({ map: poleTexture() }),
    steel: new THREE.MeshLambertMaterial({ color: 0x3c3e42 }),
    porcelain: new THREE.MeshPhongMaterial({ color: 0x8a5a3a, specular: 0x666666, shininess: 60 }),
    can: new THREE.MeshPhongMaterial({ color: 0x8f969a, specular: 0x444444, shininess: 30 }),
  };
  for (const sd of [1, -1]) {
    const tops = [];
    for (let s = LAMP_SPACING / 2; s < track.length; s += LAMP_SPACING) {
      const j = Math.floor(s / ds) % N;
      const off = WALL_OFFSET + WALL_THICKNESS + 1.4;
      const px = x[j] + nx[j] * sd * off, pz = z[j] + nz[j] * sd * off;
      const set = upGeos[rand() < 0.35 ? 1 : 0];
      for (const [key, geo] of Object.entries(set)) {
        if (!geo) continue;
        const part = new THREE.Mesh(geo, upMats[key]);
        part.position.set(px, 0, pz);
        part.rotation.y = Math.atan2(tx[j], tz[j]);
        root.add(part);
      }
      tops.push([px, pz, j]);
      // fios de serviço até os prédios
      for (let k = 0; k < 2; k++) {
        const along = (rand() - 0.5) * 8;
        const ex2 = px + nx[j] * sd * 7 + tx[j] * along, ez2 = pz + nz[j] * sd * 7 + tz[j] * along;
        let prev = null;
        for (let q = 0; q <= 6; q++) {
          const t = q / 6;
          const pt = [px + (ex2 - px) * t, 8.4 + (5.8 - 8.4) * t - Math.sin(Math.PI * t) * 0.5, pz + (ez2 - pz) * t];
          if (prev) wireSegments.push(...prev, ...pt);
          prev = pt;
        }
      }

      // Máquina de refrigerante acesa ao pé de alguns postes
      if (rand() < 0.35) {
        // Corpo e frente com materiais compartilhados (juntados depois em poucos draw calls)
        const vo2 = WALL_OFFSET + WALL_THICKNESS + 0.55;
        const k = (j + 2) % N;
        const vm = new THREE.Mesh(vendingBodyGeo, vendingBodyMat);
        vm.position.set(x[k] + nx[k] * sd * vo2, 0.9, z[k] + nz[k] * sd * vo2);
        vm.lookAt(x[k], 0.9, z[k]);
        root.add(vm);
        const front = new THREE.Mesh(vendingFrontGeo, vendingFronts[Math.floor(rand() * vendingFronts.length)]);
        front.position.copy(vm.position).addScaledVector(new THREE.Vector3(-nx[k] * sd, 0, -nz[k] * sd), 0.36);
        front.lookAt(x[k], 0.9, z[k]);
        root.add(front);
      }
    }
    for (let i = 0; i < tops.length; i++) {
      const [ax, az] = tops[i], [bx, bz] = tops[(i + 1) % tops.length];
      if (Math.hypot(bx - ax, bz - az) > LAMP_SPACING * 1.6) continue;
      for (const [wy, lat] of [[9.55, -0.76], [9.55, 0.76], [8.65, -0.68], [8.65, 0.68], [7.9, 0]]) {
        let prev = null;
        for (let k = 0; k <= 10; k++) {
          const t = k / 10;
          const ox = -(bz - az), oz = bx - ax, ol = Math.hypot(ox, oz);
          const p = [ax + (bx - ax) * t + ox / ol * lat, wy - Math.sin(Math.PI * t) * 1.1, az + (bz - az) * t + oz / ol * lat];
          if (prev) wireSegments.push(...prev, ...p);
          prev = p;
        }
      }
    }
  }
  // Todos os fios num único LineSegments
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(wireSegments, 3)), wireMat));

  const blinkers = [];
  const signalHeadMat = new THREE.MeshPhongMaterial({ color: 0x3a3d42, specular: 0x333333, shininess: 25, side: THREE.DoubleSide });
  const amberOn = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.3, 0.2) });
  const amberOff = new THREE.MeshBasicMaterial({ color: 0x3a2a10 });
  const signalGeo = signalHeadGeometry();
  const signalPoleMat = new THREE.MeshPhongMaterial({ color: 0x8c9096, specular: 0x444444, shininess: 30 });
  const signalDim = { green: new THREE.MeshBasicMaterial({ color: 0x0a2a22 }), red: new THREE.MeshBasicMaterial({ color: 0x2a0806 }) };
  for (let j = 0; j < N; j += 3) {
    const prevBend = tx[(j - 8 + N) % N] * tx[j] + tz[(j - 8 + N) % N] * tz[j];
    const nextBend = tx[j] * tx[(j + 8) % N] + tz[j] * tz[(j + 8) % N];
    if (!(prevBend > 0.99 && nextBend < 0.9)) continue; // entrada de esquina
    const k = j;
    for (const sd of [1, -1]) {
      const off = WALL_OFFSET + WALL_THICKNESS + 0.8;
      const px = x[k] + nx[k] * sd * off, pz = z[k] + nz[k] * sd * off;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 5.8, 10), signalPoleMat);
      pole.position.set(px, 2.9, pz);
      root.add(pole);
      const armLen = 2.6;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, armLen, 8), signalPoleMat);
      arm.rotation.set(0, Math.atan2(tx[k], tz[k]), Math.PI / 2, 'YXZ');
      arm.position.set(px - nx[k] * sd * armLen / 2, 5.55, pz - nz[k] * sd * armLen / 2);
      root.add(arm);
      const hx = px - nx[k] * sd * (armLen - 0.4), hz = pz - nz[k] * sd * (armLen - 0.4);
      const faceYaw = Math.atan2(-tx[k], -tz[k]);
      const addHead = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.position.set(hx, 5.3, hz); m.rotation.y = faceYaw; root.add(m); return m; };
      addHead(signalGeo.housing, signalHeadMat);
      addHead(signalGeo.visor, signalHeadMat);
      addHead(signalGeo.green, signalDim.green);
      addHead(signalGeo.red, signalDim.red);
      const lamp = addHead(signalGeo.yellow, amberOn);
      // semáforo de pedestre no poste
      const ped = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.62, 0.22), signalHeadMat);
      ped.position.set(px, 3.1, pz);
      ped.rotation.y = Math.atan2(nx[k] * sd, nz[k] * sd);
      root.add(ped);
      lamp.userData.dynamic = true; // troca de material ao piscar: não pode ser juntado
      blinkers.push(lamp);
    }
    j += 30; // um par por esquina
  }

  // --- Faixas de pedestre antes das esquinas ---------------------------------------------------------------
  const zebraTex = canvasTexture(64, 16, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(225,225,215,0.85)';
    for (let i = 0; i < 8; i++) ctx.fillRect(i * 8 + 2, 0, 5, h);
  }, { repeat: false });
  const zebraMat = new THREE.MeshLambertMaterial({ map: zebraTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  for (const b of blinkers.filter((_, i) => i % 2 === 0)) {
    const j = nearestIndexBrute(track, b.position.x, b.position.z);
    const zebra = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, 3.2), zebraMat);
    zebra.rotation.x = -Math.PI / 2;
    zebra.rotation.z = Math.atan2(tx[j], tz[j]); // largura do plano atravessando a rua
    const jj = (j - 3 + N) % N;
    zebra.position.set(x[jj], 0.035, z[jj]);
    root.add(zebra);
  }

  // Piso tátil nas duas calçadas de cada faixa de pedestre e "止まれ" (pare) pintado antes da esquina
  const tactileMat = new THREE.MeshLambertMaterial({ map: tactileTexture(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const wordMat = new THREE.MeshLambertMaterial({ map: roadWordTexture('止まれ'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  for (const b of blinkers.filter((_, i) => i % 2 === 0)) {
    const j = nearestIndexBrute(track, b.position.x, b.position.z);
    const jj = (j - 3 + N) % N;
    const yaw = Math.atan2(tx[jj], tz[jj]);
    for (const sd of [1, -1]) {
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(SIDEWALK_WIDTH - 0.3, 0.9), tactileMat);
      pad.rotation.set(-Math.PI / 2, 0, yaw);
      const off = ROAD_HALF_WIDTH + SIDEWALK_WIDTH / 2;
      pad.position.set(x[jj] + nx[jj] * sd * off, SIDEWALK_HEIGHT + 0.006, z[jj] + nz[jj] * sd * off);
      root.add(pad);
    }
    const jw = (j - 14 + N) % N;
    const word = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 8), wordMat);
    word.rotation.set(-Math.PI / 2, 0, Math.atan2(tx[jw], tz[jw]) + Math.PI); // topo das letras para a frente
    word.position.set(x[jw] + nx[jw] * 3.5, 0.032, z[jw] + nz[jw] * 3.5); // faixa da esquerda (mão inglesa)
    root.add(word);
  }

  // Marcas de pneu nas curvas (faixa transparente só onde a rua dobra)
  {
    const pos = [], uv = [], idx = [];
    const bent = (j) => tx[(j - 6 + N) % N] * tx[(j + 6) % N] + tz[(j - 6 + N) % N] * tz[(j + 6) % N] < 0.93;
    for (let j = 0; j <= N; j++) {
      const i = j % N;
      for (const [off, u] of [[-6, 0], [6, 1]]) {
        pos.push(x[i] + nx[i] * off, 0.03, z[i] + nz[i] * off);
        uv.push(u, (j * ds) / 16);
      }
      if (j < N && (bent(i) || bent((i + 1) % N))) {
        const a = j * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    root.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: tireMarksTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    })));
  }

  // Passarela de pedestres sobre a reta principal
  const OVERPASS_S = 64;
  {
    const j = Math.floor(OVERPASS_S / ds);
    const group = new THREE.Group();
    group.position.set(x[j], 0, z[j]);
    group.rotation.y = Math.atan2(tx[j], tz[j]);
    root.add(group);
    const concrete = new THREE.MeshLambertMaterial({ color: 0x7b7974 });
    const railMat = new THREE.MeshLambertMaterial({ color: 0x3a3d44 });
    const span = (WALL_OFFSET + 4.2) * 2;
    const add = (geo, mat, px, py, pz, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.x = rx; group.add(m); return m; };
    add(new THREE.BoxGeometry(span, 0.5, 2.6), concrete, 0, 5.8, 0);
    for (const rz of [-1.25, 1.25]) {
      add(new THREE.BoxGeometry(span, 0.06, 0.06), railMat, 0, 7.0, rz);
      add(new THREE.BoxGeometry(span, 0.9, 0.03), new THREE.MeshLambertMaterial({ color: 0x5d6068, transparent: true, opacity: 0.6 }), 0, 6.5, rz);
    }
    const rise = 5.8, run = 9, slope = Math.atan2(rise, run), len = Math.hypot(rise, run);
    for (const sd of [-1, 1]) {
      add(new THREE.BoxGeometry(0.6, 5.8, 0.6), concrete, sd * (WALL_OFFSET + WALL_THICKNESS + 0.9), 2.9, 0);
      add(new THREE.BoxGeometry(1.6, 0.3, len), concrete, sd * (WALL_OFFSET + 3.4), rise / 2, 1.3 + run / 2, slope);
      for (const rx of [-0.8, 0.8]) add(new THREE.BoxGeometry(0.05, 0.05, len), railMat, sd * (WALL_OFFSET + 3.4) + rx, rise / 2 + 1, 1.3 + run / 2, slope);
    }
    const signTex = canvasTexture(256, 64, (ctx, w, h) => {
      ctx.fillStyle = '#1d4f9c'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 3; ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = '#f2f2f2'; ctx.font = '700 25px ' + JP_FONT; ctx.textBaseline = 'middle';
      ctx.textAlign = 'left'; ctx.fillText('↑ 中央区', 16, 26);
      ctx.textAlign = 'right'; ctx.fillText('港 →', w - 16, 26);
      ctx.font = '600 14px ' + JP_FONT; ctx.textAlign = 'center'; ctx.fillText('湾岸通り  Wangan-dori', w / 2, 50);
    }, { repeat: false });
    const sign = add(new THREE.PlaneGeometry(6.5, 1.6), new THREE.MeshBasicMaterial({ map: signTex, color: new THREE.Color(0.75, 0.75, 0.75) }), 0, 5.2, -1.32);
    sign.rotation.y = Math.PI; // virada para quem vem
  }

  // Árvores em canteiros entre a mureta e os prédios
  {
    const spots = [];
    for (const sd of [1, -1]) {
      for (let st = 24; st < track.length; st += LAMP_SPACING) {
        if (Math.abs(st - OVERPASS_S) < 14) continue;
        const j = Math.floor(st / ds) % N;
        const off = WALL_OFFSET + WALL_THICKNESS + 1.9;
        spots.push([x[j] + nx[j] * sd * off, z[j] + nz[j] * sd * off, 0.85 + rand() * 0.35]);
      }
    }
    const variants = [treeGeometry(rand), treeGeometry(rand), treeGeometry(rand)];
    const leafTex = foliageTexture();
    const treeMats = {
      trunk: new THREE.MeshLambertMaterial({ color: 0x4a3b2e }),
      leaves: new THREE.MeshLambertMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide }),
      planter: new THREE.MeshPhongMaterial({ map: stone.map, normalMap: stone.normalMap, color: 0xb0aca4, shininess: 20 }),
      soil: new THREE.MeshLambertMaterial({ color: 0x1c1610 }),
    };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    variants.forEach((v, vi) => {
      const mine = spots.filter((_, i) => i % 3 === vi);
      for (const [key, geo] of Object.entries(v)) {
        const inst = new THREE.InstancedMesh(geo, treeMats[key], Math.max(1, mine.length));
        mine.forEach(([px, pz, k], i) => {
          q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, (Math.abs(px * 13.1 + pz * 7.7)) % 6.28);
          const s = key === 'planter' || key === 'soil' ? 1 : k;
          inst.setMatrixAt(i, m4.compose(p.set(px, 0, pz), q, sc.set(s, s, s)));
        });
        inst.count = mine.length;
        root.add(inst);
      }
    });

    // Tampas de bueiro no meio da rua e grelhas junto à guia
    const mhList = [], grList = [];
    for (let st = 18; st < track.length; st += 46) {
      const j = Math.floor(st / ds) % N;
      const off = (Math.floor(st / 46) % 2 ? 1 : -1) * 3.2;
      mhList.push([x[j] + nx[j] * off, z[j] + nz[j] * off, 0]);
    }
    for (const sdd of [1, -1]) {
      for (let st = 5; st < track.length; st += 11) {
        const j = Math.floor(st / ds) % N;
        const off = sdd * (ROAD_HALF_WIDTH - 0.35);
        grList.push([x[j] + nx[j] * off, z[j] + nz[j] * off, Math.atan2(tx[j], tz[j])]);
      }
    }
    const decal = (geo, tex, list) => {
      const inst = new THREE.InstancedMesh(geo, new THREE.MeshPhongMaterial({ map: tex, transparent: true, depthWrite: false, specular: 0x666666, shininess: 50, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), list.length);
      list.forEach(([px, pz, yaw], i) => inst.setMatrixAt(i, m4.compose(p.set(px, 0.031, pz), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw), sc.set(1, 1, 1))));
      root.add(inst);
    };
    decal(new THREE.PlaneGeometry(1.25, 1.25).rotateX(-Math.PI / 2), manholeTexture(), mhList);
    decal(new THREE.PlaneGeometry(0.45, 0.9).rotateX(-Math.PI / 2), grateTexture(), grList);
  }

  // Horizonte: arranha-céus distantes com luz vermelha de aviação (sem neblina, só silhueta e janelas)
  const aviation = [];
  const towerMats = [];
  {
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const redGlow = glowTexture();
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + rand() * 0.12, r = 300 + rand() * 180;
      if (cx + Math.cos(a) * r > PORT.quayX - 30) continue;
      const w = 22 + rand() * 22, h = 90 + rand() * 150;
      const f = facades[Math.floor(rand() * facades.length)];
      const map = f.map.clone(), emissiveMap = f.emissiveMap.clone();
      for (const t of [map, emissiveMap]) { t.repeat.set(w / f.tileW, h / f.tileH); t.needsUpdate = true; }
      const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshLambertMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.6, color: 0x555555, fog: false }));
      towerMats.push(tower.material);
      tower.position.set(cx + Math.cos(a) * r, h / 2, cz + Math.sin(a) * r);
      root.add(tower);
      const light = new THREE.Sprite(new THREE.SpriteMaterial({ map: redGlow, color: 0xff2a2a, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      light.position.set(tower.position.x, h + 1.5, tower.position.z);
      light.scale.setScalar(7);
      light.userData.phase = rand() * Math.PI * 2;
      root.add(light);
      aviation.push(light);
    }
  }

  // Porto: contêineres, portêineres, cais e baía
  const port = buildPort(root, { rand, track, distanceToTrack, glowTexture, aviation });

  const neonCache = new Map();
  const neonMaterials = new Map();
  for (const n of neonPlanes) {
    const key = `${n.word}|${n.color}|${n.vertical}`;
    if (!neonCache.has(key)) neonCache.set(key, neonTexture(n.word, n.color, n.vertical));
    const tex = neonCache.get(key);
    if (!neonMaterials.has(key)) neonMaterials.set(key, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.5, 1.5, 1.5), side: THREE.DoubleSide }));
    const mat = neonMaterials.get(key);
    // Vertical: altura proporcional ao número de caracteres, sem girar o texto.
    const vh = n.vertical ? Math.max(3.2, [...n.word].length * 1.35) : n.sh;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(n.vertical ? 1.5 : n.sw, vh), mat);
    plane.position.set(n.x, n.y + (n.vertical ? vh / 2 : 0), n.z);
    plane.rotation.y = n.yaw + Math.PI;
    root.add(plane);
  }

  // --- Linha de largada e pórtico neon ------------------------------------------------------------------
  const startGroup = new THREE.Group();
  startGroup.position.set(x[0], 0, z[0]);
  startGroup.rotation.y = Math.atan2(tx[0], tz[0]);
  root.add(startGroup);
  const checker = canvasTexture(16, 2, (ctx) => {
    for (let i = 0; i < 16; i++) for (let k = 0; k < 2; k++) {
      ctx.fillStyle = (i + k) % 2 ? '#111' : '#e8e8e8';
      ctx.fillRect(i, k, 1, 1);
    }
  }, { repeat: false, nearest: true });
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, 1.4),
    new THREE.MeshLambertMaterial({ map: checker, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
  );
  line.rotation.x = -Math.PI / 2;
  line.position.y = 0.04;
  startGroup.add(line);
  const steel = new THREE.MeshLambertMaterial({ color: 0x2a2c33 });
  for (const sd of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), steel);
    post.position.set(sd * (WALL_OFFSET + WALL_THICKNESS + 0.5), 3.5, 0);
    startGroup.add(post);
  }
  const bannerTex = neonTexture('湾岸ドリフト', '#35f2ff');
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry((WALL_OFFSET + WALL_THICKNESS + 1) * 2, 2, 0.3),
    [steel, steel, steel, steel, new THREE.MeshBasicMaterial({ map: bannerTex, color: new THREE.Color(1.4, 1.4, 1.4) }), new THREE.MeshBasicMaterial({ map: bannerTex, color: new THREE.Color(1.4, 1.4, 1.4) })],
  );
  banner.position.y = 7;
  startGroup.add(banner);

  let rain = null; // criada na primeira vez que chove
  let lastTime = null;
  const neon = buildNeonDistrict(root, { rand, fronts, billboards, jpFont: JP_FONT, glowTexture });
  mergeStatic(root);

  const atmosphere = { mist: 1, mistColor, headlights: true, grip: 1, rain: false };
  const world = {
    root,
    lamps,
    atmosphere,
    time: null,
    // Troca o horário sem remontar nada (e deixa a neblina deste mundo na cena)
    setTime(id) {
      const T = CITY_TIMES[id] || CITY_TIMES.noite;
      world.time = CITY_TIMES[id] ? id : 'noite';
      scene.fog = fog;
      fog.color.setHex(T.fog[0]); fog.density = T.fog[1];
      mistColor.setRGB(...T.mist);
      skyUniforms.horizon.value.setRGB(...T.horizon); skyUniforms.zenith.value.setRGB(...T.zenith);
      stars.visible = T.stars;
      const m = road.material;
      m.specular.setHex(T.road.specular); m.shininess = T.road.shininess; m.reflectivity = T.road.reflectivity; m.color.setHex(T.road.color);
      for (const tm of towerMats) tm.emissiveIntensity = T.towers;
      if (T.rain && !rain) rain = new Rain(root);
      if (rain) {
        for (const o of [rain.drops, rain.splash, ...rain.curtains]) o.visible = T.rain;
        // Névoa de chuva ao longe com a cor da neblina (um pouco mais clara: a cidade ilumina a chuva)
        for (const c of rain.curtains) c.material.uniforms.uColor.value.copy(fog.color).multiplyScalar(2.6);
      }
      atmosphere.grip = T.grip; atmosphere.rain = T.rain;
    },
    setEnvMap(texture) {
      if (road.material.envMap === texture) return;
      for (const m of [road.material, port.water.material, shopGlassMat]) {
        if (!m) continue;
        m.envMap = texture;
        m.needsUpdate = true;
      }
    },
    dispose: () => disposeTree(root),
    update(time, camera) {
      neon.update(time);
      const dt = lastTime === null ? 0 : Math.min(0.1, Math.max(0, time - lastTime));
      lastTime = time;
      if (rain && atmosphere.rain) rain.update(dt, camera);
      const on = Math.floor(time * 1.4) % 2 === 0; // amarelo piscante da madrugada
      for (const b of blinkers) b.material = on ? amberOn : amberOff;
      for (const l of aviation) l.material.opacity = Math.sin(time * 2 + l.userData.phase) > 0.6 ? 1 : 0.08;
      port.water.material.normalMap.offset.set(time * 0.0035, time * 0.002);
    },
  };
  world.setTime(time);
  return world;
}
