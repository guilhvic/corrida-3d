// Menus: tela inicial (modos), singleplayer (pista, carro, voltas, grid, dificuldade), garagem, ranking, perfil do piloto,
// configurações, controles, pausa e resultado.
// Navega com mouse, teclado (setas/WASD, Enter, Esc) ou controle (D-pad/analógico, A, B).
import { TRACKS, CARS, LAP_OPTIONS, PRACTICE, carSpecs, trackById, timeOf } from './catalog.js';
import { MAX_RACERS } from './race.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from './difficulty.js';
import { ENGINE_PROFILES } from './engine-dsp.js';
import { GARAGE_OPTIONS, DEFAULT_GARAGE, loadGarage, saveGarage, isLocked } from './garage.js';
import { ProfileTracker, loadProfile, garageUnlocks, ownsCar } from './profile.js';
import { CAR_PRICES, UPGRADES, upgradedParams, shopParts, PART_SLOTS } from './shop.js';
import { ACHIEVEMENTS, MEDALS, achievementById, rewardOf, progressOf, driverTitle } from './achievements.js';
import { loadRanking, pickGhost } from './ranking.js';
import { CONFIG_GROUPS, DEFAULT_CONFIG, loadConfig, saveConfig } from './settings.js';
import { formatTime, formatPoints } from './laps.js';
import { t, locale } from './i18n.js';

const SETTINGS_KEY = 'corrida3d.corrida';
export const RANDOM = 'random'; // pista ou horário sorteado a cada largada
const RECORDS_KEY = 'corrida3d.recordes';

const lapLabel = (n) => (n === 0 ? t('TREINO LIVRE') : t(n > 1 ? '{n} VOLTAS' : '{n} VOLTA', { n }));
const dateText = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(locale()) : '');

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sem storage */ }
}

// Configuração salva da última corrida (o main.js usa a pista antes de montar o mundo).
export function savedSettings() {
  return readJSON(SETTINGS_KEY, {});
}

export class Menu {
  constructor({ difficulty, onStart, onResume, onRestart, onQuit, onDifficulty, onSettings, onGarage, onRepair, onBuy, onShopPreview, onScreen, onConfig, onNav }) {
    this.root = document.getElementById('menu');
    this.handlers = { onStart, onResume, onRestart, onQuit, onDifficulty, onSettings, onGarage, onRepair, onBuy, onShopPreview, onScreen, onConfig, onNav };
    this.trackCache = new Map();
    this.difficulty = difficulty;
    this.screens = Object.fromEntries([...this.root.querySelectorAll('[data-screen]')].map((s) => [s.dataset.screen, s]));
    this.current = null;
    this.previous = 'main';
    this.focusIndex = {};

    // Logo da tela de título em letras separadas (animadas por CSS)
    const logo = this.root.querySelector('h1.logo');
    if (logo) {
      let i = 0;
      const letters = (text, cls = '') => [...text].map((ch) => `<span class="ch ${cls}" style="--i:${i++}">${ch}</span>`).join('');
      logo.innerHTML = `${letters('CORRIDA')}<span class="gap"></span>${letters('3D', 'amber')}`;
    }
    this.titleShown = false;

    const saved = savedSettings();
    this.settings = {
      track: saved.track === RANDOM || TRACKS.some((t) => t.id === saved.track) ? saved.track : TRACKS[0].id,
      time: saved.time,
      car: CARS.some((c) => c.id === saved.car) ? saved.car : CARS[0].id,
      laps: LAP_OPTIONS.includes(saved.laps) ? saved.laps : 3,
      racers: Number.isInteger(saved.racers) && saved.racers >= 1 && saved.racers <= MAX_RACERS ? saved.racers : 4,
      ghost: typeof saved.ghost === 'string' ? saved.ghost : 'best', // 'best', 'none' ou id de uma volta do ranking
      // Modo do singleplayer: corrida numa pista ou treino no estacionamento (com o horário próprio dele)
      mode: saved.mode === 'practice' ? 'practice' : 'race',
      practiceTime: timeOf(PRACTICE, saved.practiceTime).id,
    };

    // Horário aleatório vale com qualquer pista; pista aleatória sempre sorteia o horário também
    if (this.settings.track === RANDOM || saved.time === RANDOM) this.settings.time = RANDOM;
    else this.settings.time = timeOf(trackById(this.settings.track), this.settings.time).id;
    this.rankTrack = this.settings.track === RANDOM ? TRACKS[0].id : this.settings.track; // pista mostrada no ranking
    this.active = null; // pista e horário sorteados da corrida em andamento

    // Cada seletor: lista de opções, índice atual e como mostrar. Pista e horário têm ALEATÓRIA/ALEATÓRIO no fim.
    this.selectors = {
      mode: {
        count: () => 2,
        index: () => (this.practice ? 1 : 0),
        set: (i) => { this.settings.mode = i === 1 ? 'practice' : 'race'; },
        label: (i) => (i === 1 ? [t('ESTACIONAMENTO'), t('treino com cones, sem cronômetro nem rivais')] : [t('CORRIDA'), t('pista, voltas e rivais de IA')]),
      },
      track: {
        count: () => TRACKS.length + 1,
        index: () => (this.settings.track === RANDOM ? TRACKS.length : TRACKS.findIndex((t) => t.id === this.settings.track)),
        set: (i) => {
          if (i === TRACKS.length) { this.settings.track = RANDOM; this.settings.time = RANDOM; return; }
          this.settings.track = TRACKS[i].id;
          this.rankTrack = TRACKS[i].id;
          if (this.settings.time !== RANDOM) this.settings.time = timeOf(TRACKS[i], this.settings.time).id;
        },
        label: (i) => (i === TRACKS.length ? [t('ALEATÓRIA'), t('sorteada entre as {n} a cada largada', { n: TRACKS.length })] : [t(TRACKS[i].name), TRACKS[i].jp]),
      },
      // No treino o horário é o do estacionamento (sem sorteio)
      time: {
        count: () => (this.practice ? PRACTICE.times.length : this.settings.track === RANDOM ? 1 : trackById(this.settings.track).times.length + 1),
        index: () => {
          if (this.practice) return Math.max(0, PRACTICE.times.findIndex((tm) => tm.id === this.settings.practiceTime));
          if (this.settings.time === RANDOM) return this.selectors.time.count() - 1;
          return trackById(this.settings.track).times.findIndex((t) => t.id === this.settings.time);
        },
        set: (i) => {
          if (this.practice) { this.settings.practiceTime = PRACTICE.times[i].id; return; }
          const times = trackById(this.settings.track).times;
          this.settings.time = this.settings.track === RANDOM || i === times.length ? RANDOM : times[i].id;
        },
        label: (i) => {
          if (this.practice) return [t(PRACTICE.times[i].name), PRACTICE.times[i].jp];
          if (this.settings.track === RANDOM || i === trackById(this.settings.track).times.length) return [t('ALEATÓRIO'), t('sorteado a cada largada')];
          const time = trackById(this.settings.track).times[i];
          return [t(time.name), time.jp];
        },
      },
      car: {
        count: () => this.ownedCars().length,
        index: () => Math.max(0, this.ownedCars().findIndex((c) => c.id === this.settings.car)),
        set: (i) => { const c = this.ownedCars()[i]; this.settings.car = c.id; this.garage = loadGarage(c.id, this.unlocked); this.garagePeek = {}; },
        label: (i) => [t(this.ownedCars()[i].name), this.ownedCars()[i].jp],
      },
      laps: {
        count: () => LAP_OPTIONS.length,
        index: () => LAP_OPTIONS.indexOf(this.settings.laps),
        set: (i) => { this.settings.laps = LAP_OPTIONS[i]; },
        label: (i) => [lapLabel(LAP_OPTIONS[i]), t(LAP_OPTIONS[i] === 0 ? 'sem chegada' : 'corrida por pontos')],
      },
      racers: {
        count: () => MAX_RACERS,
        index: () => this.settings.racers - 1,
        set: (i) => { this.settings.racers = i + 1; },
        label: (i) => [i === 0 ? t('SÓ VOCÊ') : t('{n} CORREDORES', { n: i + 1 }), i === 0 ? t('sem rivais') : t(i > 1 ? 'você + {n} rivais de IA' : 'você + {n} rival de IA', { n: i })],
        wrap: false,
      },
      difficulty: {
        count: () => DIFFICULTY_ORDER.length,
        index: () => DIFFICULTY_ORDER.indexOf(this.difficulty),
        set: (i) => { this.handlers.onDifficulty(DIFFICULTY_ORDER[i]); },
        label: (i) => [t(DIFFICULTIES[DIFFICULTY_ORDER[i]].label), ' '],
        wrap: false,
      },
    };

    // Ranking: pista própria (sem aleatória; escolher uma aqui também escolhe para a corrida, se ela não for aleatória) e o mesmo carro
    this.selectors['r-track'] = {
      count: () => TRACKS.length,
      index: () => TRACKS.findIndex((t) => t.id === this.rankTrack),
      set: (i) => {
        this.rankTrack = TRACKS[i].id;
        if (this.settings.track === RANDOM) return;
        this.settings.track = TRACKS[i].id;
        if (this.settings.time !== RANDOM) this.settings.time = timeOf(TRACKS[i], this.settings.time).id;
      },
      label: (i) => [t(TRACKS[i].name), TRACKS[i].jp],
    };
    this.selectors['r-car'] = this.selectors.car;

    // Garagem: um seletor por opção, valendo para o carro escolhido. Itens bloqueados aparecem (com o cadeado e a
    // conquista que libera) mas não são aplicados: ficam só "espiados" até escolher outro.
    this.garage = loadGarage(this.settings.car, this.unlocked);
    this.garagePeek = {};
    for (const [key, list] of Object.entries(GARAGE_OPTIONS)) {
      this.selectors[`g-${key}`] = {
        count: () => list.length,
        index: () => Math.max(0, list.findIndex((o) => o.id === (this.garagePeek[key] ?? this.garage[key]))),
        set: (i) => {
          if (isLocked(list[i], this.unlocked, key)) this.garagePeek[key] = list[i].id;
          else { delete this.garagePeek[key]; this.garage[key] = list[i].id; }
        },
        label: (i) => {
          const o = list[i];
          if (!isLocked(o, this.unlocked, key)) return [t(o.name), `${i + 1}/${list.length}`];
          const a = o.unlock ? achievementById(o.unlock) : null;
          return [`🔒 ${t(o.name)}`, a ? t('medalha {name} ou BODYSHOP', { name: a.name }) : t('à venda no BODYSHOP')];
        },
      };
    }

    // BODYSHOP: abas (carros, preparação, peças) e o carro que recebe a preparação
    this.configLabels = this.configLabels || [];
    this.shopTab = 0;
    this.shopCar = this.settings.car;
    this.shopItems = [];
    const shopTabs = document.getElementById('shop-tabs');
    shopTabs.setAttribute('data-i18n-skip', '');
    [['CARROS', '車'], ['PREPARAÇÃO', 'チューン'], ['PEÇAS', 'パーツ']].forEach(([name, jp], i) => {
      shopTabs.insertAdjacentHTML('beforeend', `<button type="button" class="config-tab" data-nav data-action="shop-tab:${i}"><span class="tab-name"></span><span class="jp">${jp}</span></button>`);
      this.configLabels.push([shopTabs.lastElementChild.querySelector('.tab-name'), name]);
    });
    this.selectors['shop-car'] = {
      count: () => this.ownedCars().length,
      index: () => Math.max(0, this.ownedCars().findIndex((c) => c.id === this.shopCar)),
      set: (i) => { this.shopCar = this.ownedCars()[i].id; this.buildShop(); this.renderShopInfo(); },
      label: (i) => [t(this.ownedCars()[i].name), this.ownedCars()[i].jp],
    };

    // Configurações: tela montada a partir das definições (settings.js)
    this.config = loadConfig();
    const body = document.getElementById('config-body');
    body.setAttribute('data-i18n-skip', ''); // rótulos traduzidos em render()
    this.configLabels = this.configLabels || [];
    this.configTab = 0;
    const tabs = document.getElementById('config-tabs');
    tabs.setAttribute('data-i18n-skip', '');
    CONFIG_GROUPS.forEach((group, i) => {
      tabs.insertAdjacentHTML('beforeend', `<button type="button" class="config-tab" data-nav data-action="config-tab:${i}"><span class="tab-name"></span><span class="jp">${group.jp ?? ''}</span></button>`);
      this.configLabels.push([tabs.lastElementChild.querySelector('.tab-name'), group.title]);
    });
    for (const group of CONFIG_GROUPS) {
      const box = document.createElement('div');
      box.className = 'config-group';
      box.innerHTML = '<div class="caption"></div>';
      this.configLabels.push([box.querySelector('.caption'), group.title]);
      for (const o of group.options) {
        box.insertAdjacentHTML('beforeend', `<div class="selector" data-nav data-key="c-${o.key}">
          <span class="sel-label"></span>
          <button type="button" class="sel-arrow" data-dir="-1">◀</button>
          <div class="sel-value"><b></b><small></small></div>
          <button type="button" class="sel-arrow" data-dir="1">▶</button>
        </div>`);
        const sel = box.lastElementChild;
        this.configLabels.push([sel.querySelector('.sel-label'), o.label, sel]);
        this.selectors[`c-${o.key}`] = {
          count: () => o.values.length,
          index: () => o.values.indexOf(this.config[o.key]),
          set: (i) => { this.config[o.key] = o.values[i]; },
          label: (i) => {
            const v = o.values[i];
            const bar = o.bar ? '▮'.repeat(Math.round(v * 10)) + '▯'.repeat(10 - Math.round(v * 10)) : '';
            return [o.format(v), bar || o.hint?.(v) || ' '];
          },
          wrap: !o.bar,
        };
      }
      body.append(box);
    }
    this.configBoxes = [...body.children];
    this.showConfigTab(0);

    for (const sel of this.root.querySelectorAll('.selector')) {
      for (const arrow of sel.querySelectorAll('[data-dir]')) {
        arrow.addEventListener('click', () => this.change(sel.dataset.key, Number(arrow.dataset.dir)));
      }
    }
    this.root.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action]');
      if (!button) return;
      if (button.dataset.action === 'ghost') this.pickGhost(button.dataset.id);
      else this.action(button.dataset.action);
    });
    // Sem foco nativo nos botões: Enter/Espaço são tratados pela navegação (senão clicariam duas vezes).
    this.root.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    // Listas com rolagem (configurações, loja, ranking) e janela redimensionada: o cursor segue o item.
    this.root.addEventListener('scroll', () => this.placeCursor(true), true);
    addEventListener('resize', () => this.placeCursor(true));
    // Clique direto num item também bipa (o teclado e o controle bipam pela navegação)
    this.root.addEventListener('click', (e) => { if (e.target.closest('[data-action]')) this.handlers.onNav?.('select'); });
    this.root.addEventListener('pointermove', (e) => {
      const item = e.target.closest('[data-nav]');
      if (item) this.setFocus(this.items().indexOf(item));
    });
  }

  get visible() { return this.current !== null; }

  get practice() { return this.settings.mode === 'practice'; }

  // Conquistas liberadas (lidas do perfil salvo)
  get unlocked() { return garageUnlocks(loadProfile()); }

  // Carros que o jogador tem (o seletor do singleplayer só mostra estes).
  ownedCars() {
    const p = loadProfile();
    return CARS.filter((c) => ownsCar(p, c.id));
  }

  // --- BODYSHOP -----------------------------------------------------------------------------------
  // Monta a lista da aba atual. Cada item: { kind, id, name, sub, price, owned, level, max, car, slot, key }
  buildShop() {
    const p = loadProfile();
    const tabs = document.getElementById('shop-tabs');
    tabs.querySelectorAll('.config-tab').forEach((el, i) => { el.dataset.on = String(i === this.shopTab); });
    document.getElementById('shop-money').textContent = t('CAIXA ¥ {money}', { money: formatPoints(p.money) });
    document.getElementById('shop-car-row').hidden = this.shopTab !== 1;
    const items = [];
    if (this.shopTab === 0) {
      for (const car of CARS) {
        items.push({ kind: 'car', id: car.id, car: car.id, name: t(car.name), sub: car.jp, price: CAR_PRICES[car.id] ?? 0, owned: ownsCar(p, car.id) });
      }
    } else if (this.shopTab === 1) {
      const carId = this.shopCar;
      const levels = p.upgrades?.[carId] || {};
      for (const u of UPGRADES) {
        const level = levels[u.id] || 0, max = u.levels.length;
        items.push({ kind: 'upgrade', id: u.id, car: carId, name: t(u.name), sub: u.jp, level, max, owned: level >= max,
          price: level >= max ? 0 : u.levels[level].price, upgrade: u });
      }
    } else {
      const unlocked = garageUnlocks(p);
      for (const part of shopParts()) {
        const owned = !!unlocked[part.key] || (part.item.unlock && !!unlocked[part.item.unlock]);
        items.push({ kind: 'part', id: part.item.id, slot: part.slot, key: part.key, car: this.settings.car, item: part.item,
          name: t(part.item.name), sub: t(part.slotName), price: part.price, owned, medal: part.item.unlock });
      }
    }
    this.shopItems = items;
    const list = document.getElementById('shop-list');
    list.innerHTML = items.map((it, i) => {
      const broke = !it.owned && it.price > p.money;
      const status = it.kind === 'upgrade'
        ? `<span class="pips">${'▮'.repeat(it.level)}${'▯'.repeat(it.max - it.level)}</span> ${it.owned ? t('MÁX.') : `¥ ${formatPoints(it.price)}`}`
        : it.owned ? (it.kind === 'car' ? (this.settings.car === it.id ? t('NA PISTA') : t('NA GARAGEM')) : t('COMPRADO')) : `¥ ${formatPoints(it.price)}`;
      return `<button type="button" class="shop-item" data-nav data-action="shop:${i}"><b>${it.name}</b><small>${it.sub}</small>
        <span class="price ${it.owned ? 'owned' : broke ? 'broke' : ''}">${status}</span></button>`;
    }).join('');
  }

  // Ficha do item em foco e a vitrine 3D (carro, carro preparado ou carro com a peça aplicada).
  renderShopInfo() {
    const items = this.items();
    const el = items[this.focusIndex.bodyshop ?? 0];
    const idx = el?.dataset.action?.startsWith('shop:') ? Number(el.dataset.action.slice(5)) : 0;
    const it = this.shopItems?.[idx];
    const info = document.getElementById('shop-info');
    if (!it) { info.innerHTML = ''; return; }
    const p = loadProfile();
    const car = CARS.find((c) => c.id === it.car) ?? CARS[0];
    let html = `<h3>${it.name}</h3>`;
    if (it.kind === 'car') {
      const s = carSpecs({ ...car, params: upgradedParams(car, p.upgrades?.[car.id]) });
      html += `<p class="note spec-desc">${t(car.description)}</p>
        <p class="note">${t('{power} cv · {torque} N·m · {mass} kg · {ratio} kg/cv', { power: s.power, torque: s.torque, mass: s.mass, ratio: s.ratio.toFixed(1) })}</p>
        <p class="note">${it.owned ? t('Já está na sua garagem. Enter coloca na pista.') : t('Comprar por ¥ {price}.', { price: formatPoints(it.price) })}</p>`;
    } else if (it.kind === 'upgrade') {
      const before = carSpecs({ ...car, params: upgradedParams(car, p.upgrades?.[car.id]) });
      const next = Math.min(it.max, it.level + 1);
      const after = carSpecs({ ...car, params: upgradedParams(car, { ...(p.upgrades?.[car.id] || {}), [it.id]: next }) });
      html += `<p class="note spec-desc">${t(it.upgrade.description)}</p>
        <p class="note">${t('Estágio {n} de {max} em {car}.', { n: it.level, max: it.max, car: t(car.name) })}</p>
        ${it.owned ? `<p class="note">${t('Preparação no máximo.')}</p>` : `<p class="note">${t('Próximo estágio: ¥ {price}', { price: formatPoints(it.price) })}${after.power !== before.power ? ` · ${before.power} → ${after.power} cv` : ''}${after.mass !== before.mass ? ` · ${before.mass} → ${after.mass} kg` : ''}</p>`}`;
    } else {
      const a = it.medal ? achievementById(it.medal) : null;
      html += `<p class="note">${it.sub}${a ? ` · ${t('também sai com a medalha {name}', { name: a.name })}` : ` · ${t('exclusivo do BODYSHOP')}`}</p>
        <p class="note">${it.owned ? t('Liberado: escolha na GARAGEM de qualquer carro.') : t('Comprar por ¥ {price}. Vale para todos os carros.', { price: formatPoints(it.price) })}</p>`;
    }
    info.innerHTML = html;
    document.getElementById('shop-preview-caption').textContent = t(car.name);
    // Peça: a vitrine mostra o carro atual já com ela; senão, o carro do item com o visual dele.
    const look = it.kind === 'part' ? { ...loadGarage(car.id, this.unlocked), [it.slot]: it.id } : null;
    this.handlers.onShopPreview?.(car.id, look);
  }

  shopAction(i) {
    const it = this.shopItems?.[i];
    if (!it) return;
    const msg = document.getElementById('shop-msg');
    // Carro que já é seu: Enter põe ele na pista.
    if (it.kind === 'car' && it.owned) {
      this.settings.car = it.id;
      this.garage = loadGarage(it.id, this.unlocked);
      writeJSON(SETTINGS_KEY, this.settings);
      this.handlers.onSettings?.({ ...this.settings });
      msg.textContent = t('{car} na pista.', { car: it.name });
    } else if (it.owned) {
      this.flashEl(this.items()[this.focusIndex.bodyshop ?? 0]);
      return;
    } else if (!this.handlers.onBuy?.(it)) {
      this.flashEl(this.items()[this.focusIndex.bodyshop ?? 0]);
      msg.textContent = t('Saldo insuficiente: faltam ¥ {money}.', { money: formatPoints(it.price - loadProfile().money) });
      return;
    } else {
      msg.textContent = it.kind === 'car' ? t('{car} comprado! Já está na sua garagem.', { car: it.name })
        : it.kind === 'upgrade' ? t('{name} estágio {n} instalado.', { name: it.name, n: it.level + 1 })
        : t('{name} liberado na GARAGEM.', { name: it.name });
    }
    const keep = this.focusIndex.bodyshop;
    this.buildShop();
    this.setFocus(keep ?? 0);
  }

  // Traçado de uma pista, só para o desenho da prévia.
  trackShape(id) {
    if (!this.trackCache.has(id)) this.trackCache.set(id, trackById(id).build());
    return this.trackCache.get(id);
  }

  get previewTrack() {
    return this.trackShape(this.settings.track === RANDOM ? TRACKS[0].id : this.settings.track);
  }

  // Configuração da corrida com pista e horário aleatórios já sorteados
  resolved() {
    const s = { ...this.settings };
    // Treino: o lugar é sempre o estacionamento, sozinho e sem chegada.
    if (this.practice) return { ...s, track: PRACTICE.id, time: s.practiceTime, laps: 0, racers: 1 };
    if (s.track === RANDOM) s.track = TRACKS[Math.floor(Math.random() * TRACKS.length)].id;
    const times = trackById(s.track).times;
    if (s.time === RANDOM) s.time = times[Math.floor(Math.random() * times.length)].id;
    return s;
  }

  items() {
    const screen = this.screens[this.current];
    return screen ? [...screen.querySelectorAll('[data-nav]')].filter((el) => el.offsetParent !== null) : [];
  }

  setFocus(i) {
    const items = this.items();
    if (!items.length || i < 0) return;
    const index = Math.min(i, items.length - 1);
    this.focusIndex[this.current] = index;
    items.forEach((el, k) => el.classList.toggle('focused', k === index));
    items[index].scrollIntoView?.({ block: 'nearest' });
    // Troca de item (não a primeira vez na tela): cursor desliza, item acende e o painel bipa.
    const el = items[index];
    const moved = this.focusedEl && this.focusedEl !== el && this.cursorScreen === this.current;
    if (el !== this.focusedEl) {
      el.classList.remove('focus-in');
      void el.offsetWidth; // reinicia a animação
      el.classList.add('focus-in');
      clearTimeout(el.focusTimer);
      el.focusTimer = setTimeout(() => el.classList.remove('focus-in'), 450);
      if (moved) this.handlers.onNav?.('move');
    }
    this.focusedEl = el;
    this.placeCursor(!moved);
    // A lista pode ter rolado para mostrar o item: confere de novo no quadro seguinte.
    requestAnimationFrame(() => { if (this.focusedEl === el) this.placeCursor(false, false); });
    if (this.current === 'bodyshop') this.renderShopInfo();
  }

  // Moldura do cursor sobre o item em foco. jump: sem deslizar (tela nova, rolagem, janela mudou).
  placeCursor(jump = false, pop = !jump) {
    const cursor = this.cursor ??= document.getElementById('menu-cursor');
    const el = this.focusedEl;
    if (!cursor) return;
    if (!el || !this.visible || !el.offsetParent) { cursor.classList.remove('on'); return; }
    const r = el.getBoundingClientRect();
    cursor.classList.toggle('jump', jump);
    cursor.style.transform = `translate(${r.left}px, ${r.top}px)`;
    cursor.style.width = `${r.width}px`;
    cursor.style.height = `${r.height}px`;
    cursor.classList.add('on');
    if (pop) {
      cursor.classList.remove('pop');
      void cursor.offsetWidth;
      cursor.classList.add('pop');
    }
    this.cursorScreen = this.current;
  }

  show(name) {
    // Controles fica dentro das configurações: voltar dele leva às configurações, e delas para onde se estava (menu ou pausa)
    if (name === 'config' && this.current && this.current !== 'controls' && this.current !== 'config') this.previous = this.current;
    if (name === 'garage') { this.garage = loadGarage(this.settings.car, this.unlocked); this.garagePeek = {}; }
    if (name === 'bodyshop') {
      this.shopCar = ownsCar(loadProfile(), this.settings.car) ? this.settings.car : this.ownedCars()[0].id;
      document.getElementById('shop-msg').textContent = '';
      this.buildShop();
    }
    // Tela de título: anima o logo ao abrir o jogo e ao voltar de uma corrida
    if (name === 'main' && (!this.titleShown || this.current === null || this.current === 'pause' || this.current === 'results')) {
      this.titleShown = true;
      document.body.classList.remove('title-anim');
      void document.body.offsetWidth;
      document.body.classList.add('title-anim');
      clearTimeout(this.titleTimer);
      this.titleTimer = setTimeout(() => document.body.classList.remove('title-anim'), 2200);
    } else if (name !== 'main') document.body.classList.remove('title-anim');
    this.current = name;
    this.focusedEl = null;
    this.root.hidden = false;
    for (const [key, screen] of Object.entries(this.screens)) screen.hidden = key !== name;
    document.body.dataset.menu = name;
    this.handlers.onScreen?.(name);
    this.render();
    this.setFocus(this.focusIndex[name] ?? 0);
  }

  hide() {
    this.current = null;
    this.root.hidden = true;
    this.cursor?.classList.remove('on');
    document.body.dataset.menu = '';
  }

  // Ações de um frame vindas do Input.
  handle(a) {
    if (!this.visible) return;
    // Nas configurações, LB/RB (ou Q/E) trocam de aba de qualquer lugar da tela.
    if (this.current === 'bodyshop' && (a.shiftUp || a.shiftDown)) {
      this.action(`shop-tab:${(this.shopTab + (a.shiftUp ? 1 : 2)) % 3}`);
      return;
    }
    if (this.current === 'config' && (a.shiftUp || a.shiftDown)) {
      this.showConfigTab(this.configTab + (a.shiftUp ? 1 : -1));
      this.render();
      return;
    }
    const items = this.items();
    const index = this.focusIndex[this.current] ?? 0;
    // Cima/baixo: ordem da lista, pulando quem está na mesma linha (botões lado a lado)
    if (a.up) this.setFocus(this.stepRow(items, index, -1));
    if (a.down) this.setFocus(this.stepRow(items, index, 1));
    const focused = this.items()[this.focusIndex[this.current] ?? 0];
    // Esquerda/direita: num seletor troca o valor; fora dele anda para o item ao lado na mesma linha
    if (a.left || a.right) {
      if (focused?.classList.contains('selector')) this.change(focused.dataset.key, a.right ? 1 : -1);
      else {
        const side = this.neighbor(items, index, a.right ? 1 : -1);
        if (side !== null) this.setFocus(side);
      }
    }
    if (a.confirm && focused) {
      if (focused.classList.contains('selector')) this.change(focused.dataset.key, 1);
      else focused.click();
    }
    if (a.back || a.pause) this.back();
  }

  // Mesma linha na tela: caixas que se sobrepõem na vertical
  static sameRow(a, b) {
    return b.top < a.bottom - 2 && b.bottom > a.top + 2;
  }

  // Próximo item da lista (dir = ±1) que não esteja na mesma linha do atual; dá a volta no fim
  stepRow(items, index, dir) {
    const n = items.length;
    if (!n) return index;
    const a = items[index]?.getBoundingClientRect();
    for (let k = 1; k < n; k++) {
      const i = (index + dir * k + n * k) % n;
      if (!a || !Menu.sameRow(a, items[i].getBoundingClientRect())) return i;
    }
    return (index + dir + n) % n;
  }

  // Item ao lado na mesma linha (dx = ±1), o mais perto; null se não houver
  neighbor(items, index, dx) {
    const cur = items[index];
    if (!cur) return null;
    const a = cur.getBoundingClientRect();
    let best = null, bestDist = Infinity;
    items.forEach((el, i) => {
      if (i === index) return;
      const b = el.getBoundingClientRect();
      if (!Menu.sameRow(a, b) || (dx > 0 ? b.left < a.right - 2 : b.right > a.left + 2)) return;
      const dist = dx > 0 ? b.left - a.right : a.left - b.right;
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return best;
  }

  back() {
    if (this.current === 'controls') this.show('config');
    else if (this.current === 'config') this.show(this.previous);
    else if (this.current === 'single' || this.current === 'profile' || this.current === 'bodyshop') this.show('main');
    else if (this.current === 'garage') this.show('single');
    else if (this.current === 'ranking') this.show('single');
    else if (this.current === 'pause') this.handlers.onResume();
  }

  change(key, dir) {
    const s = this.selectors[key];
    const count = s.count();
    if (count < 2) return this.flash(key);
    this.handlers.onNav?.('change');
    let i = s.index() + dir;
    if (s.wrap === false) i = Math.max(0, Math.min(count - 1, i));
    else i = (i + count) % count;
    s.set(i);
    if (key.startsWith('c-')) {
      saveConfig(this.config);
      this.handlers.onConfig?.({ ...this.config });
      this.render();
      return;
    }
    if (key.startsWith('g-')) {
      if (this.garagePeek[key.slice(2)]) { this.render(); return; } // bloqueado: só mostra
      saveGarage(this.settings.car, this.garage);
      this.handlers.onGarage?.(this.settings.car, { ...this.garage });
      this.render();
      return;
    }
    writeJSON(SETTINGS_KEY, this.settings);
    this.handlers.onSettings?.({ ...this.settings });
    this.render();
  }

  // Abas das configurações: só o grupo da aba escolhida fica à vista (e navegável).
  showConfigTab(i) {
    this.configTab = (i + CONFIG_GROUPS.length) % CONFIG_GROUPS.length;
    this.configBoxes.forEach((box, k) => { box.hidden = k !== this.configTab; });
    for (const [k, tab] of [...document.getElementById('config-tabs').children].entries()) {
      tab.dataset.on = String(k === this.configTab);
    }
  }

  // Só uma opção disponível: pisca o seletor.
  flash(key) {
    this.flashEl(this.root.querySelector(`.selector[data-key="${key}"]`));
  }

  flashEl(el) {
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  action(name) {
    const h = this.handlers;
    if (name === 'start' || name === 'again') {
      this.active = this.resolved();
      h.onStart({ ...this.active });
    }
    if (name === 'single') this.show('single');
    if (name === 'garage') this.show('garage');
    if (name === 'ranking') this.show('ranking');
    if (name === 'profile') this.show('profile');
    if (name === 'bodyshop') this.show('bodyshop');
    if (name.startsWith('shop:')) this.shopAction(Number(name.slice(5)));
    if (name.startsWith('shop-tab:')) {
      this.shopTab = Number(name.slice(9));
      document.getElementById('shop-msg').textContent = '';
      this.buildShop();
      this.renderShopInfo();
    }
    if (name === 'garage-reset') {
      this.garage = { ...DEFAULT_GARAGE };
      this.garagePeek = {};
      saveGarage(this.settings.car, this.garage);
      this.handlers.onGarage?.(this.settings.car, { ...this.garage });
      this.render();
    }
    if (name === 'multi') this.flashEl(this.root.querySelector('[data-action="multi"]'));
    if (name === 'controls') this.show('controls');
    if (name === 'config') this.show('config');
    if (name === 'config-reset') {
      this.config = { ...DEFAULT_CONFIG };
      saveConfig(this.config);
      this.handlers.onConfig?.({ ...this.config });
      this.render();
    }
    if (name.startsWith('config-tab:')) {
      this.showConfigTab(Number(name.split(':')[1]));
      this.render();
    }
    if (name === 'repair') {
      const p = loadProfile();
      const cost = ProfileTracker.repairCost(ProfileTracker.damageOf(p, this.settings.car));
      if (!cost) return;
      if (!this.handlers.onRepair || cost > p.money || !this.handlers.onRepair(cost)) {
        this.flashEl(document.getElementById('repair-btn'));
        return;
      }
      this.render();
    }
    if (name === 'back') this.back();
    if (name === 'resume') h.onResume();
    if (name === 'restart') h.onRestart();
    if (name === 'quit' || name === 'menu') h.onQuit();
  }

  // Mudança vinda de uma tecla de atalho (N, V, G, K...): mantém a tela e o que está salvo em dia.
  setConfig(changes) {
    Object.assign(this.config, changes);
    saveConfig(this.config);
    this.handlers.onConfig?.({ ...this.config });
    if (this.visible) this.render();
  }

  pickGhost(id) {
    this.settings.ghost = id;
    writeJSON(SETTINGS_KEY, this.settings);
    this.handlers.onSettings?.({ ...this.settings });
    this.render();
  }

  // Lista do ranking da pista + carro escolhidos, com a opção de fantasma marcada.
  renderRanking(car) {
    const track = trackById(this.rankTrack);
    const list = loadRanking(track.id, this.settings.car);
    const picked = pickGhost(list, this.settings.ghost);
    const choice = this.settings.ghost === 'none' ? 'none' : picked?.id;
    const timeName = (id) => t(track.times.find((tm) => tm.id === id)?.name ?? '').toLowerCase();
    const rows = list.map((e, i) => `
      <button type="button" class="rank-row ${e.id === choice ? 'picked' : ''}" data-nav data-action="ghost" data-id="${e.id}">
        <span class="pos">${i + 1}º</span><b>${formatPoints(e.points)} pts</b><span>${formatTime(e.time).slice(0, -1)}</span>
        <small>${e.difficulty ? t(DIFFICULTIES[e.difficulty]?.label ?? '') : ''}</small><small>${[timeName(e.timeOfDay), dateText(e.date)].filter(Boolean).join(' · ')}</small>
        <span class="pick">${e.id === choice ? '★' : e.ghost ? '' : '—'}</span>
      </button>`).join('');
    const none = `<button type="button" class="rank-row option ${choice === 'none' ? 'picked' : ''}" data-nav data-action="ghost" data-id="none"><span>${t('SEM FANTASMA')}</span><span class="pick">${choice === 'none' ? '★' : ''}</span></button>`;
    document.getElementById('ranking-body').innerHTML = list.length
      ? `<div class="rank-list">${rows}${none}</div>`
      : `<p class="rank-empty">${t('Nenhuma volta de {car} em {track} ainda. Complete uma volta pontuando para entrar no ranking.', { car: t(car.name), track: t(track.name) })}</p>`;
    const ghostLine = document.getElementById('ghost-line');
    ghostLine.textContent = choice === 'none' ? t('Fantasma: desligado') : picked ? t('Fantasma: {pos}º do ranking · {points} pts', { pos: list.indexOf(picked) + 1, points: formatPoints(picked.points) }) : t('Fantasma: nenhuma volta gravada com este carro');
  }

  // Perfil: título, estatísticas de carreira e medalhas com progresso e item liberado
  renderProfile() {
    const p = loadProfile();
    const title = driverTitle(p);
    const got = ACHIEVEMENTS.filter((a) => p.unlocked[a.id]).length;
    const hours = Math.floor(p.seconds / 3600), minutes = Math.floor((p.seconds % 3600) / 60);
    const fav = (entries, name) => {
      const best = entries.sort((a, b) => b[1] - a[1])[0];
      return best && best[1] > 0.05 ? `${name(best[0])} · ${best[1].toFixed(1)} km` : '—';
    };
    const favTrack = fav(Object.entries(p.byTrack).map(([id, tr]) => [id, tr.km]), (id) => t(trackById(id).name));
    const favCar = fav(Object.entries(p.byCar), (id) => t(CARS.find((c) => c.id === id)?.name ?? id));
    const stat = (label, value, cls = '') => `<div class="${cls === 'small' ? 'wide' : ''}"><span>${t(label)}</span><b class="${cls}">${value}</b></div>`;
    const medalCounts = MEDALS.map((m) => [m, ACHIEVEMENTS.filter((a) => a.medal === m && p.unlocked[a.id]).length]);
    document.getElementById('profile-body').innerHTML = `
      <div class="profile-head">
        <div class="profile-title"><b>${title.name}</b><span class="jp">${title.jp}</span></div>
        <div class="profile-medals">${medalCounts.map(([m, c]) => `<span data-medal="${m}"><i class="medal"></i>×${c}</span>`).join('')}</div>
        <small>${title.next ? t('{score} pontos de medalha · próximo título: {name} com {at}', { score: title.score, name: title.next.name, at: title.next.at }) : t('{score} pontos de medalha · título máximo', { score: title.score })} · ${t('pilotando desde {date}', { date: dateText(p.since) })}</small>
      </div>
      <div class="profile-stats">
        ${stat('KM RODADOS', p.km.toLocaleString(locale(), { maximumFractionDigits: 1 }), 'amber')}
        ${stat('AO VOLANTE', hours ? `${hours} h ${minutes} min` : `${minutes} min`)}
        ${stat('CORRIDAS', `${p.finished} <small>${t('de {n}', { n: p.races })}</small>`)}
        ${stat('VITÓRIAS · PÓDIOS', `${p.wins} · ${p.podiums}`, 'amber')}
        ${stat('VOLTAS', p.laps)}
        ${stat('PONTOS NA CARREIRA', formatPoints(p.points))}
        ${stat('MAIOR COMBO', formatPoints(p.bestCombo), 'amber')}
        ${stat('MELHOR VOLTA', formatPoints(p.bestLap))}
        ${stat('MELHOR CORRIDA', formatPoints(p.bestRace))}
        ${stat('MAIOR ÂNGULO', `${Math.round(p.maxAngle)}°`, 'amber')}
        ${stat('DRIFT MAIS LONGO', `${Math.round(p.longestDrift).toLocaleString(locale())} m`)}
        ${stat('BATIDAS NA MURETA', p.wallHits)}
        ${stat('DINHEIRO', `¥ ${formatPoints(p.money)}`, 'amber')}
        ${stat('GANHO NA CARREIRA', `¥ ${formatPoints(p.earned)}`)}
        ${stat('PISTA FAVORITA', favTrack, 'small')}
        ${stat('CARRO FAVORITO', favCar, 'small')}
      </div>
      <div class="results-grades profile-grades"><span>${t('NOTAS DAS CURVAS')}</span>${Object.entries(p.grades).map(([g, c]) => `<b data-grade="${g}">${g}<small>×${c}</small></b>`).join('')}</div>
      <div class="caption profile-caption">${t('MEDALHAS')} · ${got}/${ACHIEVEMENTS.length}</div>
      <div class="medal-grid">${ACHIEVEMENTS.map((a) => {
        const pr = progressOf(a, p), on = !!p.unlocked[a.id], reward = rewardOf(a.id);
        return `<div class="medal-card ${on ? 'got' : 'locked'}" data-nav data-medal="${a.medal}">
          <i class="medal"></i>
          <div><b>${a.name}</b><small>${a.description}</small>
            <div class="medal-progress"><i style="width:${Math.round(pr.ratio * 100)}%"></i></div>
            <small class="medal-foot">${on ? t('liberada em {date}', { date: dateText(p.unlocked[a.id]) }) : pr.text}${reward ? ` · ${t(on ? 'liberou {slot}: {item}' : 'libera {slot}: {item}', { slot: reward.slotName, item: reward.item.name })}` : ''}</small>
          </div>
        </div>`;
      }).join('')}</div>`;
  }

  setDifficulty(key) {
    this.difficulty = key;
    if (this.visible) this.render();
  }

  setPad(name) {
    const el = document.getElementById('menu-pad');
    const text = name ? t('{name} conectado', { name: t(name) }) : t('Nenhum controle: aperte A no controle com esta janela em foco');
    if (el.textContent !== text) el.textContent = text;
    el.dataset.ok = String(!!name);
  }

  // --- Desenho ------------------------------------------------------------------------------------
  render() {
    for (const [el, label, sel] of this.configLabels) {
      el.textContent = t(label);
      if (sel) for (const arrow of sel.querySelectorAll('[data-dir]')) arrow.setAttribute('aria-label', `${t(label)}: ${t(arrow.dataset.dir === '1' ? 'mais' : 'menos')}`);
    }
    for (const [key, s] of Object.entries(this.selectors)) {
      const el = this.root.querySelector(`.selector[data-key="${key}"]`);
      if (!el) continue;
      const i = s.index();
      const [main, sub] = s.label(i);
      el.querySelector('b').textContent = main;
      el.querySelector('small').textContent = sub || (s.count() > 1 ? `${i + 1}/${s.count()}` : '');
      el.classList.toggle('single', s.count() < 2);
    }
    document.getElementById('difficulty-text').textContent = t(DIFFICULTIES[this.difficulty].description);
    for (const key of ['track', 'laps', 'racers']) this.root.querySelector(`.selector[data-key="${key}"]`).hidden = this.practice;
    document.getElementById('start-btn').textContent = t(this.practice ? 'INICIAR TREINO' : 'INICIAR CORRIDA');
    document.getElementById('track-caption').textContent = t(this.practice ? 'LOCAL' : 'PISTA');

    const randomTrack = this.settings.track === RANDOM, randomTime = this.settings.time === RANDOM;
    const track = randomTrack ? null : trackById(this.settings.track);
    const car = CARS.find((c) => c.id === this.settings.car);
    document.getElementById('garage-car').textContent = `${t(car.name)} · ${car.jp}`;
    this.renderMoney();
    this.renderRanking(car);
    if (this.current === 'profile') this.renderProfile();
    if (this.practice) { this.renderPractice(car); return; }
    document.getElementById('track-info').textContent = randomTrack
      ? t('Pista e horário sorteados a cada largada entre: {list}.', { list: TRACKS.map((tr) => t(tr.name).toLowerCase()).join(', ') })
      : `${Math.round(this.previewTrack.length)} m · ${t(track.description)} ${randomTime ? t('Horário sorteado a cada largada ({list}).', { list: track.times.map((tm) => t(tm.name).toLowerCase()).join(', ') }) : t(timeOf(track, this.settings.time).description)}`;
    this.drawTrack();
    this.drawSpecs(car);

    const record = randomTrack ? null : this.record();
    document.getElementById('record-line').textContent = this.settings.laps === 0
      ? t('Treino livre: sem chegada, voltas contam para o recorde de volta.')
      : randomTrack ? t('Pista aleatória: o recorde fica salvo na pista sorteada.')
        : record ? t('Recorde ({laps}): {points} pts', { laps: lapLabel(this.settings.laps).toLowerCase(), points: formatPoints(record.points) }) : t('Sem recorde nesta configuração ainda.');
  }

  // Singleplayer no modo treino: o estacionamento visto de cima, com os cones das estações.
  renderPractice(car) {
    const lot = this.trackShape(PRACTICE.id).lot;
    const time = timeOf(PRACTICE, this.settings.practiceTime);
    document.getElementById('track-info').textContent = `${t(PRACTICE.name)} · ${t(PRACTICE.description)} ${t(time.description)}`;
    document.getElementById('record-line').textContent = t('Treino: R volta para a saída, arruma os cones e conserta o carro. Nada aqui gasta a lataria de verdade.');
    document.getElementById('ghost-line').textContent = '';
    this.drawSpecs(car);
    const canvas = document.getElementById('track-preview');
    const ctx = canvas.getContext('2d');
    const { width: w, height: h } = canvas;
    const { rect, cones, spawn } = lot;
    const pad = 16;
    const s = Math.min((w - pad * 2) / (rect.maxX - rect.minX), (h - pad * 2) / (rect.maxZ - rect.minZ));
    const ox = (w - (rect.maxX - rect.minX) * s) / 2, oz = (h - (rect.maxZ - rect.minZ) * s) / 2;
    const project = (px, pz) => [ox + (rect.maxX - px) * s, oz + (rect.maxZ - pz) * s]; // igual ao minimapa
    ctx.clearRect(0, 0, w, h);
    const [x0, y0] = project(rect.maxX, rect.maxZ), [x1, y1] = project(rect.minX, rect.minZ);
    ctx.fillStyle = 'rgba(61,255,196,0.06)';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = '#3dffc4';
    ctx.shadowColor = '#3dffc4';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 3;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff7a2a';
    for (const c of cones) {
      const [cx, cy] = project(c.x, c.z);
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
    }
    const [sx, sy] = project(spawn.x, spawn.z);
    ctx.fillStyle = '#ffb13b';
    ctx.fillRect(sx - 4, sy - 7, 8, 14);
    ctx.font = '18px VT323, monospace';
    ctx.fillText(t('SAÍDA'), sx + 9, sy + 5);
  }

  drawTrack() {
    const canvas = document.getElementById('track-preview');
    const ctx = canvas.getContext('2d');
    const { width: w, height: h } = canvas;
    if (this.settings.track === RANDOM) { this.drawRandomTracks(ctx, w, h); return; }
    const { N, x, z } = this.previewTrack;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let j = 0; j < N; j++) {
      minX = Math.min(minX, x[j]); maxX = Math.max(maxX, x[j]);
      minZ = Math.min(minZ, z[j]); maxZ = Math.max(maxZ, z[j]);
    }
    const pad = 18;
    const s = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxZ - minZ));
    const ox = (w - (maxX - minX) * s) / 2, oz = (h - (maxZ - minZ) * s) / 2;
    const project = (px, pz) => [ox + (maxX - px) * s, oz + (maxZ - pz) * s]; // igual ao minimapa
    ctx.clearRect(0, 0, w, h);
    ctx.lineJoin = 'round';
    for (const [width, color, blur] of [[10, 'rgba(61,255,196,0.12)', 0], [3, '#3dffc4', 8]]) {
      ctx.beginPath();
      for (let j = 0; j <= N; j++) {
        const [sx, sy] = project(x[j % N], z[j % N]);
        if (j === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.shadowColor = '#3dffc4';
      ctx.shadowBlur = blur;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    const [lx, ly] = project(x[0], z[0]);
    ctx.fillStyle = '#ffb13b';
    ctx.fillRect(lx - 9, ly - 2, 18, 4);
    ctx.font = '18px VT323, monospace';
    ctx.fillText(t('LARGADA'), lx + 12, ly + 5);
  }

  // Pista aleatória: as pistas lado a lado, apagadas, com um "?" por cima
  drawRandomTracks(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    const cell = w / TRACKS.length, pad = 14;
    TRACKS.forEach((def, k) => {
      const { N, x, z } = this.trackShape(def.id);
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (let j = 0; j < N; j++) {
        minX = Math.min(minX, x[j]); maxX = Math.max(maxX, x[j]);
        minZ = Math.min(minZ, z[j]); maxZ = Math.max(maxZ, z[j]);
      }
      const s = Math.min((cell - pad * 2) / (maxX - minX), (h - pad * 2 - 20) / (maxZ - minZ));
      const ox = k * cell + (cell - (maxX - minX) * s) / 2, oz = (h - 20 - (maxZ - minZ) * s) / 2;
      ctx.beginPath();
      for (let j = 0; j <= N; j++) {
        const sx = ox + (maxX - x[j % N]) * s, sy = oz + (maxZ - z[j % N]) * s;
        if (j === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = 'rgba(61,255,196,0.35)';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.fillStyle = 'rgba(111,156,146,0.9)';
      ctx.font = '15px VT323, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(def.jp, k * cell + cell / 2, h - 6);
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '120px VT323, monospace';
    ctx.fillStyle = '#ffb13b';
    ctx.shadowColor = '#ffb13b';
    ctx.shadowBlur = 14;
    ctx.fillText('?', w / 2, h / 2 - 8);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  drawSpecs(car) {
    const s = carSpecs({ ...car, params: upgradedParams(car, loadProfile().upgrades?.[car.id]) });
    const bar = (value, max) => {
      const on = Math.round(Math.max(0, Math.min(1, value / max)) * 16);
      return `<span class="spec-bar">${'<i class="on"></i>'.repeat(on)}${'<i></i>'.repeat(16 - on)}</span>`;
    };
    document.getElementById('car-specs').innerHTML = `
      <p class="note spec-desc">${t(car.description)}</p>
      <div class="spec"><span>${t('POTÊNCIA')}</span>${bar(s.power, 400)}<b>${s.power} ${t('cv')}</b></div>
      <div class="spec"><span>${t('TORQUE')}</span>${bar(s.torque, 600)}<b>${s.torque} N·m</b></div>
      <div class="spec"><span>${t('PESO')}</span>${bar(s.mass, 2000)}<b>${s.mass} kg</b></div>
      <div class="spec"><span>${t('PESO/POT.')}</span>${bar(12 - s.ratio, 10)}<b>${s.ratio.toFixed(1)} kg/${t('cv')}</b></div>
      <div class="spec"><span>${t('TRAÇÃO')}</span><span class="spec-text">${t('TRASEIRA · {gears} MARCHAS · {front}% NA FRENTE', { gears: s.gears, front: Math.round(s.frontWeight * 100) })}</span></div>
      <div class="spec"><span>${t('MOTOR')}</span><span class="spec-text">${t(ENGINE_PROFILES[car.engine]?.name ?? '')}</span></div>`;
  }

  // Dinheiro e estado da lataria na garagem (o conserto é pago aqui).
  renderMoney() {
    const p = loadProfile();
    const cost = ProfileTracker.repairCost(ProfileTracker.damageOf(p, this.settings.car));
    const money = document.getElementById('garage-money');
    money.innerHTML = cost > 0
      ? `${t('¥ {money}', { money: formatPoints(p.money) })} · <span class="${cost > p.money ? 'broke' : ''}">${t('lataria: conserto por ¥ {cost}', { cost: formatPoints(cost) })}</span>`
      : t('¥ {money} · lataria sem avarias', { money: formatPoints(p.money) });
    const btn = document.getElementById('repair-btn');
    btn.hidden = cost <= 0;
    btn.textContent = t('REPARAR ¥ {cost}', { cost: formatPoints(cost) });
    btn.classList.toggle('disabled', cost > p.money);
  }

  // --- Pausa e resultado --------------------------------------------------------------------------
  showPause({ lap, laps, total, time, position, racers, practice = null }) {
    if (practice) {
      document.getElementById('pause-info').textContent = `${t('treino no estacionamento')} · ${formatPoints(total)} pts · ${t(practice.cones === 1 ? '{n} cone derrubado' : '{n} cones derrubados', { n: practice.cones })}`;
      this.show('pause');
      return;
    }
    const lapText = lap === 0 ? t('volta de saída') : laps ? t('volta {lap} de {laps}', { lap: Math.min(lap, laps), laps }) : t('volta {lap} (treino livre)', { lap });
    const posText = racers > 1 ? ` · ${t('{pos}º de {n}', { pos: position, n: racers })}` : '';
    document.getElementById('pause-info').textContent = `${lapText}${posText} · ${formatPoints(total)} pts · ${formatTime(time).slice(0, -1)}`;
    this.show('pause');
  }

  // Recorde por pista, carro e voltas. No resultado vale a pista que foi sorteada.
  recordKey(track = this.settings.track) {
    return `${track}:${this.settings.car}:${this.settings.laps}`;
  }

  record() {
    return readJSON(RECORDS_KEY, {})[this.recordKey()] || null;
  }

  showResults({ laps, total, bestCombo, time, difficulty, bestLap, standings = [], grades = null, rankBest = 0, achievements = [], prize = 0, repair = 0 }) {
    const records = readJSON(RECORDS_KEY, {});
    const raced = this.active ?? this.settings;
    const key = this.recordKey(raced.track);
    const previous = records[key];
    const isRecord = total > 0 && (!previous || total > previous.points);
    if (isRecord) {
      records[key] = { points: total, time, difficulty, date: new Date().toISOString().slice(0, 10) };
      writeJSON(RECORDS_KEY, records);
    }
    const bestPoints = Math.max(...laps.map((l) => l.points));
    const track = trackById(raced.track);
    const car = CARS.find((c) => c.id === this.settings.car);
    const position = standings.findIndex((r) => r.player) + 1;
    const standingsHtml = standings.length > 1 ? `
      <div class="scroll"><table class="results-table results-standings">
        <thead><tr><th>${t('POS')}</th><th>${t('PILOTO')}</th><th>${t('PONTOS')}</th></tr></thead>
        <tbody>${standings.map((r, i) => `<tr class="${r.player ? 'me' : ''}"><td>${i + 1}º</td><td><i style="background:${r.css}"></i>${r.name}${r.player || r.finished ? '' : ` <small>${t('(na pista)')}</small>`}</td><td>${formatPoints(r.points)}</td></tr>`).join('')}</tbody>
      </table></div>` : '';
    document.getElementById('results-body').innerHTML = `
      <p class="results-sub">${t(track.name)} · ${t(car.name)} · ${t(DIFFICULTIES[difficulty].label)}</p>
      ${standings.length > 1 ? `<p class="results-record" style="animation:none">${t('{pos}º LUGAR', { pos: position })}</p>` : ''}
      <div class="results-total"><span>${t('TOTAL')}</span><b>${formatPoints(total)}</b><small>pts</small></div>
      <p class="results-money">${t('PRÊMIO ¥ {prize}', { prize: formatPoints(prize) })} · ${t('caixa ¥ {money}', { money: formatPoints(loadProfile().money) })}${repair > 0 ? ` · <span class="broke">${t('conserto ¥ {cost}', { cost: formatPoints(repair) })}</span>` : ''}</p>
      ${isRecord ? `<p class="results-record">${t('NOVO RECORDE')}</p>` : previous ? `<p class="note">${t('Recorde: {points} pts', { points: formatPoints(previous.points) })}</p>` : ''}
      ${standingsHtml}
      <div class="scroll"><table class="results-table">
        <thead><tr><th>${t('VOLTA')}</th><th>${t('TEMPO')}</th><th>${t('PONTOS')}</th></tr></thead>
        <tbody>${laps.map((l) => `<tr class="${l.points === bestPoints && l.points > 0 ? 'best' : ''}"><td>${l.lap}</td><td>${formatTime(l.time)}</td><td>${formatPoints(l.points)}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="results-stats">
        <div><span>${t('TEMPO TOTAL')}</span><b>${formatTime(time)}</b></div>
        <div><span>${t('MAIOR COMBO')}</span><b>${formatPoints(bestCombo)}</b></div>
        ${bestLap ? `<div><span>${t('VOLTA DE MAIS PONTOS')}</span><b class="amber">${t('RECORDE DA PISTA')}</b></div>` : ''}
        ${rankBest ? `<div><span>${t('RANKING DE VOLTAS')}</span><b class="amber">${t('{pos}º LUGAR', { pos: rankBest })}</b></div>` : ''}
      </div>
      ${achievements.length ? `<div class="results-medals"><span>${t('MEDALHAS NOVAS')}</span>${achievements.map((a) => {
        const reward = rewardOf(a.id);
        return `<div class="medal-chip" data-medal="${a.medal}"><i class="medal"></i><b>${a.name}</b><small>${reward ? t('liberou {slot}: {item}', { slot: reward.slotName, item: reward.item.name }) : a.description}</small></div>`;
      }).join('')}</div>` : ''}
      ${grades && Object.values(grades).some(Boolean) ? `<div class="results-grades"><span>${t('NOTAS DAS CURVAS')}</span>${Object.entries(grades).filter(([, n]) => n).map(([g, n]) => `<b data-grade="${g}">${g}<small>×${n}</small></b>`).join('')}</div>` : ''}`;
    this.focusIndex.results = 0;
    this.show('results');
  }
}
