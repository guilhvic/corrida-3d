// KAZE 180: releitura do Nissan 180SX RPS13 kouki (1996-98). Fastback com faróis escamoteáveis,
// vigia grande até o aerofólio da tampa, lanterna horizontal de ponta a ponta com friso central e
// para-choque de boca larga. Frente para +Z (eixo dianteiro em z=1.3), esquerda para +X.
import * as THREE from 'three';
import * as P from '../carParts.js';

const { sides } = P;

export const kaze180 = {
  color: 0xb3141e,
  finish: 'solid',
  axles: { a: 1.3, b: 1.4 },
  plate: ['横浜 300', 'さ', '18-00'],
  wheels: { style: 'six', color: 0x8c6a2c, x: 0.745, width: 0.215, rimRadius: 0.205, caliper: 0xc0151b, lip: 'painted' },
  interior: { dashZ: 0.44, cage: 'half', shelf: true, shelfZ: -1.62, shelfY: 0.86, seatY: 0.38, mirrorY: 1.16, mirrorZ: -0.24 },
  door: { z0: 0.45, z1: -0.62 },
  stickerY: 0.5,
  wingDeck: 0.3,
  body: {
    zMin: -2.36,
    zMax: 2.28,
    capBulge: { front: 0.05, rear: 0.025 },
    bottom: [[-2.36, 0.3], [-2.2, 0.2], [-1.4, 0.17], [1.3, 0.17], [2.1, 0.19], [2.28, 0.26]],
    rocker: [
      [-2.36, 0.62, 0.3], [-2.3, 0.76, 0.25], [-2.15, 0.805, 0.23], [-1.8, 0.79, 0.225], [-1.4, 0.785, 0.22],
      [-0.8, 0.79, 0.2], [0.5, 0.79, 0.2], [1.0, 0.79, 0.215], [1.3, 0.785, 0.22], [1.8, 0.79, 0.21],
      [2.1, 0.76, 0.2], [2.22, 0.68, 0.205], [2.28, 0.5, 0.24],
    ],
    sill: [
      [-2.36, 0.66, 0.36], [-2.3, 0.8, 0.32], [-2.0, 0.835, 0.3], [-1.4, 0.825, 0.3], [-0.8, 0.815, 0.285],
      [0.5, 0.815, 0.285], [1.3, 0.825, 0.3], [2.0, 0.81, 0.3], [2.2, 0.73, 0.3], [2.28, 0.56, 0.32],
    ],
    shoulder: [
      [-2.36, 0.7, 0.58], [-2.3, 0.825, 0.66], [-2.12, 0.852, 0.7], [-1.7, 0.86, 0.715], [-1.4, 0.862, 0.715],
      [-1.0, 0.852, 0.715], [-0.3, 0.842, 0.71], [0.5, 0.838, 0.7], [1.0, 0.842, 0.685], [1.3, 0.845, 0.672],
      [1.7, 0.838, 0.65], [2.0, 0.818, 0.61], [2.2, 0.76, 0.55], [2.28, 0.6, 0.5],
    ],
    belt: [
      [-2.36, 0.68, 0.66], [-2.31, 0.78, 0.86], [-2.2, 0.8, 0.92], [-1.95, 0.79, 0.93], [-1.5, 0.787, 0.925],
      [-0.75, 0.782, 0.895], [0, 0.778, 0.872], [0.62, 0.772, 0.855], [0.9, 0.772, 0.82], [1.3, 0.777, 0.775],
      [1.7, 0.767, 0.73], [2.0, 0.737, 0.69], [2.2, 0.66, 0.635], [2.28, 0.5, 0.55],
    ],
    rail: [
      [-2.36, 0.66, 0.665], [-2.31, 0.76, 0.865], [-2.2, 0.78, 0.925], [-2.02, 0.765, 0.945],
      [-1.6, 0.71, 1.06], [-1.25, 0.66, 1.17], [-0.95, 0.625, 1.235],
      [-0.6, 0.618, 1.25], [-0.3, 0.628, 1.235],
      [0.05, 0.675, 1.08], [0.35, 0.72, 0.96], [0.62, 0.76, 0.862],
      [0.9, 0.752, 0.826], [1.3, 0.757, 0.781], [1.7, 0.747, 0.736], [2.0, 0.717, 0.695], [2.2, 0.64, 0.64], [2.28, 0.48, 0.555],
    ],
    crown: [
      [-2.36, 0.67], [-2.31, 0.88], [-2.24, 0.945], [-2.12, 0.965], [-2.02, 0.965], [-1.6, 1.085], [-1.25, 1.2],
      [-0.95, 1.268], [-0.6, 1.29], [-0.3, 1.275], [0.05, 1.12], [0.35, 1.0], [0.62, 0.9], [0.7, 0.885],
      [0.9, 0.868], [1.3, 0.826], [1.7, 0.778], [2.0, 0.728], [2.2, 0.672], [2.28, 0.59],
    ],
    pillar: [[-2.3, 0.05], [-1.0, 0.07], [-0.4, 0.075], [0.6, 0.06], [1.0, 0.03]],
    sharp: [0, 0.35, 0.2, 0.55, 0.75, 0.6, 0.3, 0],
    bulge: { side: 0.03, upper: 0.02, roof: 0.02, glass: 0.02 },
    windshield: { z0: -0.28, z1: 0.6 },
    rearGlass: { z0: -2.0, z1: -0.97 },
    roofTrim: [{ z0: 0.6, z1: 0.7 }],
    sideWindows: [
      { z0b: 0.6, z0t: 0.6, z1b: -0.62, z1t: -0.62 },
      { z0b: -0.72, z0t: -0.72, z1b: -1.5, z1t: -1.5 },
    ],
    glassTrim: [{ z0: -0.72, z1: -0.62 }],
  },
  // Vãos na pintura: lateral (z, y), topo (|x|, z), pontas (|x| com sinal da ponta, y)
  panelLines: {
    side: [
      [[0.6, 0.27], [0.585, 0.55], [0.6, 0.845]],
      [[-0.72, 0.27], [-0.72, 0.9]],
      [[0.6, 0.27], [-0.72, 0.27]],
      [[1.98, 0.3], [1.96, 0.61]],
      [[1.96, 0.61], [2.28, 0.575]],
      [[-2.02, 0.3], [-2.0, 0.585]],
      [[-2.0, 0.585], [-2.36, 0.595]],
    ],
    top: [
      [[0, 0.72], [0.715, 0.72]],
      [[0.715, 0.72], [0.725, 1.3], [0.705, 1.74]],
      [[0.31, 1.74], [0.705, 1.74]],
      [[0.31, 1.74], [0.31, 2.1]],
      [[0.31, 2.1], [0.7, 2.1]],
      [[0, 2.14], [0.31, 2.14]],
    ],
    end: [
      [[0, 0.585], [0.62, 0.575]],
      [[-0.0001, 0.6], [-0.7, 0.6]],
      [[-0.0001, 0.885], [-0.76, 0.885]],
    ],
  },

  build(ctx) {
    const { body, probe, parent, detail, mats, NOSE, TAIL } = ctx;
    const { paint, trim, chrome } = mats;
    const add = (geo, mat, opts, into = parent) => P.addMesh(into, geo, mat, opts);
    const faceZ = (x, y, dir = 1) => probe.at('z', x, y, dir)?.[2] ?? (dir > 0 ? NOSE : TAIL);

    // --- Frisos e borrachas das janelas -----------------------------------------------------------
    for (const s of sides) {
      P.tube(detail, body.line([0.58, 0.2, -0.3, -0.62], 4.02, s, 0.006), 0.006, mats.rubber, { radial: 5 });
      P.tube(detail, body.line([-0.72, -1.0, -1.3, -1.5], 4.02, s, 0.006), 0.006, mats.rubber, { radial: 5 });
      P.tube(detail, body.line([-0.3, -0.5, -0.8, -1.0], 5.1, s, 0.004), 0.006, trim, { radial: 5 }); // calha do teto
    }

    // --- Frente: faróis escamoteáveis levantados (tampa do capô girada, laterais em cunha) ------------
    const beams = sides.map((s) => ctx.popup({ side: s, xIn: 0.31, xOut: 0.7, zHinge: 1.74, zFront: 2.1, angle: 0.5, lamp: 'rect' }));

    // --- Para-choque dianteiro kouki ----------------------------------------------------------------
    // Boca larga com aletas, faróis de milha nos cantos da boca e lábio preto
    const mouth = probe.patch({ axis: 'z', dir: 1, u0: -0.48, u1: 0.48, v0: 0.28, v1: 0.425, nu: 18, nv: 3, lift: 0.002 });
    add(mouth, mats.cavity);
    for (const y of [0.315, 0.35, 0.385]) {
      add(P.roundedBox(0.94, 0.009, 0.02, 0.003), trim, { pos: [0, y, faceZ(0, y) - 0.004] });
    }
    P.tube(detail, [-0.48, -0.24, 0, 0.24, 0.48].map((x) => [x, 0.428, faceZ(x, 0.428) + 0.004]), 0.006, trim);
    for (const s of sides) {
      P.reflectorLamp(detail, mats, { r: 0.03, depth: 0.025, bulb: mats.fogLamp, pos: [s * 0.4, 0.352, faceZ(s * 0.4, 0.352) + 0.002] });
    }
    const lip = probe.shell({ axis: 'z', dir: 1, u0: -0.74, u1: 0.74, v0: 0.215, v1: 0.26, nu: 24, nv: 2, lift: 0.004 }, 0.028);
    add(lip.face, trim); add(lip.edge, P.doubleSided(trim));
    // Lanternas de canto: seta âmbar + luz de posição clara
    const cornerTex = P.lampTexture({ w: 256, h: 64, base: '#141414', cells: [
      { x: 0.02, cw: 0.46, color: '#f2efe6', pattern: 'fresnel' },
      { x: 0.5, cw: 0.48, color: '#ff9120', pattern: 'lines' },
    ] });
    for (const s of sides) {
      const lamp = probe.shell({ axis: 'z', dir: 1, u0: s > 0 ? 0.44 : -0.64, u1: s > 0 ? 0.64 : -0.44, v0: 0.44, v1: 0.505, nu: 8, nv: 3, lift: 0.001 }, 0.01);
      if (s < 0) { const uv = lamp.face.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
      add(lamp.face, mats.lamp(cornerTex, new THREE.Color(1.3, 1.3, 1.3)));
      add(lamp.edge, P.doubleSided(trim));
    }
    P.licensePlate(ctx, { x: 0, y: 0.5, z: faceZ(0, 0.5) + 0.012 });
    P.towStrap(ctx, { x: -0.3, y: 0.27, z: faceZ(-0.3, 0.27) + 0.02 });
    P.badge(ctx, { text: 'KAZE', y: 0.572, z: faceZ(0, 0.572) + 0.003, h: 0.026, italic: true });

    // Setas laterais no para-choque e lanterninha vermelha atrás
    for (const s of sides) {
      const marker = probe.shell({ axis: 'x', dir: s, u0: 2.02, u1: 2.12, v0: 0.46, v1: 0.49, nu: 3, nv: 2, lift: 0.001 }, 0.006);
      add(marker.face, mats.markerAmber); add(marker.edge, P.doubleSided(trim));
      const rear = probe.shell({ axis: 'x', dir: s, u0: -2.2, u1: -2.08, v0: 0.62, v1: 0.655, nu: 3, nv: 2, lift: 0.001 }, 0.006);
      add(rear.face, mats.markerRed); add(rear.edge, P.doubleSided(trim));
    }

    // --- Lateral -----------------------------------------------------------------------------------
    P.sideMirror(ctx, { z: 0.5, y: 0.92, out: 0.1 });
    P.doorHandle(ctx, { z: -0.5, y: 0.8, w: 0.13 });
    for (const s of sides) {
      P.addSlab(parent, body, { z0: -0.98, z1: 0.94, g0: 1.05, g1: 1.95, side: s, lift: 0.002, thick: 0.014, nu: 4, nv: 20 }, paint, trim);
    }
    // Tampa de combustível (lado direito) e antena (traseira esquerda)
    const fuelTex = P.canvasTex(64, 64, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.strokeStyle = 'rgba(0,0,0,0.9)'; c.lineWidth = 3;
      c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 12); c.stroke();
      c.fillStyle = 'rgba(0,0,0,0.9)'; c.fillRect(w - 16, h / 2 - 6, 6, 12);
    });
    add(probe.patch({ axis: 'x', dir: -1, u0: -1.7, u1: -1.56, v0: 0.72, v1: 0.83, nu: 4, nv: 4, lift: 0.002 }),
      new THREE.MeshBasicMaterial({ map: fuelTex, transparent: true, alphaTest: 0.3 }), {}, detail);
    const antBase = probe.at('y', 0.62, -1.95, 1, 0.005) ?? [0.62, 0.95, -1.95];
    P.tube(detail, [antBase, [antBase[0] + 0.02, antBase[1] + 0.35, antBase[2] - 0.12], [antBase[0] + 0.03, antBase[1] + 0.62, antBase[2] - 0.24]], 0.0035, chrome, { radial: 4 });

    // --- Para-brisa: limpadores e borracha ----------------------------------------------------------
    P.wiper(ctx, { x: -0.5, z: 0.63, length: 0.5, angle: 0.1 });
    P.wiper(ctx, { x: 0.04, z: 0.63, length: 0.46, angle: 0.08 });

    // --- Traseira: lanterna de ponta a ponta com friso central -----------------------------------------
    const tailCells = [
      { x: 0.0, cw: 0.52, color: '#e01a22', pattern: 'hex', ring: true },
      { x: 0.53, cw: 0.2, color: '#c96a16', pattern: 'lines' },
      { x: 0.74, cw: 0.24, color: '#a9a69f', pattern: 'fresnel' },
    ];
    const tailTex = P.lampTexture({ w: 256, h: 64, cells: tailCells });
    const tailMat = mats.lamp(tailTex);
    for (const s of sides) {
      const lamp = probe.shell({ axis: 'z', dir: -1, u0: s > 0 ? 0.26 : -0.8, u1: s > 0 ? 0.8 : -0.26, v0: 0.665, v1: 0.845, nu: 14, nv: 4, lift: 0.001 }, 0.014);
      // célula vermelha na ponta de fora dos dois lados
      const uv = lamp.face.attributes.uv;
      if (s > 0) for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
      add(lamp.face, tailMat);
      add(lamp.edge, P.doubleSided(trim));
    }
    const garnishTex = P.canvasTex(256, 64, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#5a0c10'); g.addColorStop(0.5, '#300507'); g.addColorStop(1, '#1a0203');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 3; y < h; y += 4) c.fillRect(0, y, w, 1);
      c.font = 'italic 900 26px "Arial Black", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#cfd3d8'; c.fillText('KAZE 180', w / 2, h / 2 + 2);
    });
    const garnish = probe.shell({ axis: 'z', dir: -1, u0: -0.26, u1: 0.26, v0: 0.68, v1: 0.83, nu: 8, nv: 3, lift: 0.001 }, 0.01);
    const guv = garnish.face.attributes.uv;
    for (let i = 0; i < guv.count; i++) guv.setX(i, 1 - guv.getX(i));
    add(garnish.face, new THREE.MeshStandardMaterial({ map: garnishTex, roughness: 0.15, metalness: 0.1, envMap: mats.envMap }));
    add(garnish.edge, P.doubleSided(trim));

    // Aerofólio da tampa (Type X) com brake light
    const wingZ = -2.07;
    const deckY = body.topY(wingZ, 0.5);
    const wing = new THREE.Group();
    const airfoil = new THREE.Shape();
    airfoil.moveTo(0.11, 0); airfoil.quadraticCurveTo(0.02, 0.034, -0.11, 0.01); airfoil.lineTo(-0.11, -0.004); airfoil.quadraticCurveTo(0.02, 0.01, 0.11, -0.008); airfoil.closePath();
    const blade = P.extrude(airfoil, 1.46, 0.006, 10);
    blade.rotateY(Math.PI / 2);
    P.addMesh(wing, blade, paint, { pos: [0, deckY + 0.055, wingZ], rot: [0.05, 0, 0] });
    for (const s of sides) P.addMesh(wing, P.roundedBox(0.05, 0.06, 0.14, 0.015), paint, { pos: [s * 0.56, deckY + 0.028, wingZ + 0.01] });
    P.addMesh(wing, P.roundedBox(0.36, 0.018, 0.02, 0.006), mats.markerRed, { pos: [0, deckY + 0.06, wingZ - 0.108] });
    parent.add(wing);
    ctx.aero(wing);

    // Limpador traseiro na vigia
    const rw = [];
    for (let i = 0; i <= 5; i++) { const t = i / 5; const x = 0.02 + t * 0.12, z = -1.92 + t * 0.42; rw.push([x, body.topY(z, x) + 0.012, z]); }
    P.tube(detail, rw, 0.0045, trim, { radial: 4 });

    // Para-choque traseiro: placa com luz, refletores, difusor, escapamento e cinta de reboque
    const plateZ = faceZ(0, 0.46, -1);
    P.licensePlate(ctx, { x: 0, y: 0.46, z: plateZ - 0.012, back: true });
    add(P.roundedBox(0.12, 0.018, 0.03, 0.006), trim, { pos: [0, 0.565, faceZ(0, 0.565, -1) - 0.01] });
    for (const s of sides) {
      const refl = probe.shell({ axis: 'z', dir: -1, u0: s > 0 ? 0.52 : -0.66, u1: s > 0 ? 0.66 : -0.52, v0: 0.43, v1: 0.46, nu: 4, nv: 2, lift: 0.001 }, 0.005);
      add(refl.face, mats.redLens); add(refl.edge, P.doubleSided(trim));
    }
    const valance = probe.shell({ axis: 'z', dir: -1, u0: -0.7, u1: 0.7, v0: 0.24, v1: 0.3, nu: 20, nv: 2, lift: 0.004 }, 0.02);
    add(valance.face, trim); add(valance.edge, P.doubleSided(trim));
    P.exhaustTip(ctx, { x: -0.52, y: 0.28, z: faceZ(-0.52, 0.3, -1) - 0.03, r: 0.042, len: 0.18, style: 'oval' });
    P.towStrap(ctx, { x: 0.46, y: 0.28, z: faceZ(0.46, 0.3, -1) - 0.03, back: true });

    return {
      tailMat,
      tailFlares: sides.map((s) => [s * 0.58, 0.755, faceZ(s * 0.58, 0.755, -1) - 0.03]),
      beams,
    };
  },
};
