// SEIRAN S15: releitura do Nissan Silvia S15 Spec-R (1999-2002). Cupê três volumes com faróis repuxados
// sobre a quina do para-lama, linha de cintura subindo para trás, vinco lateral forte, para-lamas traseiros
// estufados, lanternas que dobram a quina e aerofólio de três apoios. Eixo dianteiro em z=1.25.
import * as THREE from 'three';
import * as P from '../carParts.js';

const { sides } = P;

export const seiran = {
  color: 0xdfe3e8,
  finish: 'pearl',
  engineColor: 0x1c1c1f, // tampa de válvulas (aparece se o capô arrancar)
  axles: { a: 1.25, b: 1.28 },
  plate: ['品川 330', 'み', '15-15'],
  wheels: { style: 'five', color: 0xb9bdc4, x: 0.745, width: 0.215, rimRadius: 0.205, caliper: 0xd4a017, lip: 'painted' },
  interior: { seat: 0x1e1f26, suit: 0x3a3a40, dashZ: 0.38, cage: 'half', cageZ: -1.02, shelf: true, shelfZ: -1.3, shelfY: 0.96, seatY: 0.38, mirrorY: 1.16, mirrorZ: -0.18, belts: 0x1d3fb8, accent: 0x2a4fd0 },
  door: { z0: 0.4, z1: -0.7 },
  stickerY: 0.52,
  wingDeck: 0.24,
  body: {
    zMin: -2.325,
    zMax: 2.12,
    capBulge: { front: 0.045, rear: 0.03 },
    bottom: [[-2.325, 0.31], [-2.18, 0.21], [-1.28, 0.17], [1.25, 0.17], [1.95, 0.19], [2.12, 0.25]],
    rocker: [
      [-2.325, 0.6, 0.32], [-2.27, 0.76, 0.26], [-2.1, 0.81, 0.235], [-1.7, 0.795, 0.225], [-1.28, 0.79, 0.22],
      [-0.7, 0.795, 0.2], [0.5, 0.795, 0.2], [1.25, 0.79, 0.22], [1.7, 0.795, 0.21], [1.95, 0.76, 0.2],
      [2.07, 0.66, 0.2], [2.12, 0.46, 0.23],
    ],
    sill: [
      [-2.325, 0.64, 0.38], [-2.27, 0.8, 0.33], [-2.0, 0.842, 0.31], [-1.28, 0.832, 0.3], [-0.7, 0.82, 0.29],
      [0.5, 0.82, 0.29], [1.25, 0.83, 0.3], [1.9, 0.81, 0.3], [2.07, 0.72, 0.3], [2.12, 0.52, 0.32],
    ],
    shoulder: [
      [-2.325, 0.7, 0.66], [-2.28, 0.83, 0.74], [-2.1, 0.86, 0.78], [-1.6, 0.868, 0.795], [-1.28, 0.87, 0.795],
      [-0.9, 0.856, 0.79], [-0.3, 0.846, 0.785], [0.4, 0.842, 0.775], [0.9, 0.845, 0.76], [1.25, 0.848, 0.745],
      [1.6, 0.84, 0.72], [1.85, 0.815, 0.67], [2.02, 0.76, 0.6], [2.12, 0.58, 0.52],
    ],
    belt: [
      [-2.325, 0.68, 0.76], [-2.28, 0.8, 0.9], [-2.15, 0.815, 0.955], [-1.7, 0.8, 0.965], [-1.28, 0.795, 0.96],
      [-0.8, 0.786, 0.935], [-0.2, 0.78, 0.9], [0.5, 0.772, 0.865], [0.9, 0.77, 0.815], [1.25, 0.775, 0.77],
      [1.6, 0.765, 0.725], [1.85, 0.735, 0.68], [2.02, 0.66, 0.62], [2.12, 0.48, 0.555],
    ],
    rail: [
      [-2.325, 0.66, 0.765], [-2.28, 0.78, 0.905], [-2.15, 0.795, 0.96], [-1.75, 0.785, 0.97], [-1.55, 0.765, 0.985],
      [-1.3, 0.7, 1.12], [-1.0, 0.64, 1.235], [-0.6, 0.615, 1.262], [-0.25, 0.622, 1.25], [0.1, 0.672, 1.09],
      [0.35, 0.72, 0.96], [0.5, 0.752, 0.875], [0.9, 0.75, 0.822], [1.25, 0.755, 0.777], [1.6, 0.745, 0.732],
      [1.85, 0.715, 0.687], [2.02, 0.64, 0.627], [2.12, 0.46, 0.56],
    ],
    crown: [
      [-2.325, 0.78], [-2.28, 0.92], [-2.18, 0.975], [-1.8, 0.99], [-1.55, 1.0], [-1.3, 1.15], [-1.0, 1.26],
      [-0.6, 1.285], [-0.25, 1.272], [0.1, 1.11], [0.35, 0.98], [0.5, 0.9], [0.58, 0.885], [0.9, 0.862],
      [1.25, 0.82], [1.6, 0.772], [1.85, 0.722], [2.02, 0.66], [2.12, 0.585],
    ],
    pillar: [[-2.3, 0.05], [-1.55, 0.09], [-1.0, 0.075], [-0.4, 0.07], [0.5, 0.06], [1.0, 0.03]],
    sharp: [0, 0.35, 0.2, 0.7, 0.75, 0.6, 0.3, 0],
    bulge: { side: 0.035, upper: 0.03, roof: 0.02, glass: 0.02 },
    windshield: { z0: -0.23, z1: 0.48 },
    rearGlass: { z0: -1.52, z1: -1.0 },
    roofTrim: [{ z0: 0.48, z1: 0.58 }],
    sideWindows: [
      { z0b: 0.48, z0t: 0.48, z1b: -0.7, z1t: -0.7 },
      { z0b: -0.78, z0t: -0.78, z1b: -1.22, z1t: -1.22 },
    ],
    glassTrim: [{ z0: -0.78, z1: -0.7 }],
  },
  panelLines: {
    side: [
      [[0.5, 0.27], [0.485, 0.6], [0.5, 0.86]],
      [[-0.8, 0.27], [-0.8, 0.945]],
      [[0.5, 0.27], [-0.8, 0.27]],
      [[1.86, 0.3], [1.84, 0.66]],
      [[1.84, 0.66], [2.12, 0.6]],
      [[-1.98, 0.3], [-1.96, 0.68]],
      [[-1.96, 0.68], [-2.325, 0.7]],
    ],
    top: [
      [[0, 0.6], [0.705, 0.6]],
      [[0.705, 0.6], [0.72, 1.3], [0.66, 1.66]],
      [[0, 2.06], [0.4, 2.02]],
      [[0, -1.58], [0.72, -1.58]],
      [[0.72, -1.58], [0.73, -2.2]],
    ],
    end: [
      [[-0.0001, 0.68], [-0.72, 0.68]],
      [[-0.0001, 0.925], [-0.34, 0.925]],
    ],
  },

  build(ctx) {
    const { body, probe, parent, detail, mats, NOSE, TAIL } = ctx;
    const { paint, trim, chrome } = mats;
    const add = (geo, mat, opts, into = parent) => P.addMesh(into, geo, mat, opts);
    const faceZ = (x, y, dir = 1) => probe.at('z', x, y, dir)?.[2] ?? (dir > 0 ? NOSE : TAIL);

    for (const s of sides) {
      P.tube(detail, body.line([0.46, 0.1, -0.3, -0.7], 4.02, s, 0.006), 0.006, mats.rubber, { radial: 5 });
      P.tube(detail, body.line([-0.78, -1.0, -1.22], 4.02, s, 0.006), 0.006, mats.rubber, { radial: 5 });
      P.tube(detail, body.line([-0.25, -0.5, -0.8, -1.0], 5.1, s, 0.004), 0.006, trim, { radial: 5 });
    }

    // --- Faróis repuxados sobre a quina ---------------------------------------------------------------
    const headTex = P.canvasTex(256, 96, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#4a5058'); g.addColorStop(0.5, '#23272d'); g.addColorStop(1, '#3c4148');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      for (let x = 0; x < w; x += 6) c.fillRect(x, 0, 2, h);
      c.fillStyle = '#ff9a2a'; c.fillRect(w * 0.78, h * 0.55, w * 0.2, h * 0.3); // seta na ponta de trás
      for (const [cx, cy, r] of [[w * 0.2, h * 0.5, 30], [w * 0.5, h * 0.48, 26]]) {
        const rg = c.createRadialGradient(cx, cy, 2, cx, cy, r);
        rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.45, '#e6ecf2'); rg.addColorStop(0.8, '#7d848c'); rg.addColorStop(1, '#23272c');
        c.fillStyle = rg; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      }
    });
    const headMat = mats.lamp(headTex, new THREE.Color(1.6, 1.6, 1.55));
    const beams = [];
    for (const s of sides) {
      // contorno em planta (x, z): ponta de dentro na frente, afinando para trás sobre o para-lama
      const quad = [[0.42, 2.07], [0.76, 1.99], [0.8, 1.52], [0.7, 1.58]];
      const shapeFn = (u, t) => {
        const top = [quad[0][0] + (quad[1][0] - quad[0][0]) * u, quad[0][1] + (quad[1][1] - quad[0][1]) * u];
        const bot = [quad[3][0] + (quad[2][0] - quad[3][0]) * u, quad[3][1] + (quad[2][1] - quad[3][1]) * u];
        return [s * (top[0] + (bot[0] - top[0]) * t), top[1] + (bot[1] - top[1]) * t];
      };
      const housing = probe.shell({ axis: 'y', dir: 1, nu: 10, nv: 8, lift: 0.001, shapeFn }, 0.008);
      add(housing.face, headMat); add(housing.edge, P.doubleSided(trim));
      const lens = probe.patch({ axis: 'y', dir: 1, nu: 10, nv: 8, lift: 0.02, shapeFn });
      add(lens, mats.lensClear, { order: 1 });
      // projetores de verdade dentro da lente
      for (const [px, pz] of [[0.52, 2.0], [0.64, 1.88]]) {
        const hit = probe.at('y', s * px, pz, 1, 0.012);
        if (hit) P.projectorLamp(detail, mats, { r: 0.026, pos: hit, rotX: -0.5 });
      }
      const p0 = probe.at('y', s * 0.55, 1.98, 1, 0.02) ?? [s * 0.55, 0.66, 1.98];
      beams.push(p0);
    }

    // --- Para-choque: boca trapezoidal com colmeia, milhas redondas, setas e lábio ----------------------
    const mouthFn = (u, t) => { const half = 0.36 + 0.07 * t; return [-half + 2 * half * u, 0.255 + 0.17 * t]; };
    add(probe.patch({ axis: 'z', dir: 1, nu: 16, nv: 4, lift: 0.002, shapeFn: mouthFn }), mats.cavity);
    const honey = P.canvasTex(64, 64, (c, w, h) => {
      c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#000';
      for (const [cx, cy] of [[w / 2, h / 2], [0, 0], [w, 0], [0, h], [w, h]]) { c.beginPath(); for (let k = 0; k < 6; k++) { const an = (k / 6) * Math.PI * 2; c.lineTo(cx + Math.cos(an) * 14, cy + Math.sin(an) * 14); } c.fill(); }
    }, { repeat: true });
    honey.colorSpace = THREE.NoColorSpace;
    honey.repeat.set(16, 3);
    add(probe.patch({ axis: 'z', dir: 1, nu: 16, nv: 4, lift: 0.009, shapeFn: mouthFn }), new THREE.MeshStandardMaterial({ color: 0x161618, alphaMap: honey, alphaTest: 0.5, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }));
    for (const s of sides) {
      const fogPos = [s * 0.6, 0.33, faceZ(s * 0.6, 0.33) - 0.005];
      add(probe.patch({ axis: 'z', dir: 1, u0: s * 0.54, u1: s * 0.67, v0: 0.29, v1: 0.37, nu: 5, nv: 4, lift: 0.001 }), mats.cavity);
      P.reflectorLamp(detail, mats, { r: 0.034, depth: 0.03, bulb: mats.fogLamp, pos: fogPos });
      const turn = probe.shell({ axis: 'z', dir: 1, u0: s > 0 ? 0.5 : -0.68, u1: s > 0 ? 0.68 : -0.5, v0: 0.42, v1: 0.45, nu: 6, nv: 2, lift: 0.001 }, 0.006);
      add(turn.face, mats.amber); add(turn.edge, P.doubleSided(trim));
    }
    const lip = probe.shell({ axis: 'z', dir: 1, u0: -0.72, u1: 0.72, v0: 0.2, v1: 0.24, nu: 24, nv: 2, lift: 0.006 }, 0.03);
    add(lip.face, mats.carbon); add(lip.edge, P.doubleSided(mats.carbon));
    P.licensePlate(ctx, { x: 0.0, y: 0.36, z: faceZ(0, 0.36) + 0.016 });
    P.badge(ctx, { text: 'S', y: 0.5, z: faceZ(0, 0.5) + 0.004, h: 0.04, font: 'italic 900 80px "Arial Black", Arial, sans-serif' });
    for (const s of sides) {
      const marker = probe.shell({ axis: 'x', dir: s, u0: 1.94, u1: 2.04, v0: 0.5, v1: 0.53, nu: 3, nv: 2, lift: 0.001 }, 0.006);
      add(marker.face, mats.markerAmber); add(marker.edge, P.doubleSided(trim));
    }

    // --- Lateral ---------------------------------------------------------------------------------------
    P.sideMirror(ctx, { z: 0.44, y: 0.92, out: 0.1 });
    P.doorHandle(ctx, { z: -0.62, y: 0.83, w: 0.14 });
    for (const s of sides) {
      P.addSlab(parent, body, { z0: -0.9, z1: 0.88, g0: 1.05, g1: 1.95, side: s, lift: 0.002, thick: 0.016, nu: 4, nv: 20 }, paint, trim);
    }
    const fuelTex = P.canvasTex(64, 64, (c, w, h) => {
      c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(0,0,0,0.9)'; c.lineWidth = 3;
      c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 5, 0, Math.PI * 2); c.stroke();
    });
    add(probe.patch({ axis: 'x', dir: -1, u0: -1.66, u1: -1.54, v0: 0.78, v1: 0.9, nu: 4, nv: 4, lift: 0.002 }),
      new THREE.MeshBasicMaterial({ map: fuelTex, transparent: true, alphaTest: 0.3 }), {}, detail);
    const roofAnt = probe.at('y', 0, -0.95, 1, 0.004) ?? [0, 1.26, -0.95];
    add(P.roundedBox(0.03, 0.02, 0.07, 0.008), trim, { pos: roofAnt }, detail);
    P.tube(detail, [roofAnt, [0, roofAnt[1] + 0.12, roofAnt[2] - 0.12]], 0.004, trim, { radial: 4 });
    P.wiper(ctx, { x: -0.5, z: 0.51, length: 0.5, angle: 0.1 });
    P.wiper(ctx, { x: 0.02, z: 0.51, length: 0.46, angle: 0.08 });

    // --- Traseira: lanternas que dobram a quina --------------------------------------------------------
    const tailTex = P.lampTexture({ w: 256, h: 64, cells: [
      { x: 0.0, cw: 0.44, color: '#e0141c', pattern: 'hex', ring: true },
      { x: 0.46, cw: 0.26, color: '#c96a16', pattern: 'lines' },
      { x: 0.74, cw: 0.24, color: '#a9a69f', pattern: 'fresnel', ring: true },
    ] });
    const tailMat = mats.lamp(tailTex);
    const wrapTex = P.lampTexture({ w: 128, h: 64, cells: [{ x: 0.02, cw: 0.96, color: '#d41018', pattern: 'hex' }] });
    const wrapMat = mats.lamp(wrapTex);
    for (const s of sides) {
      const lamp = probe.shell({ axis: 'z', dir: -1, u0: s > 0 ? 0.34 : -0.82, u1: s > 0 ? 0.82 : -0.34, v0: 0.735, v1: 0.9, nu: 12, nv: 4, lift: 0.001 }, 0.012);
      const uv = lamp.face.attributes.uv;
      if (s > 0) for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
      add(lamp.face, tailMat); add(lamp.edge, P.doubleSided(trim));
      const side = probe.shell({ axis: 'x', dir: s, u0: -2.3, u1: -2.1, v0: 0.76, v1: 0.88, nu: 6, nv: 3, lift: 0.001 }, 0.01);
      add(side.face, wrapMat); add(side.edge, P.doubleSided(trim));
    }
    // Tampa do porta-malas: fechadura e letreiro
    P.badge(ctx, { text: 'SEIRAN', y: 0.86, z: faceZ(0.0, 0.86, -1) - 0.004, h: 0.03, back: true, font: 'italic 800 60px "Arial", sans-serif' });
    add(new THREE.CircleGeometry(0.014, 12), chrome, { pos: [0, 0.8, faceZ(0, 0.8, -1) - 0.003], rot: [0, Math.PI, 0] }, detail);

    // Aerofólio Spec-R de três apoios
    const wingZ = -2.12;
    const deckY = body.topY(wingZ, 0.3);
    const wing = new THREE.Group();
    const airfoil = new THREE.Shape();
    airfoil.moveTo(0.1, 0); airfoil.quadraticCurveTo(0.02, 0.03, -0.1, 0.012); airfoil.lineTo(-0.1, -0.004); airfoil.quadraticCurveTo(0.02, 0.012, 0.1, -0.008); airfoil.closePath();
    const blade = P.extrude(airfoil, 1.38, 0.005, 10);
    blade.rotateY(Math.PI / 2);
    P.addMesh(wing, blade, paint, { pos: [0, deckY + 0.11, wingZ], rot: [0.08, 0, 0] });
    for (const x of [-0.5, 0, 0.5]) P.addMesh(wing, P.roundedBox(0.035, 0.11, 0.12, 0.012), paint, { pos: [x, deckY + 0.055, wingZ + 0.01] });
    for (const s of sides) P.addMesh(wing, P.roundedBox(0.02, 0.05, 0.2, 0.008), paint, { pos: [s * 0.69, deckY + 0.11, wingZ] });
    P.addMesh(wing, P.roundedBox(0.3, 0.014, 0.018, 0.005), mats.markerRed, { pos: [0, deckY + 0.118, wingZ - 0.1] });
    parent.add(wing);
    ctx.aero(wing);

    // Para-choque traseiro
    P.licensePlate(ctx, { x: 0, y: 0.52, z: faceZ(0, 0.52, -1) - 0.012, back: true });
    for (const s of sides) {
      const refl = probe.shell({ axis: 'z', dir: -1, u0: s > 0 ? 0.5 : -0.7, u1: s > 0 ? 0.7 : -0.5, v0: 0.4, v1: 0.425, nu: 4, nv: 2, lift: 0.001 }, 0.005);
      add(refl.face, mats.redLens); add(refl.edge, P.doubleSided(trim));
    }
    const diffuser = probe.shell({ axis: 'z', dir: -1, u0: -0.66, u1: 0.66, v0: 0.23, v1: 0.3, nu: 20, nv: 2, lift: 0.004 }, 0.024);
    add(diffuser.face, trim); add(diffuser.edge, P.doubleSided(trim));
    P.exhaustTip(ctx, { x: -0.55, y: 0.28, z: faceZ(-0.55, 0.32, -1) - 0.035, r: 0.05, len: 0.2 });
    P.towStrap(ctx, { x: 0.5, y: 0.28, z: faceZ(0.5, 0.32, -1) - 0.03, back: true, color: 0x1d4fd8 });

    return {
      tailMat,
      tailFlares: sides.map((s) => [s * 0.6, 0.815, faceZ(s * 0.6, 0.815, -1) - 0.03]),
      beams,
    };
  },
};
