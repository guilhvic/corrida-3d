// Garagem: opções de visual por carro (pintura, rodas, aerofólio, altura, adesivo e cor do rastro de drift).
// Salvas no navegador por carro. Módulo puro (sem three.js): o modelo lê isto em createCarModel.
// Itens com unlock só ficam disponíveis depois da conquista com esse id (achievements.js).

const STORAGE_KEY = 'corrida3d.garagem';

export const PAINTS = [
  { id: 'original', name: 'COR ORIGINAL', color: null },
  { id: 'vermelho', name: 'VERMELHO SUPER', color: 0xb3141e },
  { id: 'branco', name: 'BRANCO PÉROLA', color: 0xe6e6e1, finish: 'pearl' },
  { id: 'preto', name: 'PRETO NOITE', color: 0x111214 },
  { id: 'prata', name: 'PRATA LUNAR', color: 0x9ea3aa, finish: 'metallic' },
  { id: 'azul', name: 'AZUL MIDNIGHT', color: 0x1b2f6b, finish: 'metallic' },
  { id: 'amarelo', name: 'AMARELO RACING', color: 0xe0a800 },
  { id: 'verde', name: 'VERDE TÓQUIO', color: 0x1f6b3a },
  { id: 'laranja', name: 'LARANJA SUNSET', color: 0xd9601a },
  { id: 'roxo', name: 'ROXO NEON', color: 0x4b2a7a },
  { id: 'rosa', name: 'ROSA SAKURA', color: 0xd94f9a },
  { id: 'ciano', name: 'CIANO WANGAN', color: 0x1f9fb0 },
  { id: 'grafite', name: 'GRAFITE METÁLICO', color: 0x3b3e44, finish: 'metallic', unlock: 'estrada-1' },
  { id: 'bayside', name: 'AZUL BAYSIDE', color: 0x1532a0, finish: 'metallic', unlock: 'combo-1' },
  { id: 'vinho', name: 'VINHO', color: 0x5c0f1e, unlock: 'drift-1' },
  { id: 'lima', name: 'VERDE LIMA', color: 0x86b818, unlock: 'angulo-2' },
  { id: 'galaxia', name: 'ROXO GALÁXIA', color: 0x2a1458, finish: 'pearl', unlock: 'drift-3' },
  { id: 'dourado', name: 'OURO CHAMPAGNE', color: 0xb08d3e, finish: 'metallic', unlock: 'ss-3' },
  // Exclusivas do BODYSHOP (shop = preço em ¥)
  { id: 'champion', name: 'BRANCO CHAMPION', color: 0xf2f0e6, finish: 'pearl', shop: 3500 },
  { id: 'candy', name: 'VERMELHO CANDY', color: 0x8e0a14, finish: 'pearl', shop: 4500 },
  { id: 'midnight', name: 'MIDNIGHT PURPLE', color: 0x2b1b4a, finish: 'pearl', shop: 6000 },
];

export const RIMS = [
  { id: 'original', name: 'ORIGINAL' },
  { id: 'six', name: '6 RAIOS' },
  { id: 'five', name: '5 RAIOS' },
  { id: 'mesh', name: 'MALHA DAISY' },
  { id: 'eight', name: '8 RAIOS FINOS' },
  { id: 'disc', name: 'DISCO FECHADO' },
  { id: 'twin', name: 'RAIOS DUPLOS', unlock: 'ss-2' },
];

export const RIM_COLORS = [
  { id: 'original', name: 'ORIGINAL', color: null },
  { id: 'bronze', name: 'BRONZE', color: 0x8c6a2c },
  { id: 'prata', name: 'PRATA', color: 0xb8bcc2 },
  { id: 'preto', name: 'PRETO FOSCO', color: 0x1c1c1e },
  { id: 'dourado', name: 'DOURADO', color: 0xc9a23a },
  { id: 'branco', name: 'BRANCO', color: 0xe6e6e6 },
  { id: 'grafite', name: 'GRAFITE', color: 0x4a4d52 },
  { id: 'azul', name: 'AZUL', color: 0x2456c8, unlock: 'angulo-1' },
  { id: 'vermelho', name: 'VERMELHA', color: 0xb3141e, unlock: 'vitoria-1' },
  { id: 'rose', name: 'OURO ROSÉ', color: 0xc48f7a, unlock: 'limpa' },
  { id: 'cromo', name: 'CROMADA', color: 0xdfe4ea, unlock: 'combo-2' },
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
  { id: 'shinwaza', name: 'SHINWAZA', text: '神業', style: 'kanji', unlock: 'ss-1' },
  { id: 'genkai', name: 'ALÉM DO LIMITE', text: '限界突破', style: 'block', unlock: 'angulo-3' },
  { id: 'kami', name: 'DEUS DO TOUGE', text: '峠の神', style: 'brush', unlock: 'estrada-3' },
  { id: 'muteki', name: 'MUTEKI', text: '無敵', style: 'kanji', unlock: 'vitoria-3' },
  { id: 'ame', name: 'REI DA CHUVA', text: '雨の王', style: 'brush', unlock: 'chuva' },
  { id: 'hakone', name: 'HAKONE SAISOKU', text: '箱根最速', style: 'brush', unlock: 'hakone' },
  { id: 'ryusei', name: 'RYŪSEI (METEORO)', text: '流星', style: 'kanji', shop: 2000 },
  { id: 'kanjozoku', name: 'KANJOZOKU', text: '環状族', style: 'brush', shop: 2800 },
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
  { id: 'verde', name: 'VERDE NEON', color: [0.3, 1, 0.2], unlock: 'estrada-2' },
  { id: 'gelo', name: 'GELO', color: [0.7, 0.9, 1], unlock: 'drift-2' },
  { id: 'sakura', name: 'SAKURA', color: [1, 0.55, 0.78], unlock: 'vitoria-2' },
  { id: 'fogo', name: 'FOGO', color: 'fire', unlock: 'combo-3' },
  { id: 'aurora', name: 'AURORA', color: 'aurora', unlock: 'climas' },
];

export const GARAGE_OPTIONS = { paint: PAINTS, rims: RIMS, rimColor: RIM_COLORS, wing: WINGS, drop: DROPS, sticker: STICKERS, trail: TRAILS };
export const DEFAULT_GARAGE = { paint: 'original', rims: 'original', rimColor: 'original', wing: 'original', drop: 0, sticker: 'none', trail: 'auto' };

const find = (list, id) => list.find((o) => o.id === id) || list[0];

// unlocked: { idDaConquista: data } do perfil, mais as compras do BODYSHOP ('shop:tipo:id').
// Item de medalha libera pela medalha ou pela compra; exclusivo da loja (shop), só comprando.
export const isLocked = (item, unlocked = {}, slot = null) => {
  if (!item || (!item.unlock && !item.shop)) return false;
  if (item.unlock && unlocked[item.unlock]) return false;
  return !(slot && unlocked[`shop:${slot}:${item.id}`]);
};

function readAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}

// Sem unlocked (null) não confere bloqueio; com ele, item bloqueado volta ao padrão
export function loadGarage(carId, unlocked = null) {
  const saved = readAll()[carId] || {};
  const out = { ...DEFAULT_GARAGE };
  for (const [key, list] of Object.entries(GARAGE_OPTIONS)) {
    const item = find(list, saved[key] ?? out[key]);
    out[key] = unlocked && isLocked(item, unlocked, key) ? DEFAULT_GARAGE[key] : item.id;
  }
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
    finish: find(PAINTS, config.paint).finish ?? 'solid',
    rims: config.rims === 'original' ? null : config.rims,
    rimColor: find(RIM_COLORS, config.rimColor).color,
    wing: config.wing,
    drop: find(DROPS, config.drop).drop,
    sticker: find(STICKERS, config.sticker),
    trail: find(TRAILS, config.trail).color,
  };
}
