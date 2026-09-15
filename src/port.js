// Zona portuária a leste do circuito: pátio de contêineres empilhados, torres de iluminação, cais com
// cabeços e defensas, guindastes de cais (portêineres) com luz de aviação piscando e a baía com água escura
// que reflete o ambiente. Tudo instanciado ou junto por material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { containerTextures } from './cityTextures.js';
import { Surface, valueNoise, mulberry32 } from './textures.js';

export const PORT = { yardX0: 184, yardX1: 234, quayX: 252, waterY: -1.6 };

const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed();

// Piso de concreto do pátio: placas de 5 m com juntas, manchas de óleo e faixas amarelas
function apronTextures(seed = 83) {
  const rand = mulberry32(seed);
  const W = 256, H = 256;
  const s = new Surface(W, H);
  const n = valueNoise(rand, 8, 8), fine = valueNoise(rand, 64, 64);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = s.i(x, y);
    let g = 0.34 + (n(x / W, y / H) - 0.5) * 0.12 + (fine(x / W, y / H) - 0.5) * 0.06 + (rand() - 0.5) * 0.04;
    let h = 0.5, sp = 0.15;
    if (x % 128 < 2 || y % 128 < 2) { g *= 0.55; h = 0.2; }
    if (n(x / W * 3, y / H * 3) > 0.74) { g *= 0.6; sp = 0.6; } // óleo
    let tint = [1, 0.99, 0.96];
    if (x > 200 && x < 212) { tint = [1.9, 1.55, 0.5]; g = Math.max(g, 0.3); } // faixa amarela
    s.setGray(i, g, tint);
    s.height[i] = h; s.spec[i] = sp;
  }
  return s.textures({ normalStrength: 1.5 });
}

function waterNormal(seed = 97) {
  const rand = mulberry32(seed);
  const W = 256, H = 256;
  const s = new Surface(W, H);
  const a = valueNoise(rand, 16, 16), b = valueNoise(rand, 48, 48);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = s.i(x, y);
    s.height[i] = a(x / W, y / H) * 0.6 + b(x / W, y / H) * 0.4;
    s.setGray(i, 0.05, [0.8, 0.95, 1.1]);
    s.spec[i] = 1;
  }
  return s.textures({ normalStrength: 6 });
}

// Portêiner: pórtico com quatro pernas, lança sobre a água, contra-lança, torre em A, cabine e cabos.
function craneGeometry() {
  const red = [], white = [], dark = [];
  const G = 16, L = 18, H = 42; // bitola (x), distância entre pernas (z), altura da viga
  for (const lx of [0, G]) for (const lz of [-L / 2, L / 2]) {
    (lz < 0 ? red : white).push(box(1.4, H, 1.4, lx, H / 2, lz));
    dark.push(box(2.2, 1.2, 3.2, lx, 0.6, lz)); // truques das rodas
  }
  for (const lx of [0, G]) {
    white.push(box(1.2, 1.6, L + 1.4, lx, 12, 0), box(1.2, 1.2, L + 1.4, lx, H - 6, 0));
    // diagonais
    const diag = new THREE.BoxGeometry(0.5, Math.hypot(L, H - 18), 0.5).toNonIndexed();
    diag.rotateX(Math.atan2(L, H - 18)).translate(lx, (H + 12) / 2 - 3, 0);
    red.push(diag);
  }
  for (const lz of [-L / 2, L / 2]) red.push(box(G + 1.4, 1.6, 1.4, G / 2, H, lz));
  // lança (sobre a água, +X) e contra-lança (-X) em treliça: banzos e montantes
  const boomX0 = -22, boomX1 = G + 52, boomY = H + 3;
  for (const lz of [-1.8, 1.8]) {
    white.push(box(boomX1 - boomX0, 1.0, 0.8, (boomX0 + boomX1) / 2, boomY, lz));
    white.push(box(boomX1 - boomX0, 0.6, 0.6, (boomX0 + boomX1) / 2, boomY + 3, lz));
    for (let x = boomX0; x < boomX1; x += 4) {
      red.push(box(0.3, 3, 0.3, x, boomY + 1.5, lz));
      const d = new THREE.BoxGeometry(0.22, 5, 0.22).toNonIndexed();
      d.rotateZ(Math.PI / 5).translate(x + 2, boomY + 1.5, lz);
      red.push(d);
    }
  }
  // torre em A e estais
  const apex = H + 26;
  for (const lz of [-L / 2 + 2, L / 2 - 2]) {
    for (const [x0, x1] of [[0, G * 0.35], [G, G * 0.35]]) {
      const len = Math.hypot(x1 - x0, apex - H);
      const leg = new THREE.BoxGeometry(0.9, len, 0.9).toNonIndexed();
      leg.rotateZ(Math.atan2(x0 - x1, apex - H)).translate((x0 + x1) / 2, (H + apex) / 2, lz);
      white.push(leg);
    }
  }
  white.push(box(2, 2, L - 2, G * 0.35, apex, 0));
  // casa de máquinas na contra-lança e cabine do operador
  white.push(box(12, 5, 7, -14, boomY + 3.5, 0));
  dark.push(box(3, 2.6, 3, G + 8, boomY - 3, 2.5));
  // cabos e spreader pendurado sobre a água
  const cables = [];
  for (const [x0, x1] of [[G * 0.35, boomX1 - 2], [G * 0.35, boomX0 + 2]]) {
    for (const lz of [-1.8, 1.8]) cables.push(x0, apex, lz, x1, boomY + 3, lz);
  }
  for (const lz of [-0.8, 0.8]) cables.push(G + 30, boomY, lz, G + 30, 14, lz);
  dark.push(box(2.4, 1.2, 12, G + 30, 13, 0));
  const m = (list) => mergeGeometries(list);
  return { red: m(red), white: m(white), dark: m(dark), cables, lights: [[G * 0.35, apex + 1.4, 0], [boomX1, boomY + 1, 0], [boomX0, boomY + 1, 0]] };
}

export function buildPort(root, { rand, track, distanceToTrack, glowTexture, aviation }) {
  const zMin = -230, zMax = 230;
  // --- Piso do pátio e do cais -----------------------------------------------------------------------
  const apron = apronTextures();
  apron.map.repeat.set(12, 36); apron.normalMap.repeat.set(12, 36); apron.specularMap.repeat.set(12, 36);
  const apronMat = new THREE.MeshPhongMaterial({ map: apron.map, normalMap: apron.normalMap, specularMap: apron.specularMap, specular: 0x404448, shininess: 30 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(PORT.quayX - 160, zMax - zMin), apronMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((PORT.quayX + 160) / 2, 0.012, 0);
  root.add(floor);

  // Muro do cais, cabeços de amarração e defensas de borracha
  const quayWall = new THREE.Mesh(new THREE.PlaneGeometry(zMax - zMin, 3), new THREE.MeshLambertMaterial({ color: 0x5a5854 }));
  quayWall.rotation.y = Math.PI / 2;
  quayWall.position.set(PORT.quayX, -1.4, 0);
  root.add(quayWall);
  const bollardGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.22, 0.26, 0.6, 12).translate(0, 0.3, 0).toNonIndexed(),
    new THREE.CylinderGeometry(0.34, 0.3, 0.12, 12).translate(0, 0.66, 0).toNonIndexed(),
  ]);
  const fenderGeo = new THREE.BoxGeometry(0.5, 1.6, 2.2).translate(0.25, -0.6, 0);
  const bollards = new THREE.InstancedMesh(bollardGeo, new THREE.MeshLambertMaterial({ color: 0x222326 }), 40);
  const fenders = new THREE.InstancedMesh(fenderGeo, new THREE.MeshLambertMaterial({ color: 0x0c0c0c }), 40);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < 40; i++) {
    const z = zMin + 6 + i * ((zMax - zMin - 12) / 39);
    bollards.setMatrixAt(i, m4.compose(p.set(PORT.quayX - 1.2, 0, z), q, one));
    fenders.setMatrixAt(i, m4.compose(p.set(PORT.quayX, 0, z + 5), q, one));
  }
  root.add(bollards, fenders);

  // --- Baía ----------------------------------------------------------------------------------------------
  const wn = waterNormal();
  wn.normalMap.repeat.set(60, 60);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 2400),
    new THREE.MeshPhongMaterial({ color: 0x050a10, specular: 0x7f8fa8, shininess: 90, normalMap: wn.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), combine: THREE.MixOperation, reflectivity: 0.35 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(PORT.quayX + 800, PORT.waterY, 0);
  root.add(water);

  // --- Contêineres ---------------------------------------------------------------------------------------
  const ct = containerTextures();
  const cGeo = new THREE.BoxGeometry(2.44, 2.59, 12.19);
  const uv = cGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4); // +X, -X, +Y, -Y, +Z, -Z
    const u = uv.getX(i);
    uv.setX(i, face >= 4 ? 0.5 + u * 0.5 : u * 0.5);
  }
  cGeo.translate(0, 2.59 / 2, 0);
  const palette = [0xa8261e, 0x1f4f8a, 0x2c6a3a, 0xc2621a, 0x8a8f94, 0xd8d6ce, 0x6a1a22, 0x1a7a82, 0xb89a2a, 0x3a3d44];
  const spots = [];
  for (let bx = PORT.yardX0; bx < PORT.yardX1 - 6; bx += 3 * 2.55 + 6) {
    for (let bz = zMin + 10; bz < zMax - 14; bz += 3 * 12.4 + 8) {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const x = bx + r * 2.55, z = bz + c * 12.4;
        if (distanceToTrack(track, x, z) < 36) continue;
        const stack = 1 + Math.floor(rand() * 4 * (0.4 + rand() * 0.6));
        for (let k = 0; k < stack; k++) spots.push([x, k * 2.6, z + (rand() - 0.5) * 0.3, palette[Math.floor(rand() * palette.length)]]);
      }
    }
  }
  const containers = new THREE.InstancedMesh(cGeo, new THREE.MeshPhongMaterial({ map: ct.map, normalMap: ct.normalMap, specularMap: ct.specularMap, specular: 0x333333, shininess: 25, emissive: 0xffd2a0, emissiveMap: ct.map, emissiveIntensity: 0.55 }), spots.length);
  // A luz dos refletores (emissive) também leva a cor de cada contêiner
  containers.material.onBeforeCompile = function (shader, renderer) {
    THREE.Material.prototype.onBeforeCompile.call(this, shader, renderer); // névoa do jogo
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #ifdef USE_COLOR
        totalEmissiveRadiance *= vColor;
      #endif`);
  };
  containers.material.customProgramCacheKey = () => 'conteiner';
  const col = new THREE.Color();
  spots.forEach(([x, y, z, c], i) => {
    containers.setMatrixAt(i, m4.compose(p.set(x, y, z), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, (rand() - 0.5) * 0.02), one));
    containers.setColorAt(i, col.setHex(c));
  });
  root.add(containers);

  // --- Torres de iluminação do pátio ---------------------------------------------------------------------
  const glow = glowTexture();
  const mastGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.35, 0.6, 32, 10).translate(0, 16, 0).toNonIndexed(),
    new THREE.CylinderGeometry(2.4, 2.4, 0.4, 16).translate(0, 32.2, 0).toNonIndexed(),
  ]);
  const mastMat = new THREE.MeshLambertMaterial({ color: 0x4a4c50 });
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.5, 0.7) });
  const flareMat = new THREE.SpriteMaterial({ map: glow, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const poolMat = new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(0.35, 0.24, 0.12), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  for (let z = zMin + 40; z < zMax; z += 80) {
    const x = (PORT.yardX0 + PORT.quayX) / 2 + 4;
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(x, 0, z);
    root.add(mast);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.6), lampMat);
      lamp.position.set(x + Math.cos(a) * 1.8, 32.6, z + Math.sin(a) * 1.8);
      root.add(lamp);
    }
    const flare = new THREE.Sprite(flareMat);
    flare.position.set(x, 32.4, z);
    flare.scale.setScalar(14);
    root.add(flare);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), poolMat);
    pool.position.set(x, 0.05, z);
    root.add(pool);
  }

  // --- Portêineres ---------------------------------------------------------------------------------------
  const crane = craneGeometry();
  // luz dos refletores do cais "pintada" no material (sem luz dinâmica)
  const redMat = new THREE.MeshLambertMaterial({ color: 0xa3241c, emissive: 0x3a0c08 });
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xc9c9c2, emissive: 0x3a3228 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c1d20 });
  const cableSegs = [];
  const redGlow = glowTexture();
  for (const cz of [-150, -60, 30, 120]) {
    const group = new THREE.Group();
    group.position.set(PORT.quayX - 18, 0, cz);
    group.add(new THREE.Mesh(crane.red, redMat), new THREE.Mesh(crane.white, whiteMat), new THREE.Mesh(crane.dark, darkMat));
    root.add(group);
    for (let i = 0; i < crane.cables.length; i += 6) {
      cableSegs.push(crane.cables[i] + group.position.x, crane.cables[i + 1], crane.cables[i + 2] + cz, crane.cables[i + 3] + group.position.x, crane.cables[i + 4], crane.cables[i + 5] + cz);
    }
    for (const [lx, ly, lz] of crane.lights) {
      const light = new THREE.Sprite(new THREE.SpriteMaterial({ map: redGlow, color: 0xff2a2a, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      light.position.set(group.position.x + lx, ly, cz + lz);
      light.scale.setScalar(6);
      light.userData.phase = rand() * Math.PI * 2;
      root.add(light);
      aviation.push(light);
    }
  }
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(cableSegs, 3)), new THREE.LineBasicMaterial({ color: 0x15161a })));

  return { water, apronMat };
}
