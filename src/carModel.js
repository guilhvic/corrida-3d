// Modelos 3D dos carros. A carroceria vem de um design (src/cars/*.js): linhas de desenho da lataria
// (src/carBody.js), zonas de vidro e acabamento, vãos de portas/tampas e as peças próprias de cada carro
// (src/carParts.js). Aqui ficam as partes comuns: materiais, rodas (src/carWheels.js), interior,
// luzes, garagem (aerofólio, adesivo, altura), danos e a junção das malhas.
// Frente para +Z, esquerda para +X, eixos em z=+a e z=-b.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAR } from './physics.js';
import { glowTexture } from './world.js';
import { lightConeMaterial } from './fog.js';
import { DESIGNS } from './carDesigns.js';
import { CarBody } from './carBody.js';
import * as M from './carMaterials.js';
import * as W from './carWheels.js';
import * as P from './carParts.js';
import { SurfaceProbe } from './carProbe.js';

const R = CAR.wheelRadius;
const sides = [-1, 1];

// Lataria pronta por design (geometria compartilhada entre o jogador, rivais e fantasma)
const bodyCache = new Map();
function bodyFor(designId, design) {
  if (bodyCache.has(designId)) return bodyCache.get(designId);
  const { a, b } = design.axles;
  const shape = new CarBody(design.body);
  const arch = { axles: [a, -b], radius: design.arch?.radius ?? 0.37, centerY: R - 0.005, wellX: design.arch?.wellX ?? 0.6 };
  const built = shape.build({ arch, cockpit: design.cockpit });
  built.body.userData.shared = true;
  if (built.glass) built.glass.userData.shared = true;
  const probe = new SurfaceProbe(built.body, built.glass?.index?.array);
  const entry = { shape, built, probe };
  bodyCache.set(designId, entry);
  return entry;
}

// Placa japonesa de carro particular: fundo branco, letras verdes, cidade + classe em cima, kana + número embaixo.
function plateTexture([top, kana, number]) {
  return P.canvasTex(256, 128, (ctx, w, h) => {
    const jp = '"Yu Gothic", "Meiryo", "Hiragino Kaku Gothic ProN", sans-serif';
    ctx.fillStyle = '#f1f0e6'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1d6b34'; ctx.lineWidth = 5; ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = '#1d6b34'; ctx.textBaseline = 'middle';
    ctx.font = `700 30px ${jp}`; ctx.textAlign = 'center'; ctx.fillText(top, w / 2, 32);
    ctx.font = `700 34px ${jp}`; ctx.textAlign = 'left'; ctx.fillText(kana, 18, 88);
    ctx.font = '700 62px "Arial Narrow", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(number, w / 2 + 22, 88);
    for (const bx of [48, w - 48]) { ctx.fillStyle = '#c9c8bd'; ctx.beginPath(); ctx.arc(bx, 16, 5, 0, Math.PI * 2); ctx.fill(); }
  });
}

// Adesivo de porta em canvas: fundo transparente, texto japonês no estilo escolhido.
function stickerTexture(sticker) {
  return P.canvasTex(512, 128, (ctx, w, h) => {
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

// Instrumentos: conta-giros grande no centro, velocímetro e relógios menores, com iluminação laranja
function gaugeTexture() {
  return P.canvasTex(256, 96, (c) => {
    c.fillStyle = '#050505'; c.fillRect(0, 0, 256, 96);
    const dial = (cx, cy, r, marks) => {
      c.fillStyle = '#0d0d0f'; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ff9a3a'; c.lineWidth = 2;
      for (let i = 0; i <= marks; i++) {
        const an = Math.PI * 0.75 + (i / marks) * Math.PI * 1.5;
        c.beginPath(); c.moveTo(cx + Math.cos(an) * r * 0.78, cy + Math.sin(an) * r * 0.78); c.lineTo(cx + Math.cos(an) * r * 0.95, cy + Math.sin(an) * r * 0.95); c.stroke();
      }
      c.strokeStyle = '#ff3b1a'; c.lineWidth = 3;
      const an = Math.PI * 0.75 + 0.35 * Math.PI * 1.5;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(an) * r * 0.8, cy + Math.sin(an) * r * 0.8); c.stroke();
    };
    dial(128, 50, 42, 9);
    dial(56, 56, 30, 8);
    dial(200, 56, 30, 8);
  });
}

// headlight: false dispensa a SpotLight (rivais: cada luz a mais pesa em todos os materiais da cena).
// look (garagem): { color, finish, rims, rimColor, wing ('original'|'none'|'gt'|'duck'), drop (m), sticker { text, style } }
export function createCarModel({ design: designId = 'kaze180', color, ghost = false, envMap = null, headlight: withHeadlight = true, look = null } = {}) {
  const design = DESIGNS[designId] || DESIGNS.kaze180;
  const root = new THREE.Group();
  root.rotation.order = 'YXZ'; // rumo e depois a inclinação da rampa
  const body = new THREE.Group(); // recebe rolagem/arfagem
  root.add(body);
  const detail = new THREE.Group(); // peças miúdas (somem de longe nos rivais)
  body.add(detail);

  // --- Materiais --------------------------------------------------------------------------------------
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.22, depthWrite: false });
  const G = (m) => (ghost ? ghostMat : m);
  const paintColor = look?.color ?? color ?? design.color;
  const finish = look?.color ? (look.finish ?? 'solid') : (design.finish ?? 'solid');
  const paint = G(M.paintMaterial({ color: paintColor, finish, envMap }));
  const shellPaint = G(M.paintMaterial({ color: paintColor, finish, envMap, vertexColors: true }));
  const glow = (c) => G(M.glowMaterial(c));
  const std = (o) => G(new THREE.MeshStandardMaterial({ envMap, ...o }));
  const plateTex = ghost ? null : plateTexture(design.plate);
  const mats = {
    envMap, paint, shellPaint,
    glass: G(M.glassMaterial(envMap)),
    trim: G(M.blackTrimMaterial(envMap)),
    satin: G(M.satinBlackMaterial(envMap)),
    chrome: G(M.chromeMaterial(envMap)),
    rubber: G(M.rubberMaterial()),
    seam: G(new THREE.MeshBasicMaterial({ color: 0x040404 })),
    cavity: std({ color: 0x060607, roughness: 0.9 }),
    soot: G(new THREE.MeshBasicMaterial({ color: 0x0b0a09 })),
    underbody: std({ color: 0x101012, roughness: 0.85 }),
    well: std({ color: 0x0a0a0b, roughness: 1 }),
    plateMat: ghost ? ghostMat : new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.45, metalness: 0.1, envMap }),
    plateBack: std({ color: 0x1a1a1c, roughness: 0.6 }),
    mirrorGlass: std({ color: 0xbfc6cf, metalness: 1, roughness: 0.03 }),
    bulb: glow(new THREE.Color(2.6, 2.5, 2.25)),
    lensClear: G(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.16, envMap, envMapIntensity: 1.2, depthWrite: false })),
    projector: std({ color: 0x2a3140, metalness: 0.2, roughness: 0.05, envMapIntensity: 1.5 }),
    amber: std({ color: 0xff8a1c, emissive: 0xff6a00, emissiveIntensity: 0.25, roughness: 0.2 }),
    amberGlow: glow(new THREE.Color(1.5, 0.55, 0.08)),
    redLens: std({ color: 0x8a0a0e, emissive: 0x6a0005, emissiveIntensity: 0.5, roughness: 0.15 }),
    fogLamp: glow(new THREE.Color(1.9, 1.8, 1.45)),
    markerAmber: std({ color: 0xff8a1c, emissive: 0xff5a00, emissiveIntensity: 0.6, roughness: 0.2 }),
    markerRed: std({ color: 0xb01018, emissive: 0x800008, emissiveIntensity: 0.8, roughness: 0.2 }),
    carbon: std({ color: 0x141416, metalness: 0.4, roughness: 0.3 }),
    lamp: (texture, c = new THREE.Color(1, 1, 1)) => (ghost ? ghostMat : new THREE.MeshBasicMaterial({ map: texture, color: c })),
  };

  // --- Lataria ----------------------------------------------------------------------------------------
  const { a, b } = design.axles;
  const { shape, built, probe } = bodyFor(DESIGNS[designId] ? designId : 'kaze180', design);
  body.add(new THREE.Mesh(built.body, [shellPaint, mats.trim, mats.well]));
  if (built.glass) {
    const glassMesh = new THREE.Mesh(built.glass, mats.glass);
    glassMesh.renderOrder = 1; // desenhado depois do interior
    body.add(glassMesh);
  }

  const aeroParts = [];
  const ctx = {
    THREE, ghost, body: shape, probe, parent: body, detail, root, mats, design, look, R,
    axles: design.axles, NOSE: shape.zMax, TAIL: shape.zMin,
    aero: (m) => { aeroParts.push(m); return m; }, // aerofólio original (a garagem pode trocar)
  };
  ctx.popup = (spec) => P.popupHeadlight(ctx, spec);
  // Peças próprias do design: devolve { tailMat, tailFlares: [[x,y,z]], beams: [[x,y,z]] }
  const parts = ghost ? { tailMat: null, tailFlares: [], beams: [] } : design.build(ctx);

  // --- Garagem: aerofólio, adesivos e altura ---------------------------------------------------------
  if (!ghost && look?.wing && look.wing !== 'original') {
    for (const m of aeroParts) m.removeFromParent();
    const zDeck = shape.zMin + (design.wingDeck ?? 0.34);
    if (look.wing === 'gt') {
      const deckY = shape.topY(zDeck, 0.42);
      const top = deckY + 0.34;
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(0.16, 0); bladeShape.quadraticCurveTo(0.02, 0.05, -0.16, 0.012); bladeShape.lineTo(-0.16, -0.004); bladeShape.quadraticCurveTo(0.02, 0.018, 0.16, -0.012); bladeShape.closePath();
      const blade = P.extrude(bladeShape, 1.5, 0.004, 12);
      blade.rotateY(Math.PI / 2);
      P.addMesh(body, blade, mats.carbon, { pos: [0, top, zDeck - 0.03], rot: [0.12, 0, 0] });
      P.addMesh(body, new THREE.BoxGeometry(1.5, 0.012, 0.025), mats.markerRed, { pos: [0, top + 0.03, zDeck - 0.19] });
      for (const s of sides) {
        P.addMesh(body, P.roundedBox(0.02, 0.13, 0.32, 0.008), mats.carbon, { pos: [s * 0.76, top + 0.01, zDeck - 0.04] });
        P.addMesh(body, P.roundedBox(0.03, top - deckY, 0.08, 0.008), mats.satin, { pos: [s * 0.42, (top + deckY) / 2, zDeck] });
        P.addMesh(body, P.roundedBox(0.1, 0.02, 0.12, 0.006), mats.satin, { pos: [s * 0.42, deckY + 0.008, zDeck] });
      }
    } else if (look.wing === 'duck') {
      const z = shape.zMin + 0.14;
      P.addMesh(body, P.roundedBox(1.3, 0.05, 0.2, 0.02), paint, { pos: [0, shape.topY(z, 0) + 0.03, z], rot: [-0.38, 0, 0] });
    }
  }
  if (!ghost && look?.sticker?.text) {
    const tex = stickerTexture(look.sticker);
    const stickerMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const door = design.door ?? { z0: a - 0.6, z1: -b + 0.7 };
    for (const s of [1, -1]) {
      // Lado esquerdo (+X) lido de fora corre da frente para trás; o direito, de trás para a frente.
      const zA = s > 0 ? door.z0 : door.z1, zB = s > 0 ? door.z1 : door.z0;
      const gMid = (z) => shape.gAtY(z, design.stickerY ?? 0.52, 1, 4);
      const geo = shape.patch({ z0: zA, z1: zB, g0: (t) => gMid(zA + (zB - zA) * t) - 0.3, g1: (t) => gMid(zA + (zB - zA) * t) + 0.3, side: s, lift: 0.004, nu: 6, nv: 18 });
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, v, u); }
      const sticker = new THREE.Mesh(geo, stickerMat);
      sticker.renderOrder = 1;
      body.add(sticker);
    }
  }
  if (look?.drop) body.position.y = -look.drop;

  // --- Interior (direção do lado direito, como no Japão) ------------------------------------------------
  const interior = new THREE.Group();
  body.add(interior);
  const steeringWheel = new THREE.Group();
  const wheelSpin = new THREE.Group();
  if (!ghost) buildInterior({ interior, steeringWheel, wheelSpin, design });

  // --- Rodas -------------------------------------------------------------------------------------------
  const wheelSpec = { rr: design.wheels.rimRadius ?? 0.2, W: design.wheels.width ?? 0.215 };
  const style = look?.rims ?? design.wheels.style ?? 'six';
  const wtex = ghost ? null : W.wheelTextures();
  const tireMat = G(new THREE.MeshStandardMaterial({ color: 0xffffff, map: wtex?.tire ?? null, roughness: 0.86, metalness: 0 }));
  const rimColor = look?.rimColor ?? design.wheels.color ?? 0x8c6a2c;
  const rimMat = G(M.rimMaterial(rimColor, envMap));
  const lipMat = design.wheels.lip === 'polished' && !look?.rimColor ? mats.chrome : rimMat;
  const rotorMat = G(new THREE.MeshStandardMaterial({ map: wtex?.rotor ?? null, metalness: 0.85, roughness: 0.42, envMap }));
  const caliperMat = std({ color: design.wheels.caliper ?? 0xc0151b, roughness: 0.32, metalness: 0.1 });
  const wheels = [];
  const wx = design.wheels.x ?? 0.75;
  for (const [x, z, front] of [[wx, a, true], [-wx, a, true], [wx, -b, false], [-wx, -b, false]]) {
    const side = Math.sign(x);
    const pivot = new THREE.Group();
    pivot.position.set(x, R, z);
    const spin = new THREE.Group();
    spin.add(new THREE.Mesh(W.tireGeometry(R, wheelSpec.rr, wheelSpec.W), tireMat));
    spin.add(new THREE.Mesh(W.wheelRimGeometry(style, side, wheelSpec, lipMat === rimMat), rimMat));
    if (lipMat !== rimMat) spin.add(new THREE.Mesh(W.lipGeometry(side, wheelSpec), lipMat));
    const rotor = new THREE.Mesh(W.rotorGeometry(wheelSpec.rr), rotorMat);
    rotor.position.x = -side * 0.035;
    spin.add(rotor);
    pivot.add(spin);
    if (!ghost) {
      const caliper = new THREE.Mesh(W.caliperGeometry(wheelSpec.rr), caliperMat);
      caliper.position.x = -side * 0.035;
      caliper.rotation.x = front ? 0.55 : Math.PI - 0.55;
      pivot.add(caliper);
    }
    root.add(pivot);
    wheels.push({ pivot, spin, front });
  }

  // --- Brilhos, sombra e faróis ------------------------------------------------------------------------
  const tailFlares = [];
  if (!ghost) {
    const glowTex = glowTexture();
    // Só as lanternas ganham brilho: o dos faróis apareceria por cima do capô visto de trás.
    for (const [px, py, pz] of parts.tailFlares) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff2a1a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sprite.position.set(px, py, pz);
      sprite.scale.setScalar(0.5);
      body.add(sprite);
      tailFlares.push(sprite);
    }
    const length = shape.zMax - shape.zMin;
    const blobMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    // Sombra "bolha" do carro e contato dos pneus numa malha só
    const shadowParts = [new THREE.PlaneGeometry(2.25, length + 0.5).translate(0, -(shape.zMax + shape.zMin) / 2, 0)];
    for (const [x, z] of [[wx, a], [-wx, a], [wx, -b], [-wx, -b]]) shadowParts.push(new THREE.PlaneGeometry(0.5, 0.75).translate(x, -z, 0.002));
    const shadowGeo = mergeGeometries(shadowParts);
    shadowGeo.rotateX(-Math.PI / 2);
    shadowGeo.translate(0, 0.06, 0);
    shadowParts.forEach((g) => g.dispose());
    root.add(new THREE.Mesh(shadowGeo, blobMat));

    // Fachos dos faróis na névoa (ponta estreita no farol, abrindo para a frente)
    const beamGeo = new THREE.CylinderGeometry(0.1, 2.6, 16, 16, 1, true);
    beamGeo.rotateX(-Math.PI / 2);
    beamGeo.translate(0, 0, 8);
    const beamMat = lightConeMaterial(0xfff1d6, 0.05, 0.3);
    for (const [px, py, pz] of parts.beams) {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(px, py, pz);
      beam.rotation.x = 0.045;
      body.add(beam);
    }
    if (withHeadlight) {
      const headlight = new THREE.SpotLight(0xfff0d0, 90, 70, 0.5, 0.6, 1.2);
      headlight.position.set(0, 0.8, shape.zMax - 0.1);
      headlight.target.position.set(0, 0, 22);
      root.add(headlight, headlight.target);
    }
  } else {
    root.traverse((o) => { if (o.isMesh) o.renderOrder = 2; });
  }

  // Junta as peças estáticas (menos draw calls): interior vira uma malha só com cor por vértice
  bakeColors(wheelSpin, new Set());
  mergeByMaterial(wheelSpin, new Set());
  bakeColors(interior, new Set([steeringWheel]));
  mergeByMaterial(interior, new Set([steeringWheel]));
  mergeByMaterial(detail, new Set());
  mergeByMaterial(body, new Set([interior, detail]));

  // Danos (só no carro "de verdade"; o fantasma não amassa) e vãos das portas na pintura
  const damageUniforms = {
    uDent: { value: new THREE.Vector4() }, uScratch: { value: new THREE.Vector2() },
    uCarZ: { value: new THREE.Vector2(shape.zMin, shape.zMax) },
    ...M.lineUniforms(design.panelLines),
  };
  if (!ghost) {
    for (const group of [body, detail]) {
      for (const child of group.children) {
        if (!child.isMesh) continue;
        for (const m of [child.material].flat()) M.patchCarMaterial(m, damageUniforms, { scratches: m === paint || m === shellPaint, gaps: m === shellPaint });
      }
    }
  }

  const envMaterials = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) if (m && !m.isMeshBasicMaterial && !m.isShaderMaterial && 'envMap' in m) envMaterials.add(m);
  });

  return {
    root,
    design: designId,
    tailLights: parts.tailFlares, // [x, y, z] das lanternas (rastro de drift)
    paintMaterials: [...envMaterials],
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
      if (!ghost && parts.tailMat) {
        const braking = car.brake > 0.05;
        parts.tailMat.color.setScalar(braking ? 2.6 : 1.25);
        for (const f of tailFlares) f.scale.setScalar(braking ? 1.25 : 0.5);
      }
    },
    // d: { front, rear, left, right, scratchL, scratchR } em 0..1
    setDamage(d) {
      damageUniforms.uDent.value.set(d.front, d.rear, d.left, d.right);
      damageUniforms.uScratch.value.set(d.scratchL, d.scratchR);
    },
    setDetail(near) {
      interior.visible = near;
      detail.visible = near;
    },
    setPose(x, z, yaw, y = 0, pitch = 0) {
      root.position.set(x, y + 0.03, z);
      root.rotation.y = yaw;
      root.rotation.x = -pitch;
    },
    setEnvMap(texture) {
      envMap = texture;
      for (const m of envMaterials) { if (m.envMap === texture) continue; m.envMap = texture; m.needsUpdate = true; }
    },
    dispose() {
      root.removeFromParent();
      root.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
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

// --- Interior ------------------------------------------------------------------------------------------
function buildInterior({ interior, steeringWheel, wheelSpin, design }) {
  const inside = { dashZ: 0.42, cage: 'half', shelf: true, floorY: 0.32, dashY: 0.8, seatY: 0.4, ...design.interior };
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const carpet = std({ color: 0x151517, roughness: 1 });
  const dashMat = std({ color: 0x1d1d20, roughness: 0.75 });
  const fabric = std({ color: inside.seat ?? 0x26262c, roughness: 0.95 });
  const accent = std({ color: inside.accent ?? 0x9a1418, roughness: 0.9 });
  const cage = std({ color: inside.cageColor ?? 0xa9acb2, metalness: 0.7, roughness: 0.35 });
  const suit = std({ color: inside.suit ?? 0x1d3c78, roughness: 0.85 });
  const helmet = std({ color: inside.helmet ?? 0xe8e8e8, metalness: 0.1, roughness: 0.25 });
  const visor = std({ color: 0x050505, metalness: 0.6, roughness: 0.05 });
  const belt = std({ color: inside.belts ?? 0xc0141a, roughness: 0.8 });
  const glove = std({ color: 0x111111, roughness: 0.8 });
  const metal = std({ color: 0x2a2a2c, metalness: 0.7, roughness: 0.35 });
  const gauges = new THREE.MeshBasicMaterial({ map: gaugeTexture(), color: new THREE.Color(1.4, 1.2, 1.1) });
  const lcd = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.4, 1.0) });
  const add = (g, m, pos, rot) => P.addMesh(interior, g, m, { pos, rot });
  const { dashZ, floorY, dashY } = inside;

  add(new THREE.BoxGeometry(1.44, 0.04, 2.3), carpet, [0, floorY, -0.5]);
  // Painel: perfil lateral extrudado na largura
  const prof = new THREE.Shape();
  prof.moveTo(0.2, -0.2); prof.lineTo(0.2, 0.02); prof.quadraticCurveTo(0.12, 0.1, -0.1, 0.08); prof.quadraticCurveTo(-0.2, 0.06, -0.24, -0.04); prof.lineTo(-0.14, -0.2); prof.closePath();
  const dashGeo = P.extrude(prof, 1.42, 0.01, 6);
  dashGeo.rotateY(Math.PI / 2);
  add(dashGeo, dashMat, [0, dashY, dashZ]);
  // Capelinha e instrumentos (lado direito = -X)
  add(P.roundedBox(0.44, 0.12, 0.16, 0.04), dashMat, [-0.38, dashY + 0.1, dashZ - 0.1]);
  const gm = add(new THREE.PlaneGeometry(0.38, 0.13), gauges, [-0.38, dashY + 0.09, dashZ - 0.181], [0, Math.PI, 0]);
  gm.rotation.x = -0.12;
  // Console com rádio e manômetros
  add(P.roundedBox(0.26, 0.3, 0.9, 0.04), dashMat, [0, floorY + 0.15, -0.12]);
  add(P.roundedBox(0.24, 0.24, 0.12, 0.02), dashMat, [0, dashY - 0.1, dashZ - 0.18]);
  add(new THREE.PlaneGeometry(0.14, 0.03), lcd, [0, dashY - 0.05, dashZ - 0.241], [0, Math.PI, 0]);
  for (const gx of [-0.06, 0.06]) add(new THREE.CircleGeometry(0.028, 14), gauges, [gx, dashY - 0.14, dashZ - 0.241], [0, Math.PI, 0]);
  // Câmbio e freio de mão hidráulico
  add(new THREE.ConeGeometry(0.05, 0.08, 10), std({ color: 0x0c0c0c, roughness: 1 }), [0, floorY + 0.33, -0.1]);
  P.tube(interior, [[0, floorY + 0.33, -0.1], [0, floorY + 0.46, -0.14]], 0.01, metal);
  add(new THREE.SphereGeometry(0.03, 12, 8), std({ color: 0x0a0a0a, roughness: 0.3 }), [0, floorY + 0.48, -0.15]);
  P.tube(interior, [[0.08, floorY + 0.28, -0.52], [0.08, floorY + 0.42, -0.34], [0.08, floorY + 0.48, -0.24]], 0.012, cage);

  // Bancos concha com abas laterais e cintos de 4 pontos
  for (const s of sides) {
    const seat = new THREE.Group();
    seat.position.set(s * 0.37, inside.seatY, -0.62);
    P.addMesh(seat, P.roundedBox(0.46, 0.11, 0.5, 0.04), fabric, { pos: [0, 0.02, 0.04] });
    const back = new THREE.Group();
    back.position.set(0, 0.05, -0.2);
    back.rotation.x = -0.2;
    P.addMesh(back, P.roundedBox(0.44, 0.72, 0.09, 0.04), fabric, { pos: [0, 0.38, 0] });
    for (const k of sides) P.addMesh(back, P.roundedBox(0.07, 0.5, 0.2, 0.03), fabric, { pos: [k * 0.215, 0.28, 0.06], rot: [0, -k * 0.18, 0] });
    for (const k of sides) P.addMesh(back, P.roundedBox(0.05, 0.14, 0.14, 0.02), fabric, { pos: [k * 0.2, 0.66, 0.04] });
    P.addMesh(back, new THREE.PlaneGeometry(0.12, 0.6), accent, { pos: [0, 0.34, 0.047] });
    for (const k of sides) P.addMesh(back, new THREE.BoxGeometry(0.045, 0.62, 0.006), belt, { pos: [k * 0.08, 0.34, 0.06] });
    for (const k of sides) P.addMesh(seat, new THREE.BoxGeometry(0.045, 0.006, 0.4), belt, { pos: [k * 0.14, 0.085, 0.06] });
    seat.add(back);
    interior.add(seat);
  }
  if (inside.shelf) add(new THREE.BoxGeometry(1.36, 0.03, 0.6), carpet, [0, inside.shelfY ?? 0.84, inside.shelfZ ?? -1.55]);
  // Forros de porta
  for (const s of sides) add(P.roundedBox(0.04, 0.34, 1.0, 0.02), dashMat, [s * (inside.doorX ?? 0.68), floorY + 0.36, -0.12]);

  if (inside.cage === 'half') {
    const cz = inside.cageZ ?? -1.08, top = inside.cageTop ?? 1.16;
    for (const s of sides) {
      P.tube(interior, [[s * 0.62, floorY, cz], [s * 0.6, top - 0.2, cz], [s * 0.54, top, cz]], 0.02, cage, { radial: 8 });
      P.tube(interior, [[s * 0.55, top, cz], [s * 0.58, 0.9, cz - 0.47], [s * 0.6, 0.62, cz - 0.7]], 0.018, cage, { radial: 8 });
    }
    P.tube(interior, [[-0.54, top, cz], [0.54, top, cz]], 0.02, cage, { radial: 8 });
    P.tube(interior, [[0.6, floorY + 0.08, cz], [-0.56, top - 0.02, cz]], 0.018, cage, { radial: 8 });
  } else if (inside.cage === 'hoop') {
    const hz = inside.hoopZ ?? -1.02, top = inside.hoopTop ?? 1.2;
    const pts = [[0.62, 0.62], [0.6, top - 0.1], [0.5, top - 0.02], [0.2, top], [-0.2, top], [-0.5, top - 0.02], [-0.6, top - 0.1], [-0.62, 0.62]];
    P.tube(interior, pts.map(([x, y]) => [x, y, hz]), 0.024, cage, { radial: 8, segments: 40 });
    for (const s of sides) P.tube(interior, [[s * 0.6, top - 0.1, hz], [s * 0.58, 0.72, hz - 0.45]], 0.018, cage, { radial: 8 });
  }

  // Volante esportivo de 3 raios (gira com o esterço)
  steeringWheel.position.set(-0.37, dashY + 0.12, dashZ - 0.34);
  steeringWheel.rotation.x = 0.38;
  steeringWheel.add(wheelSpin);
  const suede = std({ color: 0x0c0c0d, roughness: 1 });
  P.addMesh(wheelSpin, new THREE.TorusGeometry(0.175, 0.02, 8, 28), suede);
  for (const ang of [0, Math.PI, -Math.PI / 2]) {
    P.addMesh(wheelSpin, new THREE.BoxGeometry(0.16, 0.03, 0.012), metal, { pos: [Math.cos(ang) * 0.09, Math.sin(ang) * 0.09, 0.02], rot: [0, 0, ang] });
  }
  P.addMesh(wheelSpin, new THREE.CylinderGeometry(0.045, 0.05, 0.03, 16), suede, { pos: [0, 0, 0.03], rot: [Math.PI / 2, 0, 0] });
  P.addMesh(wheelSpin, new THREE.CircleGeometry(0.022, 12), accent, { pos: [0, 0, 0.046] });
  P.addMesh(wheelSpin, new THREE.BoxGeometry(0.02, 0.028, 0.01), accent, { pos: [0, 0.175, 0.012] });
  interior.add(steeringWheel);
  P.tube(interior, [[-0.37, dashY + 0.02, dashZ - 0.1], [-0.37, dashY + 0.12, dashZ - 0.34]], 0.024, dashMat);
  if (inside.mirrorY !== null) add(P.roundedBox(0.2, 0.055, 0.02, 0.01), dashMat, [0, inside.mirrorY ?? 1.14, inside.mirrorZ ?? 0.0]);

  // Piloto de capacete
  const px = -0.37;
  add(P.roundedBox(0.38, 0.5, 0.24, 0.1), suit, [px, inside.seatY + 0.36, -0.72], [-0.2, 0, 0]);
  const head = add(new THREE.SphereGeometry(0.135, 18, 14), helmet, [px, inside.seatY + 0.74, -0.78]);
  head.scale.set(1, 1.05, 1.1);
  add(new THREE.SphereGeometry(0.139, 18, 8, -0.9, 1.8, 1.2, 0.6), visor, [px, inside.seatY + 0.74, -0.78]);
  add(new THREE.BoxGeometry(0.02, 0.2, 0.25), accent, [px, inside.seatY + 0.8, -0.8]);
  for (const k of sides) {
    const sh = [px + k * 0.17, inside.seatY + 0.55, -0.7];
    const el = [px + k * 0.2, inside.seatY + 0.42, -0.38];
    const hand = [px + k * 0.15, dashY + 0.1, dashZ - 0.32];
    P.tube(interior, [sh, el], 0.045, suit, { radial: 8 });
    P.tube(interior, [el, hand], 0.038, suit, { radial: 8 });
    add(new THREE.SphereGeometry(0.035, 10, 8), glove, hand);
  }
}

// Troca os materiais opacos sem textura de um grupo por um único material com cor por vértice
// (as peças depois se juntam numa malha só). keep: grupos que não entram.
function bakeColors(group, keep) {
  let shared = null;
  const lin = new THREE.Color();
  group.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    for (let q = o.parent; q && q !== group; q = q.parent) if (keep.has(q)) return;
    const m = o.material;
    if (!m.isMeshStandardMaterial || m.map || m.transparent || m.vertexColors) return;
    if (!shared) shared = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.15 });
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    lin.copy(m.color);
    const count = g.attributes.position.count;
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { col[i * 3] = lin.r; col[i * 3 + 1] = lin.g; col[i * 3 + 2] = lin.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!o.geometry.userData.shared) o.geometry.dispose();
    o.geometry = g;
    o.material = shared;
  });
}

// Junta as peças estáticas por material (menos draw calls). keep: grupos que não entram.
export function mergeByMaterial(group, keep) {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert();
  const buckets = new Map();
  group.traverse((o) => {
    if (!o.isMesh || o === group) return;
    for (let q = o.parent; q && q !== group; q = q.parent) if (keep.has(q)) return;
    if (Array.isArray(o.material)) return;
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
    for (const o of list) {
      o.removeFromParent();
      if (!o.geometry.userData.shared) o.geometry.dispose();
    }
  }
}
