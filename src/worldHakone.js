// Serra de Hakone: estrada de montanha descendo a encosta em grampos, muros de pedra, cedros e bordos,
// neblina subindo do vale e um lago lá embaixo. A estrada tem altura (track.y): relevo, muros e objetos acompanham.
// Mesmo espírito PS2 dos outros mapas: texturas pequenas, luz "pintada" e poucos draw calls (mergeStatic no final).
import * as THREE from 'three';
import { ROAD_HALF_WIDTH, WALL_OFFSET } from './track.js';
import { buildTreeField, buildUndergrowth, buildTufts, buildRocks } from './trees.js';
import { groundTextures, countryRoadTextures, tireMarksTexture, roadWordTexture } from './textures.js';
import { mulberry32, canvasTexture, noise, mergeStatic, disposeTree, glowTexture, vendingTexture, JP_FONT } from './world.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const C = (r, g, b) => new THREE.Color(r, g, b);
const LAKE_Y = -42;       // espelho d'água do lago no fundo do vale
const CLOUD_Y = -4;       // mar de nuvens logo abaixo do trecho mais baixo da estrada
const BANK = 34;          // m do eixo até onde vai o barranco modelado junto da estrada
const W = WALL_OFFSET;

// Horários: céu, luz, neblina (a névoa rasteira começa em mistBase, no vale), cor das árvores, nuvens e lago.
export const HAKONE_THEMES = {
  neblina: {
    sky: { dir: V(0.25, 0.7, -0.4), zenith: C(0.4, 0.45, 0.5), away: C(0.66, 0.69, 0.7), toward: C(0.8, 0.8, 0.76), cover: 0.9,
      glow: C(0.25, 0.24, 0.2), disc: C(0, 0, 0), discSize: 0.9999, stars: 0 },
    light: { dir: V(0.3, 0.85, -0.3), color: 0xdfe6ee, intensity: 1.0 }, hemi: [0xc4ccd4, 0x46503e, 1.75],
    fog: [C(0.6, 0.64, 0.65), 0.0046], haze: [C(0.56, 0.6, 0.62), C(0.62, 0.64, 0.64)],
    ground: 0xffffff, maples: [[0.12, 0.22, 0.07], [0.09, 0.18, 0.06], [0.15, 0.24, 0.08]], cedar: [0.05, 0.085, 0.055],
    cloudSea: [C(0.82, 0.85, 0.86), 0.85], lake: 0x4a5a5e, roadLamps: false, lampIntensity: 0, stoneWet: 0.8,
    mist: 0.95, mistColor: C(0.64, 0.67, 0.68), mistDensity: 0.03, mistFalloff: 0.055, mistBase: -8,
  },
  outono: {
    sky: { dir: V(-0.75, 0.13, -0.55), zenith: C(0.12, 0.22, 0.46), away: C(0.6, 0.58, 0.64), toward: C(1.55, 0.85, 0.45), cover: 0.25,
      glow: C(2.2, 1.2, 0.5), disc: C(22, 14, 8), discSize: 0.99955, stars: 0 },
    light: { dir: V(-0.75, 0.22, -0.55), color: 0xffc08a, intensity: 2.5 }, hemi: [0xa3b2d2, 0x5a4230, 1.45],
    fog: [C(0.56, 0.5, 0.5), 0.0015], haze: [C(0.46, 0.46, 0.56), C(1.0, 0.62, 0.42)],
    ground: 0xd9c2a0, maples: [[0.5, 0.09, 0.04], [0.62, 0.26, 0.05], [0.58, 0.42, 0.1], [0.4, 0.07, 0.05], [0.2, 0.2, 0.06]], cedar: [0.05, 0.075, 0.045],
    cloudSea: [C(1.25, 0.98, 0.84), 0.5], lake: 0x5a6f96, roadLamps: false, lampIntensity: 0, stoneWet: 1,
    mist: 0.35, mistColor: C(0.78, 0.66, 0.6), mistDensity: 0.02, mistFalloff: 0.07, mistBase: -16,
  },
  noite: {
    sky: { dir: V(0.45, 0.45, 0.75), zenith: C(0.004, 0.007, 0.02), away: C(0.028, 0.035, 0.06), toward: C(0.06, 0.075, 0.12), cover: 0.35,
      glow: C(0.3, 0.34, 0.48), disc: C(5, 5.2, 5.6), discSize: 0.99975, stars: 1 },
    light: { dir: V(0.45, 0.6, 0.65), color: 0x8fa6ff, intensity: 0.5 }, hemi: [0x2c3860, 0x0b0b12, 0.42],
    fog: [C(0.03, 0.036, 0.052), 0.0034], haze: [C(0.03, 0.038, 0.065), C(0.05, 0.06, 0.1)],
    ground: 0xffffff, maples: [[0.1, 0.16, 0.06], [0.08, 0.13, 0.05]], cedar: [0.05, 0.08, 0.05],
    cloudSea: [C(0.13, 0.15, 0.21), 0.7], lake: 0x0c1220, roadLamps: true, lampIntensity: 170, stoneWet: 0.9,
    mist: 0.7, mistColor: C(0.07, 0.08, 0.105), mistDensity: 0.03, mistFalloff: 0.06, mistBase: -8,
  },
};

const smoothstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
function hash2(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(px, pz) {
  const ix = Math.floor(px), iz = Math.floor(pz), fx = px - ix, fz = pz - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  return mix(mix(hash2(ix, iz), hash2(ix + 1, iz), sx), mix(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), sx), sz);
}
function fbm(px, pz, octaves = 4) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < octaves; o++) { sum += vnoise(px, pz) * amp; norm += amp; px *= 2.03; pz *= 2.03; amp *= 0.5; }
  return sum / norm;
}

export function buildHakoneWorld(scene, track, { time = 'neblina' } = {}) {
  let T = HAKONE_THEMES.neblina;
  const rand = mulberry32(8812);
  const { N, x, z, nx, nz, tx, tz, ds, curv } = track;
  const Y = track.y;
  const root = new THREE.Group();
  root.name = 'mundo:hakone';
  scene.add(root);
  const add = (o) => { root.add(o); return o; };
  const at = (s) => Math.floor((((s % track.length) + track.length) % track.length) / ds) % N;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let j = 0; j < N; j++) {
    minX = Math.min(minX, x[j]); maxX = Math.max(maxX, x[j]);
    minZ = Math.min(minZ, z[j]); maxZ = Math.max(maxZ, z[j]);
  }
  const CX = (minX + maxX) / 2, CZ = (minZ + maxZ) / 2;

  // --- Encosta natural: plano ajustado às alturas da estrada, morro subindo ao norte, vale e lago ao sul ------
  const plane = (() => {
    // Mínimos quadrados de y = a + b·x + c·z sobre as amostras da pista
    let n = 0, sx = 0, sz = 0, sy = 0, sxx = 0, szz = 0, sxz = 0, sxy = 0, szy = 0;
    for (let j = 0; j < N; j++) {
      const px = x[j], pz = z[j], py = Y[j];
      n++; sx += px; sz += pz; sy += py; sxx += px * px; szz += pz * pz; sxz += px * pz; sxy += px * py; szy += pz * py;
    }
    const m = [[n, sx, sz], [sx, sxx, sxz], [sz, sxz, szz]], r = [sy, sxy, szy];
    const det = (a) => a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
    const d = det(m);
    const col = (k) => det(m.map((row, i) => row.map((v, c) => (c === k ? r[i] : v))));
    return { a: col(0) / d, b: col(1) / d, c: col(2) / d, mean: sy / n, mx: sx / n, mz: sz / n };
  })();
  const STEEP = 1.6; // encosta mais íngreme que a média da estrada: muros de arrimo altos e barrancos fundos
  function hillAt(px, pz) {
    let h = plane.mean + STEEP * (plane.b * (px - plane.mx) + plane.c * (pz - plane.mz));
    h += 120 * smoothstep(30, 520, pz) * (0.6 + 0.8 * fbm(px * 0.004 + 4, pz * 0.004));   // montanha ao norte
    h += 90 * smoothstep(260, 700, Math.abs(px - CX)) * fbm(px * 0.003, pz * 0.003 + 9);  // paredes do vale
    h += (fbm(px * 0.012, pz * 0.012, 3) - 0.5) * 12;
    const lake = smoothstep(-400, -560, pz);                                                // fundo do vale alagado
    return mix(h, Math.min(h, LAKE_Y - 3), lake);
  }

  // --- Barranco junto da estrada, por amostra e por lado ---------------------------------------------------------
  // Até onde vai (metade da distância até outro trecho da estrada, menos que o raio no lado de dentro das curvas),
  // altura do muro (arrimo alto do lado do morro, mureta baixa do lado do vale) e altura do terreno no fim.
  const sides = [1, -1].map((sd) => {
    const off = new Float32Array(N), endH = new Float32Array(N), wallH = new Float32Array(N), backY = new Float32Array(N);
    const FAR = Math.round(50 / ds);
    for (let j = 0; j < N; j++) {
      let limit = BANK;
      let k = 0;
      for (let q = -5; q <= 5; q++) k = Math.max(k, Math.abs(curv[(j + q + N) % N]) * (Math.sign(curv[(j + q + N) % N]) === sd ? 1 : 0));
      if (k > 1e-4) limit = Math.min(limit, 0.8 / k);
      for (let o = W + 2; o <= BANK + 2; o += 2) {
        const px = x[j] + nx[j] * sd * o, pz = z[j] + nz[j] * sd * o;
        let other = Infinity;
        for (let i = 0; i < N; i += 2) {
          const di = Math.abs(i - j);
          if (Math.min(di, N - di) < FAR) continue;
          other = Math.min(other, (x[i] - px) ** 2 + (z[i] - pz) ** 2);
        }
        other = Math.sqrt(other);
        if (other < o + 1) { limit = Math.min(limit, (o + other) / 2 - 1); break; }
      }
      off[j] = Math.max(W + 1.6, limit);
    }
    // Suaviza o recuo (mínimo na vizinhança) e calcula alturas
    const offS = new Float32Array(N);
    for (let j = 0; j < N; j++) { let m = Infinity; for (let q = -3; q <= 3; q++) m = Math.min(m, off[(j + q + N) % N]); offS[j] = m; }
    const rawEnd = new Float32Array(N);
    for (let j = 0; j < N; j++) rawEnd[j] = hillAt(x[j] + nx[j] * sd * offS[j], z[j] + nz[j] * sd * offS[j]);
    for (let j = 0; j < N; j++) {
      let sum = 0;
      for (let q = -4; q <= 4; q++) sum += rawEnd[(j + q + N) % N];
      endH[j] = sum / 9;
      const rise = endH[j] - Y[j];
      const up = smoothstep(-0.5, 2.5, rise);
      wallH[j] = mix(0.85, Math.min(6, Math.max(1.2, rise * 0.55)), up);
      backY[j] = mix(Y[j] - 0.6, Y[j] + wallH[j], up);
    }
    return { sd, off: offS, endH, wallH, backY };
  });
  const sideOf = (sd) => sides[sd > 0 ? 0 : 1];

  // Altura do chão na seção da amostra j, a `o` metros do eixo (com sinal: + = esquerda)
  function profileY(j, o) {
    const S = sideOf(o >= 0 ? 1 : -1), d = Math.abs(o);
    if (d <= W) return Y[j];
    if (d <= W + 0.8) return Y[j] + S.wallH[j];
    if (d >= S.off[j]) return hillAt(x[j] + nx[j] * o, z[j] + nz[j] * o);
    const t = (d - W - 0.8) / Math.max(0.1, S.off[j] - W - 0.8);
    return mix(S.backY[j], S.endH[j], smoothstep(0, 1, t));
  }
  // Amostra mais próxima (busca bruta: só na montagem)
  function nearest(px, pz) {
    let best = 0, bd = Infinity;
    for (let j = 0; j < N; j++) { const d = (x[j] - px) ** 2 + (z[j] - pz) ** 2; if (d < bd) { bd = d; best = j; } }
    return best;
  }
  // Chão em qualquer ponto. inside: true se o ponto cai na seção modelada junto da estrada (e não no relevo).
  function groundInfo(px, pz) {
    if (px < minX - BANK - 8 || px > maxX + BANK + 8 || pz < minZ - BANK - 8 || pz > maxZ + BANK + 8) return { h: hillAt(px, pz), inside: false };
    const j = nearest(px, pz);
    const o = (px - x[j]) * nx[j] + (pz - z[j]) * nz[j];
    const d = Math.abs(o);
    if (d >= sideOf(o).off[j]) return { h: hillAt(px, pz), inside: false };
    return { h: profileY(j, o), inside: true, j, d };
  }
  const groundAt = (px, pz) => groundInfo(px, pz).h;

  // Malha que acompanha a estrada: section(j) devolve [[offset, y], ...] (mesmo número de pontos em toda amostra).
  function strip(section, material, { uScale = 4, vScale = 1, swap = false, up = false } = {}) {
    const pos = [], uv = [], idx = [];
    let count = 0;
    for (let jj = 0; jj <= N; jj++) {
      const j = jj % N, sec = section(j);
      count = sec.length;
      let acc = 0;
      sec.forEach(([o, py], k) => {
        if (k) acc += Math.hypot(o - sec[k - 1][0], py - sec[k - 1][1]);
        pos.push(x[j] + nx[j] * o, py, z[j] + nz[j] * o);
        const u = (jj * ds) / uScale, v = acc / vScale;
        uv.push(swap ? v : u, swap ? u : v);
      });
    }
    for (let jj = 0; jj < N; jj++) for (let k = 0; k < count - 1; k++) {
      const a = jj * count + k, b = a + 1, c = a + count, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    if (up) {
      // Normal da primeira face para cima
      const p = (i) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      const n = new THREE.Vector3().subVectors(p(idx[1]), p(idx[0])).cross(new THREE.Vector3().subVectors(p(idx[2]), p(idx[0])));
      if (n.y < 0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return add(new THREE.Mesh(geo, material));
  }

  // --- Céu nublado (cobertura muda com o horário) --------------------------------------------------------------
  const skyUniforms = {
    sunDir: { value: T.sky.dir.clone() }, uTime: { value: 0 }, cover: { value: T.sky.cover },
    zenith: { value: T.sky.zenith }, away: { value: T.sky.away }, toward: { value: T.sky.toward },
    glowCol: { value: T.sky.glow }, discCol: { value: T.sky.disc }, discSize: { value: T.sky.discSize },
  };
  const sky = add(new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir; uniform float uTime, cover, discSize; varying vec3 vDir;
      uniform vec3 zenith, away, toward, glowCol, discCol;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        float sun = max(dot(d, sunDir), 0.0);
        float sunAz = pow(max(dot(normalize(d.xz + 1e-5), normalize(sunDir.xz)), 0.0), 2.0);
        vec3 col = mix(mix(away, toward, sunAz), zenith, pow(h, 0.5));
        if (d.y > 0.0) {
          vec2 p = d.xz / (d.y + 0.12) * 1.1 + vec2(uTime * 0.004, uTime * 0.0015);
          float n = vn(p * vec2(0.7, 1.6)) * 0.55 + vn(p * 2.3 + 3.0) * 0.3 + vn(p * 7.0) * 0.15;
          float cloud = smoothstep(0.62 - cover * 0.5, 0.9 - cover * 0.35, n) * smoothstep(0.0, 0.1, d.y);
          vec3 cloudCol = mix(away * 0.9, toward * 1.05, sunAz * (1.0 - cover));
          col = mix(col, cloudCol, cloud * (0.55 + 0.4 * cover));
        }
        col += glowCol * (pow(sun, 20.0) * 0.5 + pow(sun, 4.0) * 0.15) * (1.0 - cover * 0.7);
        col += discCol * smoothstep(discSize, discSize + (1.0 - discSize) * 0.55, sun) * (1.0 - cover);
        gl_FragColor = vec4(col, 1.0);
      }`,
  })));
  sky.renderOrder = -2;
  sky.userData.dynamic = true;

  const fog = new THREE.FogExp2(T.fog[0].clone(), T.fog[1]);
  const hemi = add(new THREE.HemisphereLight(...T.hemi));
  const sun = add(new THREE.DirectionalLight(T.light.color, T.light.intensity));

  // --- Fundo que acompanha a câmera: estrelas e cordilheiras da caldeira em camadas -------------------------------
  const backdrop = add(new THREE.Group());
  backdrop.userData.dynamic = true;
  const starPos = [];
  for (let i = 0; i < 900; i++) {
    const v = new THREE.Vector3(rand() - 0.5, rand() * 0.85 + 0.12, rand() - 0.5).normalize().multiplyScalar(1400);
    starPos.push(v.x, v.y, v.z);
  }
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3)),
    new THREE.PointsMaterial({ color: 0xb8c4e8, size: 1.4, sizeAttenuation: false, fog: false }));
  stars.renderOrder = -1;
  backdrop.add(stars);
  const rings = [];
  for (const [radius, base, amp, shade] of [[1100, 60, 170, 0.66], [1400, 90, 250, 0.84]]) {
    const SEG = 180, pos = [], idx = [];
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const n = fbm(Math.cos(a) * 3.3 + radius, Math.sin(a) * 3.3, 5);
      const south = Math.max(0, -Math.sin(a)); // abertura do vale para o lago
      const h = (base + amp * n * n * 1.8) * (1 - 0.55 * south ** 3) - 40;
      pos.push(Math.cos(a) * radius, LAKE_Y - 30, Math.sin(a) * radius, Math.cos(a) * radius, h, Math.sin(a) * radius);
    }
    for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
    geo.setIndex(idx);
    const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    ring.renderOrder = -1;
    backdrop.add(ring);
    rings.push({ ring, shade, SEG });
  }
  const recolorRings = () => {
    const sunAz = Math.atan2(T.light.dir.z, T.light.dir.x), [hazeAway, hazeSun] = T.haze, c = new THREE.Color();
    for (const { ring, shade, SEG } of rings) {
      const colors = ring.geometry.attributes.color;
      for (let i = 0; i <= SEG; i++) {
        const a = (i / SEG) * Math.PI * 2;
        const toSun = Math.max(0, Math.cos(a - sunAz)) ** 2;
        c.copy(hazeAway).lerp(hazeSun, toSun * 0.6).multiplyScalar(shade);
        colors.setXYZ(i * 2, c.r * 1.1, c.g * 1.1, c.b * 1.1);
        colors.setXYZ(i * 2 + 1, c.r * 0.9, c.g * 0.9, c.b * 0.94);
      }
      colors.needsUpdate = true;
    }
  };

  // --- Lago e mar de nuvens no vale --------------------------------------------------------------------------------
  const lakeMat = new THREE.MeshLambertMaterial({ color: T.lake });
  const lake = add(new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), lakeMat));
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(CX, LAKE_Y, CZ);
  const cloudUniforms = { uTime: { value: 0 }, uColor: { value: T.cloudSea[0].clone() }, uAlpha: { value: T.cloudSea[1] } };
  const cloudSea = add(new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600, 1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, uniforms: cloudUniforms,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */ `
      uniform float uTime, uAlpha; uniform vec3 uColor; varying vec3 vW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec2 p = vW.xz * 0.012 + vec2(uTime * 0.006, uTime * 0.002);
        float n = vn(p) * 0.5 + vn(p * 2.1 + 5.0) * 0.3 + vn(p * 5.3 - 2.0) * 0.2;
        float d = length(cameraPosition.xz - vW.xz);
        float a = smoothstep(0.3, 0.72, n) * uAlpha * smoothstep(1250.0, 700.0, d) * smoothstep(8.0, 60.0, d);
        gl_FragColor = vec4(uColor * (0.85 + 0.3 * n), a);
      }`,
  })));
  cloudSea.rotation.x = -Math.PI / 2;
  cloudSea.position.set(CX, CLOUD_Y, CZ - 450);
  cloudSea.renderOrder = 2;
  cloudSea.userData.dynamic = true;

  // --- Relevo em malha (fora do barranco modelado) --------------------------------------------------------------
  // Chão da serra: capim, terra e pedrinhas com relevo, mais folha seca caída (outono).
  const groundMaps = groundTextures(73, { leaves: 1 });
  const terrainMat = new THREE.MeshLambertMaterial({ ...groundMaps, vertexColors: true });
  {
    const HALF = 900, STEP = 10, cols = Math.round((HALF * 2) / STEP) + 1;
    const pos = [], uv = [], idx = [], col = [];
    const field = C(0.12, 0.16, 0.06), forest = C(0.04, 0.065, 0.035), rock = C(0.16, 0.15, 0.13), c = new THREE.Color();
    for (let k = 0; k < cols; k++) for (let i = 0; i < cols; i++) {
      const px = CX - HALF + i * STEP, pz = CZ - 350 - HALF + k * STEP;
      const g = groundInfo(px, pz);
      // Dentro da seção modelada o relevo fica escondido logo abaixo dela. Perto do muro, abaixo da estrada:
      // assim os triângulos grandes da malha não atravessam a sarjeta na frente do muro.
      let h = g.h;
      if (g.inside) h = g.d < W + 10 ? Y[g.j] - 1.2 : h - 0.5;
      pos.push(px, h, pz);
      uv.push(px / 8, pz / 8);
      c.copy(field).lerp(forest, smoothstep(0.35, 0.6, fbm(px * 0.01 + 2, pz * 0.01, 3)));
      c.lerp(rock, smoothstep(90, 200, h) * 0.6);
      col.push(c.r, c.g, c.b);
    }
    for (let k = 0; k < cols - 1; k++) for (let i = 0; i < cols - 1; i++) {
      const a = k * cols + i, b = a + cols;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    add(new THREE.Mesh(geo, terrainMat));
  }

  // --- Estrada, sarjeta, muros de pedra e barranco --------------------------------------------------------------
  const asphalt = countryRoadTextures(83);
  strip((j) => [[-ROAD_HALF_WIDTH, Y[j] + 0.02], [ROAD_HALF_WIDTH, Y[j] + 0.02]], new THREE.MeshPhongMaterial({
    map: asphalt.map, normalMap: asphalt.normalMap, specularMap: asphalt.specularMap, specular: 0x3a3c40, shininess: 30,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  }), { uScale: 16, vScale: ROAD_HALF_WIDTH * 2, swap: true, up: true });

  // Sarjeta de concreto em "U" entre o asfalto e o muro
  const gutterTex = canvasTexture(64, 32, (ctx, w, h) => {
    noise(ctx, w, h, '#8d8a82', 0.3, 700, rand, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, h * 0.35, w, h * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; for (let x0 = 0; x0 < w; x0 += 16) ctx.fillRect(x0, 0, 1, h);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(50,70,30,${0.2 + rand() * 0.3})`; ctx.fillRect(rand() * w, h * 0.75 + rand() * h * 0.25, 2, 2); }
  });
  const gutterMat = new THREE.MeshLambertMaterial({ map: gutterTex, side: THREE.DoubleSide });
  for (const sd of [1, -1]) {
    strip((j) => [[sd * ROAD_HALF_WIDTH, Y[j] + 0.02], [sd * (ROAD_HALF_WIDTH + 0.7), Y[j] - 0.12], [sd * (ROAD_HALF_WIDTH + 1.4), Y[j] - 0.12], [sd * W, Y[j] + 0.03]], gutterMat, { uScale: 4, vScale: 2.2 });
  }

  // Muro de pedras empilhadas (石垣): fiadas irregulares, junta escura e musgo escorrendo
  const stoneTex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3a3833'; ctx.fillRect(0, 0, w, h);
    for (let row = 0, y0 = 0; y0 < h; row++) {
      const rh = 16 + Math.floor(rand() * 12);
      let x0 = -Math.floor(rand() * 20);
      while (x0 < w) {
        const sw = 22 + Math.floor(rand() * 30), g = 112 + Math.floor(rand() * 40), warm = Math.floor(rand() * 10);
        for (const dx of [0, w]) {
          ctx.fillStyle = `rgb(${g + warm},${g + warm - 4},${g - 10})`;
          ctx.beginPath();
          ctx.moveTo(x0 + dx + 2 + rand() * 2, y0 + 1 + rand() * 2);
          ctx.lineTo(x0 + dx + sw - 2 - rand() * 2, y0 + 1 + rand() * 2);
          ctx.lineTo(x0 + dx + sw - 1 - rand() * 2, y0 + rh - 2 - rand() * 2);
          ctx.lineTo(x0 + dx + 1 + rand() * 2, y0 + rh - 1 - rand() * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x0 + dx + 3, y0 + 2, sw - 7, 2); // aresta de cima iluminada
        }
        x0 += sw;
      }
      y0 += rh;
    }
    const img = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) { const n = (rand() - 0.5) * 26; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 30; i++) {
      const cx = rand() * w, cy = rand() * h;
      ctx.fillStyle = `rgba(${40 + rand() * 30},${70 + rand() * 30},${25 + rand() * 20},${0.2 + rand() * 0.3})`;
      ctx.fillRect(cx, cy, 2 + rand() * 8, 6 + rand() * 28);
    }
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(0.3, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,60,20,0.25)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  const stoneMat = new THREE.MeshLambertMaterial({ map: stoneTex, side: THREE.DoubleSide });
  stoneTex.repeat.set(1, 1);
  const capTex = canvasTexture(32, 32, (ctx, w, h) => { noise(ctx, w, h, '#a9a69c', 0.3, 300, rand, 1); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, 1, h); });
  const capMat = new THREE.MeshLambertMaterial({ map: capTex, side: THREE.DoubleSide });
  // Barranco: é o chão que passa mais perto da câmera, então leva a textura cheia (capim, terra, pedra e folha).
  const bankMaps = groundTextures(77, { leaves: 0.6 });
  const bankMat = new THREE.MeshLambertMaterial({ ...bankMaps, color: 0x6f7f5a, side: THREE.DoubleSide });
  for (const S of sides) {
    const sd = S.sd;
    // Face do muro (com leve inclinação) e topo
    strip((j) => [[sd * W, Y[j] - 0.1], [sd * (W + 0.25), Y[j] + S.wallH[j]]], stoneMat, { uScale: 3, vScale: 3 });
    strip((j) => [[sd * (W + 0.25), Y[j] + S.wallH[j]], [sd * (W + 0.8), Y[j] + S.wallH[j]], [sd * (W + 0.8), S.backY[j]]], capMat, { uScale: 2, vScale: 1 });
    // Barranco até o relevo
    strip((j) => {
      const sec = [];
      for (let k = 0; k <= 5; k++) {
        const t = k / 5, o = W + 0.8 + (S.off[j] - W - 0.8) * t;
        sec.push([sd * o, mix(S.backY[j], S.endH[j], smoothstep(0, 1, t)) - (k === 0 ? 0.02 : 0)]);
      }
      return sec;
    }, bankMat, { uScale: 8, vScale: 8 });
  }

  // Marcas de pneu nos grampos
  {
    const marks = new THREE.MeshBasicMaterial({
      map: tireMarksTexture(41), transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    const bent = (j) => Math.abs(curv[j]) > 1 / 60;
    const pos = [], uv = [], idx = [];
    for (let jj = 0; jj <= N; jj++) {
      const j = jj % N;
      for (const [o, u] of [[-6, 0], [6, 1]]) { pos.push(x[j] + nx[j] * o, Y[j] + 0.035, z[j] + nz[j] * o); uv.push(u, (jj * ds) / 16); }
      if (jj < N && (bent(j) || bent((j + 1) % N))) { const a = jj * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    add(new THREE.Mesh(geo, marks));
  }

  // --- Grampos: detectados pela curvatura (curva longa que vira mais de ~130°) ----------------------------------
  const hairpins = [];
  {
    let j = 0;
    while (j < N) {
      if (Math.abs(curv[j]) < 1 / 45) { j++; continue; }
      let turn = 0, peak = 0, apex = j, k = j, gap = 0;
      const sign = Math.sign(curv[j]);
      while (k < j + N && gap < 8) {
        const c = curv[k % N];
        if (Math.sign(c) === sign && Math.abs(c) > 1 / 70) { turn += c * ds; gap = 0; if (Math.abs(c) > peak) { peak = Math.abs(c); apex = k % N; } } else gap++;
        k++;
      }
      if (Math.abs(turn) > 2.3) hairpins.push({ apex, start: j, sign, radius: 1 / peak });
      j = k;
    }
  }

  // Setas (矢羽根) no lado de fora dos grampos, espelhos de curva e placas numeradas antes de cada um
  const postMat = new THREE.MeshLambertMaterial({ color: 0x9a9c98 });
  const chevronTex = canvasTexture(32, 32, (ctx, w, h) => {
    ctx.fillStyle = '#f2f2ee'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d0202a';
    ctx.beginPath(); ctx.moveTo(8, 4); ctx.lineTo(18, 4); ctx.lineTo(28, 16); ctx.lineTo(18, 28); ctx.lineTo(8, 28); ctx.lineTo(18, 16); ctx.fill();
  }, { repeat: false, nearest: true });
  const chevronMats = [1, -1].map((dir) => {
    const t = chevronTex.clone();
    t.needsUpdate = true;
    if (dir < 0) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; }
    return new THREE.MeshLambertMaterial({ map: t, emissive: 0x333333, emissiveMap: t });
  });
  const chevronGeo = new THREE.PlaneGeometry(0.9, 0.9);
  const mirrorMat = new THREE.MeshPhongMaterial({ color: 0x8fa3b8, specular: 0xffffff, shininess: 90 });
  const mirrorRim = new THREE.MeshLambertMaterial({ color: 0xe86a1a });
  const numberTex = (n, total) => canvasTexture(64, 96, (ctx, w, h) => {
    ctx.fillStyle = '#f4f4ee'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1d3f9a'; ctx.lineWidth = 4; ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = '#1d3f9a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 40px Arial, sans-serif'; ctx.fillText(String(n), w / 2, 36);
    ctx.font = '700 13px Arial, sans-serif'; ctx.fillText(`/ ${total}`, w / 2, 60);
    ctx.font = `700 11px ${JP_FONT}`; ctx.fillText('ヘアピン', w / 2, 80);
  }, { repeat: false });
  const warnTex = (dir) => canvasTexture(64, 64, (ctx, w) => {
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = '#f2c21c'; ctx.beginPath(); ctx.moveTo(32, 2); ctx.lineTo(62, 32); ctx.lineTo(32, 62); ctx.lineTo(2, 32); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); if (dir < 0) { ctx.translate(64, 0); ctx.scale(-1, 1); }
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(22, 50); ctx.lineTo(22, 26); ctx.quadraticCurveTo(22, 14, 32, 14); ctx.quadraticCurveTo(42, 14, 42, 26); ctx.lineTo(42, 34); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(34, 32); ctx.lineTo(42, 44); ctx.lineTo(50, 32); ctx.fill();
    ctx.restore();
  }, { repeat: false });
  // Placa de frente para quem vem, num poste sobre o muro
  function roadSign(j, sd, map, w, h, height, off = W + 0.5) {
    const px = x[j] + nx[j] * sd * off, pz = z[j] + nz[j] * sd * off, base = profileY(j, sd * off);
    const face = add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map, transparent: true, alphaTest: 0.5, emissive: 0x222222, emissiveMap: map })));
    face.position.set(px, base + height, pz);
    face.lookAt(px - tx[j], base + height, pz - tz[j]);
    const back = add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), postMat));
    back.position.copy(face.position).addScaledVector(new THREE.Vector3(tx[j], 0, tz[j]), 0.02);
    back.lookAt(px + tx[j] * 2, base + height, pz + tz[j] * 2);
    const post = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, height, 6), postMat));
    post.position.set(px, base + height / 2, pz);
  }
  hairpins.forEach((hp, n) => {
    const outer = -hp.sign;
    const span = Math.round((hp.radius * Math.PI) / ds);
    for (let q = -span / 2; q <= span / 2; q += 3) {
      const j = (hp.apex + Math.round(q) + N) % N, off = W + 0.35;
      const px = x[j] + nx[j] * outer * off, pz = z[j] + nz[j] * outer * off, base = profileY(j, outer * off);
      const m = add(new THREE.Mesh(chevronGeo, chevronMats[outer > 0 ? 0 : 1]));
      m.position.set(px, base + 1.0, pz);
      m.lookAt(x[j], base + 1.0, z[j]);
      const post = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), postMat));
      post.position.set(px - nx[j] * outer * 0.05, base + 0.5, pz - nz[j] * outer * 0.05);
    }
    // Espelho de curva laranja no ápice
    {
      const j = hp.apex, off = W + 0.9;
      const px = x[j] + nx[j] * outer * off, pz = z[j] + nz[j] * outer * off, base = profileY(j, outer * off);
      const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), mirrorRim));
      pole.position.set(px, base + 1.6, pz);
      for (const turn of [-0.7, 0.7]) {
        const dirx = -nx[j] * outer * Math.cos(turn) + tx[j] * Math.sin(turn), dirz = -nz[j] * outer * Math.cos(turn) + tz[j] * Math.sin(turn);
        const rim = add(new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.08, 16), mirrorRim));
        rim.position.set(px + dirx * 0.1, base + 3.3, pz + dirz * 0.1);
        rim.lookAt(px + dirx * 5, base + 3.3, pz + dirz * 5); rim.rotateX(Math.PI / 2);
        const glass = add(new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), mirrorMat));
        glass.position.set(px + dirx * 0.15, base + 3.3, pz + dirz * 0.15);
        glass.lookAt(px + dirx * 5, base + 3.3, pz + dirz * 5);
      }
    }
    // Placa numerada e aviso de grampo antes da entrada
    const before = (hp.start - Math.round(45 / ds) + N) % N;
    roadSign(before, 1, numberTex(n + 1, hairpins.length), 0.7, 1.05, 2.0);
    roadSign((before + 6) % N, 1, warnTex(hp.sign), 0.85, 0.85, 2.2);
  });

  // Pintura no asfalto antes do primeiro grampo
  if (hairpins.length) {
    const wordMat = new THREE.MeshLambertMaterial({ map: roadWordTexture('減速'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const j = (hairpins[0].start - Math.round(28 / ds) + N) % N;
    for (const lane of [3.4, -3.4]) {
      const m = add(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.4), wordMat));
      m.position.set(x[j] + nx[j] * lane, Y[j] + 0.04, z[j] + nz[j] * lane);
      // Deitada no asfalto, inclinada com a rampa, com o topo do texto para a frente
      m.rotation.order = 'YXZ';
      m.rotation.set(-Math.PI / 2 + Math.atan(track.grade[j]), Math.atan2(tx[j], tz[j]) + Math.PI, 0);
    }
  }

  // Delineadores brancos com olho-de-gato sobre a mureta do lado do vale
  {
    const geo = new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6); geo.translate(0, 0.45, 0);
    const eyeGeo = new THREE.BoxGeometry(0.08, 0.1, 0.03);
    const spots = [], eyes = [];
    for (const S of sides) for (let s = 0; s < track.length; s += 8) {
      const j = at(s);
      if (S.wallH[j] > 1.1) continue;
      const off = W + 0.5, px = x[j] + nx[j] * S.sd * off, pz = z[j] + nz[j] * S.sd * off;
      spots.push([px, Y[j] + S.wallH[j], pz]);
      eyes.push([px - nx[j] * S.sd * 0.06, Y[j] + S.wallH[j] + 0.78, pz - nz[j] * S.sd * 0.06, Math.atan2(nx[j], nz[j])]);
    }
    const posts = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xe8e8e2 }), spots.length);
    const eyeMesh = new THREE.InstancedMesh(eyeGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.7, 0.15) }), eyes.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    spots.forEach(([px, py, pz], i) => posts.setMatrixAt(i, m4.makeTranslation(px, py, pz)));
    eyes.forEach(([px, py, pz, yaw], i) => eyeMesh.setMatrixAt(i, m4.compose(p.set(px, py, pz), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw), one)));
    add(posts); add(eyeMesh);
  }

  // --- Árvores: cedros cobrindo a encosta, bordos (momiji) junto da estrada --------------------------------------
  const cedarBase = [], mapleBase = [], bushBase = [];
  let cedarField, mapleField, bushField;
  {
    const cedars = [], maples = [];
    const roadClear = (px, pz, gap) => {
      const j = nearest(px, pz);
      return Math.hypot(px - x[j], pz - z[j]) > W + gap;
    };
    for (let i = 0; i < 30000 && cedars.length < 3800; i++) {
      const px = CX - 850 + rand() * 1700, pz = CZ - 350 - 850 + rand() * 1700;
      const dense = fbm(px * 0.01 + 3, pz * 0.01 - 5, 3);
      if (dense < 0.36) continue;
      const nearRoad = px > minX - 45 && px < maxX + 45 && pz > minZ - 45 && pz < maxZ + 45;
      if (nearRoad && !roadClear(px, pz, 3.5)) continue;
      const h = nearRoad ? groundAt(px, pz) : hillAt(px, pz);
      if (h < LAKE_Y + 1.5) continue;
      cedars.push([px, pz, 0.8 + rand() * 0.7, h]);
    }
    for (let s = 0; s < track.length; s += 6) {
      const j = at(s);
      for (const sd of [1, -1]) {
        if (rand() < 0.35) continue;
        const o = sd * (W + 6 + rand() * 26), px = x[j] + nx[j] * o, pz = z[j] + nz[j] * o;
        if (!roadClear(px, pz, 5)) continue;
        cedars.push([px, pz, 0.7 + rand() * 0.6, groundAt(px, pz)]);
      }
    }
    for (let s = 0; s < track.length; s += 5) {
      const j = at(s);
      for (const sd of [1, -1]) {
        if (rand() < 0.45) continue;
        const o = sd * (W + 3 + rand() * 14), px = x[j] + nx[j] * o, pz = z[j] + nz[j] * o;
        if (!roadClear(px, pz, 2.5)) continue;
        maples.push([px, pz, 0.7 + rand() * 0.6, groundAt(px, pz)]);
      }
    }
    cedarField = buildTreeField({
      kind: 'cedar', rand, trunkColor: 0x4a3222,
      items: cedars.map(([px, pz, k, h]) => [px, h - 0.4, pz, k]),
    });
    cedars.forEach(() => cedarBase.push(0.75 + rand() * 0.5));
    add(cedarField.group);

    mapleField = buildTreeField({
      kind: 'broadleaf', rand, trunkColor: 0x3e3026,
      items: maples.map(([px, pz, k, h]) => [px, h - 0.2, pz, k]),
    });
    maples.forEach(() => mapleBase.push([rand(), 0.8 + rand() * 0.4]));
    add(mapleField.group);

    // Mato rasteiro logo depois do muro e da mureta: o que passa mais perto da câmera.
    const bushes = [];
    for (let s = 0; s < track.length; s += 3) {
      const j = at(s);
      for (const sd of [1, -1]) {
        if (rand() < 0.45) continue;
        const o = sd * (W + 1.4 + rand() * 4), px = x[j] + nx[j] * o, pz = z[j] + nz[j] * o;
        if (!roadClear(px, pz, 1.2)) continue;
        bushes.push([px, groundAt(px, pz) - 0.15, pz, 0.7 + rand() * 0.9]);
      }
    }
    // Capim no pé do muro e matacões saindo do barranco: detalhe bem perto da câmera.
    const tufts = [], rocks = [];
    for (let s2 = 0; s2 < track.length; s2 += 1.5) {
      const j = at(s2);
      for (const sd of [1, -1]) {
        if (rand() < 0.4) continue;
        const o = sd * (W + 0.3 + rand() * 2), px = x[j] + nx[j] * o, pz = z[j] + nz[j] * o;
        if (!roadClear(px, pz, 0.25)) continue;
        tufts.push([px, groundAt(px, pz) - 0.05, pz, 0.6 + rand() * 0.7]);
      }
    }
    add(buildTufts({ items: tufts, rand }));
    for (let s2 = 0; s2 < track.length; s2 += 9) {
      const j = at(s2);
      const sd = rand() < 0.5 ? 1 : -1;
      const o = sd * (W + 2.5 + rand() * 7), px = x[j] + nx[j] * o, pz = z[j] + nz[j] * o;
      if (!roadClear(px, pz, 2)) continue;
      rocks.push([px, groundAt(px, pz) - 0.3 - rand() * 0.3, pz, 0.6 + rand() * 1.3]);
    }
    add(buildRocks({ items: rocks, rand }));

    bushField = buildUndergrowth({ items: bushes, rand });
    bushes.forEach(() => bushBase.push(0.9 + rand() * 0.7));
    add(bushField.group);
  }
  const recolorTrees = () => {
    const c = new THREE.Color();
    cedarBase.forEach((k, i) => cedarField.setColor(i, c.setRGB(T.cedar[0] * k, T.cedar[1] * k, T.cedar[2] * k)));
    mapleBase.forEach(([pick, k], i) => {
      const base = T.maples[Math.floor(pick * T.maples.length)];
      mapleField.setColor(i, c.setRGB(base[0] * k, base[1] * k, base[2] * k));
    });
    // O mato segue a cor dos cedros, um tom mais claro e amarelado.
    bushBase.forEach((k, i) => bushField.setColor(i, c.setRGB(T.cedar[0] * k * 1.5, T.cedar[1] * k * 1.25, T.cedar[2] * k * 0.9)));
    cedarField.applyColors();
    mapleField.applyColors();
    bushField.applyColors();
  };

  // --- Largada no alto: pórtico com faixa, casa de chá (茶屋) e máquinas de refrigerante --------------------------
  const lamps = [];
  const nightGroup = new THREE.Group();
  root.add(nightGroup);
  {
    // Faixa quadriculada no asfalto
    const checker = canvasTexture(64, 8, (ctx, w, h) => {
      for (let i = 0; i < 16; i++) for (let k = 0; k < 2; k++) { ctx.fillStyle = (i + k) % 2 ? '#111' : '#eee'; ctx.fillRect(i * 4, k * 4, 4, 4); }
    }, { repeat: false, nearest: true });
    const line = add(new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, 1.4), new THREE.MeshLambertMaterial({ map: checker, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })));
    line.position.set(x[0], Y[0] + 0.04, z[0]);
    line.rotation.order = 'YXZ';
    line.rotation.set(-Math.PI / 2 + Math.atan(track.grade[0]), Math.atan2(tx[0], tz[0]) + Math.PI, 0);

    const banner = canvasTexture(512, 64, (ctx, w, h) => {
      ctx.fillStyle = '#b3141e'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f4efe0'; ctx.fillRect(0, 4, w, 3); ctx.fillRect(0, h - 7, w, 3);
      ctx.font = `900 34px ${JP_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('箱根峠 ダウンヒル', w / 2, h / 2 + 1);
    }, { repeat: false });
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2c2e });
    const gate = new THREE.Group();
    gate.position.set(x[0], Y[0], z[0]);
    gate.rotation.y = Math.atan2(tx[0], tz[0]);
    for (const sd of [1, -1]) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6.4, 0.3), poleMat);
      pole.position.set(sd * (W - 0.4), 3.2, 0);
      gate.add(pole);
    }
    const face = new THREE.Mesh(new THREE.BoxGeometry((W - 0.4) * 2, 1.2, 0.12), [poleMat, poleMat, poleMat, poleMat, new THREE.MeshLambertMaterial({ map: banner, emissive: 0x331010 }), new THREE.MeshLambertMaterial({ map: banner, emissive: 0x331010 })]);
    face.position.set(0, 5.6, 0);
    gate.add(face);
    add(gate);

    // Casa de chá e refrigerantes do lado de mais espaço (menos muro)
    const js = Math.round(30 / ds);
    const sd = sides[0].wallH[js] < sides[1].wallH[js] ? 1 : -1;
    const off = W + 7;
    const px = x[js] + nx[js] * sd * off, pz = z[js] + nz[js] * sd * off, base = profileY(js, sd * (W + 1));
    const yaw = Math.atan2(-nx[js] * sd, -nz[js] * sd); // frente para a estrada
    const hut = new THREE.Group();
    hut.position.set(px, base, pz);
    hut.rotation.y = yaw;
    const wallTex = canvasTexture(128, 64, (ctx, w, h) => {
      noise(ctx, w, h, '#5a4330', 0.2, 500, rand, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; for (let x0 = 0; x0 < w; x0 += 6) ctx.fillRect(x0, 0, 1, h);
      ctx.fillStyle = '#e9dfc6'; ctx.fillRect(14, 16, 40, 26); ctx.fillRect(74, 16, 40, 26);
      ctx.fillStyle = 'rgba(90,60,30,0.5)'; for (let gx = 14; gx < 54; gx += 8) { ctx.fillRect(gx, 16, 1, 26); ctx.fillRect(gx + 60, 16, 1, 26); }
    });
    const hutWall = new THREE.MeshLambertMaterial({ map: wallTex, emissiveMap: wallTex, emissive: 0x000000 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(8, 9, 5.5), hutWall);
    body.position.y = -1.5; hut.add(body); // afunda no barranco
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.2, 2.4, 4), new THREE.MeshLambertMaterial({ color: 0x3a3f46 }));
    roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.72); roof.position.y = 4.2; hut.add(roof);
    const noren = canvasTexture(128, 48, (ctx, w, h) => {
      ctx.fillStyle = '#1f2c55'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f2f2ee'; for (let x0 = 0; x0 < w; x0 += 32) ctx.fillRect(x0 + 31, 18, 1, h);
      ctx.font = `900 26px ${JP_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('茶 屋', w / 2, 16);
    }, { repeat: false });
    const nr = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), new THREE.MeshLambertMaterial({ map: noren, side: THREE.DoubleSide }));
    nr.position.set(0, 2.1, 2.8); hut.add(nr);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.6, 0.2) }));
    lantern.position.set(2.4, 2.6, 2.95); hut.add(lantern);
    const bodyGeo = new THREE.BoxGeometry(0.9, 1.8, 0.7);
    for (const vx of [-2.6, -1.6]) {
      const b = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xd8dde2 })); b.position.set(vx, 0.9, 3.2); hut.add(b);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.7), new THREE.MeshBasicMaterial({ map: vendingTexture(rand), color: new THREE.Color(1.2, 1.2, 1.2) }));
      f.position.set(vx, 0.9, 3.56); hut.add(f);
    }
    add(hut);
    hut.updateMatrixWorld(true);
    lamps.push({ position: new THREE.Vector3(2.4, 2.6, 3.4).applyMatrix4(hut.matrixWorld), color: new THREE.Color(0xff9a50), night: false });
  }

  // --- Postes de sódio: no lado de fora dos grampos e espaçados no resto (só à noite) ------------------------------
  {
    const glow = glowTexture();
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x7c7d78 });
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 7, 6); poleGeo.translate(0, 3.5, 0);
    const spots = hairpins.map((hp) => [hp.apex, -hp.sign]);
    for (let s = 40; s < track.length; s += 70) {
      const j = at(s);
      if (hairpins.some((hp) => Math.min(Math.abs(hp.apex - j), N - Math.abs(hp.apex - j)) * ds < 40)) continue;
      spots.push([j, j % 2 ? 1 : -1]);
    }
    for (const [j, sd] of spots) {
      const off = W + 1.2, px = x[j] + nx[j] * sd * off, pz = z[j] + nz[j] * sd * off, base = profileY(j, sd * off);
      const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(px, base, pz); nightGroup.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.2), poleMat);
      const hx = px - nx[j] * sd * 1.6, hz = pz - nz[j] * sd * 1.6;
      arm.position.set((px + hx) / 2, base + 6.9, (pz + hz) / 2); arm.lookAt(hx, base + 6.9, hz); nightGroup.add(arm);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa040).multiplyScalar(2) }));
      head.position.set(hx, base + 6.8, hz); nightGroup.add(head);
      const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      flare.position.set(hx, base + 6.7, hz); flare.scale.setScalar(2.6); nightGroup.add(flare);
      lamps.push({ position: new THREE.Vector3(hx, base + 6.5, hz), color: new THREE.Color(0xffa040), night: true });
    }
  }

  mergeStatic(nightGroup);
  nightGroup.userData.dynamic = true;
  mergeStatic(root);

  const atmosphere = { headlights: true };
  const dayLamps = lamps.filter((l) => !l.night);
  const world = {
    root,
    atmosphere,
    time: null,
    hairpins: hairpins.length,
    get lamps() { return T.roadLamps ? lamps : dayLamps; },
    setTime(id) {
      T = HAKONE_THEMES[id] || HAKONE_THEMES.neblina;
      world.time = HAKONE_THEMES[id] ? id : 'neblina';
      scene.fog = fog;
      fog.color.copy(T.fog[0]); fog.density = T.fog[1];
      hemi.color.setHex(T.hemi[0]); hemi.groundColor.setHex(T.hemi[1]); hemi.intensity = T.hemi[2];
      sun.color.setHex(T.light.color); sun.intensity = T.light.intensity; sun.position.copy(T.light.dir).multiplyScalar(400);
      const S = T.sky;
      skyUniforms.sunDir.value.copy(S.dir);
      for (const k of ['zenith', 'away', 'toward']) skyUniforms[k].value = S[k];
      skyUniforms.cover.value = S.cover; skyUniforms.glowCol.value = S.glow; skyUniforms.discCol.value = S.disc; skyUniforms.discSize.value = S.discSize;
      stars.visible = !!S.stars;
      recolorRings();
      recolorTrees();
      terrainMat.color.setHex(T.ground);
      bankMat.color.setHex(0x6f7f5a).multiply(new THREE.Color(T.ground));
      stoneMat.color.setScalar(T.stoneWet);
      lakeMat.color.setHex(T.lake);
      cloudUniforms.uColor.value.copy(T.cloudSea[0]); cloudUniforms.uAlpha.value = T.cloudSea[1];
      nightGroup.visible = !!T.roadLamps;
      Object.assign(atmosphere, {
        mist: T.mist, mistColor: T.mistColor, mistDensity: T.mistDensity, mistFalloff: T.mistFalloff, mistBase: T.mistBase, lampIntensity: T.lampIntensity,
      });
    },
    setEnvMap() {},
    update(t, camera) {
      skyUniforms.uTime.value = t;
      cloudUniforms.uTime.value = t;
      if (camera) {
        sky.position.set(camera.position.x, camera.position.y, camera.position.z);
        backdrop.position.set(camera.position.x, 0, camera.position.z);
      }
    },
    dispose: () => disposeTree(root),
  };
  world.setTime(time);
  return world;
}
