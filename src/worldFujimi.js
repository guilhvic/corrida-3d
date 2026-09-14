// Interior do Japão no fim de tarde: vale com arrozais alagados, vila de casas de telhado de cerâmica, santuário,
// morros com cedros, ferrovia com trem local e o Monte Fuji ao fundo, iluminado pelo sol baixo.
// Mesmo espírito PS2 da cidade: texturas pequenas, luz "pintada" e poucos draw calls (mergeStatic no final).
import * as THREE from 'three';
import { ROAD_HALF_WIDTH, WALL_OFFSET } from './track.js';
import { countryRoadTextures, tireMarksTexture, roadWordTexture } from './textures.js';
import {
  mulberry32, canvasTexture, noise, ribbon, mergeStatic, distanceToTrack, disposeTree, glowTexture, vendingTexture, JP_FONT,
} from './world.js';

const RAIL_Z = -205;                                      // ferrovia paralela à reta de trás
const FUJI_DIR = new THREE.Vector3(0.3, 0, 1).normalize(); // à esquerda de quem sai da largada
const FUJI = { distance: 1900, height: 480 }; // base com ~1,1 km de raio (ver perfil em buildFujimiWorld)
const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const C = (r, g, b) => new THREE.Color(r, g, b);

// Horários: céu, luz (sol ou lua), neblina, cores do Fuji e das cordilheiras, janelas e postes.
// sky.dir: onde fica o brilho no céu (sol ou lua); light.dir: de onde vem a luz direcional.
export const FUJIMI_THEMES = {
  tarde: {
    sky: { dir: V(-0.45, 0.2, -0.87), zenith: C(0.07, 0.12, 0.32), away: C(0.62, 0.46, 0.56), toward: C(1.7, 0.72, 0.28), belt: C(0.25, 0.1, 0.16),
      cloudDark: C(0.5, 0.3, 0.4), cloudLit: C(2.4, 1.05, 0.45), glow: C(2.5, 1.3, 0.5), disc: C(24, 16, 9), discSize: 0.99955, stars: 0 },
    light: { dir: V(-0.45, 0.2, -0.87), color: 0xffb27a, intensity: 2.8 }, hemi: [0x9aa8d8, 0x4a3a2c, 1.25],
    fog: [C(0.52, 0.42, 0.46), 0.0011], haze: [C(0.6, 0.47, 0.55), C(1.25, 0.6, 0.3)],
    fuji: { snow: [C(0.32, 0.34, 0.52), C(1.25, 0.8, 0.66)], rock: [C(0.08, 0.075, 0.12), C(0.42, 0.24, 0.2)], forest: [C(0.05, 0.06, 0.08), C(0.2, 0.15, 0.09)] },
    fujiHaze: { min: 0.1, amp: 0.6, pow: 3, foot: 0.45 },
    cloud: C(1.15, 0.72, 0.66), windows: 0.85, shop: 0.7, roadLamps: false, lanterns: false, lampIntensity: 60, lanternGlow: 1,
    mist: 0.1, mistColor: C(0.5, 0.42, 0.46), mistDensity: 0.034, mistFalloff: 0.34,
  },
  noite: {
    sky: { dir: V(0.1, 0.3, 1), zenith: C(0.004, 0.007, 0.02), away: C(0.03, 0.04, 0.075), toward: C(0.07, 0.09, 0.15), belt: C(0, 0, 0),
      cloudDark: C(0.015, 0.02, 0.035), cloudLit: C(0.14, 0.16, 0.24), glow: C(0.35, 0.4, 0.55), disc: C(5, 5.2, 5.6), discSize: 0.99975, stars: 1 },
    light: { dir: V(-0.3, 0.55, -0.78), color: 0x8fa6ff, intensity: 0.55 }, hemi: [0x2c3860, 0x0b0b12, 0.42],
    fog: [C(0.02, 0.026, 0.045), 0.0014], haze: [C(0.035, 0.045, 0.075), C(0.06, 0.075, 0.12)],
    fuji: { snow: [C(0.12, 0.14, 0.24), C(0.5, 0.56, 0.78)], rock: [C(0.015, 0.016, 0.03), C(0.05, 0.05, 0.08)], forest: [C(0.012, 0.015, 0.025), C(0.03, 0.035, 0.05)] },
    fujiHaze: { min: 0.1, amp: 0.6, pow: 3, foot: 0.45 },
    cloud: C(0.16, 0.18, 0.26), windows: 1.5, shop: 1.3, roadLamps: true, lanterns: true, lampIntensity: 150, lanternGlow: 1.6,
    mist: 0.35, mistColor: C(0.05, 0.06, 0.095), mistDensity: 0.034, mistFalloff: 0.34,
  },
  manha: {
    sky: { dir: V(0.85, 0.16, 0.5), zenith: C(0.26, 0.42, 0.72), away: C(0.8, 0.82, 0.88), toward: C(1.6, 1.3, 0.95), belt: C(0.05, 0.04, 0.06),
      cloudDark: C(0.72, 0.74, 0.8), cloudLit: C(1.7, 1.5, 1.2), glow: C(2.2, 1.8, 1.3), disc: C(20, 18, 14), discSize: 0.99955, stars: 0 },
    light: { dir: V(0.85, 0.16, 0.5), color: 0xfff0d8, intensity: 2.2 }, hemi: [0xc8d4f0, 0x6a6a5a, 1.5],
    fog: [C(0.66, 0.7, 0.76), 0.0036], haze: [C(0.72, 0.75, 0.81), C(1.0, 0.95, 0.88)],
    fuji: { snow: [C(0.6, 0.66, 0.82), C(1.55, 1.52, 1.5)], rock: [C(0.2, 0.22, 0.3), C(0.38, 0.35, 0.4)], forest: [C(0.1, 0.13, 0.14), C(0.16, 0.2, 0.16)] },
    fujiHaze: { min: 0.15, amp: 0.85, pow: 1.4, foot: 0.92 }, // o Fuji sai de dentro da neblina
    cloud: C(1.3, 1.3, 1.35), windows: 0.12, shop: 0.5, roadLamps: false, lanterns: false, lampIntensity: 0, lanternGlow: 0.9,
    mist: 0.85, mistColor: C(0.72, 0.75, 0.8), mistDensity: 0.022, mistFalloff: 0.12,
  },
};
const RAIL_TOP = 0.95;

const smoothstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// Ruído de valor 2D determinístico (relevo, manchas de mata).
function hash2(ix, iz) {
  let h = Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm(x, z, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x * freq + i * 17.3, z * freq - i * 9.1);
    norm += amp; amp *= 0.5; freq *= 2.03;
  }
  return sum / norm;
}

// Malha a partir de listas (posição, uv opcional, cor opcional), com normais calculadas.
function bufferMesh({ pos, idx, uv, col }, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (col) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

// Inverte os triângulos se a normal de uma face de referência apontar para o lado errado.
function orient(idx, pos, faceIndex, want) {
  const p = (k) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  const [a, b, c] = [idx[faceIndex * 3], idx[faceIndex * 3 + 1], idx[faceIndex * 3 + 2]].map(p);
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  if (n.dot(want) < 0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
}

export function buildFujimiWorld(scene, track, { time = 'tarde' } = {}) {
  // Tema atual: a montagem usa o de fim de tarde e setTime(time) aplica o pedido (sem remontar nada).
  let T = FUJIMI_THEMES.tarde;
  const SUN_DIR = T.light.dir;
  let stars, cloudMat, shopFrontMat, gateLanternMats = [];
  let recolorFuji = () => {};
  const rings = [];
  const rand = mulberry32(2203);
  const { N, x, z, nx, nz, tx, tz, ds } = track;
  const root = new THREE.Group();
  root.name = 'mundo:fujimi';
  scene.add(root);
  const add = (o) => { root.add(o); return o; };
  const envMaterials = [];

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let j = 0; j < N; j++) {
    minX = Math.min(minX, x[j]); maxX = Math.max(maxX, x[j]);
    minZ = Math.min(minZ, z[j]); maxZ = Math.max(maxZ, z[j]);
  }
  const CX = (minX + maxX) / 2, CZ = (minZ + maxZ) / 2;
  const at = (s) => Math.floor((((s % track.length) + track.length) % track.length) / ds) % N;
  // Lado da pista cuja normal aponta para a direção (dx, dz).
  const sideToward = (j, dx, dz) => (nx[j] * dx + nz[j] * dz >= 0 ? 1 : -1);

  // --- Relevo: plano perto da pista e da ferrovia, morros subindo com a distância --------------------------
  const flatDistance = (px, pz) => Math.min(distanceToTrack(track, px, pz), Math.abs(pz - RAIL_Z) + 14);
  function heightAt(px, pz, d = flatDistance(px, pz)) {
    const east = smoothstep(150, 230, px);            // grampo e "S" encostados no morro
    const start = mix(95, 30, east);
    const mask = smoothstep(start, start + 180, d);
    if (mask <= 0) return 0;
    const ax = px - CX, az = pz - CZ, al = Math.hypot(ax, az) || 1;
    const toward = Math.max(0, (ax * FUJI_DIR.x + az * FUJI_DIR.z) / al); // planície na direção do Fuji
    const n = fbm(px * 0.0045, pz * 0.0045);
    const ridge = 1 - Math.abs(fbm(px * 0.002 + 7.7, pz * 0.002 - 3.3, 3) * 2 - 1);
    const amp = (18 + 150 * ridge * ridge * n) * (1 - 0.8 * toward ** 2);
    return mask * amp + mask * fbm(px * 0.03, pz * 0.03, 2) * 6;
  }

  // --- Céu de fim de tarde: degradê com o sol baixo, cinturão rosado e nuvens finas iluminadas -------------
  const skyUniforms = {
    sunDir: { value: T.sky.dir.clone() }, uTime: { value: 0 },
    zenith: { value: T.sky.zenith }, away: { value: T.sky.away }, toward: { value: T.sky.toward }, belt: { value: T.sky.belt },
    cloudDark: { value: T.sky.cloudDark }, cloudLit: { value: T.sky.cloudLit }, glowCol: { value: T.sky.glow },
    discCol: { value: T.sky.disc }, discSize: { value: T.sky.discSize },
  };
  const sky = add(new THREE.Mesh(
    new THREE.SphereGeometry(1500, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform vec3 sunDir; uniform float uTime; varying vec3 vDir;
        uniform vec3 zenith, away, toward, belt, cloudDark, cloudLit, glowCol, discCol; uniform float discSize;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          float sun = max(dot(d, sunDir), 0.0);
          vec2 flatD = normalize(d.xz + 1e-5), flatS = normalize(sunDir.xz);
          float sunAz = pow(max(dot(flatD, flatS), 0.0), 2.0);
          vec3 horizon = mix(away, toward, sunAz);
          vec3 col = mix(horizon, zenith, pow(h, 0.42 + 0.25 * sunAz));
          // Cinturão rosado do lado oposto ao sol, logo acima da sombra da Terra
          col += belt * (1.0 - sunAz) * exp(-pow((d.y - 0.07) / 0.05, 2.0));
          if (d.y > 0.0) {
            vec2 p = d.xz / (d.y + 0.1) * 1.3 + vec2(uTime * 0.003, uTime * 0.001);
            float n = vn(p * vec2(0.5, 2.4)) * 0.6 + vn(p * vec2(1.4, 4.6) + 3.0) * 0.3 + vn(p * 6.0) * 0.1;
            float cloud = smoothstep(0.58, 0.86, n) * smoothstep(0.02, 0.14, d.y) * (1.0 - smoothstep(0.3, 0.75, d.y));
            vec3 cloudCol = mix(cloudDark, cloudLit, pow(sunAz, 1.5));
            col = mix(col, cloudCol, cloud * 0.85);
          }
          col += glowCol * (pow(sun, 24.0) * 0.5 + pow(sun, 4.0) * 0.17);
          col += discCol * smoothstep(discSize, discSize + (1.0 - discSize) * 0.55, sun);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  ));
  sky.renderOrder = -2;
  sky.userData.dynamic = true;

  const fog = new THREE.FogExp2(T.fog[0].clone(), T.fog[1]);
  const hemi = add(new THREE.HemisphereLight(...T.hemi));
  const sun = new THREE.DirectionalLight(T.light.color, T.light.intensity);
  sun.position.copy(SUN_DIR).multiplyScalar(400);
  add(sun);

  // --- Fundo que acompanha a câmera: Monte Fuji e cordilheiras em camadas (sem neblina, já "enevoados") ----
  const backdrop = add(new THREE.Group());
  backdrop.userData.dynamic = true;
  // Estrelas (só aparecem à noite)
  {
    const starPos = [];
    for (let i = 0; i < 900; i++) {
      const v = new THREE.Vector3(rand() - 0.5, rand() * 0.85 + 0.12, rand() - 0.5).normalize().multiplyScalar(1400);
      starPos.push(v.x, v.y, v.z);
    }
    stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3)),
      new THREE.PointsMaterial({ color: 0xb8c4e8, size: 1.4, sizeAttenuation: false, fog: false }));
    stars.renderOrder = -1;
    backdrop.add(stars);
  }
  const fujiAz = Math.atan2(FUJI_DIR.z, FUJI_DIR.x);
  const sunAzOf = () => Math.atan2(T.light.dir.z, T.light.dir.x);
  const angleDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

  {
    // Perfil côncavo do Fuji: inclinação dr/dy = 1,5 + 3,2·(1 - u)³ (≈34° perto do cume, abrindo para ~10° na base),
    // cume truncado e largo (cratera com ~12% da altura de raio) e uma borda afundada por dentro.
    const { height: H } = FUJI, RS = H * 0.12, SEG = 240, ROWS = 56;
    const rows = [];
    for (let k = 0; k <= ROWS; k++) {
      const u = k / ROWS;
      rows.push({ t: u, r: RS + H * (1.5 * (1 - u) + 0.8 * (1 - u) ** 4), y: u * H });
    }
    rows.push({ t: 1, r: RS * 0.62, y: H - 16, crater: true });
    const pos = [], idx = [], col = [], tRow = [], aSeg = [];
    for (const row of rows) {
      for (let i = 0; i <= SEG; i++) {
        const a = (i / SEG) * Math.PI * 2;
        const wobble = 1 + 0.03 * Math.sin(a * 3 + 1.3) + 0.015 * Math.sin(a * 11 + 0.4) * row.t;
        let y = row.y;
        // Borda da cratera irregular, com o ponto mais alto (Kengamine) de um lado
        if (row.t > 0.95) y += (row.crater ? 0.4 : (row.t - 0.95) / 0.05) * (Math.sin(a * 2 + 2.2) * 5 + Math.sin(a * 7) * 2.2 + Math.sin(a * 17) * 1.2);
        pos.push(Math.cos(a) * row.r * wobble, y, Math.sin(a) * row.r * wobble);
        tRow.push(row.crater ? 0.99 : row.t); aSeg.push(a);
      }
    }
    for (let k = 0; k < rows.length - 1; k++) for (let i = 0; i < SEG; i++) {
      const a = k * (SEG + 1) + i, b = a + 1, c = a + SEG + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const mid = (ROWS >> 1) * SEG * 2;
    orient(idx, pos, mid, new THREE.Vector3(Math.cos(aSeg[(ROWS >> 1) * (SEG + 1)]), 0.3, Math.sin(aSeg[(ROWS >> 1) * (SEG + 1)])));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const normals = geo.attributes.normal;
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(tRow.length * 3), 3));
    // Cores por vértice a partir da luz do horário (recalculadas no setTime)
    recolorFuji = () => {
    const colors = geo.attributes.color;
    const nrm = new THREE.Vector3(), c = new THREE.Color();
    const sunAz = sunAzOf(), [hazeAway, hazeSun] = T.haze;
    const [snowShade, snowLit] = T.fuji.snow, [rockShade, rockLit] = T.fuji.rock, [forestShade, forestLit] = T.fuji.forest;
    for (let v = 0; v < tRow.length; v++) {
      const t = tRow[v], a = aSeg[v];
      nrm.fromBufferAttribute(normals, v);
      const lit = Math.max(0, nrm.dot(T.light.dir)) ** 0.8;
      // Linha de neve irregular, descendo pelas ravinas em faixas finas
      const gully = Math.abs(Math.sin(a * 29 + Math.sin(a * 7) * 2.2)) ** 10 * (0.6 + 0.4 * Math.sin(a * 5.3));
      const line = 0.5 + 0.08 * Math.sin(a * 3 + 0.5) + 0.05 * Math.sin(a * 8.7) - 0.24 * Math.max(0, gully);
      const snow = smoothstep(line - 0.015, line + 0.015, t) * (t > 0.95 && Math.sin(a * 13) > 0.6 ? 0.4 : 1);
      const forest = 1 - smoothstep(0.12, 0.3, t);
      c.copy(rockShade).lerp(rockLit, lit);
      if (forest > 0) c.lerp(new THREE.Color().copy(forestShade).lerp(forestLit, lit), forest);
      if (snow > 0) c.lerp(new THREE.Color().copy(snowShade).lerp(snowLit, lit), snow);
      // Perspectiva aérea: a base some na névoa, o topo fica nítido
      const haze = new THREE.Color().copy(hazeAway).lerp(hazeSun, Math.max(0, Math.cos(a - sunAz)) ** 2 * 0.3);
      haze.multiplyScalar(T.fujiHaze.foot + (1 - T.fujiHaze.foot) * smoothstep(0.02, 0.4, t)); // pé da montanha escuro como a mata, não um disco claro
      c.lerp(haze, T.fujiHaze.min + T.fujiHaze.amp * (1 - t) ** T.fujiHaze.pow);
      colors.setXYZ(v, c.r, c.g, c.b);
    }
    colors.needsUpdate = true;
    };
    const fuji = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    fuji.position.set(FUJI_DIR.x * FUJI.distance, -12, FUJI_DIR.z * FUJI.distance);
    fuji.renderOrder = -1;
    backdrop.add(fuji);

    // Nuvens baixas iluminadas encostadas na encosta
    const cloudTex = canvasTexture(128, 64, (ctx, w, h) => {
      for (let i = 0; i < 26; i++) {
        const cx = w * (0.15 + rand() * 0.7), cy = h * (0.45 + (rand() - 0.5) * 0.35), r = 8 + rand() * 20;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }
    }, { repeat: false });
    cloudMat = new THREE.SpriteMaterial({ map: cloudTex, color: T.cloud, transparent: true, depthWrite: false, fog: false });
    for (let i = 0; i < 7; i++) {
      const cloud = new THREE.Sprite(cloudMat);
      const side = (rand() - 0.5) * 1.1;
      const dist = FUJI.distance - 260 - rand() * 160;
      const dir = new THREE.Vector3(FUJI_DIR.x + FUJI_DIR.z * side, 0, FUJI_DIR.z - FUJI_DIR.x * side).normalize();
      cloud.position.set(dir.x * dist, 70 + rand() * 90, dir.z * dist);
      cloud.scale.set(260 + rand() * 260, 50 + rand() * 40, 1);
      cloud.renderOrder = -1;
      backdrop.add(cloud);
    }
  }

  // Cordilheiras distantes em duas camadas, baixas na direção do Fuji
  for (const [radius, base, amp, shade] of [[1150, 22, 120, 0.62], [1420, 40, 190, 0.8]]) {
    const SEG = 180, pos = [], col = [], idx = [];
    const c = new THREE.Color();
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const n = fbm(Math.cos(a) * 3 + radius, Math.sin(a) * 3, 5);
      const open = 1 - 0.9 * Math.exp(-((angleDiff(a, fujiAz) / 0.3) ** 2));
      const h = (base + amp * n * n * 1.6) * open + 8;
      pos.push(Math.cos(a) * radius, -30, Math.sin(a) * radius, Math.cos(a) * radius, h, Math.sin(a) * radius);
      col.push(0, 0, 0, 0, 0, 0); // cor no setTime
    }
    for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const ring = bufferMesh({ pos, idx, col }, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    ring.renderOrder = -1;
    backdrop.add(ring);
    rings.push({ ring, shade, SEG });
  }
  const recolorRings = () => {
    const sunAz = sunAzOf(), [hazeAway, hazeSun] = T.haze, c = new THREE.Color();
    for (const { ring, shade, SEG } of rings) {
      const colors = ring.geometry.attributes.color;
      for (let i = 0; i <= SEG; i++) {
        const a = (i / SEG) * Math.PI * 2;
        const toSun = Math.max(0, Math.cos(a - sunAz)) ** 2;
        c.copy(hazeAway).lerp(hazeSun, toSun * 0.65).multiplyScalar(shade * (1 - toSun * 0.25));
        colors.setXYZ(i * 2, c.r * 1.08, c.g * 1.08, c.b * 1.08);
        colors.setXYZ(i * 2 + 1, c.r * 0.92, c.g * 0.92, c.b * 0.95);
      }
      colors.needsUpdate = true;
    }
  };

  // Chão distante (evita "buraco" além do relevo)
  {
    const far = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: 0x3a4a22 }));
    far.rotation.x = -Math.PI / 2;
    far.position.set(CX, -0.8, CZ);
    add(far);
  }

  // --- Relevo em malha: grama nos baixios, mata escura nas encostas ----------------------------------------
  const grassTex = canvasTexture(64, 64, (ctx, w, h) => {
    noise(ctx, w, h, '#d8d8d0', 0.35, 1400, rand, 2);
    for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(40,50,20,${0.1 + rand() * 0.2})`; ctx.fillRect(rand() * w, rand() * h, 1, 3); }
  });
  {
    const HALF = 780, STEP = 12, cols = Math.round((HALF * 2) / STEP) + 1;
    const pos = [], uv = [], idx = [], heights = new Float32Array(cols * cols);
    for (let k = 0; k < cols; k++) for (let i = 0; i < cols; i++) {
      const px = CX - HALF + i * STEP, pz = CZ - HALF + k * STEP;
      const h = heightAt(px, pz);
      heights[k * cols + i] = h;
      pos.push(px, h, pz);
      uv.push(px / 10, pz / 10);
    }
    for (let k = 0; k < cols - 1; k++) for (let i = 0; i < cols - 1; i++) {
      const a = k * cols + i, b = a + cols, c = a + 1, d = b + 1;
      idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const col = [], nrm = geo.attributes.normal;
    const field = new THREE.Color(0.13, 0.17, 0.05), dry = new THREE.Color(0.2, 0.16, 0.07);
    const forest = new THREE.Color(0.035, 0.06, 0.03), c = new THREE.Color();
    for (let v = 0; v < cols * cols; v++) {
      const h = heights[v], px = pos[v * 3], pz = pos[v * 3 + 2];
      const slope = 1 - nrm.getY(v);
      c.copy(field).lerp(dry, fbm(px * 0.02, pz * 0.02, 2) * 0.6);
      c.lerp(forest, smoothstep(1.5, 12, h) * (0.7 + 0.3 * smoothstep(0.05, 0.3, slope)));
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: grassTex, vertexColors: true })));
  }

  // --- Estrada, acostamento e guard-rail ------------------------------------------------------------------
  const asphalt = countryRoadTextures();
  const road = add(new THREE.Mesh(
    ribbon(track, 1, [-ROAD_HALF_WIDTH, 0.02], [ROAD_HALF_WIDTH, 0.02], 0, 16),
    new THREE.MeshPhongMaterial({
      map: asphalt.map, normalMap: asphalt.normalMap, specularMap: asphalt.specularMap,
      specular: 0x3a3c40, shininess: 30, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    }),
  ));
  const ruv = road.geometry.attributes.uv;
  for (let i = 0; i < ruv.count; i++) { const u = ruv.getX(i), v = ruv.getY(i); ruv.setXY(i, v, u); }

  const vergeTex = canvasTexture(64, 32, (ctx, w, h) => {
    noise(ctx, w, h, '#77705f', 0.4, 900, rand, 1);
    for (let i = 0; i < 90; i++) {
      const yy = rand() ** 2 * h; // mato mais denso junto ao guard-rail (v = 1 em cima)
      ctx.fillStyle = `rgba(${60 + rand() * 40},${80 + rand() * 40},${25 + rand() * 20},0.9)`;
      ctx.fillRect(rand() * w, yy, 1 + rand() * 2, 1 + rand() * 3);
    }
  });
  const guardTex = canvasTexture(64, 16, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f4f4ee'); g.addColorStop(0.3, '#d9dad4'); g.addColorStop(0.45, '#8e908c');
    g.addColorStop(0.55, '#a5a7a2'); g.addColorStop(0.7, '#e6e6e0'); g.addColorStop(1, '#b8b9b2');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 10; i++) { ctx.fillStyle = `rgba(90,70,50,${0.08 + rand() * 0.15})`; ctx.fillRect(rand() * w, h * 0.5, 1 + rand() * 3, h * 0.5); }
    ctx.fillStyle = '#6b6c68'; ctx.fillRect(0, 0, 2, h); // emenda com parafusos
    ctx.fillStyle = '#555'; for (const yy of [4, 11]) ctx.fillRect(5, yy, 2, 2);
  });
  const vergeMat = new THREE.MeshLambertMaterial({ map: vergeTex, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const guardMat = new THREE.MeshLambertMaterial({ map: guardTex });
  const guardBackMat = new THREE.MeshLambertMaterial({ color: 0x9a9b96 });
  for (const side of [1, -1]) {
    add(new THREE.Mesh(ribbon(track, side, [ROAD_HALF_WIDTH, 0.025], [WALL_OFFSET + 0.4, 0.025], 0, 3, 1), vergeMat));
    add(new THREE.Mesh(ribbon(track, side, [WALL_OFFSET, 0.48], [WALL_OFFSET, 0.86], -1, 4), guardMat));
    add(new THREE.Mesh(ribbon(track, side, [WALL_OFFSET, 0.86], [WALL_OFFSET + 0.14, 0.86], 0, 4), guardBackMat));
    add(new THREE.Mesh(ribbon(track, side, [WALL_OFFSET + 0.14, 0.86], [WALL_OFFSET + 0.14, 0.48], 1, 4), guardBackMat));
  }
  {
    // Postes do guard-rail a cada 4 m, com olho-de-gato laranja a cada 3 postes
    const postGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.95, 6);
    postGeo.translate(0, 0.475, 0);
    const reflGeo = new THREE.BoxGeometry(0.1, 0.12, 0.03);
    const spots = [], refl = [];
    for (const side of [1, -1]) {
      let n = 0;
      for (let s = 0; s < track.length; s += 4, n++) {
        const j = at(s), off = WALL_OFFSET + 0.24;
        spots.push([x[j] + nx[j] * side * off, z[j] + nz[j] * side * off]);
        if (n % 3 === 0) refl.push([x[j] + nx[j] * side * (WALL_OFFSET - 0.02), z[j] + nz[j] * side * (WALL_OFFSET - 0.02), Math.atan2(nx[j], nz[j])]);
      }
    }
    const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshLambertMaterial({ color: 0xc9cac4 }), spots.length);
    const eyes = new THREE.InstancedMesh(reflGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.7, 0.15) }), refl.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    spots.forEach(([px, pz], i) => posts.setMatrixAt(i, m4.compose(p.set(px, 0, pz), q.identity(), one)));
    refl.forEach(([px, pz, yaw], i) => eyes.setMatrixAt(i, m4.compose(p.set(px, 1.0, pz), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw), one)));
    add(posts); add(eyes);
  }

  // Marcas de pneu nas curvas
  {
    const pos = [], uv = [], idx = [];
    const bent = (j) => tx[(j - 6 + N) % N] * tx[(j + 6) % N] + tz[(j - 6 + N) % N] * tz[(j + 6) % N] < 0.95;
    for (let j = 0; j <= N; j++) {
      const i = j % N;
      for (const [off, u] of [[-6, 0], [6, 1]]) { pos.push(x[i] + nx[i] * off, 0.03, z[i] + nz[i] * off); uv.push(u, (j * ds) / 16); }
      if (j < N && (bent(i) || bent((i + 1) % N))) { const a = j * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: tireMarksTexture(29), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    })));
  }

  // Setas nas curvas (矢羽根) e placas de curva perigosa antes das mais fechadas
  const chevronTex = canvasTexture(32, 32, (ctx, w, h) => {
    ctx.fillStyle = '#f2f2ee'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d0202a';
    ctx.beginPath();
    ctx.moveTo(8, 4); ctx.lineTo(18, 4); ctx.lineTo(28, 16); ctx.lineTo(18, 28); ctx.lineTo(8, 28); ctx.lineTo(18, 16);
    ctx.fill();
  }, { repeat: false, nearest: true });
  const chevronGeo = new THREE.PlaneGeometry(0.9, 0.9);
  const chevronMats = [1, -1].map((dir) => {
    const t = chevronTex.clone();
    t.needsUpdate = true;
    if (dir < 0) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; }
    return new THREE.MeshLambertMaterial({ map: t });
  });
  for (let j = 0; j < N; j += 4) {
    const k = (j + 6) % N;
    const bend = tx[k] * nx[j] + tz[k] * nz[j];
    if (Math.abs(bend) < 0.3) continue;
    const side = bend > 0 ? -1 : 1;
    const sign = add(new THREE.Mesh(chevronGeo, chevronMats[side > 0 ? 0 : 1]));
    sign.position.set(x[j] + nx[j] * side * (WALL_OFFSET + 0.3), 1.45, z[j] + nz[j] * side * (WALL_OFFSET + 0.3));
    sign.lookAt(x[j], 1.45, z[j]);
    const pole = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 0.06), guardBackMat));
    pole.position.set(sign.position.x, 0.7, sign.position.z);
  }

  // --- Ocupação do terreno (casas, arrozais e árvores não se sobrepõem) -------------------------------------
  const occupied = [];
  const free = (px, pz, r) => occupied.every((o) => Math.hypot(o.x - px, o.z - pz) > o.r + r);
  const claim = (px, pz, r) => occupied.push({ x: px, z: pz, r });
  const clearOfTrack = (px, pz, w, d, yaw, clearance) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const [i, k] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const qx = px + c * w / 2 * i + s * d / 2 * k, qz = pz - s * w / 2 * i + c * d / 2 * k;
      if (distanceToTrack(track, qx, qz) < clearance || Math.abs(qz - RAIL_Z) < 8) return false;
    }
    return true;
  };

  // --- Casas: paredes em atlas (reboco, madeira queimada, siding), telhado de cerâmica ------------------------
  // Atlas 4x4 de células de 4 x 3 m; linha de baixo = térreo (portas, rodapé de madeira), linha de cima = andar.
  function wallAtlas(style) {
    const CW = 64, CH = 48;
    const cells = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const ground = r % 2 === 0;
      const roll = rand();
      cells.push({ r, c, ground, kind: roll < 0.18 ? 'blank' : roll < 0.55 ? 'lit' : 'dark', door: ground && rand() < 0.3 });
    }
    const draw = (emissive) => (ctx, w, h) => {
      ctx.fillStyle = emissive ? '#000' : style.wall;
      ctx.fillRect(0, 0, w, h);
      if (!emissive) noise(ctx, w, h, style.wall, 0.08, 500, rand);
      for (const cell of cells) {
        const x0 = cell.c * CW, y0 = (3 - cell.r) * CH;
        if (!emissive) {
          if (style.boards === 'vertical') { ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let bx = x0; bx < x0 + CW; bx += 5) ctx.fillRect(bx, y0, 1, CH); }
          if (style.boards === 'horizontal') { ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let by = y0; by < y0 + CH; by += 4) ctx.fillRect(x0, by, CW, 1); }
          if (cell.ground && style.skirt) { ctx.fillStyle = style.skirt; ctx.fillRect(x0, y0 + CH - 14, CW, 14); ctx.fillStyle = 'rgba(0,0,0,0.3)'; for (let bx = x0; bx < x0 + CW; bx += 4) ctx.fillRect(bx, y0 + CH - 14, 1, 14); }
        }
        if (cell.kind === 'blank') continue;
        const lit = cell.kind === 'lit';
        const [wx, wy, ww, wh] = cell.door ? [x0 + 16, y0 + 10, 32, CH - 10] : [x0 + 12, y0 + (cell.ground ? 10 : 12), 40, 22];
        if (emissive) {
          if (!lit) continue;
          ctx.fillStyle = cell.door ? '#ffcf8a' : rand() < 0.5 ? '#ffd9a0' : '#fff0d0';
          ctx.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
          continue;
        }
        ctx.fillStyle = '#3a342c'; ctx.fillRect(wx, wy, ww, wh); // caixilho
        ctx.fillStyle = lit ? '#ffe0a8' : '#1d2230';
        ctx.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
        ctx.fillStyle = lit ? 'rgba(120,80,40,0.45)' : 'rgba(255,255,255,0.08)';
        if (lit && !cell.door) for (let gx = wx + 2; gx < wx + ww - 2; gx += 6) ctx.fillRect(gx, wy + 2, 1, wh - 4); // shoji
        if (lit && !cell.door) for (let gy = wy + 2; gy < wy + wh - 2; gy += 6) ctx.fillRect(wx + 2, gy, ww - 4, 1);
        ctx.fillStyle = '#3a342c'; ctx.fillRect(wx + ww / 2 - 1, wy, 2, wh);
      }
    };
    return {
      map: canvasTexture(CW * 4, CH * 4, draw(false), { nearest: true }),
      emissive: canvasTexture(CW * 4, CH * 4, draw(true), { nearest: true }),
    };
  }
  const wallStyles = [
    { wall: '#d8cfb8', skirt: '#4a3524' },
    { wall: '#2f2923', boards: 'vertical' },
    { wall: '#b9b5aa', boards: 'horizontal' },
    { wall: '#e4ddcc', skirt: '#5a4a3a' },
  ].map((st) => {
    const t = wallAtlas(st);
    return { pos: [], uv: [], idx: [], material: new THREE.MeshLambertMaterial({ map: t.map, emissiveMap: t.emissive, emissive: 0xffffff, emissiveIntensity: T.windows, side: THREE.DoubleSide }) };
  });
  const tileTex = canvasTexture(64, 64, (ctx, w, h) => {
    noise(ctx, w, h, '#8a8a8a', 0.15, 400, rand);
    for (let y = 0; y < h; y += 8) {
      const g = ctx.createLinearGradient(0, y, 0, y + 8);
      g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(0.8, 'rgba(0,0,0,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = g; ctx.fillRect(0, y, w, 8);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x0 = 0; x0 < w; x0 += 6) ctx.fillRect(x0, 0, 1, h);
  });
  const roofStyles = [0x3c4656, 0x6c7079, 0x7a4030, 0x2f4d72, 0x514a44].map((color) => ({
    pos: [], uv: [], idx: [], material: new THREE.MeshLambertMaterial({ map: tileTex, color, side: THREE.DoubleSide }),
  }));
  const ridgeMat = new THREE.MeshLambertMaterial({ color: 0x2a2c30 });
  const quad = (b, pts, uvs) => {
    const base = b.pos.length / 3;
    for (const p of pts) b.pos.push(...p);
    b.uv.push(...uvs.flat());
    b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const tri = (b, pts, uvs) => {
    const base = b.pos.length / 3;
    for (const p of pts) b.pos.push(...p);
    b.uv.push(...uvs.flat());
    b.idx.push(base, base + 1, base + 2);
  };

  // Casa com frente (-ez) para a rua; w ao longo da rua, d em profundidade.
  function addHouse(cx, cz, yaw, w, d, floors, { hip = rand() < 0.4, wall = Math.floor(rand() * wallStyles.length), roof = Math.floor(rand() * roofStyles.length) } = {}) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const L = (u, y, v) => [cx + c * u + s * v, y, cz - s * u + c * v];
    const h = floors * 3;
    const W = wallStyles[wall], R = roofStyles[roof];
    const uo = Math.floor(rand() * 4) / 4, vo = rand() < 0.5 ? 0 : 0.5;
    const ring = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
    for (let e = 0; e < 4; e++) {
      const [au, av] = ring[e], [bu, bv] = ring[(e + 1) % 4];
      const len = Math.hypot(bu - au, bv - av);
      quad(W, [L(au, 0, av), L(bu, 0, bv), L(bu, h, bv), L(au, h, av)], [[uo, vo], [uo + len / 16, vo], [uo + len / 16, vo + h / 12], [uo, vo + h / 12]]);
    }
    // Beiral de um andar em volta do térreo (庇) em sobrados
    if (floors === 2 && rand() < 0.6) {
      for (let e = 0; e < 4; e++) {
        const [au, av] = ring[e], [bu, bv] = ring[(e + 1) % 4];
        const ou = Math.sign(au + bu) * (e % 2 === 1 ? 0.8 : 0), ov = Math.sign(av + bv) * (e % 2 === 0 ? 0.8 : 0);
        quad(R, [L(au, 3.2, av), L(bu, 3.2, bv), L(bu + ou, 2.75, bv + ov), L(au + ou, 2.75, av + ov)], [[0, 0], [w / 2, 0], [w / 2, 0.4], [0, 0.4]]);
      }
    }
    const o = 0.65, rise = d * 0.28, ridgeY = h + rise, eaveY = h - o * 0.56;
    const U = w / 2 + o, V = d / 2 + o, slopeLen = Math.hypot(V, rise + o * 0.56) / 2;
    if (hip && w > d) {
      const r = w / 2 - d / 2;
      quad(R, [L(-U, eaveY, -V), L(U, eaveY, -V), L(r, ridgeY, 0), L(-r, ridgeY, 0)], [[0, 0], [U, 0], [U - (U - r) / 2, slopeLen], [(U - r) / 2, slopeLen]]);
      quad(R, [L(U, eaveY, V), L(-U, eaveY, V), L(-r, ridgeY, 0), L(r, ridgeY, 0)], [[0, 0], [U, 0], [U - (U - r) / 2, slopeLen], [(U - r) / 2, slopeLen]]);
      tri(R, [L(-U, eaveY, V), L(-U, eaveY, -V), L(-r, ridgeY, 0)], [[0, 0], [V, 0], [V / 2, slopeLen]]);
      tri(R, [L(U, eaveY, -V), L(U, eaveY, V), L(r, ridgeY, 0)], [[0, 0], [V, 0], [V / 2, slopeLen]]);
      const cap = add(new THREE.Mesh(new THREE.BoxGeometry(2 * r + 0.3, 0.25, 0.35), ridgeMat));
      cap.position.set(...L(0, ridgeY + 0.08, 0)); cap.rotation.y = yaw;
    } else {
      quad(R, [L(-U, eaveY, -V), L(U, eaveY, -V), L(U, ridgeY, 0), L(-U, ridgeY, 0)], [[0, 0], [U, 0], [U, slopeLen], [0, slopeLen]]);
      quad(R, [L(U, eaveY, V), L(-U, eaveY, V), L(-U, ridgeY, 0), L(U, ridgeY, 0)], [[0, 0], [U, 0], [U, slopeLen], [0, slopeLen]]);
      for (const su of [-1, 1]) tri(W, [L(su * w / 2, h, -d / 2), L(su * w / 2, h, d / 2), L(su * w / 2, h + (d / 2) * (rise / (d / 2)), 0)], [[0.02, 0.98], [0.2, 0.98], [0.11, 0.999]]);
      const cap = add(new THREE.Mesh(new THREE.BoxGeometry(2 * U, 0.3, 0.4), ridgeMat));
      cap.position.set(...L(0, ridgeY + 0.1, 0)); cap.rotation.y = yaw;
    }
    claim(cx, cz, Math.hypot(w, d) / 2 + 1.5);
  }

  // Galpão de lata com telhado de uma água enferrujado
  const tinMat = new THREE.MeshLambertMaterial({
    map: canvasTexture(32, 32, (ctx, w, h) => {
      noise(ctx, w, h, '#7d5a3e', 0.3, 300, rand);
      for (let x0 = 0; x0 < w; x0 += 4) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x0, 0, 2, h); }
    }),
  });
  const shedWallMat = new THREE.MeshLambertMaterial({ color: 0x6f6a60 });
  function addShed(cx, cz, yaw) {
    const g = add(new THREE.Group());
    g.position.set(cx, 0, cz); g.rotation.y = yaw;
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 2.6, 4), shedWallMat); body.position.y = 1.3; g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.1, 4.8), tinMat); roof.position.set(0, 2.85, 0); roof.rotation.x = 0.12; g.add(roof);
    claim(cx, cz, 4);
  }

  // Estufa de plástico (ビニールハウス)
  const vinylMat = new THREE.MeshLambertMaterial({
    map: canvasTexture(32, 32, (ctx, w, h) => {
      ctx.fillStyle = '#d6dcd8'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(80,90,90,0.35)'; for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 1);
    }),
    side: THREE.DoubleSide,
  });
  function addGreenhouse(cx, cz, yaw, len) {
    const geo = new THREE.CylinderGeometry(2.8, 2.8, len, 10, 1, true, -Math.PI / 2, Math.PI);
    geo.rotateZ(Math.PI / 2);
    const uvs = geo.attributes.uv;
    for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * 2, uvs.getY(i) * len / 4);
    const m = add(new THREE.Mesh(geo, vinylMat));
    m.position.set(cx, 0.2, cz); m.rotation.y = yaw;
    claim(cx, cz, len / 2 + 2);
  }

  // --- Vila: casas ao longo das curvas do norte ----------------------------------------------------------
  const VILLAGE = { x: 100, z: 215, r: 120 };
  const inVillage = (px, pz) => Math.hypot(px - VILLAGE.x, pz - VILLAGE.z) < VILLAGE.r;
  const lampSpots = [];
  const vending = [];
  const houseClear = WALL_OFFSET + 3.5;

  // Loja de conveniência da vila (primeiro, para garantir o lugar)
  {
    const j = at(335);
    const sd = sideToward(j, 0, 1);
    const w = 16, d = 11, off = houseClear + 7 + d / 2;
    const cx = x[j] + nx[j] * sd * off, cz = z[j] + nz[j] * sd * off, yaw = Math.atan2(nx[j] * sd, nz[j] * sd);
    const g = add(new THREE.Group());
    g.position.set(cx, 0, cz); g.rotation.y = yaw;
    const frontTex = canvasTexture(256, 64, (ctx, w2, h2) => {
      ctx.fillStyle = '#ecf2f0'; ctx.fillRect(0, 0, w2, h2);
      ctx.fillStyle = '#f7fbff'; ctx.fillRect(8, 18, w2 - 16, h2 - 20);
      ctx.fillStyle = 'rgba(40,60,70,0.35)';
      for (let i = 0; i < 6; i++) ctx.fillRect(14 + i * 40, 30, 22, 30); // prateleiras
      ctx.fillStyle = '#28a05a'; ctx.fillRect(0, 0, w2, 7);
      ctx.fillStyle = '#f08a24'; ctx.fillRect(0, 7, w2, 5);
      ctx.fillStyle = '#2c8fd0'; ctx.fillRect(0, 12, w2, 4);
    }, { repeat: false });
    const shop = new THREE.Mesh(new THREE.BoxGeometry(w, 4.2, d), [shedWallMat, shedWallMat, new THREE.MeshLambertMaterial({ color: 0x9a9c98 }), shedWallMat, shedWallMat,
      (shopFrontMat = new THREE.MeshLambertMaterial({ map: frontTex, emissiveMap: frontTex, emissive: 0xffffff, emissiveIntensity: T.shop }))]);
    shop.position.set(0, 2.1, 0); shop.rotation.y = Math.PI; // face +z do box virada para a rua
    g.add(shop);
    const signTex = canvasTexture(256, 48, (ctx, w2, h2) => {
      ctx.fillStyle = '#fbfbf6'; ctx.fillRect(0, 0, w2, h2);
      ctx.fillStyle = '#1f9a52'; ctx.fillRect(0, h2 - 10, w2, 10);
      ctx.fillStyle = '#e8741c'; ctx.font = `900 30px ${JP_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ふじみマート', w2 / 2, 19);
    }, { repeat: false });
    const band = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.1), new THREE.MeshBasicMaterial({ map: signTex, color: new THREE.Color(1.3, 1.3, 1.3) }));
    band.position.set(0, 4.75, -d / 2 - 0.05); band.rotation.y = Math.PI;
    g.add(band);
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(w + 6, 7.5), new THREE.MeshLambertMaterial({
      map: canvasTexture(64, 32, (ctx, w2, h2) => {
        noise(ctx, w2, h2, '#3b3b3d', 0.2, 500, rand);
        ctx.fillStyle = 'rgba(230,230,220,0.8)'; for (let i = 0; i < 8; i++) ctx.fillRect(4 + i * 8, 0, 1, h2 * 0.6);
      }, { repeat: false }),
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }));
    lot.rotation.x = -Math.PI / 2; lot.position.set(0, 0.04, -d / 2 - 3.8);
    g.add(lot);
    claim(cx, cz, 13);
    lampSpots.push([cx - Math.sin(yaw) * (d / 2 + 6) + Math.cos(yaw) * (w / 2 + 2), cz - Math.cos(yaw) * (d / 2 + 6) - Math.sin(yaw) * (w / 2 + 2), 0xe8f4ff]);
    vending.push([cx + Math.cos(yaw) * (w / 2 + 1.2) - Math.sin(yaw) * (d / 2 - 0.5), cz - Math.sin(yaw) * (w / 2 + 1.2) - Math.cos(yaw) * (d / 2 - 0.5), yaw]);
  }

  for (const sd of [1, -1]) {
    for (let s = 0; s < track.length;) {
      const w = 8 + rand() * 5, d = 7 + rand() * 4;
      const j = at(s + w / 2);
      const setback = 2 + rand() * 5;
      const off = houseClear + setback + d / 2;
      const cx = x[j] + nx[j] * sd * off, cz = z[j] + nz[j] * sd * off;
      const yaw = Math.atan2(nx[j] * sd, nz[j] * sd);
      const village = inVillage(cx, cz);
      if ((village ? rand() < 0.85 : rand() < 0.05) && heightAt(cx, cz) < 0.3 && free(cx, cz, Math.hypot(w, d) / 2 + 1)
        && clearOfTrack(cx, cz, w + 2, d + 2, yaw, houseClear)) {
        addHouse(cx, cz, yaw, w, d, rand() < 0.55 ? 2 : 1);
        if (rand() < 0.35) {
          const bx = cx + Math.sin(yaw) * (d / 2 + 4), bz = cz + Math.cos(yaw) * (d / 2 + 4);
          if (free(bx, bz, 3.5)) addShed(bx, bz, yaw);
        }
        if (village && rand() < 0.25) lampSpots.push([x[j] + nx[j] * sd * (WALL_OFFSET + 1.1), z[j] + nz[j] * sd * (WALL_OFFSET + 1.1), 0xffb060]);
        if (village && rand() < 0.18) vending.push([cx - Math.sin(yaw) * (d / 2 + 1) + Math.cos(yaw) * (w / 2 - 0.6), cz - Math.cos(yaw) * (d / 2 + 1) - Math.sin(yaw) * (w / 2 - 0.6), yaw]);
      }
      s += w + 3 + rand() * (village ? 4 : 20);
    }
  }

  // --- Santuário ao lado da reta de largada: torii, lanternas de pedra e bosque de cedros --------------------
  const bigCedars = [];
  {
    const j = at(150);
    const sd = sideToward(j, -1, 0);
    const out = [nx[j] * sd, nz[j] * sd], yaw = Math.atan2(out[0], out[1]);
    const P = (off, along = 0) => [x[j] + out[0] * off + tx[j] * along, z[j] + out[1] * off + tz[j] * along];
    const vermilion = new THREE.MeshLambertMaterial({ color: 0xc8361c });
    const black = new THREE.MeshLambertMaterial({ color: 0x1b1a1a });
    const stone = new THREE.MeshLambertMaterial({ color: 0x8d8a82 });
    const torii = add(new THREE.Group());
    const [tx0, tz0] = P(WALL_OFFSET + 8);
    torii.position.set(tx0, 0, tz0); torii.rotation.y = yaw + Math.PI / 2;
    for (const u of [-2.1, 2.1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 5.2, 10), vermilion); pillar.position.set(u, 2.6, 0); torii.add(pillar);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 10), black); foot.position.set(u, 0.25, 0); torii.add(foot);
    }
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.3, 0.25), vermilion); nuki.position.y = 4.2; torii.add(nuki);
    const kasagi = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.42, 0.5), vermilion); kasagi.position.y = 5.25; torii.add(kasagi);
    const top = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.22, 0.6), black); top.position.y = 5.55; torii.add(top);
    for (const u of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.6), black); tip.position.set(u * 3.7, 5.68, 0); tip.rotation.z = -u * 0.2; torii.add(tip);
    }
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 6), new THREE.MeshLambertMaterial({ color: 0xcdb77a }));
    rope.rotation.z = Math.PI / 2; rope.position.y = 3.8; torii.add(rope);
    // Caminho de pedra e o salão
    const path = add(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 34), new THREE.MeshLambertMaterial({
      map: canvasTexture(32, 128, (ctx, w, h) => {
        noise(ctx, w, h, '#8c877c', 0.25, 600, rand);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = 0; y < h; y += 12) ctx.fillRect(0, y, w, 1);
      }, { repeat: false }),
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    })));
    const [px0, pz0] = P(WALL_OFFSET + 2 + 17);
    path.rotation.set(-Math.PI / 2, 0, yaw); path.position.set(px0, 0.05, pz0);
    for (const along of [-2.4, 2.4]) {
      const [lx, lz] = P(WALL_OFFSET + 16, along);
      const lantern = add(new THREE.Group());
      lantern.position.set(lx, 0, lz);
      const parts = [[0.8, 0.3, 0.8, 0.15], [0.3, 1.1, 0.3, 0.85], [0.7, 0.5, 0.7, 1.65], [1.0, 0.25, 1.0, 2.0]];
      for (const [bw, bh, bd, by] of parts) { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), stone); m.position.y = by; lantern.add(m); }
      const glowBox = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.72), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.3, 0.5) }));
      glowBox.position.y = 1.65; lantern.add(glowBox);
    }
    const hall = add(new THREE.Group());
    const [hx, hz] = P(WALL_OFFSET + 40);
    hall.position.set(hx, 0, hz); hall.rotation.y = yaw;
    const wood = new THREE.MeshLambertMaterial({ color: 0x5e3b24 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 8), stone); base.position.y = 0.5; hall.add(base);
    const body = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 6), wood); body.position.y = 2.6; hall.add(body);
    const roofGeo = new THREE.ConeGeometry(7.4, 3.6, 4, 1, true);
    roofGeo.rotateY(Math.PI / 4); roofGeo.scale(1.15, 1, 1);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x3f6b5a, side: THREE.DoubleSide })); roof.position.y = 5.9; hall.add(roof);
    const [hw, hd] = [9, 8];
    claim(hx, hz, 10);
    claim(tx0, tz0, 5);
    claim(px0, pz0, 18);
    for (let i = 0; i < 34; i++) {
      const a = rand() * Math.PI * 2, r = 9 + rand() * 22;
      const cxp = hx + Math.cos(a) * r, czp = hz + Math.sin(a) * r;
      if (Math.hypot(cxp - px0, czp - pz0) < 5 || distanceToTrack(track, cxp, czp) < WALL_OFFSET + 4) continue;
      bigCedars.push([cxp, czp, 1.1 + rand() * 0.45]);
    }
    void hw; void hd;
  }

  // --- Arrozais (alagados, com mudas e secos) numa grade alinhada aos eixos ---------------------------------
  {
    const CELL_X = 20, CELL_Z = 26;
    const kinds = [];
    const cells = new Map();
    for (let gx = Math.floor((minX - 260) / CELL_X); gx * CELL_X < maxX + 260; gx++) {
      for (let gz = Math.floor((minZ - 260) / CELL_Z); gz * CELL_Z < maxZ + 260; gz++) {
        const x0 = gx * CELL_X, z0 = gz * CELL_Z, cxp = x0 + CELL_X / 2, czp = z0 + CELL_Z / 2;
        if (!clearOfTrack(cxp, czp, CELL_X + 2, CELL_Z + 2, 0, WALL_OFFSET + 3)) continue;
        if ([[x0, z0], [x0 + CELL_X, z0], [x0, z0 + CELL_Z], [x0 + CELL_X, z0 + CELL_Z]].some(([qx, qz]) => heightAt(qx, qz) > 0.12)) continue;
        if (!free(cxp, czp, 12)) continue;
        const roll = fbm(gx * 0.35, gz * 0.35, 2) + rand() * 0.3;
        cells.set(`${gx},${gz}`, roll < 0.62 ? 0 : roll < 0.85 ? 1 : 2);
      }
    }
    // Texturas: água com mudas em fileiras, arroz crescido, terra arada
    const water = canvasTexture(64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#4c5a64'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 300; i++) { ctx.fillStyle = `rgba(${90 + rand() * 30},${100 + rand() * 30},${100 + rand() * 20},0.3)`; ctx.fillRect(rand() * w, rand() * h, 3, 1); }
      ctx.fillStyle = 'rgba(70,110,40,0.85)';
      for (let y = 2; y < h; y += 4) for (let xx = 1; xx < w; xx += 3) ctx.fillRect(xx, y, 1, 1);
    });
    const grown = canvasTexture(64, 64, (ctx, w, h) => {
      noise(ctx, w, h, '#5f8a2c', 0.3, 900, rand);
      ctx.fillStyle = 'rgba(30,50,10,0.35)'; for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    });
    const soil = canvasTexture(64, 64, (ctx, w, h) => {
      noise(ctx, w, h, '#5a4330', 0.25, 700, rand);
      for (let y = 0; y < h; y += 6) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, y, w, 2); ctx.fillStyle = 'rgba(80,120,40,0.7)'; for (let xx = 2; xx < w; xx += 5) ctx.fillRect(xx, y + 3, 2, 2); }
    });
    const waterMat = new THREE.MeshPhongMaterial({ map: water, specular: 0x8a8070, shininess: 90, combine: THREE.MixOperation, reflectivity: 0.35, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    envMaterials.push(waterMat);
    const mats = [waterMat, new THREE.MeshLambertMaterial({ map: grown }), new THREE.MeshLambertMaterial({ map: soil })];
    kinds.push(...mats);
    const dikeMat = new THREE.MeshLambertMaterial({ color: 0x5a6a2c });
    const plane = new THREE.PlaneGeometry(CELL_X - 0.6, CELL_Z - 0.6);
    plane.rotateX(-Math.PI / 2);
    const dikeX = new THREE.BoxGeometry(CELL_X + 0.6, 0.3, 0.6), dikeZ = new THREE.BoxGeometry(0.6, 0.3, CELL_Z + 0.6);
    for (const [key, kind] of cells) {
      const [gx, gz] = key.split(',').map(Number);
      const x0 = gx * CELL_X, z0 = gz * CELL_Z;
      const m = add(new THREE.Mesh(plane, mats[kind]));
      m.position.set(x0 + CELL_X / 2, kind === 0 ? 0.06 : 0.1, z0 + CELL_Z / 2);
      if (rand() < 0.5) m.rotation.y = Math.PI;
      const dike = (geo, px, pz) => { const d = add(new THREE.Mesh(geo, dikeMat)); d.position.set(px, 0.12, pz); };
      dike(dikeX, x0 + CELL_X / 2, z0);
      dike(dikeZ, x0, z0 + CELL_Z / 2);
      if (!cells.has(`${gx},${gz + 1}`)) dike(dikeX, x0 + CELL_X / 2, z0 + CELL_Z);
      if (!cells.has(`${gx + 1},${gz}`)) dike(dikeZ, x0 + CELL_X, z0 + CELL_Z / 2);
      claim(x0 + CELL_X / 2, z0 + CELL_Z / 2, 11);
    }
    void kinds;
  }

  // Sítios espalhados: casa de fazenda, galpão, estufas e árvores de quebra-vento
  const yardTrees = [];
  for (let i = 0; i < 70; i++) {
    const px = minX - 220 + rand() * (maxX - minX + 440), pz = minZ - 220 + rand() * (maxZ - minZ + 440);
    if (heightAt(px, pz) > 0.2 || inVillage(px, pz)) continue;
    const yaw = Math.round(rand() * 4) * Math.PI / 2;
    if (!free(px, pz, 16) || !clearOfTrack(px, pz, 30, 30, 0, WALL_OFFSET + 6)) continue;
    const kind = rand();
    if (kind < 0.55) {
      addHouse(px, pz, yaw, 10 + rand() * 4, 8 + rand() * 2, rand() < 0.5 ? 2 : 1, { hip: rand() < 0.6 });
      if (free(px + 9, pz, 3.5)) addShed(px + 9, pz, yaw);
      for (let k = 0; k < 6; k++) yardTrees.push([px - 8 + rand() * 16, pz + 9 + rand() * 3, 0.8 + rand() * 0.5]);
    } else {
      for (let k = 0; k < 3; k++) addGreenhouse(px + (k - 1) * 7, pz, 0, 22 + rand() * 10);
    }
  }

  // Paredes e telhados de todas as casas: uma malha por estilo
  for (const b of [...wallStyles, ...roofStyles]) if (b.idx.length) add(bufferMesh(b, b.material));

  // --- Árvores: cedros nos morros e no santuário, árvores redondas nos quintais -------------------------------
  {
    const cedars = [...bigCedars];
    for (let i = 0; i < 16000 && cedars.length < 4200; i++) {
      const px = CX - 760 + rand() * 1520, pz = CZ - 760 + rand() * 1520;
      const h = heightAt(px, pz);
      const dense = fbm(px * 0.012 + 3, pz * 0.012 - 5, 3);
      if (h < 1.2 || dense < 0.38) continue;
      if (Math.abs(pz - RAIL_Z) < 12 || distanceToTrack(track, px, pz) < WALL_OFFSET + 5) continue;
      cedars.push([px, pz, 0.8 + rand() * 0.7, h]);
    }
    // Linha de cedros junto ao grampo e ao "S" (a estrada entra na mata)
    for (let s = 0; s < track.length; s += 7) {
      const j = at(s);
      if (x[j] < 180) continue;
      for (const sd of [1, -1]) {
        const off = WALL_OFFSET + 5 + rand() * 12;
        const px = x[j] + nx[j] * sd * off, pz = z[j] + nz[j] * sd * off;
        if (distanceToTrack(track, px, pz) < WALL_OFFSET + 4 || !free(px, pz, 2)) continue;
        if (rand() < 0.6) cedars.push([px, pz, 0.9 + rand() * 0.5]);
      }
    }
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 4, 5); trunkGeo.translate(0, 2, 0);
    const lowerGeo = new THREE.ConeGeometry(2.6, 9, 7); lowerGeo.translate(0, 7.5, 0);
    const upperGeo = new THREE.ConeGeometry(1.7, 7, 7); upperGeo.translate(0, 12.5, 0);
    const foliage = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x4a3222 }), cedars.length);
    const lower = new THREE.InstancedMesh(lowerGeo, foliage, cedars.length);
    const upper = new THREE.InstancedMesh(upperGeo, foliage, cedars.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
    cedars.forEach(([px, pz, k, h = heightAt(px, pz)], i) => {
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand() * Math.PI);
      m4.compose(p.set(px, h - 0.6, pz), q, sc.set(k, k * (0.9 + rand() * 0.3), k));
      trunks.setMatrixAt(i, m4); lower.setMatrixAt(i, m4); upper.setMatrixAt(i, m4);
      c.setRGB(0.035 + rand() * 0.025, 0.07 + rand() * 0.035, 0.035 + rand() * 0.02);
      lower.setColorAt(i, c); upper.setColorAt(i, c.multiplyScalar(1.12));
    });
    add(trunks); add(lower); add(upper);

    const roundTrees = [...yardTrees];
    for (let s = 0; s < track.length; s += 23) {
      const j = at(s), sd = rand() < 0.5 ? 1 : -1, off = WALL_OFFSET + 4 + rand() * 6;
      const px = x[j] + nx[j] * sd * off, pz = z[j] + nz[j] * sd * off;
      if (x[j] > 180 || !free(px, pz, 3) || distanceToTrack(track, px, pz) < WALL_OFFSET + 3) continue;
      roundTrees.push([px, pz, 0.8 + rand() * 0.6]);
    }
    const rTrunk = new THREE.CylinderGeometry(0.15, 0.22, 2.6, 5); rTrunk.translate(0, 1.3, 0);
    const crown = new THREE.IcosahedronGeometry(2.2, 0); crown.translate(0, 3.8, 0);
    const rt = new THREE.InstancedMesh(rTrunk, new THREE.MeshLambertMaterial({ color: 0x4c3a2a }), roundTrees.length);
    const rc = new THREE.InstancedMesh(crown, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), roundTrees.length);
    roundTrees.forEach(([px, pz, k], i) => {
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand() * Math.PI);
      m4.compose(p.set(px, 0, pz), q, sc.set(k, k, k));
      rt.setMatrixAt(i, m4); rc.setMatrixAt(i, m4);
      c.setRGB(0.07 + rand() * 0.05, 0.13 + rand() * 0.06, 0.03 + rand() * 0.02);
      rc.setColorAt(i, c);
    });
    add(rt); add(rc);
  }

  // --- Ferrovia e trem local de dois vagões ---------------------------------------------------------------
  const RAIL_HALF = 1300;
  {
    const ballast = add(new THREE.Mesh(new THREE.BoxGeometry(RAIL_HALF * 2, 0.7, 4.2), new THREE.MeshLambertMaterial({
      map: (() => { const t = canvasTexture(64, 32, (ctx, w, h) => noise(ctx, w, h, '#7b746a', 0.5, 1400, rand, 2)); t.repeat.set(RAIL_HALF / 2, 1); return t; })(),
    })));
    ballast.position.set(CX, 0.35, RAIL_Z);
    const railMat = new THREE.MeshLambertMaterial({ color: 0x5b5249 });
    for (const off of [-0.54, 0.54]) {
      const rail = add(new THREE.Mesh(new THREE.BoxGeometry(RAIL_HALF * 2, 0.16, 0.08), railMat));
      rail.position.set(CX, RAIL_TOP - 0.08, RAIL_Z + off);
    }
    const sleeperGeo = new THREE.BoxGeometry(0.22, 0.14, 2.1);
    const count = Math.floor((RAIL_HALF * 2) / 0.9);
    const sleepers = new THREE.InstancedMesh(sleeperGeo, new THREE.MeshLambertMaterial({ color: 0x6d655c }), count);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < count; i++) sleepers.setMatrixAt(i, m4.makeTranslation(CX - RAIL_HALF + i * 0.9, 0.74, RAIL_Z));
    add(sleepers);
    // Postes da catenária
    const poleGeo = new THREE.CylinderGeometry(0.14, 0.18, 7, 6); poleGeo.translate(0, 3.5, 0);
    const armGeo = new THREE.BoxGeometry(0.12, 0.12, 3);
    const wire = [];
    for (let px = CX - RAIL_HALF; px <= CX + RAIL_HALF; px += 50) {
      const pole = add(new THREE.Mesh(poleGeo, shedWallMat)); pole.position.set(px, 0, RAIL_Z - 2.6);
      const arm = add(new THREE.Mesh(armGeo, shedWallMat)); arm.position.set(px, 6.6, RAIL_Z - 1.2);
      if (px + 50 <= CX + RAIL_HALF) wire.push(px, 6.1, RAIL_Z, px + 50, 6.1, RAIL_Z);
    }
    add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(wire, 3)), new THREE.LineBasicMaterial({ color: 0x1c1c1c })));
  }
  const train = add(new THREE.Group());
  train.name = 'trem';
  train.userData.dynamic = true;
  {
    const sideTex = canvasTexture(256, 64, (ctx, w, h) => {
      ctx.fillStyle = '#c9ccce'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.08)'; for (let x0 = 0; x0 < w; x0 += 3) ctx.fillRect(x0, 0, 1, h);
      ctx.fillStyle = '#2f8a4a'; ctx.fillRect(0, 40, w, 6);
      ctx.fillStyle = '#e07a2a'; ctx.fillRect(0, 46, w, 3);
      for (let i = 0; i < 9; i++) { ctx.fillStyle = '#fff4d8'; ctx.fillRect(8 + i * 28, 14, 20, 20); }
      for (const dx of [36, 128, 220]) { ctx.fillStyle = '#6a6e72'; ctx.fillRect(dx - 6, 10, 14, 44); ctx.fillStyle = '#fff4d8'; ctx.fillRect(dx - 4, 14, 10, 16); }
    }, { repeat: false });
    const sideEmissive = canvasTexture(256, 64, (ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) { ctx.fillStyle = '#ffe9c0'; ctx.fillRect(8 + i * 28, 14, 20, 20); }
    }, { repeat: false });
    const frontTex = canvasTexture(64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#c9ccce'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1b2026'; ctx.fillRect(6, 10, w - 12, 22);
      ctx.fillStyle = '#2f8a4a'; ctx.fillRect(0, 40, w, 6);
      ctx.fillStyle = '#fff'; ctx.fillRect(8, 50, 8, 4); ctx.fillRect(w - 16, 50, 8, 4);
    }, { repeat: false });
    const sideMat = new THREE.MeshLambertMaterial({ map: sideTex, emissiveMap: sideEmissive, emissive: 0xffffff, emissiveIntensity: 0.8 });
    const endMat = new THREE.MeshLambertMaterial({ map: frontTex });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x77797b });
    const glow = glowTexture();
    for (let k = 0; k < 2; k++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(19.5, 3.4, 2.9), [endMat, endMat, roofMat, roofMat, sideMat, sideMat]);
      car.position.set(-k * 20, RAIL_TOP + 0.9 + 1.7, 0);
      train.add(car);
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(17, 0.9, 2.4), new THREE.MeshLambertMaterial({ color: 0x2b2d2f }));
      skirt.position.set(-k * 20, RAIL_TOP + 0.45, 0);
      train.add(skirt);
    }
    for (const [lz, color, px] of [[-0.9, 0xfff2cc, 9.8], [0.9, 0xfff2cc, 9.8], [-0.9, 0xff3322, -29.8], [0.9, 0xff3322, -29.8]]) {
      const light = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      light.position.set(px, RAIL_TOP + 1.3, lz);
      light.scale.setScalar(color === 0xff3322 ? 1.2 : 2.6);
      train.add(light);
    }
  }

  // --- Postes de luz (vila) e máquinas de refrigerante -----------------------------------------------------
  const lamps = [];
  // Postes da estrada e lanternas de festival ficam num grupo que só aparece à noite
  const nightGroup = new THREE.Group();
  root.add(nightGroup);
  {
    // À noite a estrada inteira tem postes (lado de fora, alternando), além dos da vila
    let alt = 1;
    for (let s = 20; s < track.length; s += 46) {
      const j = at(s);
      alt = -alt;
      const off = WALL_OFFSET + 1.1;
      const px = x[j] + nx[j] * alt * off, pz = z[j] + nz[j] * alt * off;
      if (Math.abs(pz - RAIL_Z) < 8 || !free(px, pz, 0.5)) continue;
      lampSpots.push([px, pz, rand() < 0.7 ? 0xffb060 : 0xdfeeff, true]);
    }
  }
  {
    // Lanternas de festival em postes de bambu ao longo da vila, ligadas por uma corda
    const bamboo = new THREE.MeshLambertMaterial({ color: 0x8a7a4a });
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.06, 3.2, 6); poleGeo.translate(0, 1.6, 0);
    const bodyGeo = new THREE.SphereGeometry(0.24, 10, 8); bodyGeo.scale(1, 1.35, 1);
    const lanternMat = [new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.55, 0.2) }), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.3, 1.9, 1.2) })];
    const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff7a3a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 });
    const rope = [];
    for (const sd of [1, -1]) {
      let prev = null, n = 0;
      for (let s = 0; s < track.length; s += 9) {
        const j = at(s), off = WALL_OFFSET + 0.7;
        const px = x[j] + nx[j] * sd * off, pz = z[j] + nz[j] * sd * off;
        if (!inVillage(px, pz)) { prev = null; continue; }
        const pole = new THREE.Mesh(poleGeo, bamboo); pole.position.set(px, 0, pz); nightGroup.add(pole);
        const l = new THREE.Mesh(bodyGeo, lanternMat[n++ % 2]); l.position.set(px, 2.55, pz); nightGroup.add(l);
        const g = new THREE.Sprite(glowMat); g.position.set(px, 2.55, pz); g.scale.setScalar(1.5); nightGroup.add(g);
        if (prev) rope.push(prev[0], 3.15, prev[1], (prev[0] + px) / 2, 2.9, (prev[1] + pz) / 2, (prev[0] + px) / 2, 2.9, (prev[1] + pz) / 2, px, 3.15, pz);
        prev = [px, pz];
      }
    }
    nightGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(rope, 3)), new THREE.LineBasicMaterial({ color: 0x2a2218 })));
  }
  {
    const glow = glowTexture();
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x7c7d78 });
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6.2, 6); poleGeo.translate(0, 3.1, 0);
    for (const [px, pz, color, night = false] of lampSpots) {
      const put = (o) => { (night ? nightGroup : root).add(o); return o; };
      const pole = put(new THREE.Mesh(poleGeo, poleMat)); pole.position.set(px, 0, pz);
      const head = put(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2) })));
      head.position.set(px, 6.2, pz);
      const flare = put(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
      flare.position.set(px, 6.1, pz); flare.scale.setScalar(2.4);
      lamps.push({ position: new THREE.Vector3(px, 5.9, pz), color: new THREE.Color(color), night });
    }
    const bodyGeo = new THREE.BoxGeometry(0.9, 1.8, 0.7);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xd8dde2 });
    const frontGeo = new THREE.PlaneGeometry(0.8, 1.7);
    const fronts = Array.from({ length: 3 }, () => new THREE.MeshBasicMaterial({ map: vendingTexture(rand), color: new THREE.Color(1.2, 1.2, 1.2) }));
    for (const [px, pz, yaw] of vending) {
      const b = add(new THREE.Mesh(bodyGeo, bodyMat)); b.position.set(px, 0.9, pz); b.rotation.y = yaw + Math.PI;
      const f = add(new THREE.Mesh(frontGeo, fronts[Math.floor(rand() * fronts.length)]));
      f.position.set(px - Math.sin(yaw) * 0.36, 0.9, pz - Math.cos(yaw) * 0.36); f.rotation.y = yaw + Math.PI;
    }
  }

  // --- Postes de fiação de madeira ao longo da estrada ------------------------------------------------------
  {
    const woodPole = new THREE.MeshLambertMaterial({ color: 0x5f5448 });
    const poleGeo = new THREE.CylinderGeometry(0.13, 0.17, 9.5, 6); poleGeo.translate(0, 4.75, 0);
    const crossGeo = new THREE.BoxGeometry(1.6, 0.1, 0.1);
    const canGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.9, 8);
    const tops = [];
    const SPACING = 36;
    for (let s = 10; s < track.length; s += SPACING) {
      const j = at(s), sd = 1, off = WALL_OFFSET + 1.6;
      const px = x[j] + nx[j] * sd * off, pz = z[j] + nz[j] * sd * off;
      const pole = add(new THREE.Mesh(poleGeo, woodPole)); pole.position.set(px, 0, pz);
      const cross = add(new THREE.Mesh(crossGeo, woodPole)); cross.position.set(px, 8.9, pz); cross.rotation.y = Math.atan2(tx[j], tz[j]) + Math.PI / 2;
      if (rand() < 0.25) { const can = add(new THREE.Mesh(canGeo, shedWallMat)); can.position.set(px + nx[j] * 0.5, 7.4, pz + nz[j] * 0.5); }
      tops.push([px, pz]);
    }
    const seg = [];
    for (let i = 0; i < tops.length; i++) {
      const [ax, az] = tops[i], [bx, bz] = tops[(i + 1) % tops.length];
      if (Math.hypot(bx - ax, bz - az) > SPACING * 1.5) continue;
      for (const [wy, lat] of [[8.9, -0.7], [8.9, 0.7], [8.1, 0]]) {
        let prev = null;
        for (let k = 0; k <= 8; k++) {
          const t = k / 8, ox = -(bz - az), oz = bx - ax, ol = Math.hypot(ox, oz);
          const p = [ax + (bx - ax) * t + ox / ol * lat, wy - Math.sin(Math.PI * t) * 0.9, az + (bz - az) * t + oz / ol * lat];
          if (prev) seg.push(...prev, ...p);
          prev = p;
        }
      }
    }
    add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)), new THREE.LineBasicMaterial({ color: 0x141414 })));
  }

  // --- Placas: velocidade, direção (azul), curva perigosa, "cuidado, criança" e ponto de ônibus ----------------
  const signPostMat = new THREE.MeshLambertMaterial({ color: 0x9a9c98 });
  function roadsideSign(s, sideDir, texture, w, h, y, { posts = 1, offset = WALL_OFFSET + 0.9 } = {}) {
    const j = at(s);
    const sd = sideDir === 'left' ? 1 : sideDir === 'right' ? -1 : sideDir;
    const px = x[j] + nx[j] * sd * offset, pz = z[j] + nz[j] * sd * offset;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: texture, emissive: 0x222222, emissiveMap: texture }));
    face.position.set(px, y, pz);
    // De frente para quem vem (sentido contrário ao da pista)
    face.lookAt(px - tx[j], y, pz - tz[j]);
    add(face);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signPostMat);
    back.position.copy(face.position).addScaledVector(new THREE.Vector3(tx[j], 0, tz[j]), 0.02);
    back.lookAt(px + tx[j] * 2, y, pz + tz[j] * 2);
    add(back);
    const offsets = posts === 1 ? [0] : [-w * 0.35, w * 0.35];
    for (const o of offsets) {
      const lx = nx[j], lz = nz[j];
      const post = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, y, 6), signPostMat));
      post.position.set(px + lx * o, y / 2, pz + lz * o);
    }
  }
  const speedTex = canvasTexture(64, 64, (ctx, w) => {
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = '#d42a2a'; ctx.beginPath(); ctx.arc(32, 32, 31, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f7f7f2'; ctx.beginPath(); ctx.arc(32, 32, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d3f9a'; ctx.font = '700 30px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('40', 32, 34);
  }, { repeat: false });
  const guideTex = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1f4fa0'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 3; ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#f2f2f2'; ctx.textBaseline = 'middle';
    ctx.font = `700 30px ${JP_FONT}`; ctx.textAlign = 'center'; ctx.fillText('↑ 富士山', w / 2, 30);
    ctx.font = '600 13px Arial, sans-serif'; ctx.fillText('Mt. Fuji  12 km', w / 2, 54);
    ctx.font = `700 24px ${JP_FONT}`; ctx.textAlign = 'left'; ctx.fillText('← 河口湖', 14, 90);
    ctx.textAlign = 'right'; ctx.fillText('甲府 →', w - 14, 90);
    ctx.font = '600 11px Arial, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('Kawaguchiko', 30, 112);
    ctx.textAlign = 'right'; ctx.fillText('Kofu', w - 30, 112);
  }, { repeat: false });
  const curveTex = (dir) => canvasTexture(64, 64, (ctx, w) => {
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = '#f2c21c'; ctx.beginPath(); ctx.moveTo(32, 2); ctx.lineTo(62, 32); ctx.lineTo(32, 62); ctx.lineTo(2, 32); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); if (dir < 0) { ctx.translate(64, 0); ctx.scale(-1, 1); }
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(26, 50); ctx.lineTo(26, 32); ctx.quadraticCurveTo(26, 20, 38, 20); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(36, 12); ctx.lineTo(46, 20); ctx.lineTo(36, 28); ctx.fill();
    ctx.restore();
  }, { repeat: false });
  const kidTex = canvasTexture(64, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f5f5f0'; ctx.fillRect(4, 92, 56, 32);
    ctx.fillStyle = '#d42a2a'; ctx.font = `900 13px ${JP_FONT}`; ctx.textAlign = 'center';
    ctx.fillText('とびだし', 32, 106); ctx.fillText('注意', 32, 120);
    ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(34, 16, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(34, 12, 10, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d42a2a'; ctx.fillRect(22, 27, 22, 26);
    ctx.fillStyle = '#1d3f9a'; ctx.beginPath(); ctx.moveTo(24, 52); ctx.lineTo(8, 84); ctx.lineTo(16, 88); ctx.lineTo(32, 60); ctx.lineTo(46, 88); ctx.lineTo(56, 84); ctx.lineTo(42, 52); ctx.fill();
    ctx.strokeStyle = '#f2c9a0'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(24, 32); ctx.lineTo(6, 44); ctx.moveTo(42, 32); ctx.lineTo(58, 22); ctx.stroke();
  }, { repeat: false });
  roadsideSign(22, 'left', speedTex, 0.75, 0.75, 2.1);
  roadsideSign(120, 'left', guideTex, 3.4, 1.7, 2.9, { posts: 2, offset: WALL_OFFSET + 1.8 });
  {
    // Placa de curva antes das curvas fechadas
    let skipUntil = -1;
    for (let j = 0; j < N; j++) {
      if (j < skipUntil) continue;
      let peak = 0, sign = 0;
      for (let k = 18; k < 40; k++) { const cv = track.curv[(j + k) % N]; if (Math.abs(cv) > peak) { peak = Math.abs(cv); sign = Math.sign(cv); } }
      if (peak < 0.028 || Math.abs(track.curv[j]) > 0.01) continue;
      roadsideSign(j * ds, 'left', curveTex(sign), 0.9, 0.9, 2.2);
      skipUntil = j + 60;
    }
  }
  {
    const j = at(300);
    const sd = sideToward(j, 0, 1);
    roadsideSign(300, sd, kidTex, 0.6, 1.2, 0.95, { offset: WALL_OFFSET + 0.6 });
    // Ponto de ônibus com banco e placa redonda
    const k = at(390), sb = sideToward(k, 0, -1);
    const px = x[k] + nx[k] * sb * (WALL_OFFSET + 1.4), pz = z[k] + nz[k] * sb * (WALL_OFFSET + 1.4);
    const busTex = canvasTexture(64, 64, (ctx, w) => {
      ctx.clearRect(0, 0, w, w);
      ctx.fillStyle = '#f2f2ee'; ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1f7a3a'; ctx.lineWidth = 5; ctx.stroke();
      ctx.fillStyle = '#1f7a3a'; ctx.font = `900 12px ${JP_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('富士見口', 32, 26); ctx.font = '700 10px Arial'; ctx.fillText('BUS', 32, 42);
    }, { repeat: false });
    const face = add(new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), new THREE.MeshLambertMaterial({ map: busTex, side: THREE.DoubleSide })));
    face.position.set(px, 2.4, pz); face.lookAt(px - tx[k], 2.4, pz - tz[k]);
    const post = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), signPostMat)); post.position.set(px, 1.2, pz);
    const bench = add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.5), new THREE.MeshLambertMaterial({ color: 0x6e4a2c })));
    const bx = px + tx[k] * 2.2 + nx[k] * sb * 0.6, bz = pz + tz[k] * 2.2 + nz[k] * sb * 0.6;
    bench.position.set(bx, 0.45, bz); bench.rotation.y = Math.atan2(tx[k], tz[k]) + Math.PI / 2;
  }

  // Pintura no asfalto antes do grampo
  {
    const wordMat = new THREE.MeshLambertMaterial({ map: roadWordTexture('速度落せ'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    let best = 0, bestJ = 0;
    for (let j = 0; j < N; j++) if (Math.abs(track.curv[j]) > best) { best = Math.abs(track.curv[j]); bestJ = j; }
    const jw = (bestJ - 32 + N) % N;
    const word = add(new THREE.Mesh(new THREE.PlaneGeometry(3.2, 8), wordMat));
    word.rotation.set(-Math.PI / 2, 0, Math.atan2(tx[jw], tz[jw]) + Math.PI);
    word.position.set(x[jw] + nx[jw] * 3.5, 0.032, z[jw] + nz[jw] * 3.5);
  }

  // --- Largada: pórtico de madeira com faixa e lanternas de festival (提灯) ------------------------------------
  {
    const startGroup = add(new THREE.Group());
    startGroup.position.set(x[0], 0, z[0]);
    startGroup.rotation.y = Math.atan2(tx[0], tz[0]);
    const checker = canvasTexture(16, 2, (ctx) => {
      for (let i = 0; i < 16; i++) for (let k = 0; k < 2; k++) { ctx.fillStyle = (i + k) % 2 ? '#111' : '#e8e8e8'; ctx.fillRect(i, k, 1, 1); }
    }, { repeat: false, nearest: true });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, 1.4), new THREE.MeshLambertMaterial({ map: checker, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    line.rotation.x = -Math.PI / 2; line.position.y = 0.04;
    startGroup.add(line);
    const wood = new THREE.MeshLambertMaterial({ color: 0x4a3222 });
    const span = WALL_OFFSET + 0.9;
    for (const sd of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 7.4, 0.45), wood); post.position.set(sd * span, 3.7, 0); startGroup.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(span * 2 + 1.4, 0.4, 0.5), wood); beam.position.y = 7.3; startGroup.add(beam);
    const bannerTex = canvasTexture(512, 64, (ctx, w, h) => {
      ctx.fillStyle = '#f4efe2'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#b3121b'; ctx.fillRect(0, 0, w, 6); ctx.fillRect(0, h - 6, w, 6);
      ctx.fillStyle = '#1a1a1a'; ctx.font = `900 40px ${JP_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('富士見街道ドリフト', w / 2, h / 2 + 2);
    }, { repeat: false });
    const bannerMat = new THREE.MeshLambertMaterial({ map: bannerTex, emissiveMap: bannerTex, emissive: 0x333333 });
    const banner = new THREE.Mesh(new THREE.BoxGeometry(span * 2 - 0.6, 1.4, 0.12), [wood, wood, wood, wood, bannerMat, bannerMat]);
    banner.position.y = 6.3;
    startGroup.add(banner);
    const lanternTex = (red) => canvasTexture(64, 64, (ctx, w, h) => {
      ctx.fillStyle = red ? '#d8261c' : '#f6ecd2'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 4; y < h; y += 6) ctx.fillRect(0, y, w, 1);
      ctx.fillStyle = red ? '#fbe9c8' : '#b3121b'; ctx.font = `900 30px ${JP_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('祭', 16, 34); ctx.fillText('祭', 48, 34);
    }, { repeat: false });
    const lanternMats = [true, false].map((red) => new THREE.MeshBasicMaterial({ map: lanternTex(red), color: new THREE.Color(1.5, 1.35, 1.2).multiplyScalar(T.lanternGlow) }));
    gateLanternMats = lanternMats;
    const lanternGeo = new THREE.SphereGeometry(0.32, 12, 8); lanternGeo.scale(1, 1.4, 1);
    const capGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10);
    const capMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const glow = glowTexture();
    const glowMat = new THREE.SpriteMaterial({ map: glow, color: 0xff8a40, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 });
    const count = 11;
    for (let i = 0; i < count; i++) {
      const u = -span + 1 + (i / (count - 1)) * (span * 2 - 2);
      const l = new THREE.Mesh(lanternGeo, lanternMats[i % 2]); l.position.set(u, 5.0, 0.35); startGroup.add(l);
      for (const cy of [5.45, 4.55]) { const c = new THREE.Mesh(capGeo, capMat); c.position.set(u, cy, 0.35); startGroup.add(c); }
      const g = new THREE.Sprite(glowMat); g.position.set(u, 5.0, 0.45); g.scale.setScalar(1.6); startGroup.add(g);
    }
  }

  mergeStatic(nightGroup);
  nightGroup.userData.dynamic = true; // liga/desliga inteiro: não entra na junção do resto
  mergeStatic(root);

  const atmosphere = { headlights: true };
  const dayLamps = lamps.filter((l) => !l.night);
  const world = {
    root,
    atmosphere,
    time: null,
    get lamps() { return T.roadLamps ? lamps : dayLamps; },
    // Troca o horário sem remontar nada (e deixa a neblina deste mundo na cena)
    setTime(id) {
      T = FUJIMI_THEMES[id] || FUJIMI_THEMES.tarde;
      world.time = FUJIMI_THEMES[id] ? id : 'tarde';
      scene.fog = fog;
      fog.color.copy(T.fog[0]); fog.density = T.fog[1];
      hemi.color.setHex(T.hemi[0]); hemi.groundColor.setHex(T.hemi[1]); hemi.intensity = T.hemi[2];
      sun.color.setHex(T.light.color); sun.intensity = T.light.intensity; sun.position.copy(T.light.dir).multiplyScalar(400);
      const S = T.sky;
      skyUniforms.sunDir.value.copy(S.dir);
      for (const k of ['zenith', 'away', 'toward', 'belt', 'cloudDark', 'cloudLit']) skyUniforms[k].value = S[k];
      skyUniforms.glowCol.value = S.glow; skyUniforms.discCol.value = S.disc; skyUniforms.discSize.value = S.discSize;
      stars.visible = !!S.stars;
      recolorFuji();
      recolorRings();
      cloudMat.color.copy(T.cloud);
      for (const w of wallStyles) w.material.emissiveIntensity = T.windows;
      if (shopFrontMat) shopFrontMat.emissiveIntensity = T.shop;
      for (const m of gateLanternMats) m.color.setRGB(1.5, 1.35, 1.2).multiplyScalar(T.lanternGlow);
      nightGroup.visible = !!(T.roadLamps || T.lanterns);
      Object.assign(atmosphere, { mist: T.mist, mistColor: T.mistColor, mistDensity: T.mistDensity, mistFalloff: T.mistFalloff, lampIntensity: T.lampIntensity });
    },
    setEnvMap(texture) {
      for (const m of envMaterials) { if (m.envMap === texture) continue; m.envMap = texture; m.needsUpdate = true; }
    },
    update(time, camera) {
      skyUniforms.uTime.value = time;
      if (camera) {
        sky.position.set(camera.position.x, 0, camera.position.z);
        backdrop.position.set(camera.position.x, 0, camera.position.z);
      }
      // Trem: passa a cada 140 s, alternando o sentido
      const cycle = Math.floor(time / 140), phase = time % 140;
      const travel = RAIL_HALF * 2 + 60;
      train.visible = phase < travel / 22;
      if (train.visible) {
        const dir = cycle % 2 === 0 ? 1 : -1;
        const d = phase * 22 - RAIL_HALF - 30;
        train.position.set(CX + dir * d, 0, RAIL_Z);
        train.rotation.y = dir > 0 ? 0 : Math.PI;
      }
    },
    dispose: () => disposeTree(root),
  };
  world.setTime(time);
  return world;
}
