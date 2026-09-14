// Menus: tela inicial (modos), singleplayer (pista, carro, voltas, grid, dificuldade), controles, pausa e resultado.
// Navega com mouse, teclado (setas/WASD, Enter, Esc) ou controle (D-pad/analógico, A, B).
import { TRACKS, CARS, LAP_OPTIONS, carSpecs, trackById, timeOf } from './catalog.js';
import { MAX_RACERS } from './race.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from './difficulty.js';
import { ENGINE_PROFILES } from './engine-dsp.js';
import { GARAGE_OPTIONS, DEFAULT_GARAGE, loadGarage, saveGarage } from './garage.js';
import { loadRanking, pickGhost } from './ranking.js';
import { CONFIG_GROUPS, DEFAULT_CONFIG, loadConfig, saveConfig } from './settings.js';
import { formatTime, formatPoints } from './laps.js';

const SETTINGS_KEY = 'corrida3d.corrida';
const RECORDS_KEY = 'corrida3d.recordes';

const lapLabel = (n) => (n === 0 ? 'TREINO LIVRE' : `${n} VOLTA${n > 1 ? 'S' : ''}`);

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
  constructor({ difficulty, onStart, onResume, onRestart, onQuit, onDifficulty, onSettings, onGarage, onScreen, onConfig }) {
    this.root = document.getElementById('menu');
    this.handlers = { onStart, onResume, onRestart, onQuit, onDifficulty, onSettings, onGarage, onScreen, onConfig };
    this.trackCache = new Map();
    this.difficulty = difficulty;
    this.screens = Object.fromEntries([...this.root.querySelectorAll('[data-screen]')].map((s) => [s.dataset.screen, s]));
    this.current = null;
    this.previous = 'main';
    this.focusIndex = {};

    const saved = savedSettings();
    this.settings = {
      track: TRACKS.some((t) => t.id === saved.track) ? saved.track : TRACKS[0].id,
      time: saved.time,
      car: CARS.some((c) => c.id === saved.car) ? saved.car : CARS[0].id,
      laps: LAP_OPTIONS.includes(saved.laps) ? saved.laps : 3,
      racers: Number.isInteger(saved.racers) && saved.racers >= 1 && saved.racers <= MAX_RACERS ? saved.racers : 4,
      ghost: typeof saved.ghost === 'string' ? saved.ghost : 'best', // 'best', 'none' ou id de uma volta do ranking
    };

    this.settings.time = timeOf(trackById(this.settings.track), this.settings.time).id;

    // Cada seletor: lista de opções, índice atual e como mostrar.
    this.selectors = {
      track: {
        count: () => TRACKS.length,
        index: () => TRACKS.findIndex((t) => t.id === this.settings.track),
        set: (i) => { this.settings.track = TRACKS[i].id; this.settings.time = timeOf(TRACKS[i], this.settings.time).id; },
        label: (i) => [TRACKS[i].name, TRACKS[i].jp],
      },
      time: {
        count: () => trackById(this.settings.track).times.length,
        index: () => trackById(this.settings.track).times.findIndex((t) => t.id === this.settings.time),
        set: (i) => { this.settings.time = trackById(this.settings.track).times[i].id; },
        label: (i) => { const t = trackById(this.settings.track).times[i]; return [t.name, t.jp]; },
      },
      car: {
        count: () => CARS.length,
        index: () => CARS.findIndex((c) => c.id === this.settings.car),
        set: (i) => { this.settings.car = CARS[i].id; this.garage = loadGarage(CARS[i].id); },
        label: (i) => [CARS[i].name, CARS[i].jp],
      },
      laps: {
        count: () => LAP_OPTIONS.length,
        index: () => LAP_OPTIONS.indexOf(this.settings.laps),
        set: (i) => { this.settings.laps = LAP_OPTIONS[i]; },
        label: (i) => [lapLabel(LAP_OPTIONS[i]), LAP_OPTIONS[i] === 0 ? 'sem chegada' : 'corrida por pontos'],
      },
      racers: {
        count: () => MAX_RACERS,
        index: () => this.settings.racers - 1,
        set: (i) => { this.settings.racers = i + 1; },
        label: (i) => [i === 0 ? 'SÓ VOCÊ' : `${i + 1} CORREDORES`, i === 0 ? 'sem rivais' : `você + ${i} rival${i > 1 ? 'is' : ''} de IA`],
        wrap: false,
      },
      difficulty: {
        count: () => DIFFICULTY_ORDER.length,
        index: () => DIFFICULTY_ORDER.indexOf(this.difficulty),
        set: (i) => { this.handlers.onDifficulty(DIFFICULTY_ORDER[i]); },
        label: (i) => [DIFFICULTIES[DIFFICULTY_ORDER[i]].label, ' '],
        wrap: false,
      },
    };

    // Ranking: os mesmos seletores de pista e carro, repetidos na tela do ranking
    this.selectors['r-track'] = this.selectors.track;
    this.selectors['r-car'] = this.selectors.car;

    // Garagem: um seletor por opção, valendo para o carro escolhido
    this.garage = loadGarage(this.settings.car);
    for (const [key, list] of Object.entries(GARAGE_OPTIONS)) {
      this.selectors[`g-${key}`] = {
        count: () => list.length,
        index: () => Math.max(0, list.findIndex((o) => o.id === this.garage[key])),
        set: (i) => { this.garage[key] = list[i].id; },
        label: (i) => [list[i].name, `${i + 1}/${list.length}`],
      };
    }

    // Configurações: tela montada a partir das definições (settings.js)
    this.config = loadConfig();
    const body = document.getElementById('config-body');
    for (const group of CONFIG_GROUPS) {
      const box = document.createElement('div');
      box.className = 'config-group';
      box.innerHTML = `<div class="caption">${group.title}</div>`;
      for (const o of group.options) {
        box.insertAdjacentHTML('beforeend', `<div class="selector" data-nav data-key="c-${o.key}">
          <span class="sel-label">${o.label}</span>
          <button type="button" class="sel-arrow" data-dir="-1" aria-label="${o.label}: menos">◀</button>
          <div class="sel-value"><b></b><small></small></div>
          <button type="button" class="sel-arrow" data-dir="1" aria-label="${o.label}: mais">▶</button>
        </div>`);
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
    this.root.addEventListener('pointermove', (e) => {
      const item = e.target.closest('[data-nav]');
      if (item) this.setFocus(this.items().indexOf(item));
    });
  }

  get visible() { return this.current !== null; }

  // Traçado da pista escolhida, só para o desenho da prévia.
  get previewTrack() {
    const id = this.settings.track;
    if (!this.trackCache.has(id)) this.trackCache.set(id, trackById(id).build());
    return this.trackCache.get(id);
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
  }

  show(name) {
    if ((name === 'controls' || name === 'config') && this.current && this.current !== 'controls' && this.current !== 'config') this.previous = this.current;
    this.current = name;
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
    document.body.dataset.menu = '';
  }

  // Ações de um frame vindas do Input.
  handle(a) {
    if (!this.visible) return;
    const items = this.items();
    const index = this.focusIndex[this.current] ?? 0;
    if (a.up) this.setFocus((index - 1 + items.length) % items.length);
    if (a.down) this.setFocus((index + 1) % items.length);
    const focused = this.items()[this.focusIndex[this.current] ?? 0];
    if ((a.left || a.right) && focused?.classList.contains('selector')) this.change(focused.dataset.key, a.right ? 1 : -1);
    if (a.confirm && focused) {
      if (focused.classList.contains('selector')) this.change(focused.dataset.key, 1);
      else focused.click();
    }
    if (a.back || a.pause) this.back();
  }

  back() {
    if (this.current === 'controls' || this.current === 'config') this.show(this.previous);
    else if (this.current === 'single') this.show('main');
    else if (this.current === 'garage') this.show('single');
    else if (this.current === 'ranking') this.show('single');
    else if (this.current === 'pause') this.handlers.onResume();
  }

  change(key, dir) {
    const s = this.selectors[key];
    const count = s.count();
    if (count < 2) return this.flash(key);
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
      saveGarage(this.settings.car, this.garage);
      this.handlers.onGarage?.(this.settings.car, { ...this.garage });
      this.render();
      return;
    }
    writeJSON(SETTINGS_KEY, this.settings);
    this.handlers.onSettings?.({ ...this.settings });
    this.render();
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
    if (name === 'start' || name === 'again') h.onStart({ ...this.settings });
    if (name === 'single') this.show('single');
    if (name === 'garage') this.show('garage');
    if (name === 'ranking') this.show('ranking');
    if (name === 'garage-reset') {
      this.garage = { ...DEFAULT_GARAGE };
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
  renderRanking(track, car) {
    const list = loadRanking(this.settings.track, this.settings.car);
    const picked = pickGhost(list, this.settings.ghost);
    const choice = this.settings.ghost === 'none' ? 'none' : picked?.id;
    const timeName = (id) => track.times.find((t) => t.id === id)?.name.toLowerCase() ?? '';
    const rows = list.map((e, i) => `
      <button type="button" class="rank-row ${e.id === choice ? 'picked' : ''}" data-nav data-action="ghost" data-id="${e.id}">
        <span class="pos">${i + 1}º</span><b>${formatPoints(e.points)} pts</b><span>${formatTime(e.time).slice(0, -1)}</span>
        <small>${e.difficulty ? DIFFICULTIES[e.difficulty]?.label ?? '' : ''}</small><small>${[timeName(e.timeOfDay), e.date?.split('-').reverse().join('/')].filter(Boolean).join(' · ')}</small>
        <span class="pick">${e.id === choice ? '★' : e.ghost ? '' : '—'}</span>
      </button>`).join('');
    const none = `<button type="button" class="rank-row option ${choice === 'none' ? 'picked' : ''}" data-nav data-action="ghost" data-id="none"><span>SEM FANTASMA</span><span class="pick">${choice === 'none' ? '★' : ''}</span></button>`;
    document.getElementById('ranking-body').innerHTML = list.length
      ? `<div class="rank-list">${rows}${none}</div>`
      : `<p class="rank-empty">Nenhuma volta de ${car.name} em ${track.name} ainda. Complete uma volta pontuando para entrar no ranking.</p>`;
    const ghostLine = document.getElementById('ghost-line');
    ghostLine.textContent = choice === 'none' ? 'Fantasma: desligado' : picked ? `Fantasma: ${list.indexOf(picked) + 1}º do ranking · ${formatPoints(picked.points)} pts` : 'Fantasma: nenhuma volta gravada com este carro';
  }

  setDifficulty(key) {
    this.difficulty = key;
    if (this.visible) this.render();
  }

  setPad(name) {
    const el = document.getElementById('menu-pad');
    const text = name ? `${name} conectado` : 'Nenhum controle: aperte A no controle com esta janela em foco';
    if (el.textContent !== text) el.textContent = text;
    el.dataset.ok = String(!!name);
  }

  // --- Desenho ------------------------------------------------------------------------------------
  render() {
    for (const [key, s] of Object.entries(this.selectors)) {
      const el = this.root.querySelector(`.selector[data-key="${key}"]`);
      if (!el) continue;
      const i = s.index();
      const [main, sub] = s.label(i);
      el.querySelector('b').textContent = main;
      el.querySelector('small').textContent = sub || (s.count() > 1 ? `${i + 1}/${s.count()}` : '');
      el.classList.toggle('single', s.count() < 2);
    }
    document.getElementById('difficulty-text').textContent = DIFFICULTIES[this.difficulty].description;

    const track = TRACKS.find((t) => t.id === this.settings.track);
    const car = CARS.find((c) => c.id === this.settings.car);
    document.getElementById('garage-car').textContent = `${car.name} · ${car.jp}`;
    this.renderRanking(track, car);
    document.getElementById('track-info').textContent = `${Math.round(this.previewTrack.length)} m · ${track.description} ${timeOf(track, this.settings.time).description}`;
    this.drawTrack();
    this.drawSpecs(car);

    const record = this.record();
    document.getElementById('record-line').textContent = this.settings.laps === 0
      ? 'Treino livre: sem chegada, voltas contam para o recorde de volta.'
      : record ? `Recorde (${lapLabel(this.settings.laps).toLowerCase()}): ${formatPoints(record.points)} pts` : 'Sem recorde nesta configuração ainda.';
  }

  drawTrack() {
    const canvas = document.getElementById('track-preview');
    const ctx = canvas.getContext('2d');
    const { width: w, height: h } = canvas;
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
    ctx.fillText('LARGADA', lx + 12, ly + 5);
  }

  drawSpecs(car) {
    const s = carSpecs(car);
    const bar = (value, max) => {
      const on = Math.round(Math.max(0, Math.min(1, value / max)) * 16);
      return `<span class="spec-bar">${'<i class="on"></i>'.repeat(on)}${'<i></i>'.repeat(16 - on)}</span>`;
    };
    document.getElementById('car-specs').innerHTML = `
      <p class="note spec-desc">${car.description}</p>
      <div class="spec"><span>POTÊNCIA</span>${bar(s.power, 400)}<b>${s.power} cv</b></div>
      <div class="spec"><span>TORQUE</span>${bar(s.torque, 600)}<b>${s.torque} N·m</b></div>
      <div class="spec"><span>PESO</span>${bar(s.mass, 2000)}<b>${s.mass} kg</b></div>
      <div class="spec"><span>PESO/POT.</span>${bar(12 - s.ratio, 10)}<b>${s.ratio.toFixed(1)} kg/cv</b></div>
      <div class="spec"><span>TRAÇÃO</span><span class="spec-text">TRASEIRA · ${s.gears} MARCHAS · ${Math.round(s.frontWeight * 100)}% NA FRENTE</span></div>
      <div class="spec"><span>MOTOR</span><span class="spec-text">${ENGINE_PROFILES[car.engine]?.name ?? ''}</span></div>`;
  }

  // --- Pausa e resultado --------------------------------------------------------------------------
  showPause({ lap, laps, total, time, position, racers }) {
    const lapText = lap === 0 ? 'volta de saída' : laps ? `volta ${Math.min(lap, laps)} de ${laps}` : `volta ${lap} (treino livre)`;
    const posText = racers > 1 ? ` · ${position}º de ${racers}` : '';
    document.getElementById('pause-info').textContent = `${lapText}${posText} · ${formatPoints(total)} pts · ${formatTime(time).slice(0, -1)}`;
    this.show('pause');
  }

  recordKey() {
    return `${this.settings.track}:${this.settings.car}:${this.settings.laps}`;
  }

  record() {
    return readJSON(RECORDS_KEY, {})[this.recordKey()] || null;
  }

  showResults({ laps, total, bestCombo, time, difficulty, bestLap, standings = [], grades = null, rankBest = 0 }) {
    const records = readJSON(RECORDS_KEY, {});
    const key = this.recordKey();
    const previous = records[key];
    const isRecord = total > 0 && (!previous || total > previous.points);
    if (isRecord) {
      records[key] = { points: total, time, difficulty, date: new Date().toISOString().slice(0, 10) };
      writeJSON(RECORDS_KEY, records);
    }
    const bestPoints = Math.max(...laps.map((l) => l.points));
    const track = TRACKS.find((t) => t.id === this.settings.track);
    const car = CARS.find((c) => c.id === this.settings.car);
    const position = standings.findIndex((r) => r.player) + 1;
    const standingsHtml = standings.length > 1 ? `
      <div class="scroll"><table class="results-table results-standings">
        <thead><tr><th>POS</th><th>PILOTO</th><th>PONTOS</th></tr></thead>
        <tbody>${standings.map((r, i) => `<tr class="${r.player ? 'me' : ''}"><td>${i + 1}º</td><td><i style="background:${r.css}"></i>${r.name}${r.player || r.finished ? '' : ' <small>(na pista)</small>'}</td><td>${formatPoints(r.points)}</td></tr>`).join('')}</tbody>
      </table></div>` : '';
    document.getElementById('results-body').innerHTML = `
      <p class="results-sub">${track.name} · ${car.name} · ${DIFFICULTIES[difficulty].label}</p>
      ${standings.length > 1 ? `<p class="results-record" style="animation:none">${position}º LUGAR</p>` : ''}
      <div class="results-total"><span>TOTAL</span><b>${formatPoints(total)}</b><small>pts</small></div>
      ${isRecord ? '<p class="results-record">NOVO RECORDE</p>' : previous ? `<p class="note">Recorde: ${formatPoints(previous.points)} pts</p>` : ''}
      ${standingsHtml}
      <div class="scroll"><table class="results-table">
        <thead><tr><th>VOLTA</th><th>TEMPO</th><th>PONTOS</th></tr></thead>
        <tbody>${laps.map((l) => `<tr class="${l.points === bestPoints && l.points > 0 ? 'best' : ''}"><td>${l.lap}</td><td>${formatTime(l.time)}</td><td>${formatPoints(l.points)}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="results-stats">
        <div><span>TEMPO TOTAL</span><b>${formatTime(time)}</b></div>
        <div><span>MAIOR COMBO</span><b>${formatPoints(bestCombo)}</b></div>
        ${bestLap ? '<div><span>VOLTA DE MAIS PONTOS</span><b class="amber">RECORDE DA PISTA</b></div>' : ''}
        ${rankBest ? `<div><span>RANKING DE VOLTAS</span><b class="amber">${rankBest}º LUGAR</b></div>` : ''}
      </div>
      ${grades && Object.values(grades).some(Boolean) ? `<div class="results-grades"><span>NOTAS DAS CURVAS</span>${Object.entries(grades).filter(([, n]) => n).map(([g, n]) => `<b data-grade="${g}">${g}<small>×${n}</small></b>`).join('')}</div>` : ''}`;
    this.focusIndex.results = 0;
    this.show('results');
  }
}
