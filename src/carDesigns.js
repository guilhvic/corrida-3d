// Designs de carroceria. Cada um traz as seções da lataria ([z, meia largura, base, topo, arredondamento]),
// a estufa/teto (ou o cockpit aberto), o estilo das rodas e build(ctx) com as peças próprias.
// build devolve { tailMat, tailFlares: [[x,y,z]], beams: [[x,y,z]] } (brilho das lanternas e fachos dos faróis).
import * as THREE from 'three';

const sides = [-1, 1];

// Colunas A e C e borrachas a partir da estufa e do teto.
function glasshouse(ctx, { cabin, roof, bPillarZ, cPillarWidth = 0.03 }) {
  const { bar, polyline, mats } = ctx;
  const front = cabin[0], back = cabin[cabin.length - 1];
  const roofFront = roof[0], roofBack = roof[roof.length - 1];
  const roofY = roofFront.yb + 0.035, roofW = roofFront.w;
  for (const s of sides) {
    bar([s * (front.w - 0.015), front.yb + 0.05, front.z - 0.02], [s * (roofW - 0.005), roofY, roofFront.z], 0.026, mats.paint);
    bar([s * (roofW - 0.005), roofY, roofBack.z], [s * (back.w - 0.015), back.yb + 0.02, back.z + 0.04], cPillarWidth, mats.paint);
    if (bPillarZ !== undefined) {
      const mid = cabin.reduce((best, c) => (Math.abs(c.z - bPillarZ) < Math.abs(best.z - bPillarZ) ? c : best));
      bar([s * (mid.w - 0.01), mid.yb + 0.03, bPillarZ + 0.04], [s * (roofW - 0.005), roofY, bPillarZ], 0.022, mats.trim);
    }
    polyline(cabin.map((c) => [s * (c.w + 0.004), c.yb + 0.045, c.z]), 0.012, mats.trim); // borracha da base dos vidros
    polyline(roof.map((c) => [s * (c.w - 0.005), c.yb + 0.028, c.z]), 0.012, mats.trim);  // calha do teto
  }
  bar([-roofW + 0.01, roofY, roofFront.z], [roofW - 0.01, roofY, roofFront.z], 0.03, mats.paint);
}

// Retrovisor de carroceria com haste.
function mirrors(ctx, { x, y, z, stalkFrom }) {
  const { THREE: T, bar, body, mats } = ctx;
  for (const s of sides) {
    bar([s * stalkFrom[0], stalkFrom[1], stalkFrom[2]], [s * (x - 0.03), y - 0.02, z + 0.01], 0.014, mats.trim);
    const housing = new T.Mesh(new T.SphereGeometry(0.06, 12, 8), mats.paint);
    housing.scale.set(1.25, 0.8, 0.6);
    housing.position.set(s * x, y, z);
    body.add(housing);
    const glassMesh = new T.Mesh(new T.CircleGeometry(0.05, 12), mats.chrome);
    glassMesh.scale.set(1.3, 0.75, 1);
    glassMesh.position.set(s * x, y, z - 0.03);
    glassMesh.rotation.y = Math.PI;
    body.add(glassMesh);
  }
}

// Lanterna com células verticais listradas (texture para lanternas traseiras).
function tailTexture(ctx, cells, { w = 256, h = 32, base = '#1c0204', stripes = true } = {}) {
  return ctx.canvasTex(w, h, (c, W, H) => {
    c.fillStyle = base; c.fillRect(0, 0, W, H);
    for (const [x, cw, fill, y0 = 4, y1 = H - 4] of cells) {
      c.fillStyle = fill; c.fillRect(x, y0, cw, y1 - y0);
      if (!stripes) continue;
      c.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = y0 + 2; y < y1; y += 3) c.fillRect(x, y, cw, 1);
    }
  });
}

export const DESIGNS = {
  // ------------------------------------------------------------------------------------------------
  // Coupé fastback anos 90 com faróis escamoteáveis (inspirado no 180SX).
  kaze180: {
    color: 0xb3141e,
    axles: { a: 1.3, b: 1.4 },
    plate: ['横浜 300', 'さ', '18-00'],
    wheels: { style: 'six', color: 0x8c6a2c, x: 0.78 },
    shell: [
      [-2.31, 0.76, 0.37, 0.77, 1],
      [-2.27, 0.835, 0.3, 0.83, 0.75],
      [-2.14, 0.868, 0.245, 0.868, 0.4],
      [-1.85, 0.882, 0.225, 0.882, 0.15],
      [-1.4, 0.896, 0.22, 0.888, 0.05],
      [-0.9, 0.886, 0.22, 0.886, 0],
      [-0.2, 0.88, 0.22, 0.88, 0],
      [0.45, 0.876, 0.22, 0.856, 0],
      [0.9, 0.882, 0.22, 0.805, 0.05],
      [1.3, 0.892, 0.22, 0.76, 0.08],
      [1.8, 0.878, 0.23, 0.695, 0.18],
      [2.1, 0.85, 0.255, 0.64, 0.38],
      [2.27, 0.8, 0.29, 0.585, 0.7],
      [2.345, 0.715, 0.33, 0.53, 1],
    ],
    cabin: [
      { z: 0.66, w: 0.8, yb: 0.79, yt: 0.84, r: 0.3, tuck: 0.05 },
      { z: 0.4, w: 0.785, yb: 0.8, yt: 0.99, r: 0.3, tuck: 0.1 },
      { z: 0.1, w: 0.765, yb: 0.81, yt: 1.14, r: 0.3, tuck: 0.15 },
      { z: -0.32, w: 0.745, yb: 0.82, yt: 1.245, r: 0.28, tuck: 0.19 },
      { z: -1.05, w: 0.735, yb: 0.83, yt: 1.245, r: 0.28, tuck: 0.19 },
      { z: -1.4, w: 0.75, yb: 0.835, yt: 1.14, r: 0.3, tuck: 0.15 },
      { z: -1.75, w: 0.77, yb: 0.84, yt: 0.99, r: 0.3, tuck: 0.1 },
      { z: -2.06, w: 0.8, yb: 0.84, yt: 0.885, r: 0.3, tuck: 0.05 },
    ],
    roof: [
      { z: -0.3, w: 0.61, yb: 1.2, yt: 1.262, r: 0.45 },
      { z: -0.5, w: 0.615, yb: 1.2, yt: 1.268, r: 0.45 },
      { z: -0.85, w: 0.615, yb: 1.2, yt: 1.268, r: 0.45 },
      { z: -1.07, w: 0.605, yb: 1.2, yt: 1.262, r: 0.45 },
    ],
    build(ctx) {
      const { box, bar, polyline, plate, onTop, onSide, shell, mats, NOSE, TAIL, plateGeo, flatShape, roundedRect } = ctx;
      const { paint, trim, seam } = mats;
      for (const s of sides) {
        bar([s * 0.785, 0.84, 0.64], [s * 0.605, 1.235, -0.3], 0.026, paint);  // coluna A
        bar([s * 0.735, 0.85, -0.62], [s * 0.605, 1.24, -0.66], 0.022, trim);  // coluna B (preta)
        bar([s * 0.61, 1.235, -1.05], [s * 0.785, 0.86, -2.02], 0.03, paint);  // coluna C
        polyline([[s * 0.8, 0.842, 0.6], [s * 0.765, 0.852, -0.3], [s * 0.755, 0.858, -1.1], [s * 0.79, 0.862, -1.95]], 0.012, trim);
        polyline([[s * 0.61, 1.228, -0.3], [s * 0.615, 1.232, -0.68], [s * 0.61, 1.228, -1.05]], 0.012, trim);
      }
      bar([-0.6, 1.235, -0.3], [0.6, 1.235, -0.3], 0.03, paint);
      bar([0.62, 0.86, 0.6], [0.06, 0.885, 0.52], 0.007, trim);              // limpadores
      bar([-0.12, 0.86, 0.6], [-0.66, 0.885, 0.53], 0.007, trim);

      polyline([-0.66, -0.3, 0, 0.3, 0.66].map((x) => onTop(0.74, x)), 0.0035, seam);
      for (const s of sides) {
        polyline([0.74, 1.05, 1.4, 1.7, 2.0, 2.2].map((z) => onTop(z, s * 0.7)), 0.0035, seam);
        polyline([0.3, 0.42, 0.55, 0.68, 0.78].map((y) => onSide(s, 0.6, y)), 0.0035, seam);
        polyline([0.3, 0.42, 0.55, 0.68, 0.8].map((y) => onSide(s, -0.86, y)), 0.0035, seam);
        polyline([0.6, 0.1, -0.4, -0.86].map((z) => onSide(s, z, 0.285)), 0.0035, seam);
        box(0.014, 0.028, 0.13, trim, s * (shell.sideX(-0.62, 0.74) + 0.006), 0.74, -0.62);
        box(0.26, 0.01, 0.2, trim, s * 0.3, shell.topY(1.12, 0.3) + 0.002, 1.12, -0.1);
        box(0.012, 0.035, 0.1, mats.markerAmber, s * (shell.sideX(2.02, 0.5) + 0.002), 0.5, 2.02);
        box(0.012, 0.045, 0.12, mats.markerRed, s * (shell.sideX(-2.0, 0.62) + 0.002), 0.62, -2.0);
      }
      const fuel = [[0.06, 0.05], [0.06, -0.05], [-0.06, -0.05], [-0.06, 0.05], [0.06, 0.05]];
      polyline(fuel.map(([dz, dy]) => onSide(1, -1.62 + dz, 0.66 + dy, 0.003)), 0.003, seam);
      mirrors(ctx, { x: 0.94, y: 0.95, z: 0.46, stalkFrom: [0.8, 0.88, 0.5] });

      const beams = ctx.popups({ x: 0.53, z: 1.82, lens: ctx.lampMat(ctx.lensTexture(2)) });
      const intakeGeo = flatShape(roundedRect(0.26, 0.07, 0.03));
      const signalGeo = flatShape(roundedRect(0.15, 0.04, 0.018));
      for (const s of sides) {
        plate(intakeGeo, trim, s * 0.37, 0.375, NOSE);
        plate(signalGeo, mats.amber, s * 0.47, 0.47, NOSE);
        plate(new THREE.CircleGeometry(0.034, 14), mats.fogLamp, s * 0.58, 0.375, NOSE - 0.01);
      }
      box(1.34, 0.022, 0.16, trim, 0, 0.315, 2.27);
      plate(plateGeo, mats.plateMat, 0, 0.44, NOSE + 0.002);

      const cells = [];
      for (const m of [false, true]) {
        const X = (x, cw) => (m ? 256 - x - cw : x);
        cells.push([X(4, 34), 34, '#ff2a2e'], [X(40, 30), 30, '#e8161e'], [X(72, 14), 14, '#ece8de'], [X(88, 22), 22, '#ff8a1c']);
      }
      cells.push([112, 32, '#3a0508', 5, 27], [116, 24, '#7a1014', 13, 19]);
      const tailMat = ctx.lampMat(tailTexture(ctx, cells), new THREE.Color(1, 1, 1));
      plate(flatShape(roundedRect(1.42, 0.12, 0.03), 4), tailMat, 0, 0.64, TAIL, true);
      plate(flatShape(roundedRect(1.5, 0.018, 0.008), 2), trim, 0, 0.565, TAIL, true);
      plate(plateGeo, mats.plateMat, 0, 0.47, TAIL - 0.002, true);
      box(1.3, 0.06, 0.14, trim, 0, 0.345, -2.25);
      for (const x of [-0.3, 0, 0.3]) box(0.02, 0.05, 0.12, trim, x, 0.33, -2.26);
      const wing = ctx.aero(box(1.36, 0.034, 0.21, paint, 0, 0.905, -2.1));
      wing.rotation.x = 0.1;
      for (const x of [-0.55, 0.55]) ctx.aero(box(0.05, 0.05, 0.08, paint, x, 0.878, -2.08));
      exhaust(ctx, -0.52, 0.33, -2.3, 0.05);
      return { tailMat, tailFlares: sides.map((s) => [s * 0.58, 0.64, TAIL - 0.03]), beams };
    },
  },

  // ------------------------------------------------------------------------------------------------
  // Cupê três volumes com faróis fixos repuxados (inspirado no Silvia S15).
  seiran: {
    color: 0xdfe3e8,
    axles: { a: 1.25, b: 1.28 },
    plate: ['品川 330', 'み', '15-15'],
    wheels: { style: 'five', color: 0xb9bdc4, x: 0.775, caliper: 0xd4a017 },
    interior: { seat: 0x1e1f26, suit: 0x3a3a40 },
    shell: [
      [-2.24, 0.77, 0.37, 0.85, 1],
      [-2.2, 0.83, 0.29, 0.9, 0.7],
      [-2.06, 0.862, 0.245, 0.93, 0.36],
      [-1.62, 0.878, 0.225, 0.937, 0.12],
      [-1.28, 0.892, 0.22, 0.93, 0.05],
      [-0.8, 0.882, 0.22, 0.905, 0],
      [-0.1, 0.876, 0.22, 0.876, 0],
      [0.5, 0.873, 0.22, 0.84, 0],
      [0.88, 0.88, 0.22, 0.79, 0.05],
      [1.25, 0.888, 0.22, 0.745, 0.08],
      [1.68, 0.872, 0.23, 0.69, 0.2],
      [1.98, 0.842, 0.25, 0.635, 0.4],
      [2.13, 0.79, 0.28, 0.58, 0.72],
      [2.2, 0.7, 0.32, 0.52, 1],
    ],
    cabin: [
      { z: 0.62, w: 0.79, yb: 0.8, yt: 0.84, r: 0.3, tuck: 0.05 },
      { z: 0.35, w: 0.775, yb: 0.81, yt: 1.0, r: 0.3, tuck: 0.1 },
      { z: 0.05, w: 0.757, yb: 0.82, yt: 1.15, r: 0.3, tuck: 0.15 },
      { z: -0.28, w: 0.742, yb: 0.84, yt: 1.235, r: 0.28, tuck: 0.2 },
      { z: -0.95, w: 0.738, yb: 0.86, yt: 1.235, r: 0.28, tuck: 0.2 },
      { z: -1.22, w: 0.752, yb: 0.88, yt: 1.13, r: 0.3, tuck: 0.15 },
      { z: -1.45, w: 0.772, yb: 0.9, yt: 1.01, r: 0.3, tuck: 0.1 },
      { z: -1.66, w: 0.79, yb: 0.9, yt: 0.95, r: 0.3, tuck: 0.05 },
    ],
    roof: [
      { z: -0.26, w: 0.6, yb: 1.19, yt: 1.252, r: 0.45 },
      { z: -0.5, w: 0.606, yb: 1.19, yt: 1.258, r: 0.45 },
      { z: -0.78, w: 0.606, yb: 1.19, yt: 1.258, r: 0.45 },
      { z: -0.97, w: 0.598, yb: 1.19, yt: 1.252, r: 0.45 },
    ],
    build(ctx) {
      const { box, bar, polyline, plate, mesh, onTop, onSide, shell, mats, NOSE, TAIL, plateGeo, flatShape, roundedRect, roundedPolygon, design } = ctx;
      const { paint, trim, seam } = mats;
      glasshouse(ctx, { cabin: design.cabin, roof: design.roof, bPillarZ: -0.74, cPillarWidth: 0.045 });
      bar([0.6, 0.86, 0.57], [0.05, 0.89, 0.49], 0.007, trim);               // limpadores
      bar([-0.12, 0.86, 0.57], [-0.64, 0.89, 0.5], 0.007, trim);

      // Frisos: capô, para-choque, portas, porta-malas, tampa de combustível
      polyline([-0.64, -0.3, 0, 0.3, 0.64].map((x) => onTop(0.7, x)), 0.0035, seam);
      polyline([-0.6, -0.3, 0, 0.3, 0.6].map((x) => onTop(-1.72, x)), 0.0035, seam);
      for (const s of sides) {
        polyline([0.7, 1.0, 1.35, 1.62, 1.72].map((z) => onTop(z, s * 0.66)), 0.0035, seam);
        polyline([0.3, 0.42, 0.55, 0.68, 0.8].map((y) => onSide(s, 0.56, y)), 0.0035, seam);
        polyline([0.3, 0.42, 0.55, 0.68, 0.82].map((y) => onSide(s, -0.98, y)), 0.0035, seam);
        polyline([0.56, 0.1, -0.5, -0.98].map((z) => onSide(s, z, 0.285)), 0.0035, seam);
        polyline([-1.72, -1.9, -2.06, -2.18].map((z) => onTop(z, s * 0.62)), 0.0035, seam);
        polyline([0.36, 0.45, 0.55, 0.62].map((y) => onSide(s, 2.06, y)), 0.0035, seam); // corte do para-choque
        box(0.014, 0.026, 0.14, trim, s * (shell.sideX(-0.72, 0.76) + 0.006), 0.76, -0.72);
        box(0.012, 0.03, 0.09, mats.markerAmber, s * (shell.sideX(1.92, 0.52) + 0.002), 0.52, 1.92);
        // Saia lateral com vinco
        polyline([1.02, 0.4, -0.3, -0.9].map((z) => onSide(s, z, 0.34, 0.004)), 0.006, trim);
      }
      const fuel = [[0.05, 0.045], [0.05, -0.045], [-0.05, -0.045], [-0.05, 0.045], [0.05, 0.045]];
      polyline(fuel.map(([dz, dy]) => onSide(-1, -1.58 + dz, 0.72 + dy, 0.003)), 0.003, seam);
      mirrors(ctx, { x: 0.93, y: 0.94, z: 0.42, stalkFrom: [0.79, 0.87, 0.46] });

      // Faróis fixos: lente curva colada na quina do para-lama, afinando para trás.
      const lensTex = ctx.canvasTex(128, 64, (c, W, H) => {
        c.fillStyle = '#1a1d22'; c.fillRect(0, 0, W, H);
        const g = c.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, '#5a6068'); g.addColorStop(1, '#2a2e34');
        c.fillStyle = g; c.fillRect(0, 0, W, H * 0.62);
        c.fillStyle = '#ff9a2a'; c.fillRect(0, 2, W * 0.22, H * 0.3);        // seta na ponta de fora
        for (const [cx, rr] of [[W * 0.52, H * 0.2], [W * 0.8, H * 0.17]]) {  // projetores
          const pg = c.createRadialGradient(cx, H * 0.24, 1, cx, H * 0.24, rr);
          pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.5, '#eef3f8'); pg.addColorStop(0.85, '#7d848c'); pg.addColorStop(1, '#23272c');
          c.fillStyle = pg; c.beginPath(); c.arc(cx, H * 0.24, rr, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = 'rgba(255,255,255,0.12)';
        for (let y = H * 0.66; y < H; y += 5) c.fillRect(0, y, W, 1);
      });
      const lens = ctx.lampMat(lensTex, new THREE.Color(2.2, 2.2, 2.1));
      const beams = [];
      for (const s of sides) {
        const spec = { z0: 1.7, z1: 2.1, side: s, nu: 10, nv: 8 };
        mesh(shell.patch({ ...spec, z0: 1.68, th0: (t) => 0.42 - 0.24 * t, th1: (t) => 0.8 + 0.5 * t, lift: 0.002 }), trim);
        mesh(shell.patch({ ...spec, th0: (t) => 0.45 - 0.24 * t, th1: (t) => 0.76 + 0.48 * t, lift: 0.005 }), lens);
        const sec = shell.at(2.0);
        const [bx, by] = shell.point(sec, 0.75);
        beams.push([s * bx, by, 2.02]);
      }

      // Para-choque dianteiro: boca larga, faróis de milha, piscas, lábio e placa.
      const mouth = roundedPolygon([[-0.45, 0.05], [-0.39, -0.07], [0.39, -0.07], [0.45, 0.05]], 0.03);
      plate(flatShape(mouth), trim, 0, 0.39, NOSE);
      for (const s of sides) {
        plate(new THREE.CircleGeometry(0.032, 14), mats.fogLamp, s * 0.34, 0.37, NOSE + 0.002);
        plate(flatShape(roundedRect(0.1, 0.03, 0.012)), mats.amber, s * 0.56, 0.44, NOSE - 0.012);
      }
      plate(flatShape(roundedRect(0.07, 0.035, 0.017)), mats.chrome, 0, 0.49, NOSE - 0.004);  // emblema
      box(1.24, 0.022, 0.14, trim, 0, 0.315, 2.12);
      plate(plateGeo, mats.plateMat, 0, 0.4, NOSE + 0.004);

      // Traseira: lanternas trapezoidais nas quinas, painel central, placa, aerofólio no porta-malas.
      const tailTex = tailTexture(ctx, [[0, 150, '#e0141c', 4, 40], [150, 60, '#ff8a1c', 6, 38], [210, 46, '#ece8de', 8, 36]], { h: 48 });
      const tailMat = ctx.lampMat(tailTex, new THREE.Color(1, 1, 1));
      const lampShape = roundedPolygon([[-0.25, -0.06], [0.23, -0.08], [0.26, 0.075], [-0.26, 0.07]], 0.03);
      for (const s of sides) {
        const m = plate(flatShape(lampShape), tailMat, s * 0.47, 0.73, TAIL, true);
        m.scale.x = -s; // espelha a lanterna do outro lado
        // A lanterna dobra a quina e continua um pouco na lateral
        mesh(shell.patch({ z0: -2.235, z1: -2.08, side: s, th0: (t) => 0.3 + 0.08 * t, th1: (t) => 0.62 - 0.12 * t, lift: 0.004, nu: 4, nv: 4 }), tailMat);
        polyline([[s * 0.22, 0.645, TAIL - 0.002], [s * 0.72, 0.645, TAIL - 0.002]], 0.004, trim);
      }
      plate(flatShape(roundedRect(0.44, 0.07, 0.02)), mats.markerRed, 0, 0.735, TAIL, true);   // painel central
      plate(flatShape(roundedRect(0.36, 0.2, 0.03)), trim, 0, 0.52, TAIL + 0.001, true);        // nicho da placa
      plate(plateGeo, mats.plateMat, 0, 0.52, TAIL - 0.003, true);
      plate(flatShape(roundedRect(1.4, 0.016, 0.008), 2), trim, 0, 0.42, TAIL, true);
      box(1.2, 0.06, 0.14, trim, 0, 0.345, -2.17);
      const wing = ctx.aero(box(1.34, 0.03, 0.2, paint, 0, 0.985, -2.04));
      wing.rotation.x = 0.06;
      for (const x of [-0.5, 0.5]) ctx.aero(box(0.045, 0.06, 0.12, paint, x, 0.955, -2.02));
      ctx.aero(box(0.9, 0.012, 0.03, mats.markerRed, 0, 0.993, -2.13));                        // 3ª luz de freio
      exhaust(ctx, -0.55, 0.33, -2.22, 0.056);
      return { tailMat, tailFlares: sides.map((s) => [s * 0.5, 0.73, TAIL - 0.03]), beams };
    },
  },

  // ------------------------------------------------------------------------------------------------
  // Roadster leve de cockpit aberto com faróis escamoteáveis (inspirado no MX-5 NA).
  tsubame: {
    color: 0x1d4fb8,
    axles: { a: 1.1, b: 1.165 },
    plate: ['神戸 500', 'す', '8-89'],
    squareness: 4.8,
    wheels: { style: 'mesh', color: 0xc7cacf, x: 0.76, caliper: 0x6a6a6a },
    interior: { dashZ: 0.38, cage: 'hoop', shelf: false, hoopZ: -0.98, hoopTop: 1.17, floorY: 0.38, seat: 0x3a2a22 },
    cockpit: { z0: 0.44, z1: -1.02, halfWidth: 0.68, corner: 0.18, floorY: 0.4, cutY: 0.56 },
    shell: [
      [-1.98, 0.72, 0.37, 0.73, 1],
      [-1.93, 0.8, 0.3, 0.8, 0.75],
      [-1.8, 0.845, 0.25, 0.83, 0.45],
      [-1.5, 0.866, 0.23, 0.835, 0.22],
      [-1.165, 0.882, 0.22, 0.82, 0.16],
      [-0.7, 0.868, 0.22, 0.785, 0.12],
      [-0.1, 0.86, 0.22, 0.77, 0.12],
      [0.4, 0.86, 0.22, 0.765, 0.12],
      [0.8, 0.868, 0.22, 0.745, 0.14],
      [1.1, 0.878, 0.22, 0.715, 0.18],
      [1.48, 0.86, 0.23, 0.665, 0.32],
      [1.78, 0.8, 0.26, 0.605, 0.55],
      [1.94, 0.7, 0.3, 0.535, 0.85],
      [1.99, 0.6, 0.33, 0.49, 1],
    ],
    build(ctx) {
      const { box, bar, polyline, plate, mesh, onTop, onSide, shell, mats, NOSE, TAIL, plateGeo, flatShape, roundedRect, loft, design } = ctx;
      const { paint, trim, seam, glass, rubber } = mats;
      const cp = design.cockpit;

      // Borracha em volta do cockpit
      const rim = [];
      for (let z = cp.z0; z >= cp.z1 + cp.corner; z -= 0.12) rim.push([cp.halfWidth + 0.01, z]);
      for (let k = 0; k <= 6; k++) {
        const ang = (k / 6) * (Math.PI / 2);
        rim.push([cp.halfWidth - cp.corner + Math.cos(ang) * cp.corner + 0.01, cp.z1 + cp.corner - Math.sin(ang) * cp.corner]);
      }
      const rimPts = [...rim.map(([x, z]) => [x, z]), ...rim.slice().reverse().map(([x, z]) => [-x, z])];
      polyline(rimPts.map(([x, z]) => [x, shell.topY(z, x) + 0.004, z]), 0.014, rubber);

      // Para-brisa com moldura preta, cantos e retrovisor interno
      const bottomZ = 0.52, topZ = 0.14, bottomY = shell.topY(0.52, 0) + 0.01, topY = 1.08;
      const nu = 10, pos = [], idx = [];
      for (let i = 0; i <= 1; i++) {
        for (let j = 0; j <= nu; j++) {
          const u = j / nu * 2 - 1;
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
      const shieldMat = glass.clone();
      shieldMat.side = THREE.DoubleSide; // vidro sem espessura: visto dos dois lados
      const shieldMesh = mesh(shield, ctx.ghost ? glass : shieldMat);
      shieldMesh.renderOrder = 1;
      const top = [], bottom = [];
      for (let j = 0; j <= nu; j++) { bottom.push(pos.slice(j * 3, j * 3 + 3)); top.push(pos.slice((j + nu + 1) * 3, (j + nu + 1) * 3 + 3)); }
      polyline(top, 0.02, trim);
      polyline(bottom, 0.014, rubber);
      for (const s of sides) bar([s * 0.69, bottomY - 0.01, bottomZ], [s * 0.61, topY, topZ], 0.022, trim);
      box(0.16, 0.05, 0.02, trim, 0, topY - 0.05, topZ + 0.02);
      bar([0.55, bottomY + 0.01, bottomZ + 0.03], [0.04, bottomY + 0.03, bottomZ - 0.02], 0.007, trim);
      bar([-0.1, bottomY + 0.01, bottomZ + 0.03], [-0.6, bottomY + 0.03, bottomZ - 0.02], 0.007, trim);

      // Capota recolhida atrás dos bancos, coberta pela lona
      mesh(loft([
        { z: -1.02, w: 0.62, yb: 0.72, yt: 0.84, r: 0.7 },
        { z: -1.1, w: 0.64, yb: 0.72, yt: 0.88, r: 0.7 },
        { z: -1.28, w: 0.62, yb: 0.72, yt: 0.86, r: 0.7 },
        { z: -1.36, w: 0.56, yb: 0.72, yt: 0.8, r: 0.8 },
      ]), rubber);

      // Frisos: capô, portas, porta-malas
      polyline([-0.62, -0.3, 0, 0.3, 0.62].map((x) => onTop(0.6, x)), 0.0035, seam);
      polyline([-0.58, -0.3, 0, 0.3, 0.58].map((x) => onTop(-1.3, x)), 0.0035, seam);
      for (const s of sides) {
        polyline([0.6, 0.9, 1.2, 1.5, 1.7].map((z) => onTop(z, s * 0.64)), 0.0035, seam);
        polyline([0.3, 0.42, 0.55, 0.66].map((y) => onSide(s, 0.42, y)), 0.0035, seam);
        polyline([0.3, 0.42, 0.55, 0.66].map((y) => onSide(s, -0.66, y)), 0.0035, seam);
        polyline([0.42, -0.1, -0.66].map((z) => onSide(s, z, 0.285)), 0.0035, seam);
        polyline([-1.3, -1.55, -1.75, -1.88].map((z) => onTop(z, s * 0.6)), 0.0035, seam);
        box(0.014, 0.024, 0.1, trim, s * (shell.sideX(-0.4, 0.68) + 0.006), 0.68, -0.4);
        box(0.012, 0.03, 0.08, mats.markerAmber, s * (shell.sideX(1.66, 0.48) + 0.002), 0.48, 1.66);
        box(0.012, 0.03, 0.08, mats.markerRed, s * (shell.sideX(-1.72, 0.56) + 0.002), 0.56, -1.72);
      }
      mirrors(ctx, { x: 0.9, y: 0.88, z: 0.36, stalkFrom: [0.72, 0.8, 0.4] });

      const beams = ctx.popups({ x: 0.5, z: 1.44, width: 0.34, height: 0.12, depth: 0.17, lens: ctx.lampMat(ctx.lensTexture(1)) });
      // Boca oval, piscas nas quinas, placa
      plate(flatShape(roundedRect(0.5, 0.1, 0.048)), trim, 0, 0.385, NOSE);
      for (const s of sides) plate(flatShape(roundedRect(0.12, 0.045, 0.02)), mats.amber, s * 0.42, 0.41, NOSE - 0.02);
      plate(plateGeo, mats.plateMat, 0, 0.395, NOSE + 0.004);
      box(1.1, 0.018, 0.12, trim, 0, 0.32, 1.9);

      // Traseira: lanternas ovais com seta e ré, placa, lábio de aerofólio, escape
      const tailTex = tailTexture(ctx, [[0, 70, '#ff8a1c', 5, 43], [70, 26, '#ece8de', 5, 43], [96, 160, '#e0141c', 5, 43]], { h: 48 });
      const tailMat = ctx.lampMat(tailTex, new THREE.Color(1, 1, 1));
      for (const s of sides) {
        const m = plate(flatShape(roundedRect(0.34, 0.11, 0.05)), tailMat, s * 0.43, 0.6, TAIL, true);
        m.scale.x = s;
      }
      plate(flatShape(roundedRect(0.36, 0.2, 0.03)), trim, 0, 0.49, TAIL + 0.001, true);
      plate(plateGeo, mats.plateMat, 0, 0.49, TAIL - 0.003, true);
      box(1.0, 0.05, 0.12, trim, 0, 0.35, -1.92);
      const lip = ctx.aero(box(1.1, 0.02, 0.1, paint, 0, shell.topY(-1.9, 0) + 0.012, -1.9));
      lip.rotation.x = 0.12;
      exhaust(ctx, 0.45, 0.34, -1.97, 0.045);
      return { tailMat, tailFlares: sides.map((s) => [s * 0.43, 0.6, TAIL - 0.03]), beams };
    },
  },
};

function exhaust(ctx, x, y, z, r) {
  const { THREE: T, body, mats } = ctx;
  const pipe = new T.Mesh(new T.CylinderGeometry(r, r, 0.16, 12, 1, true), mats.chrome);
  pipe.rotation.x = Math.PI / 2;
  pipe.position.set(x, y, z);
  body.add(pipe);
  const hole = new T.Mesh(new T.CircleGeometry(r * 0.9, 12), mats.seam);
  hole.position.set(x, y, z - 0.07);
  hole.rotation.y = Math.PI;
  body.add(hole);
}
