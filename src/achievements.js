// Conquistas e medalhas: bronze, prata e ouro por categoria, mais algumas de feito único.
// Cada uma libera um item da garagem (o item aponta para a conquista em garage.js, campo unlock).
// Módulo puro (sem three.js): recebe o perfil (profile.js) e diz o que está liberado e quanto falta.
import { GARAGE_OPTIONS } from './garage.js';
import { TRACKS } from './catalog.js';

const km = (v) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 })} km`;
const pts = (v) => `${Math.round(v).toLocaleString('pt-BR')} pts`;
const deg = (v) => `${Math.round(v)}°`;
const m = (v) => `${Math.round(v).toLocaleString('pt-BR')} m`;
const n = (v) => `${Math.round(v)}`;

// Categorias com três medalhas: valor lido do perfil e metas de bronze, prata e ouro.
const TIERED = [
  { key: 'estrada', names: ['PRIMEIROS QUILÔMETROS', 'ESTRADEIRO', 'LENDA DA ESTRADA'], what: 'Rodar', value: (p) => p.km, goals: [5, 50, 200], fmt: km },
  { key: 'combo', names: ['COMBO DE RESPEITO', 'MÃO PESADA', 'COMBO INFINITO'], what: 'Somar um combo de', value: (p) => p.bestCombo, goals: [4000, 12000, 30000], fmt: pts },
  { key: 'angulo', names: ['DE LADO', 'QUASE DE RÉ', 'ÂNGULO IMPOSSÍVEL'], what: 'Segurar um drift a', value: (p) => p.maxAngle, goals: [40, 55, 70], fmt: deg },
  { key: 'drift', names: ['DRIFT LONGO', 'SEM SOLTAR', 'MARATONA DE LADO'], what: 'Manter um combo por', value: (p) => p.longestDrift, goals: [200, 500, 1000], fmt: m },
  { key: 'ss', names: ['NOTA MÁXIMA', 'COLECIONADOR DE SS', 'JUIZ ENCANTADO'], what: 'Tirar SS em', value: (p) => p.grades.SS, goals: [1, 10, 50], fmt: (v) => `${n(v)} curva${v === 1 ? '' : 's'}` },
  { key: 'vitoria', names: ['PRIMEIRA VITÓRIA', 'TEMIDO NA SERRA', 'IMBATÍVEL'], what: 'Vencer (4+ corredores)', value: (p) => p.wins, goals: [1, 10, 30], fmt: (v) => `${n(v)} corrida${v === 1 ? '' : 's'}` },
];
export const MEDALS = ['bronze', 'prata', 'ouro'];

const variantsTotal = TRACKS.reduce((s, t) => s + t.times.length, 0);
const SPECIAL = [
  { id: 'limpa', name: 'SEM ENCOSTAR', medal: 'prata', description: 'Terminar uma corrida de 3 voltas ou mais sem bater na mureta.', value: (p) => (p.feats.cleanRace ? 1 : 0), goal: 1 },
  { id: 'chuva', name: 'REI DA CHUVA', medal: 'prata', description: 'Vencer no porto com chuva (4+ corredores).', value: (p) => (p.feats.rainKing ? 1 : 0), goal: 1 },
  { id: 'hakone', name: 'REI DE HAKONE', medal: 'ouro', description: 'Vencer na Serra de Hakone contra 7 rivais, no Normal ou Simulação.', value: (p) => (p.feats.hakoneKing ? 1 : 0), goal: 1 },
  { id: 'climas', name: 'TODOS OS CLIMAS', medal: 'prata', description: `Terminar corridas em todas as ${variantsTotal} combinações de pista e horário.`, value: (p) => Object.keys(p.variants).filter((k) => p.variants[k] > 0).length, goal: variantsTotal, fmt: (v) => `${n(v)}/${variantsTotal}` },
];

export const ACHIEVEMENTS = [
  ...TIERED.flatMap((cat) => cat.goals.map((goal, i) => ({
    id: `${cat.key}-${i + 1}`,
    group: cat.key,
    name: cat.names[i],
    medal: MEDALS[i],
    description: `${cat.what} ${cat.fmt(goal)}.`,
    value: cat.value,
    goal,
    fmt: cat.fmt,
  }))),
  ...SPECIAL.map((a) => ({ group: 'feito', fmt: (v) => (v >= a.goal ? 'feito' : 'ainda não'), ...a })),
];

export const achievementById = (id) => ACHIEVEMENTS.find((a) => a.id === id);

// Item da garagem que a conquista libera: { slot, item }
const SLOT_NAMES = { paint: 'pintura', rims: 'rodas', rimColor: 'cor de roda', wing: 'aerofólio', drop: 'altura', sticker: 'adesivo', trail: 'rastro' };
export function rewardOf(id) {
  for (const [slot, list] of Object.entries(GARAGE_OPTIONS)) {
    const item = list.find((o) => o.unlock === id);
    if (item) return { slot, slotName: SLOT_NAMES[slot], item };
  }
  return null;
}

// Progresso de 0 a 1 e texto "atual / meta"
export function progressOf(a, profile) {
  const v = a.value(profile);
  return { value: v, ratio: Math.max(0, Math.min(1, v / a.goal)), text: `${a.fmt(Math.min(v, a.goal))} / ${a.fmt(a.goal)}`, done: v >= a.goal };
}

// Conquistas cumpridas que ainda não estão marcadas como liberadas no perfil
export function newlyUnlocked(profile) {
  return ACHIEVEMENTS.filter((a) => !profile.unlocked[a.id] && a.value(profile) >= a.goal);
}

// Título do piloto pela soma das medalhas (bronze 1, prata 2, ouro 3)
const TITLES = [[0, 'NOVATO', '新人'], [4, 'PILOTO DE RUA', '走り屋'], [12, 'DRIFTER', 'ドリフター'], [24, 'ÁS DO TOUGE', '峠のエース'], [40, 'LENDA', '伝説']];
export function driverTitle(profile) {
  const score = ACHIEVEMENTS.reduce((s, a) => s + (profile.unlocked[a.id] ? MEDALS.indexOf(a.medal) + 1 : 0), 0);
  let title = TITLES[0];
  for (const t of TITLES) if (score >= t[0]) title = t;
  const next = TITLES[TITLES.indexOf(title) + 1];
  return { name: title[1], jp: title[2], score, next: next ? { name: next[1], at: next[0] } : null };
}
