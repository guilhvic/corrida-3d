// Modelos 3D dos carros com detalhe no nível de um jogo de PS2 tardio. A carroceria vem de um
// "design" (src/carDesigns.js): seções da lataria, estufa, recortes e as peças próprias de cada carro.
// Aqui ficam as partes comuns: materiais, interior, rodas, luzes e junção das malhas.
// Frente para +Z, esquerda para +X, eixos em z=+a e z=-b.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAR } from './physics.js';
import { glowTexture } from './world.js';
import { lightConeMaterial } from './fog.js';
import { Shell, loft, roundedRect, roundedPolygon, flatShape, canvasTex, mergeByMaterial } from './carShell.js';
import { DESIGNS } from './carDesigns.js';

const R = CAR.wheelRadius;

// Pneu com ombro arredondado (perfil girado em torno do eixo).
function tireGeometry() {
  const P = [[0.2, -0.104], [0.245, -0.112], [0.29, -0.112], [0.317, -0.1], [0.329, -0.074], [0.332, 0],
    [0.329, 0.074], [0.317, 0.1], [0.29, 0.112], [0.245, 0.112], [0.2, 0.104]];
  const g = new THREE.LatheGeometry(P.map(([r, y]) => new THREE.Vector2((r * R) / 0.332, y)), 28);
  g.rotateZ(Math.PI / 2);
  return g;
}

// Raio radial: caixa afinando para fora e com o centro saltado (aro côncavo).
function spoke(side, width, depth, taper, dish) {
  const g = new THREE.BoxGeometry(width, 0.165, depth, 1, 2, 1);
  const p = g.attributes.position;
  for (let v = 0; v < p.count; v++) {
    const y = p.getY(v);
    if (y > 0) p.setZ(v, p.getZ(v) * taper);
    p.setX(v, p.getX(v) + side * dish * (0.5 - y / 0.165));
  }
  g.computeVertexNormals();
  g.translate(0, 0.045 + 0.0825, 0);
  return g;
}

// Face do aro numa geometria só; side = +1 roda esquerda, -1 direita.
// six: 6 raios de competição · five: 5 raios largos · mesh: 10 raios finos de aro "daisy"
// eight: 8 raios finos e côncavos · disc: disco fechado com furos de ventilação · twin: 5 pares de raios finos
function rimFaceGeometry(style, side) {
  const parts = [];
  if (style === 'disc') {
    const dish = new THREE.CylinderGeometry(0.2, 0.21, 0.022, 24);
    dish.rotateZ(Math.PI / 2);
    dish.translate(side * 0.01, 0, 0);
    parts.push(dish);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI * 2) / 6;
      const hole = new THREE.CylinderGeometry(0.028, 0.028, 0.026, 8);
      hole.rotateZ(Math.PI / 2);
      hole.translate(side * 0.014, Math.sin(a) * 0.13, Math.cos(a) * 0.13);
      parts.push(hole);
    }
  }
  if (style === 'twin') {
    for (let i = 0; i < 10; i++) {
      const g = spoke(side, 0.014, 0.03, 0.7, 0.02);
      g.rotateX((Math.floor(i / 2) * Math.PI * 2) / 5 + (i % 2 ? 0.16 : -0.16));
      parts.push(g);
    }
  }
  const count = style === 'five' ? 5 : style === 'mesh' ? 10 : style === 'eight' ? 8 : style === 'disc' || style === 'twin' ? 0 : 6;
  for (let i = 0; i < count; i++) {
    const g = style === 'five' ? spoke(side, 0.022, 0.075, 0.7, 0.012)
      : style === 'mesh' ? spoke(side, 0.016, 0.028, 0.8, 0.006)
        : style === 'eight' ? spoke(side, 0.018, 0.034, 0.6, 0.026)
          : spoke(side, 0.024, 0.05, 0.55, 0.022);
    g.rotateX((i * Math.PI * 2) / count);
    parts.push(g);
  }
  if (style === 'mesh') {
    const ring = new THREE.TorusGeometry(0.1, 0.008, 5, 24);
    ring.rotateY(Math.PI / 2);
    ring.translate(side * 0.008, 0, 0);
    parts.push(ring);
  }
  const hub = new THREE.CylinderGeometry(0.05, 0.058, 0.04, 12);
  hub.rotateZ(Math.PI / 2);
  hub.translate(side * 0.028, 0, 0);
  parts.push(hub);
  for (let i = 0; i < 4 + (style === 'six' ? 1 : 0); i++) {
    const n = 4 + (style === 'six' ? 1 : 0);
    const a = (i * Math.PI * 2) / n;
    const nut = new THREE.CylinderGeometry(0.009, 0.009, 0.02, 6);
    nut.rotateZ(Math.PI / 2);
    nut.translate(side * 0.05, Math.sin(a) * 0.03, Math.cos(a) * 0.03);
    parts.push(nut);
  }
  return mergeGeometries(parts);
}

// Placa japonesa de carro particular: fundo branco, letras verdes, cidade + classe em cima, kana + número embaixo.
function plateTexture([top, kana, number]) {
  return canvasTex(128, 64, (ctx, w, h) => {
    const jp = '"Yu Gothic", "Meiryo", "Hiragino Kaku Gothic ProN", sans-serif';
    ctx.fillStyle = '#f3f2ea'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1d6b34'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = '#1d6b34'; ctx.textBaseline = 'middle';
    ctx.font = `700 16px ${jp}`; ctx.textAlign = 'center'; ctx.fillText(top, w / 2, 16);
    ctx.font = `700 18px ${jp}`; ctx.textAlign = 'left'; ctx.fillText(kana, 10, 44);
    ctx.font = '700 30px "Arial Narrow", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(number, w / 2 + 10, 44);
  });
}

// --- Danos: amassados (deslocam vértices) e riscos na pintura, no próprio shader dos materiais ---------
// uDent = (frente, traseira, esquerda, direita) 0..1; uScratch = (esquerda, direita) 0..1; uCarZ = (traseira, frente) da lataria.
const DAMAGE_VERTEX = /* glsl */ `
  vec3 dmgP = transformed;
  float dmgLow = 1.0 - smoothstep(0.55, 0.9, dmgP.y);
  float dmgFront = smoothstep(uCarZ.y - 0.6, uCarZ.y, dmgP.z) * dmgLow;
  float dmgRear = smoothstep(uCarZ.x + 0.6, uCarZ.x, dmgP.z) * dmgLow;
  float dmgN = 0.55 + 0.45 * sin(dmgP.x * 23.0 + dmgP.y * 17.0) * sin(dmgP.z * 11.0 + dmgP.x * 5.0);
  transformed.z -= uDent.x * dmgFront * 0.17 * dmgN;
  transformed.z += uDent.y * dmgRear * 0.15 * dmgN;
  transformed.y -= (uDent.x * dmgFront + uDent.y * dmgRear) * 0.035 * dmgN * smoothstep(0.0, 0.3, abs(dmgP.x));
  float dmgBand = smoothstep(0.25, 0.4, dmgP.y) * (1.0 - smoothstep(0.85, 1.0, dmgP.y));
  float dmgAlong = 0.6 + 0.4 * sin(dmgP.z * 3.1 + 1.0);
  transformed.x -= uDent.z * smoothstep(0.45, 0.8, dmgP.x) * dmgBand * 0.075 * dmgN * dmgAlong;
  transformed.x += uDent.w * smoothstep(-0.45, -0.8, dmgP.x) * dmgBand * 0.075 * dmgN * dmgAlong;
  vDmgPos = dmgP;
`;
const DAMAGE_FRAGMENT = /* glsl */ `
  {
    float dmgSide = vDmgPos.x > 0.0 ? uScratch.x : uScratch.y;
    float dmgBandF = smoothstep(0.3, 0.42, vDmgPos.y) * (1.0 - smoothstep(0.82, 0.95, vDmgPos.y)) * smoothstep(0.5, 0.72, abs(vDmgPos.x));
    // Riscos finos e compridos na horizontal: poucas faixas de ~2 cm, em trechos de meio metro com falhas
    vec2 cell = vec2(vDmgPos.z * 2.2, vDmgPos.y * 38.0);
    float seed = fract(sin(dot(floor(cell), vec2(127.1, 311.7))) * 43758.5453);
    float thin = step(0.42, fract(cell.y)) * step(fract(cell.y), 0.6);
    float gaps = step(0.18, fract(cell.x + seed * 5.0)) * step(fract(vDmgPos.z * 31.0 + seed * 9.0), 0.85);
    float streak = step(1.0 - dmgSide * 0.38, seed) * thin * gaps;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.66, 0.64, 0.6), streak * dmgBandF * 0.9);
    // Para-choque amassado fica sujo e com a tinta rachada
    float dmgLowF = 1.0 - smoothstep(0.55, 0.9, vDmgPos.y);
    float dmgEnds = uDent.x * smoothstep(uCarZ.y - 0.5, uCarZ.y, vDmgPos.z) + uDent.y * smoothstep(uCarZ.x + 0.5, uCarZ.x, vDmgPos.z);
    float crack = step(0.82, fract(sin(dot(floor(vDmgPos.xy * 40.0 + vDmgPos.z * 13.0), vec2(12.9898, 78.233))) * 43758.5453));
    diffuseColor.rgb *= 1.0 - clamp(dmgEnds * dmgLowF, 0.0, 1.0) * (0.25 + 0.35 * crack);
  }
`;

function applyDamageShader(material, uniforms, paint) {
  if (!material || material.isShaderMaterial || material.userData.damage) return;
  material.userData.damage = true;
  material.onBeforeCompile = function (shader, renderer) {
    THREE.Material.prototype.onBeforeCompile.call(this, shader, renderer); // relógio e cor da névoa
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uDent;\nuniform vec2 uCarZ;\nvarying vec3 vDmgPos;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${DAMAGE_VERTEX}`);
    if (paint) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec4 uDent;\nuniform vec2 uCarZ;\nuniform vec2 uScratch;\nvarying vec3 vDmgPos;')
        .replace('#include <color_fragment>', `#include <color_fragment>\n${DAMAGE_FRAGMENT}`);
    }
  };
  material.customProgramCacheKey = () => (paint ? 'dano-pintura' : 'dano');
  material.needsUpdate = true;
}

// Adesivo de porta em canvas: fundo transparente, texto japonês no estilo escolhido.
function stickerTexture(sticker) {
  return canvasTex(512, 128, (ctx, w, h) => {
    const jp = '"Yu Gothic", "Meiryo", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif';
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (sticker.style === 'sponsor') {
      ctx.fillStyle = '#ffd21a'; ctx.fillRect(60, 22, w - 120, h - 44);
      ctx.fillStyle = '#111'; ctx.fillRect(66, 28, 70, h - 56);
      ctx.fillStyle = '#ffd21a'; ctx.font = '900 44px Arial Black, Arial, sans-serif'; ctx.fillText('Z', 101, h / 2 + 2);
      ctx.fillStyle = '#111'; ctx.font = `900 46px ${jp}`; ctx.fillText(sticker.text, w / 2 + 40, h / 2 + 2, w - 220);
    } else if (sticker.style === 'kanji') {
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 56, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c0141c'; ctx.font = `900 84px ${jp}`; ctx.fillText(sticker.text, w / 2, h / 2 + 4);
    } else {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      if (sticker.style === 'brush') ctx.transform(1, 0, -0.25, 1, 0, 0);
      ctx.font = `900 ${sticker.style === 'brush' ? 92 : 70}px ${jp}`;
      ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = '#111';
      ctx.strokeText(sticker.text, 0, 4, w - 40);
      ctx.fillStyle = '#f4f4f0'; ctx.fillText(sticker.text, 0, 4, w - 40);
      if (sticker.style === 'block') { ctx.fillStyle = '#d0202a'; ctx.fillRect(-(w - 80) / 2, 44, w - 80, 8); }
      ctx.restore();
    }
  });
}

// headlight: false dispensa a SpotLight (rivais: cada luz a mais pesa em todos os materiais da cena).
// look (garagem): { color, rims, rimColor, wing ('original'|'none'|'gt'|'duck'), drop (m), sticker { text, style } }
export function createCarModel({ design: designId = 'kaze180', color, ghost = false, envMap = null, headlight: withHeadlight = true, look = null } = {}) {
  const design = DESIGNS[designId] || DESIGNS.kaze180;
  const root = new THREE.Group();
  root.rotation.order = 'YXZ'; // rumo e depois a inclinação da rampa
  const body = new THREE.Group(); // recebe rolagem/arfagem
  root.add(body);

  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.25, depthWrite: false });
  const mat = (m) => (ghost ? ghostMat : m);
  const glowMat = (c) => (ghost ? ghostMat : new THREE.MeshBasicMaterial({ color: c }));

  const paintSpec = { color: look?.color ?? color ?? design.color, specular: 0xffffff, shininess: 90, envMap, reflectivity: 0.3, combine: THREE.MixOperation };
  const paint = mat(new THREE.MeshPhongMaterial(paintSpec));
  const shellPaint = mat(new THREE.MeshPhongMaterial({ ...paintSpec, vertexColors: true }));
  // Vidro fumê semitransparente: reflete a cidade e deixa ver o interior.
  const glass = mat(new THREE.MeshPhongMaterial({
    color: 0x0b0f14, specular: 0xaabbcc, shininess: 140, envMap, reflectivity: 0.6, combine: THREE.MixOperation,
    transparent: true, opacity: 0.55, depthWrite: false,
  }));
  const trim = mat(new THREE.MeshPhongMaterial({ color: 0x0e0e10, specular: 0x333333, shininess: 30 }));
  const chrome = mat(new THREE.MeshPhongMaterial({ color: 0xc9ccd2, specular: 0xffffff, shininess: 120, envMap, reflectivity: 0.8, combine: THREE.MixOperation }));
  const rimColor = look?.rimColor ?? design.wheels.color ?? 0x8c6a2c;
  const rimMat = mat(new THREE.MeshPhongMaterial({ color: rimColor, specular: 0xffe0a0, shininess: 80, envMap, reflectivity: 0.35, combine: THREE.MixOperation }));
  const seam = mat(new THREE.MeshBasicMaterial({ color: 0x050505 }));
  const plateMat = ghost ? trim : new THREE.MeshLambertMaterial({ map: plateTexture(design.plate) });
  const mats = {
    paint, shellPaint, glass, trim, chrome, seam, plateMat,
    amber: glowMat(new THREE.Color(1.4, 0.55, 0.08)),
    fogLamp: glowMat(new THREE.Color(1.8, 1.7, 1.4)),
    markerAmber: glowMat(new THREE.Color(1.6, 0.6, 0.1)),
    markerRed: glowMat(0x9a1010),
    rubber: mat(new THREE.MeshLambertMaterial({ color: 0x151517 })),
  };

  const { a, b } = design.axles;
  const shell = new Shell(design.shell, { squareness: design.squareness ?? 6 });
  const arch = { axles: [a, -b], radius: 0.37, centerY: R - 0.005, wellX: 0.655 };
  const wellMat = mat(new THREE.MeshLambertMaterial({ color: 0x0d0d0f }));
  body.add(new THREE.Mesh(shell.geometry({ arch, cockpit: design.cockpit }), [shellPaint, wellMat]));
  if (design.cabin) {
    const cabinMesh = new THREE.Mesh(loft(design.cabin), glass);
    cabinMesh.renderOrder = 1; // desenhado depois do interior
    body.add(cabinMesh);
  }
  if (design.roof) body.add(new THREE.Mesh(loft(design.roof), paint));

  // --- Ferramentas para as peças -----------------------------------------------------------------
  const box = (w, h, d, material, x, y, z, rx = 0, parent = body) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    parent.add(m);
    return m;
  };
  const up = new THREE.Vector3(0, 1, 0);
  const bar = (p0, p1, r, material, parent = body, sides = 6) => {
    const A = new THREE.Vector3(...p0), B = new THREE.Vector3(...p1);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), sides), material);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(up, B.clone().sub(A).normalize());
    parent.add(m);
    return m;
  };
  const polyline = (points, r, material) => {
    for (let i = 0; i < points.length - 1; i++) bar(points[i], points[i + 1], r, material);
  };
  // Peça plana virada para +Z (ou -Z com back) colada na frente/traseira.
  const plate = (geometry, material, x, y, z, back = false) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    if (back) m.rotation.y = Math.PI;
    body.add(m);
    return m;
  };
  const mesh = (geometry, material) => {
    const m = new THREE.Mesh(geometry, material);
    body.add(m);
    return m;
  };
  const onTop = (z, x, lift = 0.002) => [x, shell.topY(z, x) + lift, z];
  const onSide = (s, z, y, out = 0.002) => [s * (shell.sideX(z, y) + out), y, z];
  const NOSE = shell.zMax + 0.002, TAIL = shell.zMin - 0.003;
  const plateGeo = flatShape(roundedRect(0.3, 0.15, 0.01), 2);

  // Faróis escamoteáveis levantados (usados pelo coupé e pelo roadster).
  const popups = ({ x, z, width = 0.4, height = 0.13, depth = 0.2, lens }) => {
    const podGeo = new THREE.ExtrudeGeometry(roundedRect(width, height, height * 0.42), {
      depth, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.014, bevelSegments: 3, curveSegments: 10,
    });
    podGeo.translate(0, height * 0.23, -depth / 2);
    const bezelGeo = flatShape(roundedRect(width - 0.028, height - 0.022, height * 0.36));
    const lensGeo = flatShape(roundedRect(width - 0.05, height - 0.042, height * 0.3));
    const beams = [];
    for (const s of [-1, 1]) {
      const pod = new THREE.Group();
      pod.position.set(s * x, shell.topY(z, x), z);
      pod.add(new THREE.Mesh(podGeo, paint));
      const bezel = new THREE.Mesh(bezelGeo, trim);
      bezel.position.set(0, height * 0.23, depth / 2 + 0.0195);
      pod.add(bezel);
      const lensMesh = new THREE.Mesh(lensGeo, lens);
      lensMesh.position.set(0, height * 0.23, depth / 2 + 0.021);
      pod.add(lensMesh);
      body.add(pod);
      // Vão do capô atrás do farol levantado
      const gap = new THREE.Mesh(flatShape(roundedRect(width + 0.03, 0.06, 0.025)), seam);
      gap.rotation.x = -Math.PI / 2 - 0.12;
      gap.position.set(s * x, shell.topY(z - depth * 0.65, x) + 0.003, z - depth * 0.65);
      body.add(gap);
      beams.push([s * x, shell.topY(z, x) + height * 0.23, z + depth / 2 + 0.03]);
    }
    return beams;
  };
  // Lente com refletores redondos (count) e estrias.
  const lensTexture = (count = 2) => canvasTex(128, 32, (ctx, w, h) => {
    ctx.fillStyle = '#30343a'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < count; i++) {
      const cx = count === 1 ? w / 2 : w * (0.28 + (0.44 * i) / (count - 1));
      const rr = count === 1 ? h * 0.48 : h * 0.46;
      const g = ctx.createRadialGradient(cx, h / 2, 1, cx, h / 2, rr);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#e9eef2'); g.addColorStop(0.8, '#8c939b'); g.addColorStop(1, '#3a3e44');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, h / 2, rr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    for (let x = 0; x < w; x += 4) ctx.fillRect(x, 0, 1, h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 3, w, 1);
  });
  const lampMat = (texture, c = new THREE.Color(2.4, 2.35, 2.1)) => (ghost ? trim : new THREE.MeshBasicMaterial({ map: texture, color: c, side: THREE.DoubleSide }));

  const ctx = {
    THREE, ghost, body, root, shell, mats, design, box, bar, polyline, plate, mesh, onTop, onSide, NOSE, TAIL, plateGeo,
    popups, lensTexture, lampMat, canvasTex, roundedRect, roundedPolygon, flatShape, loft, axles: design.axles,
    aero: (m) => { aeroParts.push(m); return m; }, // aerofólio original (a garagem pode trocar)
  };
  const aeroParts = [];
  // Peças próprias do design: devolve { tailMat, tailFlares: [[x,y,z]], beams: [[x,y,z]] }.
  const parts = design.build(ctx);

  // --- Garagem: aerofólio, adesivos e altura ---------------------------------------------------------
  if (look && look.wing && look.wing !== 'original') {
    for (const m of aeroParts) m.removeFromParent();
    const zDeck = shell.zMin + 0.34;
    if (look.wing === 'gt') {
      const carbon = mat(new THREE.MeshPhongMaterial({ color: 0x141416, specular: 0x8a8a8a, shininess: 80 }));
      const deckY = shell.topY(zDeck, 0.42);
      const top = deckY + 0.32;
      const blade = box(1.52, 0.032, 0.3, carbon, 0, top, zDeck - 0.03, 0.14);
      blade.userData.garage = true;
      box(1.5, 0.012, 0.03, mats.markerRed, 0, top + 0.02, zDeck - 0.19, 0.14);           // gurney com luz
      for (const s of [-1, 1]) {
        box(0.03, 0.2, 0.4, paint, s * 0.775, top + 0.02, zDeck - 0.04);                   // placas laterais
        box(0.028, top - deckY, 0.07, carbon, s * 0.42, (top + deckY) / 2, zDeck);           // pés
        box(0.1, 0.02, 0.12, carbon, s * 0.42, deckY + 0.008, zDeck);                        // base
      }
    } else if (look.wing === 'duck') {
      const z = shell.zMin + 0.16;
      box(1.26, 0.05, 0.18, paint, 0, shell.topY(z, 0) + 0.035, z, -0.42);
    }
  }
  if (look?.sticker?.text && !ghost) {
    const tex = stickerTexture(look.sticker);
    const stickerMat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.35, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const zFront = a - 0.55, zRear = -b + 0.62;
    for (const s of [1, -1]) {
      // Lado esquerdo (+X) lido de fora corre da frente para trás; o direito, de trás para a frente.
      const geo = shell.patch({ z0: s > 0 ? zFront : zRear, z1: s > 0 ? zRear : zFront, th0: () => -0.03, th1: () => 0.07, side: s, lift: 0.006, nu: 6, nv: 16 });
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, v, u); }
      const sticker = new THREE.Mesh(geo, stickerMat);
      sticker.renderOrder = 1;
      body.add(sticker);
    }
  }
  if (look?.drop) body.position.y = -look.drop;

  // --- Interior (direção do lado direito, como no Japão) ------------------------------------------------
  const cabinDark = mat(new THREE.MeshLambertMaterial({ color: 0x1b1b1e }));
  const fabric = mat(new THREE.MeshLambertMaterial({ color: design.interior?.seat ?? 0x2b2b32 }));
  const accent = mat(new THREE.MeshLambertMaterial({ color: 0x8a1414 }));
  const cage = mat(new THREE.MeshPhongMaterial({ color: 0xa2a5ab, specular: 0xffffff, shininess: 60 }));
  const suit = mat(new THREE.MeshLambertMaterial({ color: design.interior?.suit ?? 0x1d3c78 }));
  const helmet = mat(new THREE.MeshPhongMaterial({ color: 0xe6e6e6, specular: 0xffffff, shininess: 90 }));
  const visor = mat(new THREE.MeshPhongMaterial({ color: 0x080808, specular: 0xffffff, shininess: 150 }));
  const gaugeGlow = ghost ? cabinDark : new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.95, 0.3) });
  const inside = { dashZ: 0.42, cage: 'half', shelf: true, floorY: 0.32, ...design.interior };

  box(1.5, 0.05, 2.4, cabinDark, 0, inside.floorY, -0.55);             // assoalho
  box(1.46, 0.16, 0.32, cabinDark, 0, 0.8, inside.dashZ, -0.15);       // painel
  box(0.46, 0.1, 0.12, cabinDark, -0.38, 0.9, inside.dashZ - 0.1);     // capelinha dos instrumentos
  for (const gx of [-0.46, -0.3]) {
    const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), gaugeGlow);
    gauge.position.set(gx, 0.9, inside.dashZ - 0.165);
    gauge.rotation.y = Math.PI;
    body.add(gauge);
  }
  box(0.22, 0.28, 0.9, cabinDark, 0, 0.5, -0.15);                      // console central
  bar([0, 0.64, -0.08], [0, 0.8, -0.14], 0.012, cage);                 // câmbio
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), cabinDark);
  knob.position.set(0, 0.81, -0.14);
  body.add(knob);
  bar([0.06, 0.62, -0.5], [0.06, 0.74, -0.28], 0.016, cage);           // freio de mão hidráulico

  for (const s of [-1, 1]) {                                            // bancos concha
    const sx = s * 0.38;
    box(0.46, 0.12, 0.48, fabric, sx, 0.47, -0.55);
    box(0.44, 0.6, 0.1, fabric, sx, 0.82, -0.84, -0.18);
    for (const k of [-1, 1]) box(0.07, 0.52, 0.16, fabric, sx + k * 0.21, 0.8, -0.8, -0.18);
    box(0.12, 0.5, 0.01, accent, sx, 0.82, -0.785, -0.18);
    box(0.26, 0.15, 0.1, fabric, sx, 1.16, -0.9, -0.18);
  }
  if (inside.shelf) box(1.4, 0.06, 0.6, cabinDark, 0, 0.84, -1.55);    // tampão traseiro

  if (inside.cage === 'half') {                                         // meia gaiola atrás dos bancos
    for (const s of [-1, 1]) {
      bar([s * 0.62, 0.35, -1.08], [s * 0.57, 1.17, -1.08], 0.022, cage);
      bar([s * 0.57, 1.17, -1.08], [s * 0.6, 0.86, -1.72], 0.02, cage);
    }
    bar([-0.57, 1.17, -1.08], [0.57, 1.17, -1.08], 0.022, cage);
    bar([0.6, 0.4, -1.08], [-0.57, 1.17, -1.08], 0.02, cage);
  } else if (inside.cage === 'hoop') {                                  // santantônio de roadster
    const hz = inside.hoopZ ?? -1.02, top = inside.hoopTop ?? 1.2;
    const pts = [[0.62, 0.62], [0.6, top - 0.1], [0.5, top - 0.02], [0.2, top], [-0.2, top], [-0.5, top - 0.02], [-0.6, top - 0.1], [-0.62, 0.62]];
    polyline(pts.map(([x, y]) => [x, y, hz]), 0.024, cage);
    for (const s of [-1, 1]) bar([s * 0.6, top - 0.1, hz], [s * 0.58, 0.72, hz - 0.45], 0.018, cage);
  }

  // Volante (gira com o esterço)
  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(-0.38, 0.93, inside.dashZ - 0.3);
  steeringWheel.rotation.x = 0.35;
  const wheelSpin = new THREE.Group();
  steeringWheel.add(wheelSpin);
  wheelSpin.add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 6, 16), cabinDark));
  box(0.34, 0.03, 0.02, cabinDark, 0, 0, 0, 0, wheelSpin);
  box(0.03, 0.17, 0.02, cabinDark, 0, -0.085, 0, 0, wheelSpin);
  box(0.02, 0.03, 0.01, accent, 0, 0.17, 0.012, 0, wheelSpin);          // marcação do centro
  body.add(steeringWheel);
  bar([-0.38, 0.84, inside.dashZ - 0.06], [-0.38, 0.93, inside.dashZ - 0.3], 0.025, cabinDark);

  // Piloto de capacete
  box(0.36, 0.5, 0.24, suit, -0.38, 0.8, -0.7, -0.18);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), helmet);
  head.position.set(-0.38, 1.13, -0.74);
  body.add(head);
  box(0.2, 0.07, 0.06, visor, -0.38, 1.14, -0.63);
  for (const k of [-1, 1]) {
    bar([-0.38 + k * 0.17, 0.98, -0.66], [-0.38 + k * 0.1, 0.84, -0.3], 0.045, suit);
    bar([-0.38 + k * 0.1, 0.84, -0.3], [-0.38 + k * 0.15, 0.93, inside.dashZ - 0.35], 0.04, suit);
  }

  // --- Rodas: pneu arredondado, aro, disco e pinça -----------------------------------------------------
  const tireGeo = tireGeometry();
  const tireTex = ghost ? null : canvasTex(128, 64, (c2, w, h) => {
    c2.fillStyle = '#262626'; c2.fillRect(0, 0, w, h);
    c2.fillStyle = '#161616'; c2.fillRect(0, h * 0.34, w, h * 0.32); // banda de rodagem
    c2.fillStyle = '#070707';
    c2.fillRect(0, h * 0.44, w, 2); c2.fillRect(0, h * 0.54, w, 2);
    for (let x = 0; x < w; x += 8) { c2.fillRect(x, h * 0.34, 2, h * 0.1); c2.fillRect(x + 4, h * 0.56, 2, h * 0.1); }
    c2.fillStyle = '#343434';                                            // letras em relevo na lateral
    for (let x = 6; x < w; x += 64) { c2.fillRect(x, h * 0.1, 20, 3); c2.fillRect(x, h * 0.86, 20, 3); }
  });
  const tireMat = mat(new THREE.MeshLambertMaterial({ color: 0xffffff, map: tireTex, side: THREE.DoubleSide }));
  const barrelGeo = new THREE.CylinderGeometry(R * 0.63, R * 0.63, 0.19, 20, 1, true);
  barrelGeo.rotateZ(Math.PI / 2);
  const barrelMat = mat(new THREE.MeshLambertMaterial({ color: 0x2a2a2c, side: THREE.DoubleSide }));
  const lipGeo = new THREE.TorusGeometry(R * 0.625, 0.012, 6, 28);
  lipGeo.rotateY(Math.PI / 2);
  const style = look?.rims ?? design.wheels.style ?? 'six';
  const faceGeo = { 1: rimFaceGeometry(style, 1), '-1': rimFaceGeometry(style, -1) };
  const discGeo = new THREE.CylinderGeometry(R * 0.55, R * 0.55, 0.026, 18);
  discGeo.rotateZ(Math.PI / 2);
  const discMat = mat(new THREE.MeshPhongMaterial({ color: 0x6a6a6a, specular: 0x999999, shininess: 40 }));
  const caliperGeo = new THREE.BoxGeometry(0.06, 0.12, 0.1);
  const caliperMat = mat(new THREE.MeshPhongMaterial({ color: design.wheels.caliper ?? 0xc0151b, specular: 0x666666, shininess: 50 }));

  const wheels = [];
  const wx = design.wheels.x ?? 0.78;
  for (const [x, z, front] of [[wx, a, true], [-wx, a, true], [wx, -b, false], [-wx, -b, false]]) {
    const side = Math.sign(x);
    const pivot = new THREE.Group();
    pivot.position.set(x, R, z);
    const spin = new THREE.Group();
    spin.add(new THREE.Mesh(tireGeo, tireMat));
    spin.add(new THREE.Mesh(barrelGeo, barrelMat));
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.x = -side * 0.03;
    spin.add(disc);
    const lip = new THREE.Mesh(lipGeo, chrome);
    lip.position.x = side * 0.092;
    spin.add(lip);
    const face = new THREE.Mesh(faceGeo[side], rimMat);
    face.position.x = side * 0.045;
    spin.add(face);
    pivot.add(spin);
    const caliper = new THREE.Mesh(caliperGeo, caliperMat);           // pinça (não gira)
    caliper.position.set(-side * 0.03, R * 0.32, -R * 0.3 * (front ? 1 : -1));
    pivot.add(caliper);
    root.add(pivot);
    wheels.push({ pivot, spin, front });
  }

  // Brilhos, sombra "bolha" e farol que ilumina a rua
  const tailFlares = [];
  if (!ghost) {
    const glow = glowTexture();
    // Só as lanternas ganham brilho: o dos faróis apareceria por cima do capô visto de trás.
    for (const [px, py, pz] of parts.tailFlares) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff2a1a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sprite.position.set(px, py, pz);
      sprite.scale.setScalar(0.55);
      body.add(sprite);
      tailFlares.push(sprite);
    }

    const length = shell.zMax - shell.zMin;
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, length + 0.55),
      new THREE.MeshBasicMaterial({ map: glow, color: 0x000000, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.set(0, 0.06, (shell.zMax + shell.zMin) / 2);
    root.add(blob);

    // Fachos dos faróis na névoa (ponta estreita no farol, abrindo para a frente)
    const beamGeo = new THREE.CylinderGeometry(0.1, 2.6, 16, 16, 1, true);
    beamGeo.rotateX(-Math.PI / 2);
    beamGeo.translate(0, 0, 8);
    const beamMat = lightConeMaterial(0xfff1d6, 0.05, 0.3);
    for (const [px, py, pz] of parts.beams) {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(px, py, pz);
      beam.rotation.x = 0.045; // levemente para baixo
      body.add(beam);
    }

    if (withHeadlight) {
      const headlight = new THREE.SpotLight(0xfff0d0, 90, 70, 0.5, 0.6, 1.2);
      headlight.position.set(0, 0.8, shell.zMax - 0.1);
      headlight.target.position.set(0, 0, 22);
      root.add(headlight, headlight.target);
    }
  } else {
    root.traverse((o) => { if (o.isMesh) o.renderOrder = 2; });
  }

  // Interior num grupo próprio: nos rivais some de longe.
  const interior = new THREE.Group();
  body.add(interior);
  if (!ghost) {
    const interiorMats = new Set([cabinDark, fabric, accent, cage, suit, helmet, visor, gaugeGlow]);
    for (const child of [...body.children]) {
      if (child === steeringWheel || (child.isMesh && interiorMats.has(child.material))) interior.add(child);
    }
  }
  mergeByMaterial(interior, new Set([steeringWheel]));
  mergeByMaterial(body, new Set([interior]));

  // Danos (só no carro "de verdade"; o fantasma não amassa)
  const damageUniforms = {
    uDent: { value: new THREE.Vector4() }, uScratch: { value: new THREE.Vector2() },
    uCarZ: { value: new THREE.Vector2(shell.zMin, shell.zMax) },
  };
  if (!ghost) {
    for (const child of body.children) {
      if (!child.isMesh || child === interior) continue;
      for (const m of [child.material].flat()) applyDamageShader(m, damageUniforms, m === paint || m === shellPaint);
    }
  }

  const envMaterials = [paint, shellPaint, glass, chrome, rimMat];
  return {
    root,
    design: designId,
    tailLights: parts.tailFlares, // [x, y, z] das lanternas (rastro de drift)
    paintMaterials: envMaterials,
    update(car) {
      root.position.set(car.x, (car.y || 0) + 0.03, car.z);
      root.rotation.y = car.yaw;
      root.rotation.x = -(car.pitch || 0);
      body.rotation.z = THREE.MathUtils.clamp(car.ay * 0.006, -0.06, 0.06);
      body.rotation.x = THREE.MathUtils.clamp(-car.ax * 0.004, -0.04, 0.04);
      for (const w of wheels) {
        if (w.front) w.pivot.rotation.y = car.steer;
        w.spin.rotation.x = car.wheelSpin;
      }
      wheelSpin.rotation.z = -car.steer * 2.5; // relação de direção ~14:1 encurtada para aparecer
      if (!ghost) {
        const braking = car.brake > 0.05;
        parts.tailMat.color.setScalar(braking ? 2.6 : 1.3);
        for (const f of tailFlares) f.scale.setScalar(braking ? 1.3 : 0.55);
      }
    },
    // d: { front, rear, left, right, scratchL, scratchR } em 0..1
    setDamage(d) {
      damageUniforms.uDent.value.set(d.front, d.rear, d.left, d.right);
      damageUniforms.uScratch.value.set(d.scratchL, d.scratchR);
    },
    setDetail(near) {
      interior.visible = near;
    },
    setPose(x, z, yaw, y = 0, pitch = 0) {
      root.position.set(x, y + 0.03, z);
      root.rotation.y = yaw;
      root.rotation.x = -pitch;
    },
    setEnvMap(texture) {
      envMap = texture;
      for (const m of envMaterials) { m.envMap = texture; m.needsUpdate = true; }
    },
    dispose() {
      root.removeFromParent();
      root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    },
    // Troca a carroceria procedural por um modelo .glb (as rodas do modelo ficam paradas).
    // config.rotacaoGraus corrige modelos que não apontam para +Z.
    useGltf(model, config = {}) {
      for (const child of body.children) if (!child.isSprite) child.visible = false;
      for (const w of wheels) w.pivot.visible = false;
      let bounds = new THREE.Box3().setFromObject(model);
      let size = bounds.getSize(new THREE.Vector3());
      model.rotation.y = THREE.MathUtils.degToRad(config.rotacaoGraus ?? (size.x > size.z ? 90 : 0));
      model.updateMatrixWorld(true);
      bounds = new THREE.Box3().setFromObject(model);
      size = bounds.getSize(new THREE.Vector3());
      model.scale.multiplyScalar(4.45 / Math.max(size.x, size.z));
      model.updateMatrixWorld(true);
      bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z + (b - a) / 2;
      model.position.y -= bounds.min.y;
      model.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of [].concat(o.material)) { if (envMap && 'envMap' in m) { m.envMap = envMap; m.needsUpdate = true; } }
      });
      body.add(model);
    },
  };
}
