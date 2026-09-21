// KAMINARI 86: releitura do Toyota Sprinter Trueno AE86 (1983-87), o hachiroku. Hatch de três portas,
// baixo e quadrado, faróis escamoteáveis, capô plano, vigia grande e inclinada, lanternas horizontais de
// três células e a pintura de dois tons (branco em cima, preto embaixo). Frente para +Z (eixo dianteiro
// em z=1.2), esquerda para +X.
import * as THREE from 'three';
import * as P from '../carParts.js';

const { sides } = P;

export const kaminari86 = {
  color: 0xe8e8e3,
  finish: 'solid',
  engineColor: 0x2b2d33, // tampa de válvulas (aparece se o capô arrancar)
  axles: { a: 1.2, b: 1.2 },
  plate: ['群馬 55', 'ふ', '86-13'],
  wheels: { style: 'eight', color: 0xb9bdc2, x: 0.75, width: 0.21, rimRadius: 0.205, caliper: 0x6a6a6a, lip: 'polished' },
  interior: { dashZ: 0.42, dashY: 0.78, cage: 'half', cageZ: -1.12, shelf: true, shelfZ: -1.52, shelfY: 0.9, seatY: 0.4, mirrorY: 1.2, mirrorZ: -0.2, seat: 0x23242a, suit: 0x2a2d33, accent: 0x1f5fb8, belts: 0x1f5fb8 },
  door: { z0: 0.56, z1: -0.86 },
  stickerY: 0.52,
  wingDeck: 0.26,
  arch: { radius: 0.37, wellX: 0.58 },
  // Dois tons: a faixa preta da lataria vai da soleira até o vinco lateral (g 1 a 3).
  twoTone: { z0: -2.22, z1: 1.88, g0: 0.85, g1: 2.62 },
  body: {
    zMin: -2.27,
    zMax: 1.93,
    capBulge: { front: 0.035, rear: 0.02 },
    bottom: [[-2.27, 0.3], [-2.1, 0.2], [-1.2, 0.17], [1.2, 0.17], [1.8, 0.19], [1.93, 0.26]],
    rocker: [
      [-2.27, 0.58, 0.3], [-2.2, 0.72, 0.26], [-2.0, 0.755, 0.23], [-1.6, 0.748, 0.22], [-1.2, 0.742, 0.215],
      [-0.6, 0.738, 0.205], [0.4, 0.738, 0.205], [0.9, 0.742, 0.21], [1.2, 0.748, 0.22], [1.6, 0.742, 0.215],
      [1.82, 0.71, 0.21], [1.9, 0.63, 0.22], [1.93, 0.48, 0.26],
    ],
    sill: [
      [-2.27, 0.62, 0.36], [-2.2, 0.765, 0.33], [-1.9, 0.788, 0.3], [-1.2, 0.782, 0.3], [-0.6, 0.778, 0.285],
      [0.4, 0.778, 0.285], [1.2, 0.782, 0.3], [1.8, 0.768, 0.3], [1.88, 0.7, 0.3], [1.93, 0.52, 0.33],
    ],
    // Vinco lateral reto de ponta a ponta: a linha de caráter do hachiroku.
    shoulder: [
      [-2.27, 0.68, 0.58], [-2.2, 0.79, 0.63], [-2.05, 0.808, 0.66], [-1.7, 0.812, 0.665], [-1.2, 0.812, 0.665],
      [-0.6, 0.806, 0.662], [0.3, 0.802, 0.66], [0.9, 0.806, 0.655], [1.2, 0.81, 0.65], [1.6, 0.8, 0.638],
      [1.82, 0.762, 0.6], [1.9, 0.69, 0.55], [1.93, 0.56, 0.5],
    ],
    // Cintura baixa e reta; à frente do para-brisa vira a borda do capô plano.
    belt: [
      [-2.27, 0.66, 0.66], [-2.22, 0.742, 0.88], [-2.1, 0.762, 0.935], [-1.9, 0.758, 0.94], [-1.5, 0.754, 0.94],
      [-0.9, 0.75, 0.938], [-0.3, 0.747, 0.932], [0.25, 0.744, 0.925], [0.6, 0.736, 0.905],
      [0.95, 0.722, 0.862], [1.25, 0.714, 0.845], [1.6, 0.7, 0.822], [1.82, 0.655, 0.788], [1.93, 0.53, 0.665],
    ],
    // Calha do teto (o AE86 tem calha de chuva aparente) e, adiante, a quina do capô.
    rail: [
      [-2.27, 0.64, 0.665], [-2.22, 0.726, 0.885], [-2.1, 0.748, 0.94], [-2.02, 0.744, 0.945],
      [-1.75, 0.706, 1.055], [-1.45, 0.668, 1.165], [-1.15, 0.638, 1.262], [-0.95, 0.628, 1.295],
      [-0.4, 0.628, 1.3], [-0.15, 0.642, 1.245], [0.12, 0.672, 1.125], [0.38, 0.702, 1.02], [0.6, 0.726, 0.912],
      [0.95, 0.716, 0.868], [1.25, 0.708, 0.851], [1.6, 0.695, 0.828], [1.82, 0.652, 0.794], [1.93, 0.52, 0.67],
    ],
    // Teto reto e comprido, capô quase plano e queda curta na traseira.
    crown: [
      [-2.27, 0.86], [-2.15, 0.945], [-2.05, 0.962], [-1.85, 1.015], [-1.6, 1.155], [-1.3, 1.272],
      [-1.05, 1.328], [-0.4, 1.335], [-0.2, 1.322], [0.1, 1.205], [0.35, 1.065], [0.6, 0.932], [0.7, 0.915],
      [0.95, 0.888], [1.25, 0.868], [1.6, 0.846], [1.82, 0.812], [1.93, 0.7],
    ],
    pillar: [[-2.2, 0.05], [-1.1, 0.085], [-0.4, 0.08], [0.6, 0.06], [1.0, 0.03]],
    // Quadrado: vinco forte no ombro e na cintura.
    sharp: [0, 0.4, 0.25, 0.68, 0.8, 0.62, 0.3, 0],
    bulge: { side: 0.018, upper: 0.014, roof: 0.012, glass: 0.014 },
    windshield: { z0: -0.32, z1: 0.6 },
    rearGlass: { z0: -1.88, z1: -1.02 },
    roofTrim: [{ z0: 0.6, z1: 0.68 }],
    sideWindows: [
      { z0b: 0.56, z0t: 0.56, z1b: -0.78, z1t: -0.78 },
      { z0b: -0.88, z0t: -0.88, z1b: -1.4, z1t: -1.26 },
    ],
    glassTrim: [{ z0: -0.88, z1: -0.78 }],
  },
  // Vãos na pintura: lateral (z, y), topo (|x|, z), pontas (|x| com sinal da ponta, y)
  panelLines: {
    side: [
      [[0.56, 0.27], [0.545, 0.56], [0.56, 0.93]],
      [[-0.88, 0.27], [-0.88, 0.94]],
      [[0.56, 0.27], [-0.88, 0.27]],
      [[1.66, 0.3], [1.64, 0.62]],
      [[1.64, 0.62], [1.93, 0.6]],
      [[-2.02, 0.3], [-2.0, 0.6]],
      [[-2.0, 0.6], [-2.27, 0.61]],
    ],
    top: [
      [[0, 0.7], [0.7, 0.7]],
      [[0.7, 0.7], [0.712, 1.2], [0.7, 1.84]],
      [[0.28, 1.54], [0.64, 1.54]],
      [[0.28, 1.54], [0.28, 1.82]],
      [[0.28, 1.82], [0.64, 1.82]],
      [[0, 1.9], [0.28, 1.9]],
      [[0, -1.92], [0.68, -1.92]],
    ],
    end: [
      [[0, 0.6], [0.6, 0.59]],
      [[-0.0001, 0.6], [-0.66, 0.6]],
      [[-0.0001, 0.9], [-0.72, 0.9]],
    ],
  },

  build(ctx) {
    const { body, probe, parent, detail, mats, NOSE, TAIL } = ctx;
    const { paint, trim, chrome, satin } = mats;
    const add = (geo, mat, opts, into = parent) => P.addMesh(into, geo, mat, opts);
    const faceZ = (x, y, dir = 1) => probe.at('z', x, y, dir)?.[2] ?? (dir > 0 ? NOSE : TAIL);

    // --- Dois tons: faixa preta embaixo, como a pintura panda de fábrica ------------------------------
    const tt = kaminari86.twoTone;
    for (const s of sides) {
      add(body.patch({ z0: tt.z0, z1: tt.z1, g0: tt.g0, g1: tt.g1, side: s, lift: 0.0022, nu: 8, nv: 40 }), satin, {}, detail);
    }

    // --- Frisos, borrachas e a calha de chuva do teto -------------------------------------------------
    for (const s of sides) {
      P.tube(detail, body.line([0.54, 0.2, -0.3, -0.78], 4.02, s, 0.006), 0.006, mats.rubber, { radial: 5 });
      P.tube(detail, body.line([-0.88, -1.05, -1.22, -1.36], 4.02, s, 0.006), 0.006, mats.rubber, { radial: 5 });
      // calha de chuva aparente: um cordão mais grosso do para-brisa até a vigia
      P.tube(detail, body.line([-0.3, -0.6, -0.95, -1.25, -1.5], 5.08, s, 0.004), 0.006, trim, { radial: 5 });
    }

    // --- Frente: faróis escamoteáveis levantados ------------------------------------------------------
    const beams = sides.map((s) => ctx.popup({ side: s, xIn: 0.28, xOut: 0.64, zHinge: 1.54, zFront: 1.82, angle: 0.42, lamp: 'rect' }));

    // --- Para-choque dianteiro: friso fino em cima, boca retangular e lábio preto ---------------------
    const mouth = probe.patch({ axis: 'z', dir: 1, u0: -0.5, u1: 0.5, v0: 0.3, v1: 0.42, nu: 18, nv: 3, lift: 0.002 });
    add(mouth, mats.cavity);
    P.grille(ctx, { y: 0.36, z: faceZ(0, 0.36) + 0.004, w: 0.96, h: 0.1, r: 0.012, pattern: 'lines', depth: 0.02 });
    // grade fina acima do para-choque (a "boca" de cima do hachiroku)
    const slot = probe.patch({ axis: 'z', dir: 1, u0: -0.34, u1: 0.34, v0: 0.52, v1: 0.565, nu: 12, nv: 2, lift: 0.002 });
    add(slot, mats.cavity);
    P.grille(ctx, { y: 0.543, z: faceZ(0, 0.543) + 0.004, w: 0.66, h: 0.036, r: 0.008, pattern: 'lines', depth: 0.012 });
    const lip = probe.shell({ axis: 'z', dir: 1, u0: -0.74, u1: 0.74, v0: 0.22, v1: 0.275, nu: 24, nv: 2, lift: 0.004 }, 0.026);
    add(lip.face, trim); add(lip.edge, P.doubleSided(trim));
    for (const s of sides) {
      P.reflectorLamp(detail, mats, { r: 0.032, depth: 0.025, bulb: mats.fogLamp, pos: [s * 0.42, 0.355, faceZ(s * 0.42, 0.355) + 0.002] });
    }
    // Lanternas de canto: seta âmbar quadrada, como as do para-choque de fábrica
    const cornerTex = P.lampTexture({ w: 256, h: 64, base: '#141414', cells: [
      { x: 0.02, cw: 0.44, color: '#ff9120', pattern: 'lines' },
      { x: 0.48, cw: 0.5, color: '#f2efe6', pattern: 'fresnel' },
    ] });
    for (const s of sides) {
      const lamp = probe.shell({ axis: 'z', dir: 1, u0: s > 0 ? 0.42 : -0.66, u1: s > 0 ? 0.66 : -0.42, v0: 0.44, v1: 0.52, nu: 8, nv: 3, lift: 0.001 }, 0.01);
      if (s < 0) { const uv = lamp.face.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
      add(lamp.face, mats.lamp(cornerTex, new THREE.Color(1.3, 1.3, 1.3)));
      add(lamp.edge, P.doubleSided(trim));
    }
    P.licensePlate(ctx, { x: 0, y: 0.47, z: faceZ(0, 0.47) + 0.012 });
    P.towStrap(ctx, { x: -0.3, y: 0.26, z: faceZ(-0.3, 0.26) + 0.02 });
    P.badge(ctx, { text: '雷', y: 0.6, z: faceZ(0, 0.6) + 0.003, h: 0.03, font: '900 64px "Yu Gothic", "Meiryo", sans-serif' });

    // Setas laterais no para-lama e lanterninha vermelha atrás
    for (const s of sides) {
      const marker = probe.shell({ axis: 'x', dir: s, u0: 1.52, u1: 1.62, v0: 0.6, v1: 0.64, nu: 3, nv: 2, lift: 0.001 }, 0.006);
      add(marker.face, mats.markerAmber); add(marker.edge, P.doubleSided(trim));
      const rear = probe.shell({ axis: 'x', dir: s, u0: -2.16, u1: -2.05, v0: 0.62, v1: 0.655, nu: 3, nv: 2, lift: 0.001 }, 0.006);
      add(rear.face, mats.markerRed); add(rear.edge, P.doubleSided(trim));
    }

    // --- Lateral -------------------------------------------------------------------------------------
    P.sideMirror(ctx, { z: 0.46, y: 0.95, out: 0.1, size: 0.9 });
    P.doorHandle(ctx, { z: -0.62, y: 0.82, w: 0.12 });
    for (const s of sides) {
      P.addSlab(parent, body, { z0: -0.98, z1: 0.9, g0: 1.05, g1: 1.9, side: s, lift: 0.002, thick: 0.012, nu: 4, nv: 20 }, satin, trim);
    }
    // Emblema 86 na coluna traseira e tampa de combustível (lado direito)
    for (const s of sides) {
      P.badge(ctx, { text: '86', x: s * body.sideX(-1.0, 0.78), y: 0.78, z: -1.0, h: 0.028, rotY: s * Math.PI / 2 });
    }
    const fuelTex = P.canvasTex(64, 64, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.strokeStyle = 'rgba(0,0,0,0.9)'; c.lineWidth = 3;
      c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 12); c.stroke();
      c.fillStyle = 'rgba(0,0,0,0.9)'; c.fillRect(w - 16, h / 2 - 6, 6, 12);
    });
    add(probe.patch({ axis: 'x', dir: -1, u0: -1.72, u1: -1.58, v0: 0.74, v1: 0.85, nu: 4, nv: 4, lift: 0.002 }),
      new THREE.MeshBasicMaterial({ map: fuelTex, transparent: true, alphaTest: 0.3 }), {}, detail);
    const antBase = probe.at('y', 0.64, 0.7, 1, 0.005) ?? [0.64, 0.9, 0.7];
    P.tube(detail, [antBase, [antBase[0] + 0.01, antBase[1] + 0.32, antBase[2] - 0.06], [antBase[0] + 0.02, antBase[1] + 0.56, antBase[2] - 0.12]], 0.0035, chrome, { radial: 4 });

    // --- Para-brisa: limpadores -----------------------------------------------------------------------
    P.wiper(ctx, { x: -0.46, z: 0.6, length: 0.48, angle: 0.1 });
    P.wiper(ctx, { x: 0.08, z: 0.6, length: 0.44, angle: 0.08 });

    // --- Traseira: lanternas horizontais de três células ---------------------------------------------
    const tailCells = [
      { x: 0.0, cw: 0.34, color: '#e01a22', pattern: 'lines', ring: true },
      { x: 0.35, cw: 0.3, color: '#a9a69f', pattern: 'fresnel' },
      { x: 0.66, cw: 0.32, color: '#e01a22', pattern: 'lines' },
    ];
    const tailTex = P.lampTexture({ w: 256, h: 96, cells: tailCells });
    const tailMat = mats.lamp(tailTex);
    for (const s of sides) {
      const lamp = probe.shell({ axis: 'z', dir: -1, u0: s > 0 ? 0.18 : -0.76, u1: s > 0 ? 0.76 : -0.18, v0: 0.63, v1: 0.83, nu: 14, nv: 4, lift: 0.001 }, 0.014);
      const uv = lamp.face.attributes.uv;
      if (s > 0) for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
      add(lamp.face, tailMat);
      add(lamp.edge, P.doubleSided(trim));
    }
    // Painel central preto entre as lanternas, com o nome
    const garnishTex = P.canvasTex(256, 64, (c, w, h) => {
      c.fillStyle = '#0d0d0f'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,0.05)';
      for (let y = 3; y < h; y += 4) c.fillRect(0, y, w, 1);
      c.font = '900 24px "Arial Narrow", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#c9ccd2'; c.fillText('KAMINARI 86', w / 2, h / 2 + 2);
    });
    const garnish = probe.shell({ axis: 'z', dir: -1, u0: -0.18, u1: 0.18, v0: 0.66, v1: 0.8, nu: 8, nv: 3, lift: 0.001 }, 0.008);
    const guv = garnish.face.attributes.uv;
    for (let i = 0; i < guv.count; i++) guv.setX(i, 1 - guv.getX(i));
    add(garnish.face, new THREE.MeshStandardMaterial({ map: garnishTex, roughness: 0.2, metalness: 0.1, envMap: mats.envMap }));
    add(garnish.edge, P.doubleSided(trim));

    // Lábio de borracha na tampa (o aerofólio baixinho de fábrica)
    const wingZ = -2.12;
    const deckY = body.topY(wingZ, 0.4);
    const wing = new THREE.Group();
    P.addMesh(wing, P.roundedBox(1.3, 0.035, 0.13, 0.014), trim, { pos: [0, deckY + 0.018, wingZ + 0.04], rot: [-0.22, 0, 0] });
    parent.add(wing);
    ctx.aero(wing);

    // Limpador da vigia
    const rw = [];
    for (let i = 0; i <= 5; i++) { const t = i / 5; const x = -0.02 - t * 0.13, z = -1.82 + t * 0.4; rw.push([x, body.topY(z, x) + 0.012, z]); }
    P.tube(detail, rw, 0.0045, trim, { radial: 4 });

    // Para-choque traseiro: placa com luz, refletores, saia preta, escapamento e cinta de reboque
    const plateZ = faceZ(0, 0.46, -1);
    P.licensePlate(ctx, { x: 0, y: 0.46, z: plateZ - 0.012, back: true });
    add(P.roundedBox(0.12, 0.018, 0.03, 0.006), trim, { pos: [0, 0.555, faceZ(0, 0.555, -1) - 0.01] });
    for (const s of sides) {
      const refl = probe.shell({ axis: 'z', dir: -1, u0: s > 0 ? 0.5 : -0.64, u1: s > 0 ? 0.64 : -0.5, v0: 0.42, v1: 0.45, nu: 4, nv: 2, lift: 0.001 }, 0.005);
      add(refl.face, mats.redLens); add(refl.edge, P.doubleSided(trim));
    }
    const valance = probe.shell({ axis: 'z', dir: -1, u0: -0.7, u1: 0.7, v0: 0.23, v1: 0.3, nu: 20, nv: 2, lift: 0.004 }, 0.018);
    add(valance.face, trim); add(valance.edge, P.doubleSided(trim));
    P.exhaustTip(ctx, { x: -0.5, y: 0.27, z: faceZ(-0.5, 0.29, -1) - 0.03, r: 0.04, len: 0.16, style: 'round' });
    P.towStrap(ctx, { x: 0.44, y: 0.27, z: faceZ(0.44, 0.29, -1) - 0.03, back: true });

    return {
      tailMat,
      tailFlares: sides.map((s) => [s * 0.5, 0.73, faceZ(s * 0.5, 0.73, -1) - 0.03]),
      beams,
    };
  },
};
