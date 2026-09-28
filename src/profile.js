// Perfil do piloto: estatísticas de carreira salvas no navegador e o rastreador que as atualiza durante a corrida.
// Módulo puro (sem three.js): o main.js chama os métodos do ProfileTracker nos eventos do jogo.
import { newlyUnlocked } from './achievements.js';
import { STARTER_CAR, CAR_PRICES } from './shop.js';

const STORAGE_KEY = 'corrida3d.perfil';
const GRADES = ['SS', 'S', 'A', 'B', 'C', 'D'];
const SAVE_EVERY = 15; // s entre gravações durante a corrida

export function emptyProfile() {
  return {
    version: 1,
    since: new Date().toISOString().slice(0, 10),
    km: 0,               // distância total pilotando (corrida valendo)
    seconds: 0,          // tempo ao volante
    races: 0,            // corridas iniciadas
    finished: 0,         // corridas terminadas (com chegada)
    wins: 0,             // 1º lugar com pelo menos 4 corredores
    podiums: 0,          // top 3 com pelo menos 4 corredores
    laps: 0,
    points: 0,           // soma dos pontos das corridas terminadas
    bestCombo: 0,        // maior combo somado
    bestLap: 0,          // volta de mais pontos
    bestRace: 0,         // corrida de mais pontos
    maxAngle: 0,         // maior ângulo sustentado (graus, média de ~0,3 s) com o combo valendo
    longestDrift: 0,     // m de um combo só, do começo até somar ou perder
    wallHits: 0,
    grades: Object.fromEntries(GRADES.map((g) => [g, 0])),
    byTrack: {},         // id -> { km, races, wins }
    byCar: {},           // id -> km
    variants: {},        // 'pista:horário' -> corridas terminadas
    carsFinished: {},    // id -> corridas terminadas
    money: 0,            // ¥ ganhos nas corridas (gastos no reparo da lataria)
    earned: 0,           // ¥ ganhos na carreira inteira
    damage: {},          // lataria de cada carro: id -> { front, rear, left, right, scratchL, scratchR, hits, broken }
    ownedCars: {},       // BODYSHOP: carros comprados (id -> data)
    upgrades: {},        // preparação comprada: id do carro -> { motor: 2, pneus: 1, ... }
    bought: {},          // peças compradas: 'shop:tipo:id' -> data
    feats: {},           // conquistas de evento único: cleanRace, hakoneKing, rainKing
    unlocked: {},        // id da conquista -> data
  };
}

function merge(base, saved) {
  if (!saved || typeof saved !== 'object') return base;
  for (const [k, v] of Object.entries(base)) {
    if (!(k in saved)) continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) base[k] = { ...v, ...saved[k] };
    else if (typeof saved[k] === typeof v) base[k] = saved[k];
  }
  return base;
}

export function loadProfile(storage = globalThis.localStorage) {
  try { return merge(emptyProfile(), JSON.parse(storage.getItem(STORAGE_KEY))); } catch { return emptyProfile(); }
}

// Liberações da garagem: medalhas mais as peças compradas no BODYSHOP.
export const garageUnlocks = (profile) => ({ ...profile.unlocked, ...profile.bought });

// Carro na garagem do jogador (o de largada sempre).
export const ownsCar = (profile, id) => id === STARTER_CAR || !!profile.ownedCars?.[id] || CAR_PRICES[id] === undefined;

export function saveProfile(profile, storage = globalThis.localStorage) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch { /* sem storage */ }
}

// Zonas de amassado e lados riscados, com o ponto de cada uma no desenho do carro ([x lateral, z frente]).
const DENT_ZONES = [
  ['front', 'Amassado na frente', [0, 1.7]],
  ['rear', 'Amassado atrás', [0, -1.8]],
  ['left', 'Amassado do lado esquerdo', [0.85, 0.1]],
  ['right', 'Amassado do lado direito', [-0.85, 0.1]],
];
const SCRATCH_SIDES = [
  ['scratchL', 'Riscos na lateral esquerda', [0.85, -0.9]],
  ['scratchR', 'Riscos na lateral direita', [-0.85, -0.9]],
];

// Peças que caem numa batida: nome na ficha e onde ficam no desenho.
const PARTS = {
  'para-choque-diant': ['Para-choque dianteiro', [0, 2.25]],
  'para-choque-tras': ['Para-choque traseiro', [0, -2.25]],
  capo: ['Capô', [0, 1.25]],
  'porta-esq': ['Porta esquerda', [0.9, 0.05]],
  'porta-dir': ['Porta direita', [-0.9, 0.05]],
  'farol-esq': ['Farol esquerdo', [0.6, 2.1]],
  'farol-dir': ['Farol direito', [-0.6, 2.1]],
  'retrovisor-esq': ['Retrovisor esquerdo', [1.05, 0.85]],
  'retrovisor-dir': ['Retrovisor direito', [-1.05, 0.85]],
  'placa-frente': ['Placa da frente', [0, 2.35]],
  'placa-tras': ['Placa de trás', [0, -2.35]],
  aerofolio: ['Aerofólio', [0, -2]],
  lanternas: ['Lanternas traseiras', [0.5, -2.2]],
};

export class ProfileTracker {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.profile = loadProfile(storage);
    this.race = null;
    this.saveTimer = 0;
    this.dirty = false;
    // Loja nova: quem já corria com um carro antes dela fica com ele de graça.
    const owned = this.profile.ownedCars;
    if (!Object.keys(owned).length) {
      const date = new Date().toISOString().slice(0, 10);
      owned[STARTER_CAR] = date;
      for (const [id, km] of Object.entries(this.profile.byCar)) if (km > 0.05) owned[id] = date;
      for (const id of Object.keys(this.profile.carsFinished)) owned[id] = date;
      this.save();
    }
  }

  get unlocked() { return this.profile.unlocked; }

  // settings: { track, time, car, laps, racers, difficulty }
  startRace(settings) {
    const p = this.profile;
    p.races++;
    this.track(settings.track).races++;
    this.race = { ...settings, hits: 0, angle: 0, drift: 0, lapsDone: 0 };
    this.dirty = true;
  }

  track(id) {
    return (this.profile.byTrack[id] ??= { km: 0, races: 0, wins: 0 });
  }

  // Um quadro de corrida valendo. angle: graus (absoluto); combo: combo de drift vivo; drifting: de lado agora.
  drive(dt, { speed, angle, combo, drifting }) {
    const r = this.race;
    if (!r || dt <= 0) return;
    const p = this.profile, km = (speed * dt) / 1000;
    p.km += km;
    p.seconds += dt;
    this.track(r.track).km += km;
    p.byCar[r.car] = (p.byCar[r.car] || 0) + km;
    // Ângulo sustentado: média móvel curta, só de lado de verdade (sem contar rodadas)
    const k = 1 - Math.exp(-dt / 0.3);
    r.angle += ((drifting && speed > 8 && angle < 88 ? angle : 0) - r.angle) * k;
    if (r.angle > p.maxAngle) p.maxAngle = r.angle;
    r.drift = combo ? r.drift + speed * dt : 0;
    if (r.drift > p.longestDrift) p.longestDrift = r.drift;
    this.dirty = true;
  }

  bank(points) {
    if (points > this.profile.bestCombo) this.profile.bestCombo = points;
    this.dirty = true;
  }

  grade(g) {
    if (g in this.profile.grades) this.profile.grades[g]++;
    this.dirty = true;
  }

  wallHit() {
    this.profile.wallHits++;
    if (this.race) this.race.hits++;
    this.dirty = true;
  }

  lap(points) {
    const p = this.profile;
    p.laps++;
    if (this.race) this.race.lapsDone++;
    if (points > p.bestLap) p.bestLap = points;
    this.dirty = true;
  }

  // Chegada. position: 1 = primeiro; racers: tamanho do grid; total: pontos da corrida.
  finish({ position, racers, total }) {
    const r = this.race, p = this.profile;
    if (!r) return;
    p.finished++;
    p.points += total;
    if (total > p.bestRace) p.bestRace = total;
    const key = `${r.track}:${r.time}`;
    p.variants[key] = (p.variants[key] || 0) + 1;
    p.carsFinished[r.car] = (p.carsFinished[r.car] || 0) + 1;
    const contested = racers >= 4;
    if (contested && position <= 3) p.podiums++;
    if (contested && position === 1) {
      p.wins++;
      this.track(r.track).wins++;
      if (r.track === 'hakone' && racers >= 8 && r.difficulty !== 'facil') p.feats.hakoneKing = true;
      if (r.time === 'chuva') p.feats.rainKing = true;
    }
    if (r.laps >= 3 && r.hits === 0) p.feats.cleanRace = true;
    this.race = null;
    this.save();
  }

  // Saiu da corrida sem terminar
  abandon() {
    this.race = null;
    this.save();
  }

  // --- Dinheiro e lataria -------------------------------------------------------------------------
  // Prêmio da corrida: pontos valem dinheiro e o pódio paga bônus (grid de 2 ou mais).
  static prize({ total, position, racers }) {
    const bonus = racers > 1 ? Math.max(0, racers - position + 1) * 250 : 0;
    return Math.round(total / 20) + bonus;
  }

  // Lataria de um carro (ou null se ele está inteiro).
  static damageOf(profile, carId) {
    const d = profile.damage?.[carId];
    return d && typeof d === 'object' && typeof d.front === 'number' ? d : null;
  }

  // Conserto da lataria: amassado custa mais que risco, peça arrancada custa por peça; na centena.
  static repairCost(damage) {
    if (!damage) return 0;
    const total = ProfileTracker.repairItems(damage).reduce((sum, it) => sum + it.cost, 0);
    return Math.round(total / 100) * 100;
  }

  // Conserto item a item, para a ficha de dano da garagem: uma linha por zona amassada, por lado riscado e
  // por peça que caiu, já com o lugar de cada uma no desenho do carro visto de cima (x lateral, z da frente).
  static repairItems(damage) {
    if (!damage) return [];
    const out = [];
    for (const [key, label, at] of DENT_ZONES) {
      const value = damage[key] || 0;
      if (value > 0.04) out.push({ kind: 'dent', key, label, value, cost: Math.round(value * 1200), at });
    }
    for (const [key, label, at] of SCRATCH_SIDES) {
      const value = damage[key] || 0;
      if (value > 0.04) out.push({ kind: 'scratch', key, label, value, cost: Math.round(value * 500), at });
    }
    for (const name of damage.broken || []) {
      out.push({ kind: 'part', key: name, label: PARTS[name]?.[0] ?? name, cost: 450, at: PARTS[name]?.[1] ?? [0, 0] });
    }
    return out;
  }

  earn(amount) {
    this.profile.money += amount;
    this.profile.earned += amount;
    this.dirty = true;
    return this.profile.money;
  }

  // Paga se tiver saldo. Devolve se deu certo.
  spend(amount) {
    if (amount > this.profile.money) return false;
    this.profile.money -= amount;
    this.save();
    return true;
  }

  // --- BODYSHOP ------------------------------------------------------------------------------------
  giveCar(id) { this.profile.ownedCars[id] = new Date().toISOString().slice(0, 10); this.dirty = true; }
  setUpgrade(carId, upgradeId, level) {
    (this.profile.upgrades[carId] ??= {})[upgradeId] = level;
    this.dirty = true;
  }
  giveItem(key) { this.profile.bought[key] = new Date().toISOString().slice(0, 10); this.dirty = true; }

  // A lataria fica como está entre as corridas: bater só sai do bolso na garagem.
  saveDamage(carId, damage) {
    if (!this.profile.damage || typeof this.profile.damage.front === 'number') this.profile.damage = {};
    this.profile.damage[carId] = { ...damage };
    this.dirty = true;
  }

  // Conquistas liberadas agora (e já gravadas como liberadas)
  checkAchievements() {
    const list = newlyUnlocked(this.profile);
    if (!list.length) return list;
    const today = new Date().toISOString().slice(0, 10);
    for (const a of list) this.profile.unlocked[a.id] = today;
    this.save();
    return list;
  }

  tick(dt) {
    this.saveTimer += dt;
    if (this.dirty && this.saveTimer > SAVE_EVERY) this.save();
  }

  save() {
    saveProfile(this.profile, this.storage);
    this.saveTimer = 0;
    this.dirty = false;
  }
}
