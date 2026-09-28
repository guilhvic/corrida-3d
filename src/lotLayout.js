// Estacionamento de treino: medidas do pátio, ponto de saída, cones e o traçado invisível que o jogo usa por
// dentro (câmera, áudio). Módulo puro (sem three.js), como o track.js: o cenário fica em lot.js.
import { buildTrack } from './track.js';

// Área livre por dentro das muretas (a face interna delas fica exatamente nestas linhas).
export const LOT = { minX: -75, maxX: 75, minZ: -52, maxZ: 52 };

// Onde o carro aparece (e volta com R): perto da mureta sul, de frente para o pátio.
export const LOT_SPAWN = { x: 0, z: -42, yaw: 0 };

// Estações de cones. Cada estação tem o desenho no chão (círculos, faixas) e os cones.
function coneLayout() {
  const cones = [];
  const cluster = (x, z) => {
    cones.push({ x, z });
    for (let k = 0; k < 4; k++) cones.push({ x: x + Math.cos(k * Math.PI / 2 + 0.4) * 0.9, z: z + Math.sin(k * Math.PI / 2 + 0.4) * 0.9 });
  };
  // Oito: dois montes de cones para contornar em volta, trocando de lado no meio.
  cluster(-50, 18);
  cluster(-50, -16);
  // Slalom: linha reta de cones a cada 11 m.
  for (let k = 0; k < 7; k++) cones.push({ x: -18 + k * 11, z: -30 });
  // Grampo: ápice (monte) e o arco de fora marcado por cones; entrar rente ao ápice sem derrubar o arco.
  cluster(46, 18);
  for (let k = 0; k <= 10; k++) {
    const a = -Math.PI / 2 + (k / 10) * Math.PI;
    cones.push({ x: 46 + Math.cos(a) * 15, z: 18 + Math.sin(a) * 15 });
  }
  // Pião: um cone sozinho no meio do círculo.
  cones.push({ x: 2, z: 22 });
  return cones;
}

// Traçado invisível: retângulo arredondado dentro do pátio, no sentido anti-horário visto de cima.
export function buildLotTrack() {
  const t = buildTrack([
    [-45, -40], [45, -40], [60, -34], [64, -20], [64, 20], [60, 34], [45, 40],
    [-45, 40], [-60, 34], [-64, 20], [-64, -20], [-60, -34],
  ]);
  return Object.assign(t, { id: 'lot', lot: { rect: LOT, spawn: LOT_SPAWN, cones: coneLayout() } });
}
