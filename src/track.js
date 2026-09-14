// Pista: spline Catmull-Rom centrípeta fechada, reamostrada por comprimento de arco.
// Módulo puro (sem three.js) para poder ser testado no Node.

export const ROAD_HALF_WIDTH = 7;     // rua de 14 m
export const SIDEWALK_WIDTH = 2.2;
// Face interna das muretas, medida do eixo da rua (logo depois da calçada).
export const WALL_OFFSET = ROAD_HALF_WIDTH + SIDEWALK_WIDTH;

// Circuito de rua (~860 m) por quarteirões: retas e esquinas de 90° arredondadas.
// Os pares de pontos perto de cada esquina controlam o raio. Plano XZ, metros, sentido de corrida.
const SCALE = 0.85;
export const TRACK_POINTS = [
  [0, -100], [0, 100], [3, 122], [22, 140], [118, 140], [137, 122], [140, 100], [140, 45], [132, 27],
  [112, 20], [92, 17], [74, 5], [70, -15], [70, -55], [78, -75], [98, -80], [158, -80], [176, -90],
  [180, -110], [180, -135], [170, -155], [150, -160], [25, -160], [5, -150], [0, -130],
].map(([px, pz]) => [px * SCALE, pz * SCALE]);

// Estrada do interior ao pé do Fuji (~1,3 km): reta longa entre arrozais, curvas abertas pela vila,
// grampo no morro, descida em "S" e reta ao lado da ferrovia.
export const FUJIMI_POINTS = [
  [0, -90], [0, 150], [5, 180], [30, 200], [70, 205], [120, 200], [150, 215], [175, 245], [185, 275], [210, 292],
  [235, 282], [242, 255], [238, 200], [250, 150], [265, 90], [258, 40], [228, 10], [215, -30], [232, -72], [240, -110],
  [218, -150], [170, -162], [80, -160], [42, -155], [15, -140], [0, -115],
];

// Serra estilo Hakone (~1,5 km, [x, z, altura]): largada no alto, curva de encosta, sequência de grampos
// descendo a encosta em zigue-zague, reta do vale e subida sinuosa de volta. A altura é interpolada ao longo da pista.
export const HAKONE_POINTS = [
  [-60, 0, 46], [80, 0, 43.2],
  [108, -6, 42.1], [124, -30, 40.8], [117, -57, 39.4], [88, -72, 37.9],
  [14, -72, 34.4],
  [-8.5, -81, 33.2], [-8.5, -113, 31.7], [14, -122, 30.5],
  [110, -122, 26],
  [132.5, -131, 24.9], [132.5, -163, 23.3], [110, -172, 22.1],
  [14, -172, 17.6],
  [-8.5, -181, 16.4], [-8.5, -213, 14.9], [14, -222, 13.7],
  [110, -222, 9.2],
  [155.2, -233.2, 7], [155.2, -266.8, 5.4], [130, -278, 4],
  [-50, -278, 9],
  [-84, -262, 13.2], [-94, -223, 17.8], [-78, -175, 23.2], [-98, -125, 29.1], [-80, -75, 35.1], [-94, -34, 39.9], [-86, -8, 42.9],
];

function catmullRom(p0, p1, p2, p3, t) {
  // Formulação de Barry-Goldman com alpha = 0.5 (centrípeta: sem laços nem cúspides).
  const knot = (a, b) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1e-4;
  const t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
  const tt = t1 + (t2 - t1) * t;
  const mix = (a, b, ta, tb) => {
    const w = (tt - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
  };
  const A1 = mix(p0, p1, t0, t1), A2 = mix(p1, p2, t1, t2), A3 = mix(p2, p3, t2, t3);
  const B1 = mix(A1, A2, t0, t2), B2 = mix(A2, A3, t1, t3);
  return mix(B1, B2, t1, t2);
}

export function buildTrack(points = TRACK_POINTS, spacing = 2) {
  const n = points.length;
  const dense = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
    for (let k = 0; k < 60; k++) dense.push(catmullRom(p0, p1, p2, p3, k / 60));
  }

  const cum = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1], b = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const length = cum[dense.length];
  const N = Math.round(length / spacing);
  const ds = length / N;

  const x = new Float32Array(N), z = new Float32Array(N);
  let seg = 0;
  for (let j = 0; j < N; j++) {
    const s = j * ds;
    while (cum[seg + 1] < s) seg++;
    const a = dense[seg], b = dense[(seg + 1) % dense.length];
    const w = (s - cum[seg]) / (cum[seg + 1] - cum[seg]);
    x[j] = a[0] + (b[0] - a[0]) * w;
    z[j] = a[1] + (b[1] - a[1]) * w;
  }

  const tx = new Float32Array(N), tz = new Float32Array(N);
  const nx = new Float32Array(N), nz = new Float32Array(N);
  for (let j = 0; j < N; j++) {
    const p = (j - 1 + N) % N, q = (j + 1) % N;
    const dx = x[q] - x[p], dz = z[q] - z[p], l = Math.hypot(dx, dz);
    tx[j] = dx / l; tz[j] = dz / l;
    // "Esquerda" de quem anda para frente (Y para cima): (tz, -tx).
    nx[j] = tz[j]; nz[j] = -tx[j];
  }

  // Curvatura com sinal (positiva = curva à esquerda), suavizada.
  const raw = new Float32Array(N);
  for (let j = 0; j < N; j++) {
    const q = (j + 1) % N;
    const cross = tx[j] * tz[q] - tz[j] * tx[q];
    const dot = tx[j] * tx[q] + tz[j] * tz[q];
    raw[j] = -Math.atan2(cross, dot) / ds;
  }
  const curv = new Float32Array(N);
  const R = 4;
  for (let j = 0; j < N; j++) {
    let sum = 0;
    for (let k = -R; k <= R; k++) sum += raw[(j + k + N) % N];
    curv[j] = sum / (2 * R + 1);
  }

  const track = { N, length, ds, x, z, tx, tz, nx, nz, curv };
  if (points.some((p) => p.length > 2)) addElevation(track, points);
  return track;
}

// Altura por amostra (track.y) e rampa (track.grade, dy/ds no sentido da corrida): as alturas dos pontos de controle
// são ligadas em linha reta ao longo da pista e suavizadas (janela de ~24 m) para a rampa não mudar de golpe.
function addElevation(track, points) {
  const { N, ds } = track;
  const keys = points.map((p) => ({ j: nearestIndex(track, p[0], p[1]), y: p[2] ?? 0 })).sort((a, b) => a.j - b.j);
  const raw = new Float32Array(N);
  for (let k = 0; k < keys.length; k++) {
    const a = keys[k], b = keys[(k + 1) % keys.length];
    const span = (b.j - a.j + N) % N || N;
    for (let i = 0; i < span; i++) raw[(a.j + i) % N] = a.y + (b.y - a.y) * (i / span);
  }
  const y = new Float32Array(N), grade = new Float32Array(N);
  const R = 6;
  for (let j = 0; j < N; j++) {
    let sum = 0;
    for (let k = -R; k <= R; k++) sum += raw[(j + k + N) % N];
    y[j] = sum / (2 * R + 1);
  }
  for (let j = 0; j < N; j++) grade[j] = (y[(j + 1) % N] - y[(j - 1 + N) % N]) / (2 * ds);
  track.y = y;
  track.grade = grade;
}

// Altura do chão da pista no ponto (px, pz), perto da amostra idx. Pistas planas: 0.
export function groundAt(track, idx, px, pz) {
  if (!track.y) return 0;
  const along = (px - track.x[idx]) * track.tx[idx] + (pz - track.z[idx]) * track.tz[idx];
  return track.y[idx] + along * track.grade[idx];
}

// Altura, inclinação do bico (pitch, + = subindo) e aceleração da gravidade na rampa (gx, gz) do carro.
export function followGround(c, track, idx) {
  if (!track.y) { c.y = 0; c.pitch = 0; c.gx = 0; c.gz = 0; return; }
  const g = track.grade[idx], tx = track.tx[idx], tz = track.tz[idx];
  c.y = groundAt(track, idx, c.x, c.z);
  c.pitch = Math.atan(g * (Math.sin(c.yaw) * tx + Math.cos(c.yaw) * tz));
  const a = (-9.81 * g) / Math.sqrt(1 + g * g);
  c.gx = a * tx;
  c.gz = a * tz;
}

// Índice da amostra mais próxima. Com `hint` busca só na vizinhança (O(1) por frame).
export function nearestIndex(track, px, pz, hint = -1, window = 40) {
  const { N, x, z } = track;
  let best = 0, bestD = Infinity;
  const scan = (j) => {
    const d = (x[j] - px) ** 2 + (z[j] - pz) ** 2;
    if (d < bestD) { bestD = d; best = j; }
  };
  if (hint < 0) for (let j = 0; j < N; j++) scan(j);
  else for (let k = -window; k <= window; k++) scan((hint + k + N) % N);
  if (hint >= 0 && bestD > 40 * 40) return nearestIndex(track, px, pz, -1);
  return best;
}

// Distância lateral (com sinal, positiva = esquerda) em relação à amostra `idx`.
export function lateralOffset(track, idx, px, pz) {
  return (px - track.x[idx]) * track.nx[idx] + (pz - track.z[idx]) * track.nz[idx];
}

export function surfaceAt(lateral) {
  const a = Math.abs(lateral);
  if (a <= ROAD_HALF_WIDTH) return SURFACES.asphalt;
  if (a <= WALL_OFFSET + 0.5) return SURFACES.sidewalk;
  return SURFACES.offroad; // só acontece se algo atravessar a mureta
}

// Superfície sob cada eixo do carro (frente = +a, trás = -b ao longo do yaw).
export function carSurfaces(track, car, idx, a, b) {
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  const latF = lateralOffset(track, idx, car.x + fx * a, car.z + fz * a);
  const latR = lateralOffset(track, idx, car.x - fx * b, car.z - fz * b);
  return [surfaceAt(latF), surfaceAt(latR)];
}

export const SURFACES = {
  asphalt: { name: 'asphalt', grip: 1.0, roll: 0.015 },
  sidewalk: { name: 'sidewalk', grip: 0.85, roll: 0.04 },
  offroad: { name: 'offroad', grip: 0.55, roll: 0.09 },
};
