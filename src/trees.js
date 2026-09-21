// Árvores e mato dos mapas de estrada (Fujimi e Hakone). Mesmo espírito PS2 dos outros cenários:
// pouca geometria, sombreamento chapado e tudo instanciado, mas com silhueta de verdade em vez de
// cones e bolas lisas. Cada árvore sai de um punhado de variantes geradas com semente fixa, então
// duas árvores vizinhas nunca ficam idênticas e o custo continua sendo alguns draw calls por mapa.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Empurra cada vértice por um ruído barato: tira a cara de primitiva perfeita do three.js.
function jitter(geo, amount, rand) {
  const p = geo.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    p[i] += (rand() - 0.5) * amount;
    p[i + 1] += (rand() - 0.5) * amount * 0.6;
    p[i + 2] += (rand() - 0.5) * amount;
  }
  return geo;
}

// Um galho de cedro: cone de base recortada (raios alternados) — de longe vira silhueta espinhada.
function cedarTier(rand, { radius, height, y, segments = 7 }) {
  const pos = [], idx = [];
  const lean = [(rand() - 0.5) * radius * 0.16, (rand() - 0.5) * radius * 0.16];
  pos.push(lean[0], y + height, lean[1]); // ponta
  const start = rand() * Math.PI * 2;
  for (let i = 0; i < segments; i++) {
    const a = start + (i / segments) * Math.PI * 2;
    const r = radius * (i % 2 ? 0.66 : 1) * (0.85 + rand() * 0.3);
    pos.push(Math.cos(a) * r, y + (rand() - 0.5) * height * 0.22, Math.sin(a) * r);
  }
  for (let i = 0; i < segments; i++) idx.push(0, 1 + ((i + 1) % segments), 1 + i);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return geo;
}

// Copa de cedro (sugi): galhos em camadas, menores e mais próximos perto do topo.
function cedarCrown(rand, { height, radius, tiers }) {
  const parts = [];
  const base = height * 0.22;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    parts.push(cedarTier(rand, {
      radius: radius * (1 - t * 0.78) * (0.9 + rand() * 0.2),
      height: height * (0.34 - t * 0.12),
      y: base + t * (height - base) * 0.92,
    }));
  }
  const geo = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  geo.computeVertexNormals();
  return geo;
}

// Copa de folhosa (quintais de Fujimi, bordos de Hakone): aglomerado de bolas amassadas.
function broadleafCrown(rand, { height, radius }) {
  const parts = [];
  const blobs = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < blobs; i++) {
    const r = radius * (i === 0 ? 1 : 0.5 + rand() * 0.45);
    const blob = new THREE.IcosahedronGeometry(r, 0); // detalhe 0 e vértices embaralhados: silhueta quebrada por pouca geometria
    blob.scale(1, 0.78 + rand() * 0.2, 1);
    jitter(blob, r * 0.2, rand);
    const a = rand() * Math.PI * 2, d = i === 0 ? 0 : radius * (0.3 + rand() * 0.35);
    blob.translate(Math.cos(a) * d, height + (rand() - 0.45) * radius * 0.45, Math.sin(a) * d);
    parts.push(blob);
  }
  const geo = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  geo.computeVertexNormals();
  return geo;
}

// Tronco: afinando para cima e, na folhosa, com galhos saindo para a copa.
function trunkGeometry(rand, { height, radius, branches = 0, crownY = height }) {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(radius * 0.45, radius, height, 6, 1);
  trunk.translate((rand() - 0.5) * 0.1, height / 2, (rand() - 0.5) * 0.1);
  parts.push(trunk);
  for (let i = 0; i < branches; i++) {
    const len = crownY * (0.5 + rand() * 0.3);
    const branch = new THREE.CylinderGeometry(radius * 0.18, radius * 0.4, len, 5, 1);
    branch.translate(0, len / 2, 0);
    branch.rotateZ((rand() * 0.5 + 0.35) * (i % 2 ? 1 : -1));
    branch.rotateY(rand() * Math.PI * 2);
    branch.translate(0, height * 0.55, 0);
    parts.push(branch);
  }
  const geo = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  geo.computeVertexNormals();
  return geo;
}

// Uma variante inteira (tronco + copa) já na escala certa.
function variantGeometry(kind, rand) {
  if (kind === 'cedar') {
    const height = 15 + rand() * 4;
    const radius = 2.3 + rand() * 0.7;
    return {
      trunk: trunkGeometry(rand, { height: height * 0.75, radius: 0.34 }),
      crown: cedarCrown(rand, { height, radius, tiers: 4 + Math.floor(rand() * 2) }),
    };
  }
  const height = 4.2 + rand() * 1.6; // tronco mais alto que a copa é larga: a árvore não vira guarda-chuva
  const radius = 1.7 + rand() * 0.7;
  return {
    trunk: trunkGeometry(rand, { height, radius: 0.22, branches: 3, crownY: radius }),
    // A copa senta em cima do tronco (e desce um pouco por fora dele): nada de bola flutuando.
    crown: broadleafCrown(rand, { height: height * 0.92 + radius * 0.2, radius }),
  };
}

// Campo de árvores instanciadas. items: [x, y, z, escala] (o y já é o chão).
// Devolve o grupo pronto, setColor(i, cor) para a cor da copa (muda com o horário) e applyColors().
export function buildTreeField({ kind = 'cedar', items, rand, variants = 3, trunkColor = 0x4a3222 }) {
  const group = new THREE.Group();
  const geos = [];
  for (let v = 0; v < variants; v++) geos.push(variantGeometry(kind, rand));
  const pick = items.map((_, i) => (i * 7 + Math.floor(rand() * 3)) % variants);
  const counts = geos.map((_, v) => pick.filter((q) => q === v).length);
  const trunkMat = new THREE.MeshLambertMaterial({ color: trunkColor, flatShading: true });
  const crownMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const trunks = [], crowns = [], slot = [];
  for (let v = 0; v < variants; v++) {
    trunks.push(new THREE.InstancedMesh(geos[v].trunk, trunkMat, Math.max(1, counts[v])));
    crowns.push(new THREE.InstancedMesh(geos[v].crown, crownMat, Math.max(1, counts[v])));
    group.add(trunks[v], crowns[v]);
  }
  const used = new Array(variants).fill(0);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  items.forEach(([px, py, pz, k], i) => {
    const v = pick[i], j = used[v]++;
    slot.push([v, j]);
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand() * Math.PI * 2);
    m4.compose(p.set(px, py, pz), q, sc.set(k, k * (0.9 + rand() * 0.28), k));
    trunks[v].setMatrixAt(j, m4);
    crowns[v].setMatrixAt(j, m4);
  });
  // Sobras (contagem mínima de 1) ficam invisíveis fora do mapa.
  for (let v = 0; v < variants; v++) {
    for (let j = used[v]; j < trunks[v].count; j++) {
      m4.compose(p.set(0, -9999, 0), q.identity(), sc.set(1, 1, 1));
      trunks[v].setMatrixAt(j, m4); crowns[v].setMatrixAt(j, m4);
    }
  }
  return {
    group,
    setColor(i, color) {
      const [v, j] = slot[i];
      crowns[v].setColorAt(j, color);
    },
    applyColors() {
      for (const c of crowns) if (c.instanceColor) c.instanceColor.needsUpdate = true;
    },
  };
}

// Moita rasteira e tufo de capim: o mato que fica na beira da estrada, onde a câmera passa perto.
export function buildUndergrowth({ items, rand, variants = 3 }) {
  const group = new THREE.Group();
  const geos = [];
  for (let v = 0; v < variants; v++) {
    const r = 0.5 + rand() * 0.5;
    const blobs = [];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.IcosahedronGeometry(r * (0.6 + rand() * 0.5), 0);
      b.scale(1.1, 0.7, 1.1);
      jitter(b, r * 0.5, rand);
      b.translate((rand() - 0.5) * r, r * (0.5 + rand() * 0.3), (rand() - 0.5) * r);
      blobs.push(b);
    }
    const geo = mergeGeometries(blobs);
    blobs.forEach((b) => b.dispose());
    geo.computeVertexNormals();
    geos.push(geo);
  }
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const pick = items.map((_, i) => (i * 5 + Math.floor(rand() * 3)) % variants);
  const counts = geos.map((_, v) => Math.max(1, pick.filter((q) => q === v).length));
  const meshes = geos.map((g, v) => new THREE.InstancedMesh(g, mat, counts[v]));
  meshes.forEach((m) => group.add(m));
  const used = new Array(variants).fill(0), slot = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  items.forEach(([px, py, pz, k], i) => {
    const v = pick[i], j = used[v]++;
    slot.push([v, j]);
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand() * Math.PI * 2);
    m4.compose(p.set(px, py, pz), q, sc.set(k, k * (0.8 + rand() * 0.5), k));
    meshes[v].setMatrixAt(j, m4);
  });
  for (let v = 0; v < variants; v++) {
    for (let j = used[v]; j < meshes[v].count; j++) {
      m4.compose(p.set(0, -9999, 0), q.identity(), sc.set(1, 1, 1));
      meshes[v].setMatrixAt(j, m4);
    }
  }
  return {
    group,
    setColor(i, color) { const [v, j] = slot[i]; meshes[v].setColorAt(j, color); },
    applyColors() { for (const m of meshes) if (m.instanceColor) m.instanceColor.needsUpdate = true; },
  };
}

// Tufo de capim em cartões cruzados: o detalhe que passa raspando pela câmera na beira da pista.
// Textura desenhada uma vez (folhas com ponta clara e recorte por alpha).
function tuftTexture(rand) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  for (let i = 0; i < 26; i++) {
    const x0 = 8 + rand() * 48, len = 22 + rand() * 34, lean = (rand() - 0.5) * 26;
    const w = 1.5 + rand() * 1.8;
    const grad = ctx.createLinearGradient(x0, 64, x0 + lean, 64 - len);
    grad.addColorStop(0, 'rgba(38,52,20,1)');
    grad.addColorStop(1, `rgba(${120 + rand() * 60 | 0},${150 + rand() * 60 | 0},70,1)`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, 64);
    ctx.quadraticCurveTo(x0 + lean * 0.4, 64 - len * 0.6, x0 + lean, 64 - len);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// items: [x, y, z, escala]. Dois planos cruzados por tufo, tudo numa malha instanciada só.
export function buildTufts({ items, rand, height = 0.55 }) {
  const quads = [];
  for (const rot of [0, Math.PI / 2]) {
    const q = new THREE.PlaneGeometry(0.9, height);
    q.translate(0, height / 2, 0);
    q.rotateY(rot);
    quads.push(q);
  }
  const geo = mergeGeometries(quads);
  quads.forEach((q) => q.dispose());
  const mat = new THREE.MeshLambertMaterial({
    map: tuftTexture(rand), transparent: false, alphaTest: 0.45, side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  items.forEach(([px, py, pz, k], i) => {
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand() * Math.PI);
    m4.compose(p.set(px, py, pz), q, sc.set(k, k * (0.8 + rand() * 0.6), k));
    mesh.setMatrixAt(i, m4);
  });
  for (let i = items.length; i < mesh.count; i++) {
    m4.compose(p.set(0, -9999, 0), q.identity(), sc.set(1, 1, 1));
    mesh.setMatrixAt(i, m4);
  }
  return mesh;
}

// Lajes e matacões de pedra: saem do barranco da serra e das valas, quebrando a linha lisa do relevo.
export function buildRocks({ items, rand, variants = 3, color = 0x6a6a66 }) {
  const group = new THREE.Group();
  const geos = [];
  for (let v = 0; v < variants; v++) {
    const g = new THREE.IcosahedronGeometry(1, 0);
    g.scale(1 + rand() * 0.6, 0.55 + rand() * 0.5, 1 + rand() * 0.5);
    jitter(g, 0.42, rand);
    g.computeVertexNormals();
    geos.push(g);
  }
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const pick = items.map((_, i) => (i * 3 + Math.floor(rand() * 3)) % variants);
  const counts = geos.map((_, v) => Math.max(1, pick.filter((q) => q === v).length));
  const meshes = geos.map((g, v) => new THREE.InstancedMesh(g, mat, counts[v]));
  meshes.forEach((m) => group.add(m));
  const used = new Array(variants).fill(0);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), e = new THREE.Euler();
  items.forEach(([px, py, pz, k], i) => {
    const v = pick[i], j = used[v]++;
    e.set((rand() - 0.5) * 0.5, rand() * Math.PI * 2, (rand() - 0.5) * 0.5);
    q.setFromEuler(e);
    m4.compose(p.set(px, py, pz), q, sc.set(k, k * (0.7 + rand() * 0.5), k));
    meshes[v].setMatrixAt(j, m4);
  });
  for (let v = 0; v < variants; v++) {
    for (let j = used[v]; j < meshes[v].count; j++) {
      m4.compose(p.set(0, -9999, 0), q.identity(), sc.set(1, 1, 1));
      meshes[v].setMatrixAt(j, m4);
    }
  }
  return group;
}
