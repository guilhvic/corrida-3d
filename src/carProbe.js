// Sonda da lataria: acha o ponto da superfície ao longo de um eixo (raio em X, Y ou Z) com uma grade 2D
// de triângulos por projeção, bem mais rápida que o Raycaster para centenas de consultas.
// Serve para colar lanternas, grades, faróis e peças exatamente sobre a carroceria.
import * as THREE from 'three';

const AXES = { x: [2, 1], y: [0, 2], z: [0, 1] }; // coordenadas do plano de projeção (u, v) por eixo
const CELL = 0.04;

export class SurfaceProbe {
  constructor(geometry, extraIndex = null) {
    this.pos = geometry.attributes.position.array;
    this.nrm = geometry.attributes.normal.array;
    const index = geometry.index.array;
    // Só a lataria pintada e o acabamento (grupos 0 e 1); a parede interna das caixas de roda fica fora.
    const groups = geometry.groups.length ? geometry.groups.filter((g) => g.materialIndex !== 2) : [{ start: 0, count: index.length }];
    const tris = [];
    for (const g of groups) for (let i = g.start; i < g.start + g.count; i += 3) tris.push(index[i], index[i + 1], index[i + 2]);
    if (extraIndex) for (let i = 0; i < extraIndex.length; i += 3) tris.push(extraIndex[i], extraIndex[i + 1], extraIndex[i + 2]);
    this.tris = Uint32Array.from(tris);
    this.grids = {};
  }

  grid(axis) {
    if (this.grids[axis]) return this.grids[axis];
    const [ua, va] = AXES[axis];
    const p = this.pos, T = this.tris;
    const map = new Map();
    for (let t = 0; t < T.length; t += 3) {
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (let k = 0; k < 3; k++) {
        const o = T[t + k] * 3;
        u0 = Math.min(u0, p[o + ua]); u1 = Math.max(u1, p[o + ua]);
        v0 = Math.min(v0, p[o + va]); v1 = Math.max(v1, p[o + va]);
      }
      for (let cu = Math.floor(u0 / CELL); cu <= Math.floor(u1 / CELL); cu++) {
        for (let cv = Math.floor(v0 / CELL); cv <= Math.floor(v1 / CELL); cv++) {
          const key = cu * 4096 + cv;
          let list = map.get(key);
          if (!list) { list = []; map.set(key, list); }
          list.push(t);
        }
      }
    }
    this.grids[axis] = map;
    return map;
  }

  // Raio a partir de (u, v) no plano do eixo, vindo de dir = +1 (do lado positivo, andando para -) ou -1.
  // Devolve { point: [x,y,z], normal: [x,y,z] } da primeira superfície encontrada, ou null.
  cast(axis, u, v, dir = 1) {
    const [ua, va] = AXES[axis];
    const wa = 3 - ua - va;
    const list = this.grid(axis).get(Math.floor(u / CELL) * 4096 + Math.floor(v / CELL));
    if (!list) return null;
    const p = this.pos, n = this.nrm, T = this.tris;
    let best = null, bestW = dir > 0 ? -Infinity : Infinity;
    for (const t of list) {
      const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
      const au = p[a + ua], av = p[a + va], bu = p[b + ua], bv = p[b + va], cu = p[c + ua], cv = p[c + va];
      const det = (bv - cv) * (au - cu) + (cu - bu) * (av - cv);
      if (Math.abs(det) < 1e-12) continue;
      const l1 = ((bv - cv) * (u - cu) + (cu - bu) * (v - cv)) / det;
      const l2 = ((cv - av) * (u - cu) + (au - cu) * (v - cv)) / det;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const w = l1 * p[a + wa] + l2 * p[b + wa] + l3 * p[c + wa];
      if (dir > 0 ? w > bestW : w < bestW) {
        bestW = w;
        best = [l1, l2, l3, a, b, c];
      }
    }
    if (!best) return null;
    const [l1, l2, l3, a, b, c] = best;
    const point = [0, 0, 0], normal = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      point[k] = l1 * p[a + k] + l2 * p[b + k] + l3 * p[c + k];
      normal[k] = l1 * n[a + k] + l2 * n[b + k] + l3 * n[c + k];
    }
    const len = Math.hypot(...normal) || 1;
    return { point, normal: normal.map((x) => x / len) };
  }

  // Ponto 3D: axis 'z' com (x, y), 'x' com (z, y), 'y' com (x, z)
  at(axis, u, v, dir = 1, lift = 0) {
    const hit = this.cast(axis, u, v, dir);
    if (!hit) return null;
    return hit.point.map((c, k) => c + hit.normal[k] * lift);
  }

  // Grade colada na superfície entre (u0,v0) e (u1,v1). shapeFn(s, t) opcional devolve [u, v] (formas não retangulares).
  // UV: u = s, v = t. Pontos sem superfície herdam o vizinho mais próximo.
  patch({ axis, dir = 1, u0, u1, v0, v1, nu = 12, nv = 6, lift = 0.003, shapeFn = null }) {
    const [ua, va] = AXES[axis];
    const pos = [], uv = [], nrm = [];
    const miss = [];
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const s = i / nu, t = j / nv;
        const [u, v] = shapeFn ? shapeFn(s, t) : [u0 + (u1 - u0) * s, v0 + (v1 - v0) * t];
        const hit = this.cast(axis, u, v, dir);
        if (hit) {
          pos.push(...hit.point.map((c, k) => c + hit.normal[k] * lift));
          nrm.push(...hit.normal);
        } else {
          const q = [0, 0, 0]; q[ua] = u; q[va] = v;
          pos.push(...q); nrm.push(0, 0, 0);
          miss.push(pos.length / 3 - 1);
        }
        uv.push(s, t);
      }
    }
    // Buracos: copia o vizinho com superfície
    const W = nu + 1;
    for (const m of miss) {
      const i = m % W, j = Math.floor(m / W);
      let donor = -1;
      for (let r = 1; r <= Math.max(nu, nv) && donor < 0; r++) {
        for (const [di, dj] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii > nu || jj > nv) continue;
          const d = jj * W + ii;
          if (!miss.includes(d)) { donor = d; break; }
        }
      }
      if (donor >= 0) for (let k = 0; k < 3; k++) { pos[m * 3 + k] = pos[donor * 3 + k]; nrm[m * 3 + k] = nrm[donor * 3 + k]; }
    }
    const idx = [];
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    // Faces para fora: confere com a normal média
    const center = Math.floor(nv / 2) * W + Math.floor(nu / 2);
    const tmp = geo.clone();
    tmp.computeVertexNormals();
    const cn = [tmp.attributes.normal.getX(center), tmp.attributes.normal.getY(center), tmp.attributes.normal.getZ(center)];
    tmp.dispose();
    if (cn[0] * nrm[center * 3] + cn[1] * nrm[center * 3 + 1] + cn[2] * nrm[center * 3 + 2] < 0) {
      const index = geo.index.array;
      for (let k = 0; k < index.length; k += 3) [index[k + 1], index[k + 2]] = [index[k + 2], index[k + 1]];
    }
    return geo;
  }

  // Casca com espessura a partir de patch(): face externa + borda (para lanternas e peças salientes)
  shell(spec, thick = 0.02) {
    const outer = this.patch({ ...spec, lift: (spec.lift ?? 0.002) + thick });
    const inner = this.patch({ ...spec, lift: spec.lift ?? 0.002 });
    const { nu = 12, nv = 6 } = spec;
    const W = nu + 1;
    const ring = [];
    for (let i = 0; i <= nu; i++) ring.push(i);
    for (let j = 1; j <= nv; j++) ring.push(j * W + nu);
    for (let i = nu - 1; i >= 0; i--) ring.push(nv * W + i);
    for (let j = nv - 1; j >= 1; j--) ring.push(j * W);
    const po = outer.attributes.position.array, pi = inner.attributes.position.array;
    const pos = [], idx = [];
    for (const v of ring) pos.push(po[v * 3], po[v * 3 + 1], po[v * 3 + 2], pi[v * 3], pi[v * 3 + 1], pi[v * 3 + 2]);
    const n = ring.length;
    for (let k = 0; k < n; k++) { const a = k * 2, b = ((k + 1) % n) * 2; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const edge = new THREE.BufferGeometry();
    edge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    edge.setIndex(idx);
    edge.computeVertexNormals();
    inner.dispose();
    return { face: outer, edge };
  }
}
