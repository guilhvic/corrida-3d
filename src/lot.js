// Estacionamento de treino: pátio aberto de 150 x 104 m atrás dos armazéns do porto, cercado por muretas de
// concreto e alambrado, com torres de iluminação e cones montados em estações (oito, slalom, grampo e pião).
// Não é pista: não tem volta, cronômetro nem rivais. O "traçado" que o jogo pede (câmera, nível de detalhe,
// áudio) é um retângulo arredondado por dentro do pátio, que ninguém vê.
import * as THREE from 'three';
import { LOT, LOT_SPAWN } from './lotLayout.js';
import { lotTextures, roadWordTexture, mulberry32 } from './textures.js';
import { barrierTextures, containerTextures } from './cityTextures.js';
import { lightConeMaterial } from './fog.js';
import { glowTexture, canvasTexture, noise, mergeStatic, disposeTree, JP_FONT } from './world.js';
import { Cones } from './cones.js';

const BARRIER_H = 0.9, BARRIER_T = 0.6, FENCE_GAP = 4, FENCE_H = 2.6;

// Horários: a geometria é a mesma, só muda céu, luz e as torres acesas.
const LOT_TIMES = {
  noite: {
    fog: [0x0f1119, 0.0068], horizon: [0.12, 0.09, 0.16], zenith: [0.01, 0.012, 0.03], stars: true,
    hemi: [0x46507a, 0x0b0a10, 0.55], sun: { color: 0x8a9cff, intensity: 0.25, dir: [-0.4, 0.8, 0.3] },
    mist: 0.7, mistColor: [0.05, 0.05, 0.065], lamps: true, lampIntensity: 170, windows: 1, asphalt: 0x9c9c9c,
  },
  dia: {
    fog: [0xa9b3bf, 0.0032], horizon: [0.72, 0.77, 0.84], zenith: [0.3, 0.46, 0.72], stars: false,
    hemi: [0xe4ecff, 0x6a655c, 1.6], sun: { color: 0xfff1dc, intensity: 2.6, dir: [0.5, 0.75, -0.35] },
    mist: 0, mistColor: [0.55, 0.57, 0.6], lamps: false, lampIntensity: 0, windows: 0.05, asphalt: 0xffffff,
  },
};

// Escala as coordenadas de textura (a textura repete ao longo da peça em vez de esticar).
function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geo;
}

// Alambrado: losangos de arame com os buracos transparentes.
function chainLinkTexture() {
  const tex = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(175,182,188,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, h / 2); ctx.lineTo(w / 2, 0); ctx.lineTo(w, h / 2); ctx.lineTo(w / 2, h); ctx.closePath();
    ctx.moveTo(-w / 2, 0); ctx.lineTo(0, -h / 2);
    ctx.stroke();
  });
  return tex;
}

// Parede de armazém em chapa ondulada, com uma fileira de janelas altas (acesas de noite pelo emissive).
function shedTexture(rand) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    for (let x = 0; x < w; x++) {
      const rib = Math.sin((x / 6) * Math.PI * 2);
      const v = 118 + rib * 16 + (rand() - 0.5) * 8;
      ctx.fillStyle = `rgb(${v * 0.82},${v * 0.9},${v})`;
      ctx.fillRect(x, 0, 1, h);
    }
    ctx.fillStyle = 'rgba(60,40,30,0.35)';
    for (let k = 0; k < 20; k++) ctx.fillRect(rand() * w, h * 0.55 + rand() * h * 0.2, 2, h * 0.3); // escorridos de ferrugem
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, h - 10, w, 10);
  });
}

function windowTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = k % 3 === 1 ? '#3a3020' : '#ffcf7a';
      ctx.fillRect(8 + k * 31, 14, 22, 12);
    }
  });
}

// Borracha no asfalto: rodas de pião nos círculos, arcos do oito e riscos do slalom, mais manchas de sujeira.
function rubberTexture() {
  const W = LOT.maxX - LOT.minX, D = LOT.maxZ - LOT.minZ, S = 2048 / W;
  const tex = canvasTexture(2048, Math.round(D * S), (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const rand = mulberry32(404);
    const px = (x) => (x - LOT.minX) * S, pz = (z) => (LOT.maxZ - z) * S;
    ctx.lineCap = 'round';
    const ring = (x, z, r, n, alpha) => {
      for (let k = 0; k < n; k++) {
        const rr = (r + (rand() - 0.5) * 3) * S, a0 = rand() * Math.PI * 2, span = Math.PI * (0.6 + rand() * 1.6);
        ctx.strokeStyle = `rgba(8,8,8,${alpha * (0.4 + rand() * 0.6)})`;
        ctx.lineWidth = (0.18 + rand() * 0.12) * S;
        for (const off of [0, 1.55]) {
          ctx.beginPath();
          ctx.ellipse(px(x), pz(z), rr + off * S, rr + off * S, 0, a0, a0 + span);
          ctx.stroke();
        }
      }
    };
    ring(-50, 18, 10, 30, 0.35);
    ring(-50, -16, 10, 30, 0.35);
    ring(2, 22, 7, 40, 0.45);
    ring(46, 18, 9, 20, 0.3);
    // Slalom: esses entre os cones
    for (let k = 0; k < 10; k++) {
      ctx.strokeStyle = `rgba(8,8,8,${0.15 + rand() * 0.2})`;
      ctx.lineWidth = 0.22 * S;
      ctx.beginPath();
      for (let x = -26; x <= 58; x += 1) {
        const z = -30 + Math.sin((x + 18) / 11 * Math.PI + k * 0.2) * (3.5 + rand() * 0.3);
        if (x === -26) ctx.moveTo(px(x), pz(z)); else ctx.lineTo(px(x), pz(z));
      }
      ctx.stroke();
    }
    // Sujeira e poeira acumulada junto às muretas
    const edge = ctx.createLinearGradient(0, 0, 0, 5 * S);
    edge.addColorStop(0, 'rgba(40,34,26,0.55)'); edge.addColorStop(1, 'rgba(40,34,26,0)');
    ctx.fillStyle = edge; ctx.fillRect(0, 0, w, 5 * S);
    ctx.save(); ctx.translate(0, h); ctx.scale(1, -1); ctx.fillStyle = edge; ctx.fillRect(0, 0, w, 5 * S); ctx.restore();
    for (let k = 0; k < 90; k++) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, `rgba(0,0,0,${0.08 + rand() * 0.1})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.translate(rand() * w, rand() * h);
      ctx.scale((2 + rand() * 6) * S, (2 + rand() * 6) * S);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }, { repeat: false });
  return tex;
}

export function buildLotWorld(scene, track, { time = 'noite' } = {}) {
  const rand = mulberry32(2024);
  const root = new THREE.Group();
  root.name = 'mundo:estacionamento';
  scene.add(root);
  const W = LOT.maxX - LOT.minX, D = LOT.maxZ - LOT.minZ, CX = (LOT.minX + LOT.maxX) / 2, CZ = (LOT.minZ + LOT.maxZ) / 2;

  // --- Céu e luz ------------------------------------------------------------------------------
  const fog = new THREE.FogExp2(0x0f1119, 0.0068);
  const mistColor = new THREE.Color();
  const skyUniforms = { horizon: { value: new THREE.Color() }, zenith: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 16, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 horizon, zenith; varying vec3 vDir; void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        gl_FragColor = vec4(mix(horizon, zenith, pow(h, 0.45)), 1.0); }`,
    }),
  );
  sky.renderOrder = -1;
  root.add(sky);
  const starPos = [];
  for (let i = 0; i < 400; i++) {
    const v = new THREE.Vector3(rand() - 0.5, rand() * 0.8 + 0.2, rand() - 0.5).normalize().multiplyScalar(1400);
    starPos.push(v.x, v.y, v.z);
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3)),
    new THREE.PointsMaterial({ color: 0x8890b0, size: 1.5, sizeAttenuation: false, fog: false }),
  );
  root.add(stars);
  const hemi = new THREE.HemisphereLight(0x46507a, 0x0b0a10, 0.55);
  root.add(hemi);
  const sun = new THREE.DirectionalLight(0x8a9cff, 0.25);
  root.add(sun);

  // --- Chão: terreno de fora, pátio de asfalto e a borracha por cima -----------------------------
  const dirt = canvasTexture(64, 64, (ctx, w, h) => noise(ctx, w, h, '#2e2c29', 0.3, 800, rand, 2));
  dirt.repeat.set(250, 250);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshLambertMaterial({ map: dirt }));
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -0.02;
  root.add(outside);

  const asphalt = lotTextures();
  const padW = W + 2 * (BARRIER_T + FENCE_GAP + 2), padD = D + 2 * (BARRIER_T + FENCE_GAP + 2);
  const lotGeo = scaleUV(new THREE.PlaneGeometry(padW, padD), padW / 20, padD / 20);
  const lotMat = new THREE.MeshPhongMaterial({
    map: asphalt.map, normalMap: asphalt.normalMap, specularMap: asphalt.specularMap, specular: 0x5a5e66, shininess: 40,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  });
  const lotMesh = new THREE.Mesh(lotGeo, lotMat);
  lotMesh.rotation.x = -Math.PI / 2;
  lotMesh.position.set(CX, 0, CZ);
  root.add(lotMesh);

  const decalMat = (extra) => new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, ...extra });
  const rubber = new THREE.Mesh(new THREE.PlaneGeometry(W, D), decalMat({ map: rubberTexture() }));
  rubber.rotation.x = -Math.PI / 2;
  rubber.position.set(CX, 0.01, CZ);
  root.add(rubber);

  // --- Pintura no chão: vagas, círculos das estações e o nome do pátio ----------------------------------
  const paintWhite = decalMat({ color: 0xd8d6cc, opacity: 0.85 });
  const paintYellow = decalMat({ color: 0xe0b020, opacity: 0.85 });
  const whiteParts = [], yellowParts = [];
  const stripe = (list, x, z, w, l, yaw = 0) => {
    const g = new THREE.PlaneGeometry(w, l);
    g.rotateX(-Math.PI / 2);
    g.rotateY(yaw);
    g.translate(x, 0.02, z);
    list.push(g);
  };
  // Vagas ao longo da mureta norte e da oeste (quem estaciona aqui de dia é o pessoal do porto).
  for (let x = LOT.minX + 6; x <= LOT.maxX - 6; x += 2.6) stripe(whiteParts, x, LOT.maxZ - 2.6, 0.12, 5.2);
  stripe(whiteParts, CX, LOT.maxZ - 5.2, W - 12, 0.12);
  for (let z = LOT.minZ + 30; z <= LOT.maxZ - 12; z += 2.6) stripe(whiteParts, LOT.minX + 2.6, z, 5.2, 0.12);
  // Círculos das estações
  const circle = (list, x, z, r, w = 0.16) => {
    const g = new THREE.RingGeometry(r - w / 2, r + w / 2, 72);
    g.rotateX(-Math.PI / 2);
    g.translate(x, 0.02, z);
    list.push(g);
  };
  circle(yellowParts, -50, 18, 11); circle(yellowParts, -50, -16, 11);
  circle(yellowParts, 2, 22, 8);
  circle(yellowParts, 46, 18, 2.2);
  // Faixa de largada tracejada do slalom e a caixa de saída
  for (let k = 0; k < 6; k++) stripe(whiteParts, -26, -33.5 + k * 1.4, 0.2, 0.8);
  stripe(whiteParts, LOT_SPAWN.x, LOT_SPAWN.z - 3, 4, 0.2);
  stripe(whiteParts, LOT_SPAWN.x - 2, LOT_SPAWN.z, 0.2, 6);
  stripe(whiteParts, LOT_SPAWN.x + 2, LOT_SPAWN.z, 0.2, 6);
  for (const [parts, mat] of [[whiteParts, paintWhite], [yellowParts, paintYellow]]) for (const g of parts) root.add(new THREE.Mesh(g, mat));
  const word = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 8), decalMat({ map: roadWordTexture('練習場'), color: 0xffffff }));
  word.rotation.set(-Math.PI / 2, 0, Math.PI); // lido por quem sai da caixa, de frente para o pátio
  word.position.set(LOT_SPAWN.x, 0.02, LOT_SPAWN.z + 9);
  root.add(word);

  // --- Muretas de concreto (faces internas nas bordas do LOT) e alambrado atrás ---------------------------
  const barrier = barrierTextures();
  const wallMat = new THREE.MeshPhongMaterial({ map: barrier.map, normalMap: barrier.normalMap, specularMap: barrier.specularMap, specular: 0x3a3a3a, shininess: 18 });
  const fenceMat = new THREE.MeshLambertMaterial({ map: chainLinkTexture(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  const postMat = new THREE.MeshLambertMaterial({ color: 0x5c6166 });
  const edges = [
    { x: CX, z: LOT.minZ - BARRIER_T / 2, len: W + BARRIER_T * 2, yaw: 0, out: [0, -1] },
    { x: CX, z: LOT.maxZ + BARRIER_T / 2, len: W + BARRIER_T * 2, yaw: 0, out: [0, 1] },
    { x: LOT.minX - BARRIER_T / 2, z: CZ, len: D, yaw: Math.PI / 2, out: [-1, 0] },
    { x: LOT.maxX + BARRIER_T / 2, z: CZ, len: D, yaw: Math.PI / 2, out: [1, 0] },
  ];
  for (const e of edges) {
    const wall = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(e.len, BARRIER_H, BARRIER_T), e.len / 3, 1), wallMat);
    wall.position.set(e.x, BARRIER_H / 2, e.z);
    wall.rotation.y = e.yaw;
    root.add(wall);
    const fl = e.len + FENCE_GAP * 2;
    const fence = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(fl, FENCE_H), fl / 1.2, FENCE_H / 1.2), fenceMat);
    fence.position.set(e.x + e.out[0] * FENCE_GAP, FENCE_H / 2, e.z + e.out[1] * FENCE_GAP);
    fence.rotation.y = e.yaw;
    root.add(fence);
    for (let k = 0; k <= Math.floor(fl / 3); k++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, FENCE_H + 0.1, 6), postMat);
      const along = -fl / 2 + k * (fl / Math.floor(fl / 3));
      post.position.set(fence.position.x + Math.cos(e.yaw) * along, FENCE_H / 2, fence.position.z - Math.sin(e.yaw) * along);
      root.add(post);
    }
  }
  // Pilhas de pneus velhos nos cantos (atrás da mureta)
  const tireGeo = new THREE.TorusGeometry(0.34, 0.16, 8, 14);
  tireGeo.rotateX(Math.PI / 2);
  const tireMat = new THREE.MeshLambertMaterial({ color: 0x151515 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    for (let s = 0; s < 3; s++) for (let h = 0; h < 4 - s; h++) {
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.position.set((sx > 0 ? LOT.maxX : LOT.minX) + sx * (1.6 + s * 0.8), 0.16 + h * 0.3, (sz > 0 ? LOT.maxZ : LOT.minZ) + sz * 1.6 - sz * s * 0.9);
      root.add(tire);
    }
  }

  // --- Torres de iluminação ---------------------------------------------------------------------------
  // Postes altos junto às muretas, com a luminária apontada para dentro. Só as mais próximas do carro ganham
  // luz de verdade (main.js); as outras "pintam" a poça de luz no chão.
  const lamps = [];
  const glow = glowTexture();
  const nightGroup = new THREE.Group();
  nightGroup.userData.dynamic = true;
  root.add(nightGroup);
  const poleMat = new THREE.MeshPhongMaterial({ color: 0x55595f, specular: 0x333333, shininess: 30 });
  const headMat = new THREE.MeshLambertMaterial({ color: 0x2a2c30 });
  const panelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.55, 1.4) });
  const poolMat = new THREE.MeshBasicMaterial({ map: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xfff0d0, opacity: 0.22, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  const coneMat = lightConeMaterial(0xffe6b8, 0.22, 0.8);
  const poleH = 13;
  const towers = [];
  for (const x of [-50, 0, 50]) towers.push([x, LOT.minZ - 2.2, 0, 1], [x, LOT.maxZ + 2.2, 0, -1]);
  for (const z of [-15, 20]) towers.push([LOT.minX - 2.2, z, 1, 0], [LOT.maxX + 2.2, z, -1, 0]);
  for (const [x, z, ix, iz] of towers) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, poleH, 8), poleMat);
    pole.position.set(x, poleH / 2, z);
    root.add(pole);
    const head = new THREE.Group();
    head.position.set(x + ix * 0.6, poleH, z + iz * 0.6);
    head.rotation.y = Math.atan2(ix, iz);
    root.add(head);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 0.25), headMat);
    frame.rotation.x = 0.55;
    head.add(frame);
    // Face acesa: na frente do corpo inclinado, virada para o pátio e para baixo.
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), panelMat);
    panel.position.set(0, -0.08, 0.14);
    panel.rotation.x = 0.55 + Math.PI / 2;
    head.add(panel);
    const aim = new THREE.Vector3(x + ix * 16, 0, z + iz * 16);
    lamps.push({ position: new THREE.Vector3(x + ix * 4, poleH - 1, z + iz * 4), color: new THREE.Color(0xffe2b0) });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(aim.x, 0.03, aim.z);
    nightGroup.add(pool);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 9, poleH, 20, 1, true), coneMat);
    const from = new THREE.Vector3(head.position.x, poleH - 0.3, head.position.z);
    beam.position.copy(from).add(aim).multiplyScalar(0.5);
    beam.lookAt(from);
    beam.rotateX(Math.PI / 2);
    beam.scale.y = from.distanceTo(aim) / poleH;
    nightGroup.add(beam);
    const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffe6c0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    flare.position.set(head.position.x + ix * 0.2, poleH - 0.3, head.position.z + iz * 0.2);
    flare.scale.setScalar(5);
    nightGroup.add(flare);
  }

  // --- Em volta: armazéns ao norte, contêineres a leste, prédios e guindastes ao longe --------------------------------
  const shedMats = [];
  const shedTex = shedTexture(rand);
  const winTex = windowTexture();
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3d42 });
  for (const [x, w, d, h] of [[-55, 48, 30, 13], [0, 36, 26, 11], [52, 44, 32, 15]]) {
    const m = new THREE.MeshLambertMaterial({ map: shedTex.clone(), emissiveMap: winTex, emissive: 0xffffff, emissiveIntensity: 1 });
    m.map.needsUpdate = true;
    m.map.repeat.set(w / 12, 1);
    shedMats.push(m);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [m, m, roofMat, roofMat, m, m]);
    body.position.set(x, h / 2, LOT.maxZ + 12 + d / 2);
    root.add(body);
    // Telhado em duas águas
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(d * 0.6, d * 0.6, w, 3, 1), roofMat);
    roof.rotation.z = Math.PI / 2;
    roof.scale.set(1, 1, 0.22);
    roof.position.set(x, h, body.position.z);
    root.add(roof);
  }
  const box = containerTextures(77);
  box.map.repeat.set(0.5, 1);
  box.normalMap.repeat.set(0.5, 1);
  const boxGeo = new THREE.BoxGeometry(2.44, 2.6, 12.2);
  const boxMat = new THREE.MeshPhongMaterial({ map: box.map, normalMap: box.normalMap, specular: 0x333333, shininess: 20 });
  const palette = [0x9a2a22, 0x1f4f8a, 0x2f7a4a, 0xc9a13a, 0x6a6e74, 0xb05a1e, 0x2a6a78];
  const stacks = [];
  for (let row = 0; row < 3; row++) for (let k = 0; k < 9; k++) {
    const levels = 1 + Math.floor(rand() * 4);
    for (let l = 0; l < levels; l++) stacks.push([LOT.maxX + 14 + row * 3.1, 1.3 + l * 2.6, -44 + k * 12.6 + (rand() - 0.5) * 0.4]);
  }
  const boxes = new THREE.InstancedMesh(boxGeo, boxMat, stacks.length);
  const mtx = new THREE.Matrix4(), col = new THREE.Color();
  stacks.forEach(([x, y, z], i) => {
    boxes.setMatrixAt(i, mtx.makeTranslation(x, y, z));
    boxes.setColorAt(i, col.setHex(palette[Math.floor(rand() * palette.length)]));
  });
  root.add(boxes);
  // Prédios da cidade ao sul e a oeste (silhuetas com janelas)
  const towerWin = canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    for (let y = 4; y < h; y += 8) for (let x = 3; x < w; x += 8) {
      if (rand() < 0.45) continue;
      ctx.fillStyle = rand() < 0.7 ? '#ffd79a' : '#9fd6ff';
      ctx.fillRect(x, y, 4, 4);
    }
  });
  const towerMat = new THREE.MeshLambertMaterial({ color: 0x23262e, emissiveMap: towerWin, emissive: 0xffffff, emissiveIntensity: 1 });
  shedMats.push(towerMat);
  for (let k = 0; k < 16; k++) {
    const w = 14 + rand() * 20, h = 20 + rand() * 60;
    const a = Math.PI * (0.55 + rand() * 0.9); // sul e oeste
    const r = 190 + rand() * 180;
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), towerMat);
    t.position.set(Math.cos(a) * r - 40, h / 2, Math.sin(a) * r * 0.9 - 120);
    root.add(t);
  }
  // Guindastes do porto a leste, com a luz vermelha de aviação
  const craneMat = new THREE.MeshLambertMaterial({ color: 0x8c2a1c });
  const aviationMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.15) });
  const aviation = [];
  for (const z of [-60, 0, 60]) {
    const g = new THREE.Group();
    g.position.set(260, 0, z);
    for (const [dx, dz] of [[-6, -8], [6, -8], [-6, 8], [6, 8]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 42, 1.2), craneMat);
      leg.position.set(dx, 21, dz);
      g.add(leg);
    }
    const boom = new THREE.Mesh(new THREE.BoxGeometry(80, 3, 3), craneMat);
    boom.position.set(-10, 44, 0);
    g.add(boom);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), aviationMat);
    light.position.set(-50, 46, 0);
    light.userData.phase = rand() * 6;
    light.userData.dynamic = true; // pisca: fica fora da junção de malhas
    g.add(light);
    aviation.push(light);
    root.add(g);
  }
  // Placa de neon no armazém do meio: o nome do pátio
  const sign = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#0a0a0e'; ctx.fillRect(0, 0, w, h);
    ctx.font = `900 62px ${JP_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff3d7a'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#ff7aa6';
    ctx.fillText('ドリフト練習場', w / 2, h / 2 + 4);
  }, { repeat: false });
  const signMat = new THREE.MeshBasicMaterial({ map: sign, color: new THREE.Color(1.3, 1.3, 1.3) });
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), signMat);
  signMesh.position.set(0, 9, LOT.maxZ + 11.9);
  signMesh.rotation.y = Math.PI;
  root.add(signMesh);

  // --- Cones ------------------------------------------------------------------------------------------
  const cones = new Cones(root, track.lot.cones, LOT);

  mergeStatic(root);

  const atmosphere = { mist: 0.7, mistColor, headlights: true, grip: 1, rain: false, lampIntensity: 170 };
  let T = LOT_TIMES.noite;
  const world = {
    root,
    atmosphere,
    cones,
    time: null,
    get lamps() { return T.lamps ? lamps : []; },
    setTime(id) {
      T = LOT_TIMES[id] || LOT_TIMES.noite;
      world.time = LOT_TIMES[id] ? id : 'noite';
      scene.fog = fog;
      fog.color.setHex(T.fog[0]); fog.density = T.fog[1];
      skyUniforms.horizon.value.setRGB(...T.horizon); skyUniforms.zenith.value.setRGB(...T.zenith);
      stars.visible = T.stars;
      hemi.color.setHex(T.hemi[0]); hemi.groundColor.setHex(T.hemi[1]); hemi.intensity = T.hemi[2];
      sun.color.setHex(T.sun.color); sun.intensity = T.sun.intensity; sun.position.set(...T.sun.dir).multiplyScalar(300);
      nightGroup.visible = T.lamps;
      panelMat.color.setRGB(...(T.lamps ? [1.6, 1.55, 1.4] : [0.35, 0.36, 0.38]));
      for (const m of shedMats) m.emissiveIntensity = T.windows;
      lotMat.color.setHex(T.asphalt);
      mistColor.setRGB(...T.mistColor);
      Object.assign(atmosphere, { mist: T.mist, lampIntensity: T.lampIntensity, headlights: T.lamps });
    },
    setEnvMap() {},
    update(time, camera) {
      if (camera) sky.position.set(camera.position.x, 0, camera.position.z);
      for (const l of aviation) l.visible = Math.sin(time * 2 + l.userData.phase) > 0.2;
    },
    dispose: () => disposeTree(root),
  };
  world.setTime(time);
  return world;
}
