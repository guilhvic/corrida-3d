// Geometria base dos carros: carroceria por seções superelípticas interpoladas ao longo de z,
// com recorte das caixas de roda e (nos conversíveis) do cockpit; loft simples para vidros/teto;
// peças coladas na lataria. Frente para +Z, esquerda para +X.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const clamp = THREE.MathUtils.clamp;

export class Shell {
  // keys: [[z, meia largura, base, topo, arredondamento 0..1]]; squareness: expoente da seção reta.
  constructor(keys, { squareness = 6 } = {}) {
    this.keys = keys;
    this.squareness = squareness;
    this.zMin = keys[0][0];
    this.zMax = keys[keys.length - 1][0];
  }

  // Interpolação cúbica (Hermite com tangentes de Catmull-Rom) entre as seções-chave.
  at(zIn) {
    const K = this.keys;
    const z = clamp(zIn, K[0][0], K[K.length - 1][0]);
    let i = 0;
    while (i < K.length - 2 && z > K[i + 1][0]) i++;
    const k0 = K[i], k1 = K[i + 1];
    const h = k1[0] - k0[0], t = (z - k0[0]) / h, t2 = t * t, t3 = t2 * t;
    const slope = (j, c) => {
      const a = K[Math.max(0, j - 1)], b = K[Math.min(K.length - 1, j + 1)];
      return (b[c] - a[c]) / (b[0] - a[0]);
    };
    const v = (c) => (2 * t3 - 3 * t2 + 1) * k0[c] + (t3 - 2 * t2 + t) * h * slope(i, c)
      + (-2 * t3 + 3 * t2) * k1[c] + (t3 - t2) * h * slope(i + 1, c);
    return { w: v(1), yb: v(2), yt: v(3), r: clamp(v(4), 0, 1) };
  }

  exponent(s) { return this.squareness - (this.squareness - 2.8) * s.r; }

  // Leve "tumblehome" acima da cintura e saia recolhida embaixo.
  static tumble(yn) { return 1 - 0.035 * Math.max(0, yn - 0.55) / 0.45 - 0.05 * Math.max(0, 0.18 - yn) / 0.18; }

  // Ponto da meia seção (lado +X): theta -π/2 = centro de baixo, 0 = meio da lateral, π/2 = centro de cima.
  point(s, theta) {
    const e = 2 / this.exponent(s);
    const c = Math.cos(theta), sn = Math.sin(theta);
    const u = Math.pow(Math.max(0, c), e);
    const v = Math.sign(sn) * Math.pow(Math.abs(sn), e);
    const yn = (v + 1) / 2;
    return [s.w * u * Shell.tumble(yn), s.yb + yn * (s.yt - s.yb)];
  }

  // Largura da lateral numa altura y.
  sideX(z, y) {
    const s = this.at(z), n = this.exponent(s);
    const v = clamp((y - (s.yb + s.yt) / 2) / ((s.yt - s.yb) / 2), -1, 1);
    return s.w * Math.pow(1 - Math.abs(v) ** n, 1 / n) * Shell.tumble((v + 1) / 2);
  }

  // Altura da superfície de cima numa posição lateral x.
  topY(z, x) {
    const s = this.at(z), n = this.exponent(s);
    const u = clamp(Math.abs(x) / (s.w * 0.97), 0, 1);
    return (s.yb + s.yt) / 2 + Math.pow(1 - u ** n, 1 / n) * (s.yt - s.yb) / 2;
  }

  // Meia seção reamostrada por comprimento de arco; o fundo recebe menos pontos.
  half(s, count) {
    const dense = [], acc = [0];
    const S = 240;
    for (let i = 0; i <= S; i++) {
      dense.push(this.point(s, -Math.PI / 2 + (Math.PI * i) / S));
      if (i) {
        const [x0, y0] = dense[i - 1], [x1, y1] = dense[i];
        const bottom = (y1 - s.yb) / (s.yt - s.yb) < 0.05;
        acc.push(acc[i - 1] + Math.hypot(x1 - x0, y1 - y0) * (bottom ? 0.3 : 1));
      }
    }
    const total = acc[S], out = [];
    let j = 0;
    for (let k = 0; k < count; k++) {
      const target = (total * k) / (count - 1);
      while (j < S - 1 && acc[j + 1] < target) j++;
      const t = clamp((target - acc[j]) / (acc[j + 1] - acc[j] || 1), 0, 1);
      out.push([dense[j][0] + (dense[j + 1][0] - dense[j][0]) * t, dense[j][1] + (dense[j + 1][1] - dense[j][1]) * t]);
    }
    return out;
  }

  // arch: { axles: [zF, zR], radius, centerY, wellX }
  // cockpit (conversível): { z0 (frente), z1 (trás), halfWidth, corner, floorY, cutY }
  geometry({ arch, cockpit = null }) {
    const M = 34;
    const ringN = 2 * M - 2;
    const { zMin, zMax } = this;

    // Seções: espaçamento regular, mais densas em volta das caixas de roda e das bordas do cockpit.
    const raw = [];
    for (let z = zMin; z < zMax; z += 0.07) raw.push(z);
    raw.push(zMax);
    for (const zA of arch.axles) {
      for (let k = 0; k <= 30; k++) raw.push(zA + arch.radius * Math.cos((Math.PI * k) / 30));
      raw.push(zA + arch.radius + 0.012, zA - arch.radius - 0.012);
    }
    if (cockpit) {
      for (let z = cockpit.z1; z <= cockpit.z0; z += 0.035) raw.push(z);
      raw.push(cockpit.z0 + 0.012, cockpit.z1 - 0.012);
    }
    raw.sort((a, b) => a - b);
    const zs = [];
    for (const z of raw) {
      if (z < zMin || z > zMax) continue;
      if (!zs.length || z - zs[zs.length - 1] > 0.01) zs.push(z);
      else if (z === zMax) zs[zs.length - 1] = zMax;
    }

    const sections = zs.map((z) => this.at(z));
    const rows = zs.length;
    const pos = [], idx = [], cut = [];
    sections.forEach((s, i) => {
      const half = this.half(s, M);
      const ring = [...half, ...half.slice(1, M - 1).reverse().map(([x, y]) => [-x, y])];
      for (const [x, y] of ring) pos.push(x, y, zs[i]);
    });

    const inArch = (z, y) => arch.axles.some((zA) => {
      const dz = z - zA;
      return Math.abs(dz) <= arch.radius && (y < arch.centerY || (y - arch.centerY) ** 2 + dz * dz < arch.radius ** 2);
    });
    // Meia largura do cockpit num z (cantos de trás arredondados).
    const cockpitHalf = (z) => {
      if (!cockpit || z > cockpit.z0 || z < cockpit.z1) return -1;
      const { z0, z1, halfWidth, corner } = cockpit;
      const d = Math.min(z0 - z, z - z1);
      if (d >= corner) return halfWidth;
      return halfWidth - corner + Math.sqrt(corner * corner - (corner - d) ** 2);
    };
    const kind = new Uint8Array(rows * ringN); // 0 lataria, 1 caixa de roda, 2 cockpit
    for (let v = 0; v < rows * ringN; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      if (Math.abs(x) > arch.wellX && inArch(z, y)) kind[v] = 1;
      else if (cockpit && y > cockpit.cutY && Math.abs(x) < cockpitHalf(z)) kind[v] = 2;
    }

    for (let i = 0; i < rows - 1; i++) {
      for (let k = 0; k < ringN; k++) {
        const a = i * ringN + k, b = i * ringN + ((k + 1) % ringN), c = a + ringN, d = b + ringN;
        // Quadrado com um só vértice diferente dos outros: a diagonal não pode passar por ele,
        // senão a borda do recorte vira dente de serra.
        const pa = kind[a] ? 1 : 0, pb = kind[b] ? 1 : 0, pc = kind[c] ? 1 : 0, pd = kind[d] ? 1 : 0;
        const count = pa + pb + pc + pd;
        const odd = count === 1 ? 1 : 0;
        const flip = (count === 1 || count === 3) && (pb === odd || pc === odd);
        const tris = flip ? [[a, b, d], [a, d, c]] : [[a, b, c], [b, d, c]];
        // Triângulos que tocam um recorte vão para o material escuro (sem brilho de pintura).
        for (const t of tris) (kind[t[0]] || kind[t[1]] || kind[t[2]] ? cut : idx).push(...t);
      }
    }
    for (const [ri, flip] of [[0, true], [rows - 1, false]]) {
      const s = sections[ri];
      const center = pos.length / 3;
      pos.push(0, (s.yb + s.yt) / 2, zs[ri]);
      for (let k = 0; k < ringN; k++) {
        const a = ri * ringN + k, b = ri * ringN + ((k + 1) % ringN);
        if (flip) idx.push(center, b, a); else idx.push(center, a, b);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    // Grupo 0: lataria · grupo 1: caixas de roda e cockpit
    geo.setIndex([...idx, ...cut]);
    geo.addGroup(0, idx.length, 0);
    geo.addGroup(idx.length, cut.length, 1);
    // Normais calculadas antes dos recortes: a lataria continua lisa até a borda.
    geo.computeVertexNormals();

    const p = geo.attributes.position.array;
    const colors = new Float32Array(p.length).fill(1);
    const kindAt = (i, j) => (i >= 0 && i < rows ? kind[i * ringN + ((j + ringN) % ringN)] : 0);
    for (let i = 0; i < rows; i++) {
      const s = sections[i];
      for (let j = 0; j < ringN; j++) {
        const o = (i * ringN + j) * 3;
        const kv = kind[i * ringN + j];
        if (kv === 1) {
          p[o] = Math.sign(p[o]) * arch.wellX;           // parede interna da caixa de roda
          colors[o] = colors[o + 1] = colors[o + 2] = 0.05;
          continue;
        }
        if (kv === 2) {
          p[o + 1] = cockpit.floorY;                      // fundo do cockpit
          colors[o] = colors[o + 1] = colors[o + 2] = 0.07;
          continue;
        }
        const yn = (p[o + 1] - s.yb) / (s.yt - s.yb);
        colors[o] = colors[o + 1] = colors[o + 2] = yn < 0.1 ? 0.55 + yn * 4.5 : 1; // sombra na saia

        const nearArch = kindAt(i - 1, j) === 1 || kindAt(i + 1, j) === 1 || kindAt(i, j - 1) === 1 || kindAt(i, j + 1) === 1;
        if (nearArch && Math.abs(p[o]) > arch.wellX) {
          // Vizinho de um vértice recortado: vai para cima do círculo, para a borda do arco ficar lisa.
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
        if (cockpit && p[o + 1] > cockpit.cutY && (kindAt(i, j - 1) === 2 || kindAt(i, j + 1) === 2)) {
          // Borda lateral do cockpit: vai para a largura exata.
          const hw = cockpitHalf(p[o + 2]);
          if (hw > 0) p[o] = Math.sign(p[o]) * hw;
        }
      }
    }
    // Frente e trás do cockpit (vizinhos em z) alinhados às bordas.
    if (cockpit) {
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < ringN; j++) {
          const o = (i * ringN + j) * 3;
          if (kind[i * ringN + j] || p[o + 1] <= cockpit.cutY) continue;
          if (kindAt(i + 1, j) === 2) p[o + 2] = cockpit.z1;
          else if (kindAt(i - 1, j) === 2) p[o + 2] = cockpit.z0;
        }
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }

  // Faixa colada na lataria (lanternas, faróis, decalques): z de z0 a z1 e, em cada z, ângulos
  // da seção de th0(t) a th1(t) (t = 0..1 ao longo de z). side: +1 lado esquerdo, -1 direito.
  patch({ z0, z1, th0, th1, side = 1, lift = 0.004, nu = 8, nv = 8 }) {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= nv; i++) {
      const t = i / nv, z = z0 + (z1 - z0) * t, s = this.at(z);
      const yc = (s.yb + s.yt) / 2;
      for (let j = 0; j <= nu; j++) {
        const th = th0(t) + (th1(t) - th0(t)) * (j / nu);
        const [x, y] = this.point(s, th);
        const len = Math.hypot(x, y - yc) || 1;
        pos.push(side * (x + (x / len) * lift), y + ((y - yc) / len) * lift, z);
        uv.push(j / nu, t);
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
    // Garante normal para fora da lataria (depende do sentido de theta e do lado).
    const n = geo.attributes.normal, mid = Math.floor(pos.length / 6) * 3;
    const s = this.at(pos[mid + 2]);
    const out = [pos[mid], pos[mid + 1] - (s.yb + s.yt) / 2];
    if (n.getX(mid / 3) * out[0] + n.getY(mid / 3) * out[1] < 0) {
      const index = geo.index.array;
      for (let k = 0; k < index.length; k += 3) [index[k + 1], index[k + 2]] = [index[k + 2], index[k + 1]];
      geo.computeVertexNormals();
    }
    return geo;
  }
}

// --- Loft simples para a estufa de vidro e o teto ----------------------------------------------
// Seção: { z, w: meia largura, yb: base, yt: topo, r: arredondamento 0..1, tuck: estreitamento no topo }
function ringPoints({ w, yb, yt, r = 0.35, tuck = 0 }) {
  const h = yt - yb;
  const rad = r * Math.min(w, h / 2);
  const pts = [];
  const corner = (cx, cy, a0) => {
    for (let k = 0; k <= 3; k++) {
      const a = a0 + (k / 3) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
  };
  corner(w - rad, yb + rad, -Math.PI / 2);
  corner(w * (1 - tuck) - rad, yt - rad, 0);
  corner(-w * (1 - tuck) + rad, yt - rad, Math.PI / 2);
  corner(-w + rad, yb + rad, Math.PI);
  return pts;
}

export function loft(unsorted) {
  // As faces só apontam para fora com as seções em z crescente.
  const sections = [...unsorted].sort((a, b) => a.z - b.z);
  const rings = sections.map((s) => ringPoints(s).map(([x, y]) => [x, y, s.z]));
  const n = rings[0].length;
  const pos = [], idx = [];
  for (const ring of rings) for (const p of ring) pos.push(...p);
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < n; k++) {
      const a = i * n + k, b = i * n + ((k + 1) % n), c = a + n, d = b + n;
      idx.push(a, b, c, b, d, c);
    }
  }
  for (const [ri, flip] of [[0, true], [rings.length - 1, false]]) {
    const ring = rings[ri];
    const cy = ring.reduce((s, p) => s + p[1], 0) / n;
    const center = pos.length / 3;
    pos.push(0, cy, ring[0][2]);
    for (let k = 0; k < n; k++) {
      const a = ri * n + k, b = ri * n + ((k + 1) % n);
      if (flip) idx.push(center, b, a); else idx.push(center, a, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0); s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0);
  s.lineTo(x1, y1 - r); s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2);
  s.lineTo(x0 + r, y1); s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

// Polígono de cantos arredondados a partir de pontos [x, y] (sentido anti-horário).
export function roundedPolygon(points, radius) {
  const s = new THREE.Shape();
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const [px, py] = points[(i - 1 + n) % n], [cx, cy] = points[i], [nx, ny] = points[(i + 1) % n];
    const l1 = Math.hypot(px - cx, py - cy), l2 = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const ax = cx + ((px - cx) / l1) * r, ay = cy + ((py - cy) / l1) * r;
    const bx = cx + ((nx - cx) / l2) * r, by = cy + ((ny - cy) / l2) * r;
    if (i === 0) s.moveTo(ax, ay); else s.lineTo(ax, ay);
    s.quadraticCurveTo(cx, cy, bx, by);
  }
  s.closePath();
  return s;
}

// Forma plana com UV de 0 a 1 (para receber textura).
export function flatShape(shape, segments = 10) {
  const g = new THREE.ShapeGeometry(shape, segments);
  g.computeBoundingBox();
  const b = g.boundingBox, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) - b.min.x) / (b.max.x - b.min.x), (uv.getY(i) - b.min.y) / (b.max.y - b.min.y));
  }
  return g;
}

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Junta as peças estáticas por material (menos draw calls). keep: grupos que não entram.
export function mergeByMaterial(group, keep) {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert();
  const buckets = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    for (let q = o.parent; q && q !== group; q = q.parent) if (keep.has(q)) return;
    const g = o.geometry;
    const key = `${o.material.uuid}|${g.index ? 'i' : 'n'}|${Object.keys(g.attributes).sort().join(',')}|${o.renderOrder}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const geos = list.map((o) => o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)));
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, list[0].material);
    mesh.renderOrder = list[0].renderOrder;
    group.add(mesh);
    for (const o of list) o.removeFromParent();
  }
}
