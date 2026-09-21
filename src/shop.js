// BODYSHOP: o que dá para comprar com os ¥ das corridas. Módulo puro (sem three.js).
// - Carros: o KAZE 180 é o de largada; os outros se compram (quem já tinha corrido com um fica com ele).
// - Preparação: seis kits por carro, cada um em três estágios, que mexem no acerto de verdade (physics.js).
// - Peças: itens da garagem que antes só saíam por medalha, mais algumas exclusivas da loja.
import { CAR } from './physics.js';
import { GARAGE_OPTIONS } from './garage.js';

export const STARTER_CAR = 'kaze180';
export const CAR_PRICES = { kaze180: 0, tsubame: 12000, kaminari86: 15000, seiran: 22000 };

// mult: multiplica o valor do carro; add: soma. Cada estágio substitui o anterior (não acumula).
export const UPGRADES = [
  {
    id: 'motor', name: 'PREPARAÇÃO DO MOTOR', jp: 'エンジン',
    description: 'Comando bravo, pistões forjados e remapeamento: mais torque em toda a faixa de giro.',
    levels: [
      { price: 3000, mult: { torqueScale: 1.07 } },
      { price: 6500, mult: { torqueScale: 1.15 } },
      { price: 12000, mult: { torqueScale: 1.25 } },
    ],
  },
  {
    id: 'peso', name: 'REDUÇÃO DE PESO', jp: '軽量化',
    description: 'Bancos concha, vidros de policarbonato e capô de fibra: mais leve e mais ágil para girar.',
    levels: [
      { price: 2500, mult: { mass: 0.96, inertia: 0.96 } },
      { price: 5500, mult: { mass: 0.92, inertia: 0.92 } },
      { price: 9500, mult: { mass: 0.88, inertia: 0.88 } },
    ],
  },
  {
    id: 'pneus', name: 'PNEUS', jp: 'タイヤ',
    description: 'Compostos mais macios: mais aderência para frear tarde e sair de lado com controle.',
    levels: [
      { price: 2000, mult: { mu: 1.03 } },
      { price: 4500, mult: { mu: 1.06 } },
      { price: 8000, mult: { mu: 1.1 } },
    ],
  },
  {
    id: 'suspensao', name: 'SUSPENSÃO', jp: '足回り',
    description: 'Coilovers e barras estabilizadoras: centro de gravidade mais baixo e direção mais rápida.',
    levels: [
      { price: 3000, mult: { cgHeight: 0.95 }, add: { steerRate: 0.4 } },
      { price: 6000, mult: { cgHeight: 0.9 }, add: { steerRate: 0.8 } },
      { price: 10500, mult: { cgHeight: 0.85 }, add: { steerRate: 1.3 } },
    ],
  },
  {
    id: 'freios', name: 'FREIOS', jp: 'ブレーキ',
    description: 'Discos maiores e pinças de quatro pistões: frenagem mais curta na entrada da curva.',
    levels: [
      { price: 1800, mult: { brakeForce: 1.12 } },
      { price: 4000, mult: { brakeForce: 1.25 } },
      { price: 7000, mult: { brakeForce: 1.4 } },
    ],
  },
  {
    id: 'angulo', name: 'KIT DE ÂNGULO', jp: 'アングル',
    description: 'Mangas de eixo modificadas: mais esterço para segurar drifts bem mais abertos sem rodar.',
    levels: [
      { price: 4000, add: { maxLock: 0.08, easyMaxAngle: 0.05 } },
      { price: 8000, add: { maxLock: 0.16, easyMaxAngle: 0.1 } },
      { price: 14000, add: { maxLock: 0.26, easyMaxAngle: 0.16 } },
    ],
  },
];

// Acerto do carro com a preparação comprada (levels: { motor: 2, pneus: 1, ... }).
export function upgradedParams(carDef, levels = {}) {
  const base = { ...CAR, ...carDef.params };
  const out = { ...carDef.params };
  for (const u of UPGRADES) {
    const lv = levels?.[u.id] || 0;
    if (!lv) continue;
    const stage = u.levels[lv - 1];
    for (const [k, m] of Object.entries(stage.mult || {})) out[k] = base[k] * m;
    for (const [k, a] of Object.entries(stage.add || {})) out[k] = base[k] + a;
  }
  return out;
}

// Peças: preço por tipo para os itens de medalha; os exclusivos da loja trazem o preço no item (shop).
export const PART_SLOTS = [
  ['paint', 'PINTURA', 3000],
  ['rims', 'RODAS', 5000],
  ['rimColor', 'COR DA RODA', 2000],
  ['sticker', 'ADESIVO', 2500],
  ['trail', 'RASTRO DE DRIFT', 3500],
];

export function shopParts() {
  const out = [];
  for (const [slot, slotName, price] of PART_SLOTS) {
    for (const item of GARAGE_OPTIONS[slot]) {
      if (!item.unlock && !item.shop) continue;
      out.push({ slot, slotName, item, price: item.shop ?? price, key: `shop:${slot}:${item.id}` });
    }
  }
  return out;
}
