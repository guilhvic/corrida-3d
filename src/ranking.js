// Ranking local de voltas por pista e carro: as 10 voltas de mais pontos, cada uma com o fantasma gravado
// (posição e rumo a 20 Hz). Guardado no navegador; módulo puro (sem three.js).

const STORAGE_KEY = 'corrida3d.ranking.v1';
const OLD_GHOST_KEY = 'corrida3d.drift.v1'; // fantasma único das versões anteriores (sem carro)
export const RANK_SIZE = 10;

const storage = () => (typeof localStorage === 'undefined' ? null : localStorage);

function readAll() {
  try { return JSON.parse(storage()?.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function writeAll(all) {
  try { storage()?.setItem(STORAGE_KEY, JSON.stringify(all)); return true; } catch { return false; }
}

export const rankKey = (trackId, carId) => `${trackId}:${carId}`;

// Fantasma compacto: x e z em decímetros, rumo em centésimos de radiano (inteiros no JSON).
export function packGhost(samples) {
  const out = new Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = Math.round(samples[i] * (i % 3 === 2 ? 100 : 10));
  return out;
}
export function unpackGhost(packed) {
  if (!packed) return null;
  const out = new Array(packed.length);
  for (let i = 0; i < packed.length; i++) out[i] = packed[i] / (i % 3 === 2 ? 100 : 10);
  return out;
}

// Traz o fantasma antigo (um por pista, do KAZE 180) para o ranking na primeira vez.
function migrate(all, trackId, carId) {
  if (carId !== 'kaze180' || all[rankKey(trackId, carId)]) return false;
  try {
    const key = trackId === 'wangan' ? OLD_GHOST_KEY : `${OLD_GHOST_KEY}.${trackId}`;
    const old = JSON.parse(storage()?.getItem(key));
    if (!old?.bestLap || !old.ghost) return false;
    all[rankKey(trackId, carId)] = [{
      id: 'antiga', points: old.bestLap.points, time: old.bestLap.time, difficulty: null, timeOfDay: null, date: null, ghost: packGhost(old.ghost),
    }];
    return true;
  } catch { return false; }
}

export function loadRanking(trackId, carId) {
  const all = readAll();
  if (migrate(all, trackId, carId)) writeAll(all);
  return (all[rankKey(trackId, carId)] || []).slice().sort((a, b) => b.points - a.points);
}

// Registra uma volta; devolve a posição no ranking (1..10) ou 0 se não entrou.
export function submitLap(trackId, carId, { points, time, difficulty = null, timeOfDay = null, date = new Date().toISOString().slice(0, 10) }, samples) {
  if (!(points > 0) || !samples?.length) return 0;
  const all = readAll();
  migrate(all, trackId, carId);
  const key = rankKey(trackId, carId);
  const list = (all[key] || []).slice().sort((a, b) => b.points - a.points);
  if (list.length >= RANK_SIZE && points <= list[list.length - 1].points) return 0;
  const entry = { id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, points: Math.round(points), time, difficulty, timeOfDay, date, ghost: packGhost(samples) };
  list.push(entry);
  list.sort((a, b) => b.points - a.points);
  all[key] = list.slice(0, RANK_SIZE);
  if (!writeAll(all)) {
    // Sem espaço: descarta os fantasmas das posições de baixo e tenta de novo
    for (const e of all[key].slice(3)) e.ghost = null;
    writeAll(all);
  }
  return all[key].indexOf(entry) + 1;
}

// choice: 'best' (1º do ranking), 'none' ou o id de uma volta.
export function pickGhost(list, choice) {
  if (choice === 'none') return null;
  return list.find((e) => e.id === choice && e.ghost) || list.find((e) => e.ghost) || null;
}
