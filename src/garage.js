// Garagem: opções de visual por carro (pintura, rodas, aerofólio, altura, adesivo e cor do rastro de drift).
// Salvas no navegador por carro. Módulo puro (sem three.js): o modelo lê isto em createCarModel.

const STORAGE_KEY = 'corrida3d.garagem';

export const PAINTS = [
  { id: 'original', name: 'COR ORIGINAL', color: null },
  { id: 'vermelho', name: 'VERMELHO SUPER', color: 0xb3141e },
  { id: 'branco', name: 'BRANCO PÉROLA', color: 0xe6e6e1 },
  { id: 'preto', name: 'PRETO NOITE', color: 0x111214 },
  { id: 'prata', name: 'PRATA LUNAR', color: 0x9ea3aa },
  { id: 'azul', name: 'AZUL MIDNIGHT', color: 0x1b2f6b },
  { id: 'amarelo', name: 'AMARELO RACING', color: 0xe0a800 },
  { id: 'verde', name: 'VERDE TÓQUIO', color: 0x1f6b3a },
  { id: 'laranja', name: 'LARANJA SUNSET', color: 0xd9601a },
  { id: 'roxo', name: 'ROXO NEON', color: 0x4b2a7a },
  { id: 'rosa', name: 'ROSA SAKURA', color: 0xd94f9a },
  { id: 'ciano', name: 'CIANO WANGAN', color: 0x1f9fb0 },
];

export const RIMS = [
  { id: 'original', name: 'ORIGINAL' },
  { id: 'six', name: '6 RAIOS' },
  { id: 'five', name: '5 RAIOS' },
  { id: 'mesh', name: 'MALHA DAISY' },
  { id: 'eight', name: '8 RAIOS FINOS' },
  { id: 'disc', name: 'DISCO FECHADO' },
];

export const RIM_COLORS = [
  { id: 'original', name: 'ORIGINAL', color: null },
  { id: 'bronze', name: 'BRONZE', color: 0x8c6a2c },
  { id: 'prata', name: 'PRATA', color: 0xb8bcc2 },
  { id: 'preto', name: 'PRETO FOSCO', color: 0x1c1c1e },
  { id: 'dourado', name: 'DOURADO', color: 0xc9a23a },
  { id: 'branco', name: 'BRANCO', color: 0xe6e6e6 },
  { id: 'grafite', name: 'GRAFITE', color: 0x4a4d52 },
];

export const WINGS = [
  { id: 'original', name: 'ORIGINAL' },
  { id: 'none', name: 'SEM AEROFÓLIO' },
  { id: 'gt', name: 'GT ALTO' },
  { id: 'duck', name: 'DUCKTAIL' },
];

export const DROPS = [
  { id: 0, name: 'ALTURA ORIGINAL', drop: 0 },
  { id: 2, name: 'REBAIXADO -2 CM', drop: 0.02 },
  { id: 4, name: 'REBAIXADO -4 CM', drop: 0.04 },
  { id: 6, name: 'NO CHÃO -6 CM', drop: 0.06 },
];

export const STICKERS = [
  { id: 'none', name: 'SEM ADESIVO' },
  { id: 'touge', name: 'TOUGE SAISOKU', text: '峠最速', style: 'brush' },
  { id: 'wangan', name: 'WANGAN DRIFT', text: '湾岸ドリフト', style: 'block' },
  { id: 'hashiriya', name: 'HASHIRIYA', text: '走り屋', style: 'brush' },
  { id: 'kaze', name: 'KAZE (VENTO)', text: '風', style: 'kanji' },
  { id: 'tamashii', name: 'ALMA DE DRIFT', text: 'ドリフト魂', style: 'block' },
  { id: 'zeta', name: 'PATROCÍNIO ZETA', text: 'ゼータタイヤ', style: 'sponsor' },
];

export const TRAILS = [
  { id: 'auto', name: 'COR DO MULTIPLICADOR', color: null },
  { id: 'ciano', name: 'CIANO', color: [0.2, 0.95, 1] },
  { id: 'rosa', name: 'ROSA NEON', color: [1, 0.2, 0.7] },
  { id: 'roxo', name: 'ROXO', color: [0.6, 0.3, 1] },
  { id: 'dourado', name: 'DOURADO', color: [1, 0.72, 0.2] },
  { id: 'vermelho', name: 'VERMELHO', color: [1, 0.12, 0.08] },
  { id: 'branco', name: 'BRANCO', color: [1, 1, 1] },
  { id: 'arcoiris', name: 'ARCO-ÍRIS', color: 'rainbow' },
];

export const GARAGE_OPTIONS = { paint: PAINTS, rims: RIMS, rimColor: RIM_COLORS, wing: WINGS, drop: DROPS, sticker: STICKERS, trail: TRAILS };
export const DEFAULT_GARAGE = { paint: 'original', rims: 'original', rimColor: 'original', wing: 'original', drop: 0, sticker: 'none', trail: 'auto' };

const find = (list, id) => list.find((o) => o.id === id) || list[0];

function readAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}

export function loadGarage(carId) {
  const saved = readAll()[carId] || {};
  const out = { ...DEFAULT_GARAGE };
  for (const [key, list] of Object.entries(GARAGE_OPTIONS)) out[key] = find(list, saved[key] ?? out[key]).id;
  return out;
}

export function saveGarage(carId, config) {
  const all = readAll();
  all[carId] = config;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch { /* sem storage */ }
}

// Valores prontos para o modelo 3D e o rastro.
export function garageLook(config) {
  return {
    color: find(PAINTS, config.paint).color,
    rims: config.rims === 'original' ? null : config.rims,
    rimColor: find(RIM_COLORS, config.rimColor).color,
    wing: config.wing,
    drop: find(DROPS, config.drop).drop,
    sticker: find(STICKERS, config.sticker),
    trail: find(TRAILS, config.trail).color,
  };
}
