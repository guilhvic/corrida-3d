// Bairro noturno: placas verticais salientes (tate-kanban), tubos de neon 3D animados, lâmpadas de
// marquise nos outdoors, lanternas de papel, telões de LED e poças de luz colorida no chão.
// Animações usam poucos materiais compartilhados (fases), então custam quase nada por quadro.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const COLORS = {
  pink: [1, 0.18, 0.62], cyan: [0.2, 0.95, 1], green: [0.45, 1, 0.3],
  yellow: [1, 0.82, 0.22], red: [1, 0.22, 0.16], violet: [0.7, 0.4, 1], white: [1, 0.95, 0.88],
};
const COLOR_KEYS = Object.keys(COLORS);
const TATE_WORDS = ['スナック愛', '居酒屋まるや', 'バー月光', 'カラオケ', 'ホテル蘭', '麻雀', '焼き鳥', '占い', 'ネットカフェ', 'ラーメン龍', '質屋', 'ビリヤード', '寿司政', 'パブ夢', '中華そば', '酒'];
const TICKER = ['ニュース速報　今夜　湾岸ドリフト大会　開催中', '首都高　通行止めのお知らせ', 'ゼータタイヤ　新発売', '明日の天気　雨のち曇り'];

const hdr = (key, k) => new THREE.Color(COLORS[key][0] * k, COLORS[key][1] * k, COLORS[key][2] * k);
const css = (key, a = 1) => `rgba(${COLORS[key].map((v) => Math.round(v * 255)).join(',')},${a})`;

export function buildNeonDistrict(scene, { rand, fronts, billboards, jpFont, glowTexture }) {
  const animated = [];   // { material, mode, phase, color, key }
  const tubeBuckets = new Map();
  const pools = [];

  function material(key, mode, phase = 0) {
    const id = `${key}|${mode}|${phase}`;
    let entry = animated.find((a) => a.id === id);
    if (!entry) {
      entry = { id, mode, phase, key, material: new THREE.MeshBasicMaterial({ color: hdr(key, 2.4) }) };
      animated.push(entry);
    }
    return entry.material;
  }

  // Referencial da fachada: X ao longo (para o lado), Y para cima, Z para a rua.
  const frontMatrix = (f, along = 0, y = 0, out = 0) => {
    const X = new THREE.Vector3(-f.ex[0], 0, -f.ex[1]);
    const Z = new THREE.Vector3(-f.ez[0], 0, -f.ez[1]);
    const m = new THREE.Matrix4().makeBasis(X, new THREE.Vector3(0, 1, 0), Z);
    const fx = f.cx - f.ez[0] * f.d / 2, fz = f.cz - f.ez[1] * f.d / 2;
    m.setPosition(fx - X.x * along + Z.x * out, y, fz - X.z * along + Z.z * out);
    return m;
  };

  function addTube(points, closed, matrix, key, mode, phase) {
    const path = new THREE.CurvePath();
    const pts = points.map(([px, py]) => new THREE.Vector3(px, py, 0));
    for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) path.add(new THREE.LineCurve3(pts[i], pts[(i + 1) % pts.length]));
    const geo = new THREE.TubeGeometry(path, Math.max(4, pts.length * 3), 0.05, 4, false);
    geo.applyMatrix4(matrix);
    const bucketId = `${key}|${mode}|${phase}`;
    if (!tubeBuckets.has(bucketId)) tubeBuckets.set(bucketId, { key, mode, phase, geos: [] });
    tubeBuckets.get(bucketId).geos.push(geo);
  }

  const pickColor = () => COLOR_KEYS[Math.floor(rand() * COLOR_KEYS.length)];

  // --- Placas verticais salientes: 28 variações num atlas 1024x1024 (uma malha só) ------------------
  const ATLAS = 1024, SLOT_W = 64, SLOT_H = 340, COLS = 16;
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = atlasCanvas.height = ATLAS;
  const atlasCtx = atlasCanvas.getContext('2d');
  atlasCtx.fillStyle = '#2a2b30';
  atlasCtx.fillRect(ATLAS - 16, ATLAS - 16, 16, 16); // canto reservado: laterais/topo da caixa
  const variants = [];
  function drawVariant(slot, word, key, lightbox) {
    const chars = [...word];
    const c = document.createElement('canvas');
    c.width = SLOT_W; c.height = chars.length * 50 + 28;
    const ctx = c.getContext('2d');
    ctx.fillStyle = lightbox ? '#f3efe4' : '#0b0710';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = lightbox ? css('red', 0.9) : css(key);
    ctx.lineWidth = 4;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = lightbox ? 0 : 10;
    ctx.strokeRect(5, 5, c.width - 10, c.height - 10);
    ctx.font = `900 42px ${jpFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = lightbox ? '#b3121b' : '#ffffff';
    chars.forEach((ch, i) => ctx.fillText(ch, 32, 40 + i * 50));
    if (!lightbox) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = css(key, 0.5);
      ctx.fillRect(0, 0, c.width, c.height);
    }
    const col = slot % COLS, row = Math.floor(slot / COLS);
    const x = col * SLOT_W, y = row * SLOT_H;
    atlasCtx.drawImage(c, x, y);
    variants.push({
      key, lightbox, height: chars.length * 0.62 + 0.5,
      u0: x / ATLAS, u1: (x + SLOT_W) / ATLAS, v0: 1 - (y + c.height) / ATLAS, v1: 1 - y / ATLAS,
    });
  }
  for (let i = 0; i < 28; i++) {
    drawVariant(i, TATE_WORDS[i % TATE_WORDS.length], pickColor(), rand() < 0.35);
  }
  const atlasTex = new THREE.CanvasTexture(atlasCanvas);
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  const darkUV = [(ATLAS - 8) / ATLAS, 8 / ATLAS];
  const tateGeos = { steady: [], blinkA: [], blinkB: [] };
  function tateBox(variant, matrix, group) {
    const geo = new THREE.BoxGeometry(0.34, variant.height, 1.7);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const face = Math.floor(i / 4); // 0/1 = laterais ±X, com o texto
      if (face <= 1) uv.setXY(i, variant.u0 + uv.getX(i) * (variant.u1 - variant.u0), variant.v0 + uv.getY(i) * (variant.v1 - variant.v0));
      else uv.setXY(i, darkUV[0], darkUV[1]);
    }
    geo.clearGroups();
    geo.applyMatrix4(matrix);
    tateGeos[group].push(geo);
  }
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x2a2b30 });

  // --- Distribuição pelas fachadas de frente para a rua ---------------------------------------------
  const lanterns = [];
  const screens = [];
  for (const f of fronts) {
    if (f.h > 7 && rand() < 0.8) {
      const side = rand() < 0.5 ? -1 : 1;
      const along = side * (f.w / 2 - 0.9);
      let y = 4.0;
      const stack = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < stack && y < f.h - 2; k++) {
        const variant = variants[Math.floor(rand() * variants.length)];
        const { key, lightbox, height } = variant;
        const group = !lightbox && rand() < 0.25 ? (rand() < 0.5 ? 'blinkA' : 'blinkB') : 'steady';
        tateBox(variant, frontMatrix(f, along, y + height / 2, 1.0), group);
        // suporte até a parede
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.25), frameMat);
        arm.applyMatrix4(frontMatrix(f, along, y + height - 0.2, 0.1));
        scene.add(arm);
        pools.push({ m: frontMatrix(f, along, 0.03, 1.6), key: lightbox ? 'white' : key, size: 3.2 });
        y += height + 0.4 + rand() * 1.0;
      }
    }

    // Contorno de neon na borda do telhado
    if (rand() < 0.4) {
      const key = pickColor();
      const m = frontMatrix(f, 0, f.h + 0.95, 0.06);
      const segs = Math.max(2, Math.round(f.w / 2.5));
      const chase = rand() < 0.4;
      for (let i = 0; i < segs; i++) {
        const x0 = -f.w / 2 + (i / segs) * f.w, x1 = -f.w / 2 + ((i + 1) / segs) * f.w;
        addTube([[x0, 0], [x1, 0]], false, m, key, chase ? 'chase' : 'steady', i % 4);
      }
    }

    // Tubos de neon: moldura sobre a loja, zigue-zague, seta ou círculo
    for (let tube = 0; tube < (rand() < 0.35 ? 2 : 1); tube++) if (rand() < 0.7) {
      const key = pickColor();
      const kind = Math.floor(rand() * 4);
      const y0 = 3.9 + Math.floor(rand() * Math.max(1, (f.h - 6) / 3.4)) * 3.4;
      const m = frontMatrix(f, 0, y0, 0.14);
      const width = Math.min(f.w - 2.5, 4 + rand() * 5);
      if (kind === 0) {
        const hh = 0.9 + rand() * 0.8;
        addTube([[-width / 2, 0], [width / 2, 0], [width / 2, hh], [-width / 2, hh]], true, m, key, rand() < 0.3 ? 'flicker' : 'steady', 0);
        addTube([[-width / 2 + 0.25, 0.22], [width / 2 - 0.25, 0.22]], false, m, pickColor(), 'steady', 0);
      } else if (kind === 1) {
        const steps = 8 + Math.floor(rand() * 6);
        for (let i = 0; i < steps; i++) {
          const x0 = -width / 2 + (i / steps) * width, x1 = -width / 2 + ((i + 1) / steps) * width;
          addTube([[x0, i % 2 ? 0.7 : 0], [x1, i % 2 ? 0 : 0.7]], false, m, key, 'chase', i % 4);
        }
      } else if (kind === 2) {
        for (let i = 0; i < 4; i++) {
          const ax = -width / 2 + i * 0.9;
          addTube([[ax, 0.8], [ax + 0.5, 0.4], [ax, 0]], false, m, key, 'chase', i);
        }
        addTube([[-width / 2 + 3.8, 0.4], [width / 2, 0.4]], false, m, key, 'steady', 0);
      } else {
        const r = 0.7 + rand() * 0.5, n = 16;
        const ring = Array.from({ length: n }, (_, i) => [Math.cos((i / n) * Math.PI * 2) * r, r + Math.sin((i / n) * Math.PI * 2) * r]);
        addTube(ring, true, m, key, rand() < 0.5 ? 'flicker' : 'steady', 0);
        addTube([[-r * 0.5, r], [r * 0.5, r]], false, m, pickColor(), 'chase', Math.floor(rand() * 4));
      }
      pools.push({ m: frontMatrix(f, 0, 0.03, 1.8), key, size: 4.5 });
    }

    // Lanternas vermelhas de papel na frente de izakayas
    if (rand() < 0.2) {
      const count = 5 + Math.floor(rand() * 5);
      const span = Math.min(f.w - 1.5, count * 1.1);
      const wire = [];
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : i / (count - 1);
        const along = -span / 2 + t * span;
        const sag = Math.sin(Math.PI * t) * 0.35;
        const p = new THREE.Vector3().setFromMatrixPosition(frontMatrix(f, along, 3.45 - sag, 0.55));
        lanterns.push(p);
        wire.push(new THREE.Vector3(p.x, p.y + 0.33, p.z));
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x111111 })));
      pools.push({ m: frontMatrix(f, 0, 0.03, 1.2), key: 'red', size: span + 1.5 });
    }

    if (f.h > 30 && screens.length < 3 && rand() < 0.6) screens.push(f);
  }

  // Placas verticais: uma malha por grupo de animação
  const tateMaterials = {};
  for (const [group, geos] of Object.entries(tateGeos)) {
    if (!geos.length) continue;
    tateMaterials[group] = new THREE.MeshBasicMaterial({ map: atlasTex, color: new THREE.Color(1.35, 1.35, 1.35) });
    scene.add(new THREE.Mesh(mergeGeometries(geos), tateMaterials[group]));
    geos.forEach((g) => g.dispose());
  }

  // Tubos agrupados por cor e animação (um draw call por grupo)
  for (const bucket of tubeBuckets.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(bucket.geos), material(bucket.key, bucket.mode, bucket.phase));
    for (const g of bucket.geos) g.dispose();
    scene.add(mesh);
  }

  // Lanternas (instanciadas)
  if (lanterns.length) {
    const geo = new THREE.SphereGeometry(0.22, 10, 8);
    geo.scale(1, 1.35, 1);
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.5, 0.22) }), lanterns.length);
    const m4 = new THREE.Matrix4();
    lanterns.forEach((p, i) => inst.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
    scene.add(inst);
  }

  // --- Lâmpadas de marquise em volta dos outdoors ---------------------------------------------------
  const bulbPositions = [];
  for (const bb of billboards) {
    const bh = bb.w * 0.375, theta = bb.yaw + Math.PI, c = Math.cos(theta), s = Math.sin(theta);
    const perimeter = [];
    const stepsX = Math.round(bb.w / 0.5), stepsY = Math.round(bh / 0.5);
    for (let i = 0; i <= stepsX; i++) perimeter.push([-bb.w / 2 - 0.15 + (i / stepsX) * (bb.w + 0.3), 1.65]);
    for (let i = 1; i <= stepsY; i++) perimeter.push([bb.w / 2 + 0.15, 1.65 + (i / stepsY) * (bh + 0.3)]);
    for (let i = stepsX - 1; i >= 0; i--) perimeter.push([-bb.w / 2 - 0.15 + (i / stepsX) * (bb.w + 0.3), 1.95 + bh]);
    for (let i = stepsY - 1; i >= 1; i--) perimeter.push([-bb.w / 2 - 0.15, 1.65 + (i / stepsY) * (bh + 0.3)]);
    for (const [lx, ly] of perimeter) bulbPositions.push([bb.x + lx * c + 0.1 * s, bb.y + ly, bb.z - lx * s + 0.1 * c]);
  }
  let bulbs = null;
  if (bulbPositions.length) {
    bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), bulbPositions.length);
    const m4 = new THREE.Matrix4();
    bulbPositions.forEach(([px, py, pz], i) => bulbs.setMatrixAt(i, m4.makeTranslation(px, py, pz)));
    bulbs.setColorAt(0, new THREE.Color());
    scene.add(bulbs);
  }

  // --- Telões de LED com letreiro correndo ---------------------------------------------------------------
  const screenStates = screens.map((f, i) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 144;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(10, 5.6), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.15, 1.15, 1.15) }));
    plane.applyMatrix4(frontMatrix(f, 0, Math.min(f.h - 4, f.h * 0.55), 0.2));
    scene.add(plane);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(10.5, 6.1, 0.3), frameMat);
    bezel.applyMatrix4(frontMatrix(f, 0, Math.min(f.h - 4, f.h * 0.55), 0.02));
    scene.add(bezel);
    return { ctx: canvas.getContext('2d'), tex, text: TICKER[i % TICKER.length], offset: 0 };
  });

  function drawScreen(state, time) {
    const { ctx } = state;
    const g = ctx.createLinearGradient(0, 0, 0, 144);
    g.addColorStop(0, '#061a3a'); g.addColorStop(1, '#010612');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 144);
    ctx.fillStyle = '#c8101c'; ctx.fillRect(0, 0, 256, 26);
    ctx.fillStyle = '#fff'; ctx.font = `900 18px ${jpFont}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText('ニュース速報', 8, 14);
    const now = new Date();
    ctx.textAlign = 'right';
    ctx.fillText(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, 248, 14);
    // barras "gráfico" animadas
    for (let i = 0; i < 12; i++) {
      const hgt = 18 + Math.abs(Math.sin(time * 1.3 + i * 0.7)) * 50;
      ctx.fillStyle = i % 3 ? '#35f2ff' : '#ffd23f';
      ctx.fillRect(14 + i * 19, 108 - hgt, 12, hgt);
    }
    ctx.fillStyle = '#000'; ctx.fillRect(0, 112, 256, 32);
    ctx.fillStyle = '#ffe14a'; ctx.font = `700 22px ${jpFont}`; ctx.textAlign = 'left';
    const width = ctx.measureText(state.text).width;
    state.offset = (time * 55) % (width + 256);
    ctx.fillText(state.text, 256 - state.offset, 129);
    // grade de pixels do LED
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let x = 0; x < 256; x += 3) ctx.fillRect(x, 0, 1, 144);
    state.tex.needsUpdate = true;
  }

  // --- Poças de luz colorida no chão ------------------------------------------------------------------
  if (pools.length) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({
      map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
    }), pools.length);
    const pos = new THREE.Vector3(), q = new THREE.Quaternion(), scl = new THREE.Vector3();
    pools.forEach((p, i) => {
      p.m.decompose(pos, q, scl);
      inst.setMatrixAt(i, new THREE.Matrix4().compose(pos, q, scl.set(p.size, 1, p.size * 0.7)));
      inst.setColorAt(i, hdr(p.key, 0.45));
    });
    scene.add(inst);
  }

  let lastScreen = 0;
  const bulbOn = new THREE.Color(2.4, 2.1, 1.5), bulbOff = new THREE.Color(0.25, 0.18, 0.1);
  return {
    update(time) {
      for (const a of animated) {
        let k = 2.4;
        if (a.mode === 'chase') k = ((Math.floor(time * 6) - a.phase) % 4 + 4) % 4 < 2 ? 2.6 : 0.25;
        else if (a.mode === 'flicker') k = Math.sin(time * 37.1) * Math.sin(time * 13.7 + a.phase) > 0.72 ? 0.2 : 2.4;
        a.material.color.copy(hdr(a.key, k));
      }
      if (tateMaterials.blinkA) tateMaterials.blinkA.color.setScalar(Math.sin(time * 2.2) > -0.2 ? 1.35 : 0.25);
      if (tateMaterials.blinkB) tateMaterials.blinkB.color.setScalar(Math.sin(time * 3.1 + 2) > 0 ? 1.35 : 0.25);
      if (bulbs) {
        const step = Math.floor(time * 10);
        for (let i = 0; i < bulbs.count; i++) bulbs.setColorAt(i, (i + step) % 3 === 0 ? bulbOn : bulbOff);
        bulbs.instanceColor.needsUpdate = true;
      }
      if (time - lastScreen > 0.1) {
        lastScreen = time;
        for (const s of screenStates) drawScreen(s, time);
      }
    },
  };
}
