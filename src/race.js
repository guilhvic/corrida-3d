// Grid de largada e dados dos corredores de IA. Módulo puro (sem three.js).

export const MAX_RACERS = 8;
const LAST_SLOT_AHEAD = 14; // m depois da linha para o último do grid (a reta antes da linha é curta demais)
const SLOT_GAP = 6.5;       // m entre posições (fila indiana alternando os lados)
const SLOT_LANE = 3.2;      // m do centro da rua

// Posição i do grid (0 = pole, à esquerda). O grid fica na reta logo depois da linha:
// a corrida já começa na volta 1. lane: null usa o lado alternado; 0 põe no centro.
export function gridSlot(track, i, lane = null) {
  const ahead = LAST_SLOT_AHEAD + (MAX_RACERS - 1 - i) * SLOT_GAP;
  const idx = Math.round(ahead / track.ds) % track.N;
  if (lane === null) lane = i % 2 === 0 ? SLOT_LANE : -SLOT_LANE;
  return {
    idx,
    lane,
    x: track.x[idx] + track.nx[idx] * lane,
    z: track.z[idx] + track.nz[idx] * lane,
    yaw: Math.atan2(track.tx[idx], track.tz[idx]),
  };
}

// Pilotos de IA: nome no painel, cor da carroceria e habilidade (0..1).
export const RIVALS = [
  { name: 'KENJI', car: 'seiran', color: 0xe8e8e8, skill: 0.95 },
  { name: 'AYA', car: 'tsubame', color: 0x1c4fb0, skill: 0.9 },
  { name: 'RYO', car: 'kaminari86', color: 0xe8e8e3, skill: 0.85 },
  { name: 'MIKA', car: 'seiran', color: 0xe0a000, skill: 0.8 },
  { name: 'TAKU', car: 'kaze180', color: 0x1f7a3a, skill: 0.75 },
  { name: 'YUI', car: 'tsubame', color: 0xd94f9a, skill: 0.7 },
  { name: 'SHO', car: 'kaze180', color: 0x111214, skill: 0.65 },
];
