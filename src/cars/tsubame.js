// TSUBAME NA: releitura do Mazda MX-5 / Eunos Roadster NA (1989-97). Roadster pequeno e redondo, capota
// recolhida, faróis escamoteáveis, boca oval, vinco que contorna a carroceria à meia altura, lanternas
// retangulares de ponta e para-brisa com moldura preta. Eixo dianteiro em z=1.1.
import * as THREE from 'three';
import * as P from '../carParts.js';

const { sides } = P;

export const tsubame = {
  color: 0x1d4fb8,
  finish: 'solid',
  axles: { a: 1.1, b: 1.165 },
  plate: ['神戸 500', 'す', '8-89'],
  wheels: { style: 'mesh', color: 0xc7cacf, x: 0.72, width: 0.2, rimRadius: 0.19, caliper: 0x6a6a6a, lip: 'polished' },
  interior: { dashZ: 0.36, dashY: 0.74, cage: 'hoop', shelf: false, hoopZ: -0.98, hoopTop: 1.17, floorY: 0.36, seat: 0x3a2a22, seatY: 0.36, doorX: 0.66, mirrorY: 1.02, mirrorZ: 0.18, accent: 0x6a4a2a },
  cockpit: { z0: 0.42, z1: -1.0, halfWidth: 0.66, corner: 0.2, floorY: 0.4, cutY: 0.6 },
  door: { z0: 0.3, z1: -0.85 },
  stickerY: 0.48,
  wingDeck: 0.18,
  arch: { radius: 0.36, wellX: 0.58 },
  body: {
    zMin: -2.07,
    zMax: 1.9,
    capBulge: { front: 0.05, rear: 0.035 },
    bottom: [[-2.07, 0.3], [-1.9, 0.2], [-1.165, 0.16], [1.1, 0.16], [1.7, 0.18], [1.9, 0.26]],
    rocker: [
      [-2.07, 0.58, 0.32], [-2.0, 0.74, 0.25], [-1.8, 0.79, 0.23], [-1.165, 0.78, 0.22], [-0.6, 0.785, 0.2],
      [0.4, 0.785, 0.2], [1.1, 0.78, 0.22], [1.55, 0.78, 0.21], [1.78, 0.72, 0.2], [1.87, 0.58, 0.21], [1.9, 0.4, 0.26],
    ],
    sill: [
      [-2.07, 0.62, 0.38], [-2.0, 0.78, 0.32], [-1.7, 0.825, 0.3], [-1.165, 0.82, 0.3], [-0.6, 0.815, 0.29],
      [0.4, 0.815, 0.29], [1.1, 0.82, 0.3], [1.55, 0.8, 0.3], [1.78, 0.72, 0.3], [1.9, 0.45, 0.33],
    ],
    shoulder: [
      [-2.07, 0.66, 0.6], [-2.02, 0.8, 0.65], [-1.8, 0.838, 0.67], [-1.165, 0.84, 0.68], [-0.6, 0.83, 0.68],
      [0.4, 0.828, 0.675], [1.1, 0.834, 0.66], [1.5, 0.824, 0.63], [1.75, 0.77, 0.58], [1.87, 0.64, 0.52], [1.9, 0.46, 0.46],
    ],
    belt: [
      [-2.07, 0.62, 0.72], [-2.03, 0.74, 0.8], [-1.85, 0.775, 0.845], [-1.4, 0.775, 0.855], [-1.0, 0.765, 0.85],
      [-0.4, 0.76, 0.84], [0.3, 0.755, 0.83], [0.6, 0.755, 0.8], [1.1, 0.755, 0.73], [1.5, 0.735, 0.68],
      [1.75, 0.66, 0.62], [1.87, 0.5, 0.56], [1.9, 0.35, 0.5],
    ],
    rail: [
      [-2.07, 0.59, 0.73], [-2.03, 0.71, 0.81], [-1.85, 0.745, 0.855], [-1.4, 0.745, 0.865], [-1.0, 0.735, 0.86],
      [-0.4, 0.73, 0.85], [0.3, 0.725, 0.84], [0.6, 0.725, 0.81], [1.1, 0.725, 0.74], [1.5, 0.705, 0.69],
      [1.75, 0.63, 0.63], [1.87, 0.47, 0.565], [1.9, 0.33, 0.505],
    ],
    crown: [
      [-2.07, 0.74], [-2.03, 0.83], [-1.85, 0.87], [-1.4, 0.88], [-1.0, 0.875], [-0.4, 0.86], [0.3, 0.855],
      [0.6, 0.83], [1.1, 0.765], [1.5, 0.71], [1.75, 0.65], [1.87, 0.58], [1.9, 0.52],
    ],
    pillar: 0.1,
    sharp: [0, 0.3, 0.15, 0.45, 0.35, 0.2, 0.1, 0],
    bulge: { side: 0.05, upper: 0.05, roof: 0.05, glass: 0.02 },
  },
  panelLines: {
    side: [
      [[0.42, 0.28], [0.405, 0.6], [0.42, 0.83]],
      [[-0.95, 0.28], [-0.95, 0.855]],
      [[0.42, 0.28], [-0.95, 0.28]],
      [[1.62, 0.3], [1.6, 0.6]],
      [[-1.8, 0.3], [-1.78, 0.62]],
    ],
    top: [
      [[0, 0.62], [0.7, 0.62]],
      [[0.7, 0.62], [0.705, 1.15], [0.6, 1.62]],
      [[0, 1.74], [0.33, 1.72]],
      [[0.33, 1.28], [0.65, 1.28]],
      [[0.33, 1.28], [0.33, 1.6]],
      [[0.33, 1.6], [0.65, 1.6]],
      [[0, -1.2], [0.66, -1.2]],
      [[0.66, -1.2], [0.68, -1.86]],
      [[0, -1.93], [0.68, -1.86]],
    ],
    end: [
      [[-0.0001, 0.62], [-0.6, 0.62]],
    ],
  },

  build(ctx) {
    const { body, probe, parent, detail, mats, NOSE, TAIL, design } = ctx;
    const { paint, trim, chrome, rubber } = mats;
    const add = (geo, mat, opts, into = parent) => P.addMesh(into, geo, mat, opts);
    const faceZ = (x, y, dir = 1) => probe.at('z', x, y, dir)?.[2] ?? (dir > 0 ? NOSE : TAIL);
    const cp = design.cockpit;

    // Borracha em volta do cockpit
    const rim = [];
    for (let z = cp.z0; z >= cp.z1 + cp.corner; z -= 0.1) rim.push([cp.halfWidth + 0.012, z]);
    for (let k = 0; k <= 8; k++) {
      const ang = (k / 8) * (Math.PI / 2);
      rim.push([cp.halfWidth - cp.corner + Math.cos(ang) * cp.corner + 0.012, cp.z1 + cp.corner - Math.sin(ang) * cp.corner]);
    }
    const loop = [...rim, ...rim.slice().reverse().map(([x, z]) => [-x, z])];
    P.tube(detail, loop.map(([x, z]) => [x, body.topY(z, x) + 0.006, z]), 0.016, rubber, { radial: 6, segments: 120 });

    // --- Para-brisa com moldura preta ----------------------------------------------------------------
    const bottomZ = 0.5, topZ = 0.14, bottomY = body.topY(bottomZ, 0) + 0.008, topY = 1.06;
    const nu = 14, pos = [], idx = [];
    for (let i = 0; i <= 1; i++) {
      for (let j = 0; j <= nu; j++) {
        const u = (j / nu) * 2 - 1;
        const half = i ? 0.6 : 0.68;
        const bow = (1 - u * u) * 0.05;
        pos.push(u * half, (i ? topY : bottomY) + (i ? bow * 0.2 : 0), (i ? topZ : bottomZ) + bow);
      }
    }
    for (let j = 0; j < nu; j++) idx.push(j, j + 1, j + nu + 1, j + 1, j + nu + 2, j + nu + 1);
    const shield = new THREE.BufferGeometry();
    shield.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    shield.setIndex(idx);
    shield.computeVertexNormals();
    const shieldMat = mats.glass.clone();
    shieldMat.side = THREE.DoubleSide;
    shieldMat.userData.fresnelGlass = true;
    add(shield, shieldMat, { order: 1 });
    const top = [], bottom = [];
    for (let j = 0; j <= nu; j++) { bottom.push(pos.slice(j * 3, j * 3 + 3)); top.push(pos.slice((j + nu + 1) * 3, (j + nu + 1) * 3 + 3)); }
    P.tube(parent, top.map(([x, y, z]) => [x, y + 0.012, z]), 0.022, trim, { radial: 6 });
    P.tube(parent, bottom, 0.014, rubber, { radial: 6 });
    for (const s of sides) P.tube(parent, [[s * 0.69, bottomY - 0.01, bottomZ], [s * 0.61, topY + 0.012, topZ]], 0.024, trim, { radial: 6 });
    add(P.roundedBox(0.03, 0.06, 0.03, 0.01), trim, { pos: [0, topY - 0.03, topZ - 0.01] });
    P.wiper(ctx, { x: -0.5, z: bottomZ + 0.03, length: 0.44, angle: 0.08, lift: 0.02 });
    P.wiper(ctx, { x: 0.02, z: bottomZ + 0.03, length: 0.42, angle: 0.06, lift: 0.02 });

    // Capota recolhida sob a capa, atrás dos bancos
    const bootShape = P.roundedRectShape(1.26, 0.16, 0.07);
    const boot = P.extrude(bootShape, 0.36, 0.02, 8);
    boot.rotateY(0);
    add(boot, new THREE.MeshStandardMaterial({ color: 0x0f0f11, roughness: 0.75, envMap: mats.envMap }), { pos: [0, body.topY(-1.18, 0) + 0.01, -1.18] });

    // --- Faróis escamoteáveis (tampa do capô girada, laterais em cunha) e frente ----------------------
    const beams = sides.map((s) => ctx.popup({ side: s, xIn: 0.33, xOut: 0.65, zHinge: 1.28, zFront: 1.6, angle: 0.62, lamp: 'round' }));
    // Boca oval
    const ovalFn = (u, t) => { const a = Math.PI * (1 - u); const r = 0.5 + 0.5 * t; return [Math.cos(a) * 0.25 * r, 0.345 + Math.sin(a) * 0.045 * r - (1 - t) * 0.0]; };
    const ovalTop = probe.patch({ axis: 'z', dir: 1, nu: 16, nv: 3, lift: 0.002, shapeFn: (u, t) => { const a = Math.PI * u; return [Math.cos(a) * 0.25 * t, 0.345 + Math.sin(a) * 0.05 * t]; } });
    const ovalBot = probe.patch({ axis: 'z', dir: 1, nu: 16, nv: 3, lift: 0.002, shapeFn: (u, t) => { const a = -Math.PI * u; return [Math.cos(a) * 0.25 * t, 0.345 + Math.sin(a) * 0.05 * t]; } });
    void ovalFn;
    add(ovalTop, P.doubleSided(mats.cavity)); add(ovalBot, P.doubleSided(mats.cavity));
    for (const s of sides) {
      const turn = probe.shell({ axis: 'z', dir: 1, u0: s > 0 ? 0.36 : -0.52, u1: s > 0 ? 0.52 : -0.36, v0: 0.4, v1: 0.44, nu: 5, nv: 2, lift: 0.001 }, 0.008);
      add(turn.face, mats.amber); add(turn.edge, P.doubleSided(trim));
      const marker = probe.shell({ axis: 'x', dir: s, u0: 1.66, u1: 1.76, v0: 0.48, v1: 0.51, nu: 3, nv: 2, lift: 0.001 }, 0.006);
      add(marker.face, mats.markerAmber); add(marker.edge, P.doubleSided(trim));
      const rearMarker = probe.shell({ axis: 'x', dir: s, u0: -1.94, u1: -1.84, v0: 0.6, v1: 0.63, nu: 3, nv: 2, lift: 0.001 }, 0.006);
      add(rearMarker.face, mats.markerRed); add(rearMarker.edge, P.doubleSided(trim));
    }
    P.licensePlate(ctx, { x: 0, y: 0.34, z: faceZ(0, 0.34) + 0.03, tilt: 0.05 });
    P.badge(ctx, { text: '燕', y: 0.47, z: faceZ(0, 0.47) + 0.004, h: 0.04, font: '900 72px "Yu Gothic", "Meiryo", sans-serif' });

    // --- Lateral ---------------------------------------------------------------------------------------
    P.sideMirror(ctx, { z: 0.3, y: 0.8, out: 0.1, size: 0.9 });
    for (const s of sides) {
      const p = body.surface(-0.84, body.gAtY(-0.84, 0.79, 3, 5), s, 0.004);
      add(P.roundedBox(0.012, 0.022, 0.1, 0.006), chrome, { pos: p }, detail);
    }
    add(probe.patch({ axis: 'x', dir: -1, u0: -1.62, u1: -1.5, v0: 0.72, v1: 0.8, nu: 4, nv: 3, lift: 0.002 }),
      new THREE.MeshBasicMaterial({ map: P.canvasTex(64, 48, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(0,0,0,0.9)'; c.lineWidth = 3; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 10); c.stroke(); }), transparent: true, alphaTest: 0.3 }), {}, detail);
    const ant = probe.at('y', -0.62, -1.7, 1, 0.004) ?? [-0.62, 0.87, -1.7];
    P.tube(detail, [ant, [ant[0] - 0.01, ant[1] + 0.45, ant[2] - 0.1]], 0.003, chrome, { radial: 4 });

    // --- Traseira ------------------------------------------------------------------------------------
    const tailTex = P.lampTexture({ w: 256, h: 64, cells: [
      { x: 0.0, cw: 0.44, color: '#e0141c', pattern: 'lines' },
      { x: 0.46, cw: 0.2, color: '#c96a16', pattern: 'lines' },
      { x: 0.68, cw: 0.14, color: '#a9a69f', pattern: 'fresnel' },
      { x: 0.84, cw: 0.14, color: '#c8121a', pattern: 'lines' },
    ] });
    const tailMat = mats.lamp(tailTex);
    for (const s of sides) {
      const lamp = probe.shell({ axis: 'z', dir: -1, u0: s > 0 ? 0.26 : -0.76, u1: s > 0 ? 0.76 : -0.26, v0: 0.62, v1: 0.72, nu: 12, nv: 3, lift: 0.001 }, 0.014);
      const uv = lamp.face.attributes.uv;
      if (s > 0) for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
      add(lamp.face, tailMat); add(lamp.edge, P.doubleSided(trim));
    }
    P.badge(ctx, { text: 'Tsubame', y: 0.74, x: 0.42, z: faceZ(0.42, 0.76, -1) - 0.004, h: 0.034, back: true, font: 'italic 700 60px "Brush Script MT", "Segoe Script", cursive' });
    add(new THREE.CircleGeometry(0.013, 12), chrome, { pos: [0, 0.76, faceZ(0, 0.76, -1) - 0.003], rot: [0, Math.PI, 0] }, detail);
    const lipZ = TAIL + 0.16;
    const lipSpoiler = add(P.roundedBox(1.0, 0.02, 0.1, 0.008), paint, { pos: [0, body.topY(lipZ, 0) + 0.012, lipZ], rot: [0.12, 0, 0] });
    ctx.aero(lipSpoiler);

    P.licensePlate(ctx, { x: 0, y: 0.47, z: faceZ(0, 0.47, -1) - 0.012, back: true });
    for (const s of sides) {
      const refl = probe.shell({ axis: 'z', dir: -1, u0: s > 0 ? 0.44 : -0.6, u1: s > 0 ? 0.6 : -0.44, v0: 0.44, v1: 0.465, nu: 4, nv: 2, lift: 0.001 }, 0.005);
      add(refl.face, mats.redLens); add(refl.edge, P.doubleSided(trim));
    }
    const valance = probe.shell({ axis: 'z', dir: -1, u0: -0.6, u1: 0.6, v0: 0.26, v1: 0.31, nu: 18, nv: 2, lift: 0.004 }, 0.016);
    add(valance.face, trim); add(valance.edge, P.doubleSided(trim));
    P.exhaustTip(ctx, { x: -0.45, y: 0.29, z: faceZ(-0.45, 0.32, -1) - 0.03, r: 0.038, len: 0.16 });

    return {
      tailMat,
      tailFlares: sides.map((s) => [s * 0.52, 0.67, faceZ(s * 0.52, 0.67, -1) - 0.03]),
      beams,
    };
  },
};
