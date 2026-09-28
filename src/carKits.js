// Kits de carroceria da garagem: para-choques com splitter, canards, saias laterais e difusor; alargadores
// sobre os arcos das rodas; capô de fibra (liso ou com tomada de ar). São peças montadas por cima da lataria,
// como o aerofólio, coladas na superfície com a sonda (carProbe.js).
// O que fica preso a um painel que arranca (para-choque, capô) vai num grupo próprio e voa junto na batida.
import * as THREE from 'three';
import * as P from './carParts.js';

const sides = [-1, 1];

// Ponto da lataria em X naquele corte (z, y) do lado pedido; devolve o padrão se o raio não achar nada.
function surfaceX(probe, z, y, side, fallback = 0.85) {
  const hit = probe.cast('x', z, y, side);
  return hit ? Math.abs(hit.point[0]) : fallback;
}

// Altura do assoalho da lataria em (x, z) — para o splitter e as saias ficarem rentes.
function bottomY(probe, x, z, fallback = 0.22) {
  const hit = probe.cast('y', x, z, -1);
  return hit ? hit.point[1] : fallback;
}

// Alargador: faixa que acompanha o arco da roda, saindo da lataria e abrindo para fora.
function fenderFlare({ zA, side, radius, centerY, x0, flare, rise }) {
  const N = 22;
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const ang = -Math.PI * 0.46 + (i / N) * Math.PI * 0.92; // do para-lama da frente até o de trás, por cima
    const c = Math.cos(ang), s = Math.sin(ang);
    const zIn = zA + s * radius, yIn = centerY + c * radius;
    const zOut = zA + s * (radius + rise), yOut = centerY + c * (radius + rise);
    pos.push(side * x0, yIn, zIn, side * (x0 + flare), yOut, zOut);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// look: { kit, fenders, hood } da garagem. panels: as regiões dos painéis que arrancam (para o capô de fibra
// cobrir exatamente o mesmo pedaço). Devolve os grupos que devem voar com cada painel.
export function buildBodyKit(ctx, look, panels) {
  const { parent: body, mats, body: shape, probe, design, axles } = ctx;
  const extras = {};
  const group = (name) => {
    if (!extras[name]) { extras[name] = new THREE.Group(); body.add(extras[name]); }
    return extras[name];
  };
  const { a, b } = axles;
  const kit = look?.kit ?? 'original', fenders = look?.fenders ?? 'original', hood = look?.hood ?? 'original';
  const race = kit === 'pista';
  const kitMat = race ? mats.carbon : mats.paint;

  if (kit !== 'original') {
    const front = group('para-choque-diant');
    const noseZ = shape.zMax - 0.1;
    const noseY = bottomY(probe, 0, noseZ);
    const noseW = surfaceX(probe, noseZ, noseY + 0.2, 1) * 2;
    // Splitter: lâmina rente ao chão saindo na frente do para-choque (mais larga e saliente no kit de pista).
    const depth = race ? 0.3 : 0.18;
    const lip = P.addMesh(front, P.roundedBox(noseW * 0.99, 0.022, depth, 0.008), kitMat, {
      pos: [0, noseY + 0.012, noseZ + depth * 0.42], rot: [race ? 0.02 : 0.08, 0, 0],
    });
    lip.name = 'splitter';
    if (race) {
      // Tirantes do splitter e canards nas quinas do para-choque.
      for (const s of sides) {
        P.addMesh(front, P.roundedBox(0.012, 0.16, 0.012, 0.004), mats.satin, { pos: [s * 0.42, noseY + 0.1, noseZ + 0.22], rot: [0.5, 0, 0] });
        for (let k = 0; k < 2; k++) {
          const y = noseY + 0.1 + k * 0.09; // na quina do para-choque, abaixo dos faróis
          const x = surfaceX(probe, shape.zMax - 0.22, y, s);
          P.addMesh(front, P.roundedBox(0.16, 0.01, 0.1, 0.004), mats.carbon, { pos: [s * (x + 0.06), y, shape.zMax - 0.24], rot: [-0.25, 0, s * 0.35] });
        }
      }
    }
    // Saias laterais: ficam na lataria (não saem com o para-choque).
    const skirtZ = (a - 0.5 + (-b + 0.5)) / 2, skirtLen = (a + b) - 1;
    for (const s of sides) {
      const y = bottomY(probe, s * 0.7, skirtZ) + 0.03;
      const x = surfaceX(probe, skirtZ, y + 0.06, s);
      P.addMesh(body, P.roundedBox(0.05, 0.09, skirtLen, 0.012), kitMat, { pos: [s * (x + 0.005), y, skirtZ], rot: [0, 0, s * -0.25] });
    }
    // Difusor: sai com o para-choque traseiro.
    const rear = group('para-choque-tras');
    const tailZ = shape.zMin + 0.16, tailY = bottomY(probe, 0, tailZ + 0.1);
    const diffW = surfaceX(probe, tailZ, tailY + 0.2, 1) * 1.7;
    P.addMesh(rear, P.roundedBox(diffW, 0.02, 0.26, 0.008), race ? mats.carbon : mats.satin, { pos: [0, tailY + 0.02, tailZ - 0.02], rot: [-0.12, 0, 0] });
    for (const x of [-0.5, -0.17, 0.17, 0.5]) {
      P.addMesh(rear, P.roundedBox(0.016, 0.09, 0.24, 0.006), mats.carbon, { pos: [x * diffW, tailY + 0.07, tailZ - 0.02], rot: [-0.12, 0, 0] });
    }
  }

  if (fenders !== 'original') {
    const bolted = fenders === 'aparafusado';
    const radius = (design.arch?.radius ?? 0.37) + 0.012;
    const centerY = ctx.R - 0.005;
    const flare = bolted ? 0.055 : 0.042;
    const mat = bolted ? mats.satin : mats.paint;
    for (const zA of [a, -b]) {
      for (const s of sides) {
        const x0 = surfaceX(probe, zA, centerY + radius * 0.75, s) - 0.01;
        const mesh = new THREE.Mesh(fenderFlare({ zA, side: s, radius, centerY, x0, flare, rise: bolted ? 0.05 : 0.035 }), P.doubleSided(mat));
        body.add(mesh);
        if (!bolted) continue;
        // Parafusos de aço aparecendo na borda, como nos alargadores de rebite.
        for (let k = 0; k <= 6; k++) {
          const ang = -Math.PI * 0.4 + (k / 6) * Math.PI * 0.8;
          const z = zA + Math.sin(ang) * (radius + 0.05), y = centerY + Math.cos(ang) * (radius + 0.05);
          P.addMesh(body, new THREE.CylinderGeometry(0.011, 0.011, 0.012, 6), mats.chrome, { pos: [s * (x0 + flare * 0.5), y, z], rot: [0, 0, Math.PI / 2] });
        }
      }
    }
  }

  if (hood !== 'original') {
    const capo = panels.capo;
    const cover = group('capo');
    // A mesma região do capô que arranca numa batida, um dedo acima da chapa: o painel de fibra por cima.
    // Precisa de folga (e de prioridade no teste de profundidade) para não brigar com a chapa de baixo.
    const carbon = P.doubleSided(mats.carbon).clone();
    carbon.polygonOffset = true;
    carbon.polygonOffsetFactor = -3;
    carbon.polygonOffsetUnits = -6;
    for (const side of sides) {
      const g = shape.patch({ z0: capo.z0, z1: capo.z1, g0: capo.g0, g1: capo.g1, side, lift: 0.016, nu: 6, nv: 8 });
      cover.add(new THREE.Mesh(g, carbon));
    }
    // Pinos de capô nas quinas da frente.
    for (const s of sides) {
      const z = capo.z1 - 0.06;
      const x = 0.42, y = shape.topY(z, x) + 0.004;
      P.addMesh(cover, new THREE.CylinderGeometry(0.018, 0.02, 0.012, 10), mats.chrome, { pos: [s * x, y + 0.006, z] });
      P.addMesh(cover, new THREE.CylinderGeometry(0.005, 0.005, 0.03, 6), mats.satin, { pos: [s * x, y + 0.02, z] });
    }
    if (hood === 'tomada') {
      // Tomada de ar: caixa baixa com a boca virada para o para-brisa.
      const z = (capo.z0 + capo.z1) / 2 - 0.04;
      const y = shape.topY(z, 0.2);
      P.addMesh(cover, P.roundedBox(0.56, 0.09, 0.46, 0.025), mats.carbon, { pos: [0, y + 0.05, z], rot: [-0.06, 0, 0] });
      P.addMesh(cover, new THREE.BoxGeometry(0.46, 0.075, 0.02), mats.soot, { pos: [0, y + 0.055, z - 0.21], rot: [0.32, 0, 0] });
    }
  }

  return extras;
}
