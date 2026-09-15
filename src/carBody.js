// Lataria por linhas de desenho: em cada z a meia seção passa por pontos de controle que vêm de curvas
// ao longo do comprimento (como numa planta de carro): centro de baixo, soleira, saia, ombro (linha de
// caráter), cintura (base dos vidros / borda do capô), calha do teto, borda interna da coluna e centro de
// cima. Entre os pontos, curvas de Hermite com vinco ajustável e "barriga" para fora.
// A mesma superfície vira pintura, vidro (para-brisa, vigia, janelas), borracha de vedação e acabamento
// preto conforme as zonas do design; caixas de roda e cockpit são recortados.
// Frente para +Z, esquerda para +X.
import * as THREE from 'three';

export const SPANS = ['bottom', 'lower', 'side', 'upper', 'glass', 'pillar', 'roof'];
// Índice g de cada ponto de controle na coordenada do contorno (g = vão + fração do comprimento do vão)
export const G = { bottomCenter: 0, rocker: 1, sill: 2, shoulder: 3, belt: 4, rail: 5, rail2: 6, topCenter: 7 };
const DEFAULT_COUNTS = { bottom: 3, lower: 3, side: 9, upper: 5, glass: 7, pillar: 2, roof: 13 };
const DEFAULT_SHARP = [0, 0.3, 0.15, 0.3, 0.7, 0.55, 0.2, 0];
const DENSE = 24;
const clamp = THREE.MathUtils.clamp;

// Interpolação cúbica monótona (PCHIP) de chaves [[z, v1, v2, ...]]: passa pelas chaves sem ondular.
class KeyCurve {
  constructor(keys) {
    if (typeof keys === 'number') keys = [[0, keys]];
    this.keys = [...keys].sort((a, b) => a[0] - b[0]);
    const K = this.keys, n = K.length, comps = K[0].length - 1;
    this.m = K.map(() => new Array(comps).fill(0));
    for (let c = 1; c <= comps; c++) {
      const h = [], d = [];
      for (let k = 0; k < n - 1; k++) { h.push(K[k + 1][0] - K[k][0]); d.push((K[k + 1][c] - K[k][c]) / (h[k] || 1)); }
      if (n < 2) continue;
      this.m[0][c - 1] = d[0];
      this.m[n - 1][c - 1] = d[n - 2];
      for (let k = 1; k < n - 1; k++) {
        if (d[k - 1] * d[k] <= 0) { this.m[k][c - 1] = 0; continue; }
        const w1 = 2 * h[k] + h[k - 1], w2 = h[k] + 2 * h[k - 1];
        this.m[k][c - 1] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k]);
      }
      // Pontas: tangente zero se contraria a direção (evita ultrapassar a chave)
      if (Math.sign(this.m[0][c - 1]) !== Math.sign(d[0])) this.m[0][c - 1] = 0;
      if (Math.sign(this.m[n - 1][c - 1]) !== Math.sign(d[n - 2])) this.m[n - 1][c - 1] = 0;
    }
  }

  at(zIn, out = []) {
    const K = this.keys, n = K.length, comps = K[0].length - 1;
    if (n === 1) { for (let c = 0; c < comps; c++) out[c] = K[0][c + 1]; return out; }
    const z = clamp(zIn, K[0][0], K[n - 1][0]);
    let i = 0;
    while (i < n - 2 && z > K[i + 1][0]) i++;
    const h = K[i + 1][0] - K[i][0], t = h ? (z - K[i][0]) / h : 0, t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    for (let c = 0; c < comps; c++) {
      out[c] = h00 * K[i][c + 1] + h10 * h * this.m[i][c] + h01 * K[i + 1][c + 1] + h11 * h * this.m[i + 1][c];
    }
    return out;
  }
}

const curve = (spec, fallback) => (spec === undefined ? fallback : new KeyCurve(spec));

export class CarBody {
  // spec: { bottom, rocker, sill?, shoulder, belt, rail, crown, pillar?, sharp?, bulge?, counts?,
  //         windshield?, rearGlass?, sideWindows?, roofTrim?, pillarTrim?, glassTrim? }
  constructor(spec) {
    this.spec = spec;
    this.L = {
      bottom: curve(spec.bottom), rocker: curve(spec.rocker), sill: curve(spec.sill, null),
      shoulder: curve(spec.shoulder), belt: curve(spec.belt), rail: curve(spec.rail), crown: curve(spec.crown),
      pillar: curve(spec.pillar ?? 0.05),
    };
    this.bulge = {};
    for (const s of SPANS) this.bulge[s] = curve(spec.bulge?.[s] ?? 0);
    this.sharp = spec.sharp ?? DEFAULT_SHARP;
    this.counts = { ...DEFAULT_COUNTS, ...spec.counts };
    const ends = [spec.belt, spec.shoulder, spec.crown].map((k) => [k[0][0], k[k.length - 1][0]]);
    this.zMin = spec.zMin ?? Math.min(...ends.map((e) => e[0]));
    this.zMax = spec.zMax ?? Math.max(...ends.map((e) => e[1]));
    this.cache = new Map();
  }

  // Pontos de controle da meia seção (+X) num z: [[x, y] × 8]
  controls(z) {
    const L = this.L, v = [];
    const [yBot] = L.bottom.at(z, v);
    const [xr, yr] = L.rocker.at(z, []);
    const [xsh, ysh] = L.shoulder.at(z, []);
    const sill = L.sill ? L.sill.at(z, []) : [xr + (xsh - xr) * 0.8, yr + (ysh - yr) * 0.3];
    const [xb, yb] = L.belt.at(z, []);
    const [xrl, yrl] = L.rail.at(z, []);
    const [yc] = L.crown.at(z, []);
    const [pw] = L.pillar.at(z, []);
    const dx = -xrl, dy = yc - yrl, len = Math.hypot(dx, dy) || 1;
    const k = Math.min(pw, len * 0.45) / len;
    return [[0, yBot], [xr, yr], sill, [xsh, ysh], [xb, yb], [xrl, yrl], [xrl + dx * k, yrl + dy * k], [0, yc]];
  }

  // Contorno denso de um z: para cada vão, DENSE+1 pontos igualmente espaçados no comprimento.
  contour(z) {
    const key = Math.round(z * 4000);
    let c = this.cache.get(key);
    if (c) return c;
    const P = this.controls(z);
    const mirror = (p) => [-p[0], p[1]];
    const at = (k) => (k < 0 ? mirror(P[1]) : k > 7 ? mirror(P[6]) : P[k]);
    const spans = [];
    for (let s = 0; s < 7; s++) {
      const p0 = P[s], p1 = P[s + 1];
      const chord = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const tangent = (k, len) => {
        const a = at(k - 1), b = at(k + 1);
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        const f = (1 - this.sharp[k]) * len;
        return [(dx / l) * f, (dy / l) * f];
      };
      const t0 = tangent(s, chord), t1 = tangent(s + 1, chord);
      const b = this.bulge[SPANS[s]].at(z, [])[0] * chord;
      const nx = chord ? (p1[1] - p0[1]) / chord : 0, ny = chord ? -(p1[0] - p0[0]) / chord : 0;
      const S = DENSE * 2;
      const raw = [];
      for (let i = 0; i <= S; i++) {
        const t = i / S, t2 = t * t, t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
        const bump = Math.sin(Math.PI * t) * b;
        raw.push([
          h00 * p0[0] + h10 * t0[0] + h01 * p1[0] + h11 * t1[0] + nx * bump,
          h00 * p0[1] + h10 * t0[1] + h01 * p1[1] + h11 * t1[1] + ny * bump,
        ]);
      }
      const acc = [0];
      for (let i = 1; i <= S; i++) acc.push(acc[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
      const total = acc[S];
      const pts = new Float64Array((DENSE + 1) * 2);
      let j = 0;
      for (let q = 0; q <= DENSE; q++) {
        const target = (total * q) / DENSE;
        while (j < S - 1 && acc[j + 1] < target) j++;
        const f = total ? clamp((target - acc[j]) / ((acc[j + 1] - acc[j]) || 1), 0, 1) : 0;
        pts[q * 2] = raw[j][0] + (raw[j + 1][0] - raw[j][0]) * f;
        pts[q * 2 + 1] = raw[j][1] + (raw[j + 1][1] - raw[j][1]) * f;
      }
      spans.push({ pts, length: total });
    }
    c = { z, P, spans };
    if (this.cache.size > 6000) this.cache.clear();
    this.cache.set(key, c);
    return c;
  }

  // Ponto [x, y] do contorno em g (0..7) num z
  point(z, g) {
    const c = this.contour(z);
    const s = clamp(Math.floor(g), 0, 6);
    const t = clamp(g - s, 0, 1) * DENSE;
    const i = Math.min(DENSE - 1, Math.floor(t)), f = t - i;
    const p = c.spans[s].pts;
    return [p[i * 2] + (p[i * 2 + 2] - p[i * 2]) * f, p[i * 2 + 1] + (p[i * 2 + 3] - p[i * 2 + 1]) * f];
  }

  // Normal para fora (2D, na seção) em g
  normal2(z, g) {
    const e = 0.02;
    const a = this.point(z, Math.max(0, g - e)), b = this.point(z, Math.min(7, g + e));
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [dy / l, -dx / l];
  }

  // Ponto 3D do lado side (+1 esquerda, -1 direita), afastado lift da superfície
  surface(z, g, side = 1, lift = 0) {
    const [x, y] = this.point(z, g);
    const [nx, ny] = this.normal2(z, g);
    return [side * (x + nx * lift), y + ny * lift, z];
  }

  // Largura da lateral numa altura y (o ponto mais para fora do contorno nessa altura)
  sideX(z, y) {
    const c = this.contour(z);
    let best = -1;
    for (let s = 1; s <= 5; s++) {
      const p = c.spans[s].pts;
      for (let i = 0; i < DENSE; i++) {
        const y0 = p[i * 2 + 1], y1 = p[i * 2 + 3];
        if ((y - y0) * (y - y1) > 0) continue;
        const f = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
        best = Math.max(best, p[i * 2] + (p[i * 2 + 2] - p[i * 2]) * f);
      }
    }
    if (best < 0) best = c.P[3][0];
    return best;
  }

  // Altura da superfície de cima numa posição lateral x
  topY(z, xIn) {
    const c = this.contour(z);
    const x = Math.abs(xIn);
    let best = -Infinity;
    for (let s = 3; s <= 6; s++) {
      const p = c.spans[s].pts;
      for (let i = 0; i < DENSE; i++) {
        const x0 = p[i * 2], x1 = p[i * 2 + 2];
        if ((x - x0) * (x - x1) > 0) continue;
        const f = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
        best = Math.max(best, p[i * 2 + 1] + (p[i * 2 + 3] - p[i * 2 + 1]) * f);
      }
    }
    return best === -Infinity ? c.P[4][1] : best;
  }

  // g onde o contorno cruza a altura y na lateral (para decalques e peças)
  gAtY(z, y, from = 1, to = 5) {
    const c = this.contour(z);
    let found = null, bestX = -1;
    for (let s = from; s < to; s++) {
      const p = c.spans[s].pts;
      for (let i = 0; i < DENSE; i++) {
        const y0 = p[i * 2 + 1], y1 = p[i * 2 + 3];
        if ((y - y0) * (y - y1) > 0) continue;
        const f = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
        const x = p[i * 2] + (p[i * 2 + 2] - p[i * 2]) * f;
        if (x > bestX) { bestX = x; found = s + (i + f) / DENSE; }
      }
    }
    return found ?? from + 0.5;
  }

  // --- Malha ------------------------------------------------------------------------------------
  // arch: { axles: [zF, zR], radius, centerY, wellX }
  // cockpit: { z0, z1, halfWidth, corner, floorY, cutY }
  build({ arch, cockpit = null }) {
    const spec = this.spec;
    const { zMin, zMax } = this;
    const counts = this.counts;

    // Coluna lógica: (vão, t). Vinco (sharp >= 0.5) duplica o vértice entre dois vãos.
    const cols = []; // { g, span, t, logical }
    let logical = 0;
    for (let s = 0; s < 7; s++) {
      const n = counts[SPANS[s]];
      for (let j = 0; j <= n; j++) {
        if (j === 0 && s > 0) {
          if (this.sharp[s] >= 0.5) cols.push({ g: s, span: s, t: 0, logical: logical - 1, crease: true });
          continue;
        }
        cols.push({ g: s + j / n, span: j === n && s < 6 ? s : s, t: j / n, logical: logical++ });
      }
    }
    // Anel completo: meia seção (+X) e o espelho (-X) sem os dois centros
    const H = cols.length;
    const ring = [...cols.map((c) => ({ ...c, side: 1 })), ...cols.slice(1, H - 1).reverse().map((c) => ({ ...c, side: -1 }))];
    const ringN = ring.length;

    // Linhas: espaçamento regular + zonas densas (rodas, pontas, vidros, cockpit)
    const raw = [];
    for (let z = zMin; z <= zMax; z += 0.055) raw.push(z);
    for (let k = 0; k <= 10; k++) {
      const u = 1 - Math.cos((k / 10) * (Math.PI / 2));
      raw.push(zMax - u * 0.35, zMin + u * 0.35);
    }
    raw.push(zMax);
    for (const zA of arch.axles) {
      for (let k = 0; k <= 32; k++) raw.push(zA + arch.radius * Math.cos((Math.PI * k) / 32));
      raw.push(zA + arch.radius + 0.012, zA - arch.radius - 0.012);
    }
    const edgeZ = [];
    for (const r of [spec.windshield, spec.rearGlass, ...(spec.roofTrim || []), ...(spec.pillarTrim || []), ...(spec.glassTrim || [])]) {
      if (r) edgeZ.push(r.z0, r.z1);
    }
    for (const w of spec.sideWindows || []) {
      edgeZ.push(w.z0b, w.z0t, w.z1b, w.z1t);
      for (let z = Math.min(w.z0b, w.z0t); z <= Math.max(w.z1b, w.z1t); z += 0.035) raw.push(z);
    }
    raw.push(...edgeZ);
    if (cockpit) {
      for (let z = cockpit.z1; z <= cockpit.z0; z += 0.03) raw.push(z);
      raw.push(cockpit.z0 + 0.012, cockpit.z1 - 0.012);
    }
    raw.sort((a, b) => a - b);
    const zs = [];
    const isEdge = (z) => edgeZ.some((e) => Math.abs(e - z) < 1e-6);
    for (const z of raw) {
      if (z < zMin - 1e-9 || z > zMax + 1e-9) continue;
      const last = zs[zs.length - 1];
      if (!zs.length || z - last > 0.008) zs.push(z);
      else if (isEdge(z) || z === zMax) zs[zs.length - 1] = z;
    }
    const rows = zs.length;

    const pos = new Float32Array(rows * ringN * 3);
    for (let i = 0; i < rows; i++) {
      for (let k = 0; k < ringN; k++) {
        const c = ring[k];
        const [x, y] = this.point(zs[i], c.g);
        const o = (i * ringN + k) * 3;
        pos[o] = c.side * x; pos[o + 1] = y; pos[o + 2] = zs[i];
      }
    }

    // Janelas laterais: a borda da frente e a de trás caem exatamente sobre vértices (sem serrilhado).
    // [z da borda de trás, z da borda da frente] da janela na fração t da altura
    const windowZ = (w, t) => { const a = w.z0b + (w.z0t - w.z0b) * t, b = w.z1b + (w.z1t - w.z1b) * t; return a < b ? [a, b] : [b, a]; };
    for (const w of spec.sideWindows || []) {
      for (let k = 0; k < ringN; k++) {
        const c = ring[k];
        if (c.g < 4 || c.g > 5) continue;
        for (const zE of windowZ(w, c.g - 4)) {
          let bi = 0;
          for (let i = 1; i < rows; i++) if (Math.abs(zs[i] - zE) < Math.abs(zs[bi] - zE)) bi = i;
          if (Math.abs(zs[bi] - zE) > 0.03 || isEdge(zs[bi])) continue;
          const [x, y] = this.point(zE, c.g);
          const o = (bi * ringN + k) * 3;
          pos[o] = c.side * x; pos[o + 1] = y; pos[o + 2] = zE;
        }
      }
    }

    // Tipo de cada vértice: 0 lataria, 1 caixa de roda, 2 cockpit
    const inArch = (z, y) => arch.axles.some((zA) => {
      const dz = z - zA;
      return Math.abs(dz) <= arch.radius && (y < arch.centerY || (y - arch.centerY) ** 2 + dz * dz < arch.radius ** 2);
    });
    const cockpitHalf = (z) => {
      if (!cockpit || z > cockpit.z0 || z < cockpit.z1) return -1;
      const { z0, z1, halfWidth, corner } = cockpit;
      const d = Math.min(z0 - z, z - z1);
      if (d >= corner) return halfWidth;
      return halfWidth - corner + Math.sqrt(corner * corner - (corner - d) ** 2);
    };
    const kind = new Uint8Array(rows * ringN);
    for (let v = 0; v < rows * ringN; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      const c = ring[v % ringN];
      if (c.g <= 4 && Math.abs(x) > arch.wellX && inArch(z, y)) kind[v] = 1;
      else if (cockpit && c.g >= 3 && y > cockpit.cutY && Math.abs(x) < cockpitHalf(z)) kind[v] = 2;
    }

    // Material de cada triângulo
    const inRange = (list, z) => (list || []).some((r) => z >= r.z0 && z <= r.z1);
    const zoneOf = (span, t, z) => {
      if (span === 6) {
        if (spec.windshield && z >= spec.windshield.z0 && z <= spec.windshield.z1) return 'glass';
        if (spec.rearGlass && z >= spec.rearGlass.z0 && z <= spec.rearGlass.z1) return 'glass';
        if (inRange(spec.roofTrim, z)) return 'trim';
      } else if (span === 5) {
        if (inRange(spec.pillarTrim, z)) return 'trim';
      } else if (span === 4) {
        if (inRange(spec.glassTrim, z)) return 'trim';
        for (const w of spec.sideWindows || []) {
          const [zf, zr] = windowZ(w, t);
          if (z >= zf && z <= zr) return 'glass';
        }
      }
      return 'paint';
    };
    const tris = { paint: [], trim: [], dark: [], glass: [] };
    const triZone = [];
    const addTri = (a, b, c, zone) => { triZone.push([a, b, c, zone]); };
    for (let i = 0; i < rows - 1; i++) {
      for (let k = 0; k < ringN; k++) {
        const k2 = (k + 1) % ringN;
        const a = i * ringN + k, b = i * ringN + k2, c = a + ringN, d = b + ringN;
        const pa = kind[a] ? 1 : 0, pb = kind[b] ? 1 : 0, pc = kind[c] ? 1 : 0, pd = kind[d] ? 1 : 0;
        const count = pa + pb + pc + pd;
        const odd = count === 1 ? 1 : 0;
        const flip = (count === 1 || count === 3) && (pb === odd || pc === odd);
        const pair = flip ? [[a, b, d], [a, d, c]] : [[a, b, c], [b, d, c]];
        // O quadrado pertence ao vão da coluna de g maior (a outra pode ser o fim do vão anterior).
        const hi = ring[k].g >= ring[k2].g ? ring[k] : ring[k2];
        const lo = hi === ring[k] ? ring[k2] : ring[k];
        const span = hi.span;
        const tc = (hi.t + (lo.span === span ? lo.t : 0)) / 2;
        for (const t of pair) {
          if (kind[t[0]] || kind[t[1]] || kind[t[2]]) { addTri(...t, 'dark'); continue; }
          const zc = (pos[t[0] * 3 + 2] + pos[t[1] * 3 + 2] + pos[t[2] * 3 + 2]) / 3;
          addTri(...t, zoneOf(span, clamp(tc, 0, 1), zc));
        }
      }
    }
    // Borda dos vidros: triângulo de vidro encostado em vértice que não é só vidro vira borracha preta.
    const nonGlass = new Uint8Array(rows * ringN);
    for (const [a, b, c, zone] of triZone) if (zone !== 'glass') { nonGlass[a] = 1; nonGlass[b] = 1; nonGlass[c] = 1; }
    const glassOnly = new Uint8Array(rows * ringN);
    for (const t of triZone) {
      if (t[3] !== 'glass') continue;
      if (nonGlass[t[0]] || nonGlass[t[1]] || nonGlass[t[2]]) t[3] = 'seal';
      else { glassOnly[t[0]] = 1; glassOnly[t[1]] = 1; glassOnly[t[2]] = 1; }
    }
    for (const [a, b, c, zone] of triZone) tris[zone === 'seal' ? 'trim' : zone].push(a, b, c);

    // Tampas das pontas: domo raso (para-choque abaulado) em anéis concêntricos
    const capStart = pos.length / 3;
    const capPos = [];
    const capIdx = [];
    const capNrm = [];
    const CAP_RINGS = [1, 0.8, 0.58, 0.34, 0.12];
    for (const [ri, flip, bulge] of [[0, true, spec.capBulge?.rear ?? 0.03], [rows - 1, false, spec.capBulge?.front ?? 0.04]]) {
      const dir = flip ? -1 : 1;
      const base = capStart + capPos.length / 3;
      let cy = 0, ext = 0;
      for (let k = 0; k < ringN; k++) cy += pos[(ri * ringN + k) * 3 + 1];
      cy /= ringN;
      for (let k = 0; k < ringN; k++) { const o = (ri * ringN + k) * 3; ext = Math.max(ext, Math.abs(pos[o]), Math.abs(pos[o + 1] - cy)); }
      for (const sc of CAP_RINGS) {
        for (let k = 0; k < ringN; k++) {
          const o = (ri * ringN + k) * 3;
          const dx = pos[o] * sc, dy = (pos[o + 1] - cy) * sc;
          capPos.push(dx, cy + dy, zs[ri] + dir * bulge * (1 - sc * sc));
          const slope = (2 * bulge * sc) / Math.max(0.2, ext);
          const nl = Math.hypot(dx / Math.max(0.2, ext) * slope, dy / Math.max(0.2, ext) * slope, 1);
          capNrm.push((dx / Math.max(0.2, ext)) * slope / nl, (dy / Math.max(0.2, ext)) * slope / nl, dir / nl);
        }
      }
      capPos.push(0, cy, zs[ri] + dir * bulge);
      capNrm.push(0, 0, dir);
      const center = base + CAP_RINGS.length * ringN;
      for (let r = 0; r < CAP_RINGS.length; r++) {
        for (let k = 0; k < ringN; k++) {
          const k2 = (k + 1) % ringN;
          const a = base + r * ringN + k, b = base + r * ringN + k2;
          if (r === CAP_RINGS.length - 1) {
            if (flip) capIdx.push(center, b, a); else capIdx.push(center, a, b);
          } else {
            const c = a + ringN, d = b + ringN;
            if (flip) capIdx.push(a, c, b, b, c, d); else capIdx.push(a, b, c, b, d, c);
          }
        }
      }
    }

    const allPos = new Float32Array(pos.length + capPos.length);
    allPos.set(pos); allPos.set(capPos, pos.length);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(allPos, 3));
    const index = [...tris.paint, ...capIdx, ...tris.trim, ...tris.dark];
    geo.setIndex(index);
    geo.addGroup(0, tris.paint.length + capIdx.length, 0);
    geo.addGroup(tris.paint.length + capIdx.length, tris.trim.length, 1);
    geo.addGroup(tris.paint.length + capIdx.length + tris.trim.length, tris.dark.length, 2);
    // Normais antes dos recortes e com os vidros juntos: a lataria continua lisa até a borda.
    const full = new THREE.BufferGeometry();
    full.setAttribute('position', geo.attributes.position);
    full.setIndex([...index, ...tris.glass]);
    full.computeVertexNormals();
    geo.setAttribute('normal', full.attributes.normal);
    full.setIndex(null);

    // Recortes: parede interna das caixas de roda, borda do arco lisa, fundo do cockpit.
    const p = allPos;
    const colors = new Float32Array(allPos.length).fill(1);
    const kindAt = (i, k) => (i >= 0 && i < rows ? kind[i * ringN + ((k + ringN) % ringN)] : 0);
    // vizinho lógico (pula o vértice duplicado do vinco)
    const nextK = (k, dir) => {
      let q = (k + dir + ringN) % ringN;
      if (ring[q].logical === ring[k].logical && ring[q].side === ring[k].side) q = (q + dir + ringN) % ringN;
      return q;
    };
    for (let i = 0; i < rows; i++) {
      for (let k = 0; k < ringN; k++) {
        const v = i * ringN + k, o = v * 3, c = ring[k];
        const kv = kind[v];
        if (kv === 1) { p[o] = Math.sign(p[o]) * arch.wellX; colors[o] = colors[o + 1] = colors[o + 2] = 0.05; continue; }
        if (kv === 2) { p[o + 1] = cockpit.floorY; colors[o] = colors[o + 1] = colors[o + 2] = 0.07; continue; }
        // Oclusão: embaixo escuro, saia um pouco
        let ao = 1;
        if (c.span === 0) ao = 0.28;
        else if (c.span === 1) ao = 0.45 + 0.45 * c.t;
        else if (c.span === 2) ao = 0.9 + 0.1 * c.t;
        const nearArch = kindAt(i - 1, k) === 1 || kindAt(i + 1, k) === 1 || kindAt(i, nextK(k, -1)) === 1 || kindAt(i, nextK(k, 1)) === 1;
        if (nearArch && Math.abs(p[o]) > arch.wellX) {
          ao *= 0.8;
          const z = p[o + 2], y = p[o + 1];
          const zA = arch.axles.reduce((best, a) => (Math.abs(z - a) < Math.abs(z - best) ? a : best));
          const dz = z - zA, dy = y - arch.centerY;
          if (dy <= 0) p[o + 2] = zA + Math.sign(dz) * arch.radius;
          else {
            const dist = Math.hypot(dz, dy);
            if (dist - arch.radius <= 0.1) {
              p[o + 2] = zA + (dz * arch.radius) / dist;
              p[o + 1] = arch.centerY + (dy * arch.radius) / dist;
            }
          }
        }
        if (cockpit && p[o + 1] > cockpit.cutY && (kindAt(i, nextK(k, -1)) === 2 || kindAt(i, nextK(k, 1)) === 2)) {
          const hw = cockpitHalf(p[o + 2]);
          if (hw > 0) p[o] = Math.sign(p[o]) * hw;
        }
        colors[o] = colors[o + 1] = colors[o + 2] = ao;
      }
    }
    if (cockpit) {
      for (let i = 0; i < rows; i++) {
        for (let k = 0; k < ringN; k++) {
          const o = (i * ringN + k) * 3;
          if (kind[i * ringN + k] || p[o + 1] <= cockpit.cutY) continue;
          if (kindAt(i + 1, k) === 2) p[o + 2] = cockpit.z1;
          else if (kindAt(i - 1, k) === 2) p[o + 2] = cockpit.z0;
        }
      }
    }
    // Vidro fica 1 cm para dentro da moldura (a borracha faz a rampa)
    const nrm = geo.attributes.normal.array;
    for (let v = 0; v < rows * ringN; v++) {
      if (!glassOnly[v] || nonGlass[v]) continue;
      const o = v * 3;
      p[o] -= nrm[o] * 0.011; p[o + 1] -= nrm[o + 1] * 0.011; p[o + 2] -= nrm[o + 2] * 0.011;
    }
    // Tampas: normal do domo
    for (let v = capStart, q = 0; v < allPos.length / 3; v++, q++) {
      const o = v * 3;
      nrm[o] = capNrm[q * 3]; nrm[o + 1] = capNrm[q * 3 + 1]; nrm[o + 2] = capNrm[q * 3 + 2];
      const low = p[o + 1] < 0.3 ? 0.55 : 0.9;
      colors[o] = colors[o + 1] = colors[o + 2] = low;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const glassGeo = new THREE.BufferGeometry();
    glassGeo.setAttribute('position', geo.attributes.position);
    glassGeo.setAttribute('normal', geo.attributes.normal);
    glassGeo.setIndex(tris.glass);
    return { body: geo, glass: tris.glass.length ? glassGeo : null, rows: zs, ring };
  }

  // Faixa colada na lataria: z de z0 a z1 e, em cada z, contorno de g0(s) a g1(s) (s = 0..1 ao longo de z).
  // side: +1 lado esquerdo, -1 direito. UV: u no contorno, v ao longo de z.
  patch({ z0, z1, g0, g1, side = 1, lift = 0.004, nu = 8, nv = 8 }) {
    const G0 = typeof g0 === 'function' ? g0 : () => g0;
    const G1 = typeof g1 === 'function' ? g1 : () => g1;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= nv; i++) {
      const s = i / nv, z = z0 + (z1 - z0) * s;
      for (let j = 0; j <= nu; j++) {
        const g = G0(s) + (G1(s) - G0(s)) * (j / nu);
        pos.push(...this.surface(z, g, side, lift));
        uv.push(j / nu, s);
      }
    }
    for (let i = 0; i < nv; i++) {
      for (let j = 0; j < nu; j++) {
        const a = i * (nu + 1) + j, b = a + 1, c = a + nu + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // Normal para fora da lataria
    const mid = (Math.floor(nv / 2) * (nu + 1) + Math.floor(nu / 2));
    const zMid = pos[mid * 3 + 2], gMid = (G0(0.5) + G1(0.5)) / 2;
    const [ox, oy] = this.normal2(zMid, gMid);
    const n = geo.attributes.normal;
    if (n.getX(mid) * ox * side + n.getY(mid) * oy < 0) {
      const index = geo.index.array;
      for (let k = 0; k < index.length; k += 3) [index[k + 1], index[k + 2]] = [index[k + 2], index[k + 1]];
      geo.computeVertexNormals();
    }
    return geo;
  }

  // Pontos ao longo de uma linha da lataria (para frisos, borrachas e cromados)
  line(zList, g, side = 1, lift = 0.003) {
    const G1 = typeof g === 'function' ? g : () => g;
    return zList.map((z, i) => this.surface(z, G1(i / Math.max(1, zList.length - 1), z), side, lift));
  }
}
