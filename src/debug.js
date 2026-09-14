// Painel de debug (tecla B): telemetria ao vivo do carro e ajuste fino dos parâmetros de física,
// pontuação e paredes. Os ajustes ficam salvos no navegador até serem restaurados.
import { CAR } from './physics.js';
import { SURFACES } from './track.js';
import { DRIFT } from './drift.js';
import { WALL } from './walls.js';
import { AI } from './ai.js';
import { JUDGE } from './styleJudge.js';

const STORAGE_KEY = 'corrida3d.debug.acerto';
const DEG = 180 / Math.PI;

// P(alvo, chave, rótulo, mín, máx, passo, unidade, dica)
const P = (t, k, label, min, max, step, unit = '', hint = '') => ({ t, k, label, min, max, step, unit, hint });

const GROUPS = [
  { title: 'Simulação', params: [
    P('sim', 'timeScale', 'Velocidade do tempo', 0, 2, 0.05, 'x', '0 congela a física; não fica salvo'),
    P('CAR', 'gravity', 'Gravidade', 0, 30, 0.01, 'm/s²', 'Carga vertical dos pneus = massa × gravidade'),
  ] },
  { title: 'Massa e geometria', params: [
    P('CAR', 'mass', 'Massa', 500, 3000, 10, 'kg'),
    P('CAR', 'inertia', 'Inércia de guinada', 300, 5000, 10, 'kg·m²', 'Maior = carro gira mais devagar'),
    P('CAR', 'a', 'CG → eixo dianteiro', 0.6, 2.2, 0.01, 'm', 'Só a física; o modelo 3D não muda'),
    P('CAR', 'b', 'CG → eixo traseiro', 0.6, 2.2, 0.01, 'm', 'Só a física; o modelo 3D não muda'),
    P('CAR', 'cgHeight', 'Altura do CG', 0.1, 1.2, 0.01, 'm', 'Transferência de carga na aceleração/frenagem'),
  ] },
  { title: 'Pneus', params: [
    P('CAR', 'mu', 'Atrito de pico (μ)', 0.3, 2.5, 0.01),
    P('CAR', 'rearGrip', 'Aderência traseira', 0.5, 1.5, 0.01, 'x', '< 1 deixa a traseira mais solta'),
    P('CAR', 'pacB', 'Pacejka B (rigidez)', 2, 40, 0.1, '', 'Maior = pico de aderência com menos deriva'),
    P('CAR', 'pacC', 'Pacejka C (forma)', 0.8, 2, 0.01, '', 'Maior = perde mais aderência depois do pico'),
  ] },
  { title: 'Superfícies', params: [
    P('asphalt', 'grip', 'Asfalto: aderência', 0.2, 1.5, 0.01, 'x'),
    P('sidewalk', 'grip', 'Calçada: aderência', 0.2, 1.5, 0.01, 'x'),
    P('offroad', 'grip', 'Fora da rua: aderência', 0.1, 1.5, 0.01, 'x'),
    P('asphalt', 'roll', 'Asfalto: rolagem', 0, 0.2, 0.001),
  ] },
  { title: 'Motor e câmbio', params: [
    P('CAR', 'torqueScale', 'Multiplicador de torque', 0.2, 3, 0.01, 'x'),
    P('CAR', 'redline', 'Corte de giro', 4000, 10000, 50, 'rpm'),
    P('CAR', 'upshiftRpm', 'Sobe marcha (auto)', 3000, 10000, 50, 'rpm'),
    P('CAR', 'downshiftRpm', 'Desce marcha (auto)', 1500, 7000, 50, 'rpm'),
    P('CAR', 'finalDrive', 'Diferencial', 2, 6, 0.01, ':1'),
    P('CAR', 'shiftTime', 'Tempo de troca', 0, 0.6, 0.01, 's'),
    P('CAR', 'efficiency', 'Eficiência da transmissão', 0.5, 1, 0.01),
    P('CAR', 'reverseMaxSpeed', 'Velocidade máx. de ré', 2, 30, 0.5, 'm/s'),
  ] },
  { title: 'Freios e controles', params: [
    P('CAR', 'brakeForce', 'Força de freio', 2000, 40000, 100, 'N'),
    P('CAR', 'brakeBias', 'Distribuição (dianteira)', 0, 1, 0.01, '', 'Fração da frenagem no eixo dianteiro'),
    P('CAR', 'handbrakeForce', 'Freio de mão', 0, 20000, 100, 'N'),
    P('CAR', 'absLimit', 'ABS dianteiro libera', 0.1, 1.2, 0.01, 'x'),
    P('CAR', 'absLimitRear', 'ABS traseiro libera', 0.1, 1.2, 0.01, 'x'),
    P('CAR', 'tcsLimit', 'Controle de tração libera', 0.1, 1.2, 0.01, 'x'),
  ] },
  { title: 'Aerodinâmica', params: [
    P('CAR', 'dragK', 'Arrasto (½ρCdA)', 0, 2, 0.01),
    P('CAR', 'downforceK', 'Downforce', 0, 3, 0.01),
  ] },
  { title: 'Direção', params: [
    P('CAR', 'maxSteerLow', 'Esterço em baixa', 0.1, 1.2, 0.01, 'rad'),
    P('CAR', 'maxSteerHigh', 'Esterço a 160 km/h', 0.05, 1.2, 0.01, 'rad'),
    P('CAR', 'maxLock', 'Batente da direção', 0.2, 1.5, 0.01, 'rad'),
    P('CAR', 'steerRate', 'Velocidade do volante', 1, 15, 0.1, 'rad/s'),
  ] },
  { title: 'Assistência de drift (Normal e Fácil)', params: [
    P('CAR', 'counterSteer', 'Contra-esterço automático', 0, 1.5, 0.01, 'x', 'Fração do ângulo de drift somada ao esterço'),
    P('CAR', 'driftAngleSoft', 'Ângulo do anti-rodada', 0.2, 1.5, 0.01, 'rad'),
    P('CAR', 'stabilityK', 'Anti-rodada: força', 0, 200000, 1000, 'N·m/rad'),
    P('CAR', 'stabilityDamp', 'Anti-rodada: amortecimento', 0, 30000, 100, 'N·m·s'),
  ] },
  { title: 'Controle de ângulo (Fácil)', params: [
    P('CAR', 'easyMaxAngle', 'Ângulo com esterço todo', 0.1, 1.4, 0.01, 'rad'),
    P('CAR', 'easyEntrySpeed', 'Velocidade para entrar', 0, 30, 0.5, 'm/s'),
    P('CAR', 'easyKp', 'Ganho P', 0, 100, 0.5),
    P('CAR', 'easyKd', 'Ganho D', 0, 40, 0.5),
    P('CAR', 'easyMaxTorque', 'Torque máximo', 0, 100000, 500, 'N·m'),
    P('CAR', 'speedHold', 'Empurrão no drift', 0, 5, 0.05, 'm/s²'),
  ] },
  { title: 'Paredes', params: [
    P('WALL', 'restitution', 'Restituição (quique)', 0, 1, 0.01),
    P('WALL', 'friction', 'Atrito de raspagem', 0, 1.5, 0.01),
  ] },
  { title: 'IA dos rivais', params: [
    P('AI', 'cornerPace', 'Ritmo de curva', 0.5, 1.2, 0.01, 'x', 'Fração da aderência usada na curva; alto demais bate'),
    P('AI', 'decel', 'Frenagem planejada', 2, 10, 0.1, 'm/s²'),
    P('AI', 'driftBias', 'Ângulo no drift', 0, 1, 0.01, '', 'Esterço extra para o lado da curva'),
    P('AI', 'driftThrottle', 'Acelerador no drift', 0.2, 1, 0.01),
    P('AI', 'driftCurv', 'Curva mínima para driftar', 0.004, 0.05, 0.001, '1/m'),
    P('AI', 'headingGain', 'Ganho de direção', 0.5, 6, 0.05),
    P('AI', 'lookBase', 'Mira à frente', 2, 20, 0.1, 'm'),
    P('AI', 'lookPerSpeed', 'Mira por velocidade', 0, 1.5, 0.01, 's'),
    P('AI', 'edgeMargin', 'Folga do meio-fio', 0, 4, 0.05, 'm'),
    P('AI', 'followGap', 'Distância atrás de outro carro', 0, 30, 0.5, 'm'),
    P('AI', 'topSpeed', 'Velocidade máxima', 10, 60, 0.5, 'm/s'),
  ] },
  { title: 'Julgamento de estilo (notas por curva)', params: [
    P('JUDGE', 'angleLow', 'Ângulo com nota zero', 0, 40, 1, '°'),
    P('JUDGE', 'angleHigh', 'Ângulo com nota cheia', 20, 80, 1, '°'),
    P('JUDGE', 'smokeFull', 'Fumaça com nota cheia', 0.2, 1, 0.01),
    P('JUDGE', 'minDrift', 'Fração de lado para ter nota', 0, 1, 0.01),
  ] },
  { title: 'Pontuação de drift', params: [
    P('DRIFT', 'minAngle', 'Ângulo mínimo', 0, 45, 1, '°'),
    P('DRIFT', 'minSpeed', 'Velocidade mínima', 0, 100, 1, 'km/h'),
    P('DRIFT', 'maxScoredAngle', 'Ângulo máx. pontuado', 20, 120, 1, '°'),
    P('DRIFT', 'spinAngle', 'Ângulo de rodada', 60, 180, 1, '°'),
    P('DRIFT', 'grace', 'Tolerância sem drift', 0, 4, 0.05, 's'),
    P('DRIFT', 'multStep', 'Tempo por +0,5 mult.', 0.5, 10, 0.1, 's'),
    P('DRIFT', 'maxMult', 'Multiplicador máximo', 1, 10, 0.5, 'x'),
    P('DRIFT', 'wallImpact', 'Impacto que zera o combo', 0, 10, 0.1, 'm/s'),
    P('DRIFT', 'carImpact', 'Batida em carro que zera', 0, 10, 0.1, 'm/s'),
  ] },
];

const TELEMETRY = [
  ['speed', 'Velocidade'], ['uv', 'Long. / lateral'],
  ['beta', 'Ângulo de drift'], ['yaw', 'Guinada'],
  ['steer', 'Esterço (alvo)'], ['steerMax', 'Esterço máx. agora'],
  ['alpha', 'Deriva pneu D / T'], ['load', 'Carga D / T'],
  ['use', 'Uso da aderência D / T'], ['grip', 'Aderência disp. D / T'],
  ['fy', 'Força lateral D / T'], ['fx', 'Força long. D / T'],
  ['g', 'Acel. long. / lat.'], ['surface', 'Piso D / T'],
  ['engine', 'Giro / marcha'], ['torque', 'Torque / força motriz'],
  ['aero', 'Arrasto / downforce'], ['assist', 'Torque assist. / empurrão'],
  ['slip', 'Patinando / travando'], ['flags', 'Estado'],
  ['inputs', 'Acel. / freio / mão'], ['inputSteer', 'Esterço pedido'],
  ['combo', 'Combo / mult.'], ['perf', 'FPS / quadro'],
];

const decimals = (step) => Math.min(3, Math.max(0, -Math.floor(Math.log10(step) + 1e-9)));
const near = (a, b) => Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-6);
const n0 = (v) => (Math.abs(v) >= 10000 ? `${(v / 1000).toFixed(1).replace('.', ',')}k` : Math.round(v).toLocaleString('pt-BR'));
const SURFACE_NAMES = { asphalt: 'asfalto', sidewalk: 'calçada', offroad: 'fora' };
const pct = (v) => `${Math.round(v * 100)}%`;

const CSS = `
#debug { position: fixed; top: 10px; right: 10px; width: 540px; max-width: calc(100vw - 20px); max-height: calc(100vh - 20px);
  display: flex; flex-direction: column; z-index: 50; background: rgba(3, 8, 8, 0.93); border: 1px solid rgba(61,255,196,0.35);
  border-radius: 6px; box-shadow: 0 8px 30px rgba(0,0,0,0.6); font-family: var(--dot); color: var(--text); font-size: 16px; }
#debug[hidden] { display: none; }
#debug header { display: flex; align-items: center; gap: 8px; padding: 6px 8px 4px 10px; cursor: move; user-select: none;
  border-bottom: 1px solid rgba(61,255,196,0.2); }
#debug header h2 { margin: 0; flex: 1; font-weight: normal; font-size: 22px; letter-spacing: 0.1em; color: var(--vfd); text-shadow: 0 0 8px rgba(61,255,196,0.6); }
#debug button { font-family: var(--dot); font-size: 16px; color: var(--vfd); background: rgba(61,255,196,0.07); border: 1px solid rgba(61,255,196,0.3);
  border-radius: 3px; padding: 1px 7px; cursor: pointer; }
#debug button:hover { background: rgba(61,255,196,0.18); }
#debug .dbg-scroll { overflow-y: auto; overflow-x: hidden; padding: 6px 10px 10px; }
#debug .dbg-caption { color: var(--label); letter-spacing: 0.12em; font-size: 15px; margin: 8px 0 4px; opacity: 0.85; }
#debug .dbg-tel { display: grid; grid-template-columns: max-content minmax(0,1fr) max-content minmax(0,1fr); gap: 0 8px; font-size: 14px; line-height: 1.15; }
#debug .dbg-tel span { color: var(--muted); white-space: nowrap; }
#debug .dbg-tel b { font-weight: normal; color: var(--vfd); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
#debug .dbg-tel b.warn { color: var(--amber); }
#debug .dbg-tel b.bad { color: var(--red); }
#debug .dbg-graphs { display: grid; grid-template-columns: 150px 1fr; gap: 6px; margin-top: 6px; }
#debug canvas { width: 100%; background: rgba(61,255,196,0.03); border: 1px solid rgba(61,255,196,0.15); border-radius: 3px; display: block; }
#debug .dbg-legend { display: flex; gap: 10px; font-size: 13px; color: var(--muted); margin-top: 2px; flex-wrap: wrap; }
#debug .dbg-legend i { font-style: normal; }
#debug .dbg-tools { display: flex; gap: 6px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
#debug input[type="search"], #debug textarea { font-family: var(--dot); font-size: 16px; color: var(--text); background: rgba(0,0,0,0.4);
  border: 1px solid rgba(61,255,196,0.25); border-radius: 3px; padding: 2px 6px; }
#debug input[type="search"] { flex: 1; min-width: 120px; }
#debug textarea { width: 100%; height: 120px; resize: vertical; margin-top: 6px; font-size: 14px; }
#debug details { border-top: 1px solid rgba(61,255,196,0.12); padding: 3px 0; }
#debug summary { cursor: pointer; color: var(--label); letter-spacing: 0.08em; font-size: 17px; padding: 2px 0; }
#debug summary .dbg-count { color: var(--amber); margin-left: 6px; }
#debug .dbg-param { display: grid; grid-template-columns: minmax(0,1fr) 140px 76px 56px 20px; gap: 6px; align-items: center; padding: 1px 0; }
#debug .dbg-param label { color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }
#debug .dbg-param.changed label { color: var(--amber); }
#debug .dbg-param input[type="range"] { width: 100%; accent-color: #3dffc4; margin: 0; }
#debug .dbg-param.changed input[type="range"] { accent-color: #ffb13b; }
#debug .dbg-param input[type="number"] { width: 100%; font-family: var(--dot); font-size: 15px; color: var(--vfd); background: rgba(0,0,0,0.4);
  border: 1px solid rgba(61,255,196,0.2); border-radius: 3px; padding: 0 3px; }
#debug .dbg-param .dbg-unit { color: var(--muted); font-size: 13px; white-space: nowrap; overflow: hidden; }
#debug .dbg-param .dbg-reset { padding: 0 3px; font-size: 14px; visibility: hidden; }
#debug .dbg-param.changed .dbg-reset { visibility: visible; color: var(--amber); border-color: rgba(255,177,59,0.4); }
#debug .dbg-flags { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 15px; }
#debug .dbg-flags label { display: flex; align-items: center; gap: 4px; cursor: pointer; }
#debug .dbg-flags input { accent-color: #3dffc4; margin: 0; }
#debug .dbg-hint { font-size: 13px; color: var(--muted); margin-top: 4px; }
`;

function el(tag, className, html) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export class DebugPanel {
  constructor(car) {
    this.car = car;
    this.sim = { timeScale: 1 };
    this.targets = {
      sim: this.sim, CAR, DRIFT, WALL, AI, JUDGE,
      asphalt: SURFACES.asphalt, sidewalk: SURFACES.sidewalk, offroad: SURFACES.offroad,
    };
    this.groups = GROUPS.map((g) => ({ title: g.title, params: g.params.map((p) => ({ ...p, def: this.targets[p.t][p.k] })) }));
    this.params = this.groups.flatMap((g) => g.params);
    this.open = false;
    this.history = [];
    this.trails = { F: [], R: [] };
    this.sampleTimer = 0;
    this.textTimer = 0;
    this.saveTimer = 0;
    this.loadedCount = this.load();
    this.build();
  }

  get timeScale() { return this.sim.timeScale; }

  // --- Persistência -----------------------------------------------------------------------
  changedValues() {
    const out = {};
    for (const p of this.params) {
      if (p.t === 'sim') continue;
      const v = this.targets[p.t][p.k];
      if (near(v, p.def)) continue;
      (out[p.t] ||= {})[p.k] = v;
    }
    return out;
  }

  load() {
    try {
      return this.apply(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    } catch {
      return 0;
    }
  }

  // Aplica { CAR: { mu: 1.2 }, DRIFT: {...} }; devolve quantos valores entraram.
  apply(values) {
    let count = 0;
    for (const p of this.params) {
      const v = values?.[p.t]?.[p.k];
      if (typeof v !== 'number' || !Number.isFinite(v) || p.t === 'sim') continue;
      this.targets[p.t][p.k] = v;
      count++;
    }
    return count;
  }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        const values = this.changedValues();
        if (Object.keys(values).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
        else localStorage.removeItem(STORAGE_KEY);
      } catch { /* sem storage */ }
    }, 250);
  }

  // --- Interface ----------------------------------------------------------------------------
  build() {
    const style = el('style');
    style.textContent = CSS;
    document.head.append(style);

    const root = (this.root = el('section'));
    root.id = 'debug';
    root.hidden = true;
    root.setAttribute('aria-label', 'Painel de debug');
    root.innerHTML = `
      <header><h2>DEBUG · ACERTO</h2><button data-act="freecam" title="Voar pelo mapa com a corrida congelada (F)">câmera livre (F)</button><button data-act="close" title="Fechar (B)">×</button></header>
      <div class="dbg-scroll">
        <div class="dbg-caption">TELEMETRIA</div>
        <div class="dbg-tel"></div>
        <div class="dbg-graphs">
          <div><canvas class="dbg-circle" width="300" height="160"></canvas>
            <div class="dbg-legend"><i>círculo de atrito D · T</i></div></div>
          <div><canvas class="dbg-chart" width="560" height="160"></canvas>
            <div class="dbg-legend"><i style="color:#ffb13b">■ ângulo ±90°</i><i style="color:#6fd8ff">■ guinada ±180°/s</i><i style="color:#3dffc4">■ vel. 0-200</i><i style="color:#ff4a3a">■ esterço</i></div></div>
        </div>
        <div class="dbg-caption">ASSISTÊNCIAS DO CARRO (MUDAM COM A DIFICULDADE)</div>
        <div class="dbg-flags"></div>
        <div class="dbg-caption">AJUSTES</div>
        <div class="dbg-tools">
          <input type="search" placeholder="filtrar parâmetros…" aria-label="Filtrar parâmetros">
          <button data-act="export" title="Mostrar/colar o acerto em JSON">exportar / importar</button>
          <button data-act="reset-all" title="Voltar todos os valores ao padrão">restaurar tudo</button>
        </div>
        <div class="dbg-io" hidden>
          <textarea spellcheck="false" aria-label="Acerto em JSON"></textarea>
          <div class="dbg-tools"><button data-act="copy">copiar</button><button data-act="import">aplicar JSON colado</button><span class="dbg-hint dbg-io-msg"></span></div>
        </div>
        <div class="dbg-params"></div>
        <div class="dbg-hint">Valores em âmbar foram alterados e ficam salvos neste navegador. ↺ volta ao padrão.</div>
      </div>`;
    document.body.append(root);

    const $ = (sel) => root.querySelector(sel);
    this.telEl = {};
    const tel = $('.dbg-tel');
    for (const [key, label] of TELEMETRY) {
      tel.append(el('span', '', label));
      tel.append((this.telEl[key] = el('b', '', '-')));
    }
    this.circle = $('.dbg-circle').getContext('2d');
    this.chart = $('.dbg-chart').getContext('2d');

    // Assistências: refletem o carro (as teclas 1/2/3/T e a dificuldade também mudam).
    this.flags = [];
    const flagBox = $('.dbg-flags');
    for (const [key, label] of [['driftAssist', 'Assist. drift'], ['tcs', 'Controle de tração'], ['abs', 'ABS'], ['automatic', 'Câmbio automático']]) {
      const lab = el('label', '', `<input type="checkbox"> ${label}`);
      const box = lab.querySelector('input');
      box.addEventListener('change', () => { this.car[key] = box.checked; box.blur(); });
      flagBox.append(lab);
      this.flags.push({ key, box });
    }
    const angleLab = el('label', '', 'Controle de ângulo <input type="range" min="0" max="1" step="0.05" style="width:90px"> <b></b>');
    this.angleRange = angleLab.querySelector('input');
    this.angleText = angleLab.querySelector('b');
    this.angleRange.addEventListener('input', () => { this.car.angleControl = Number(this.angleRange.value); });
    this.angleRange.addEventListener('pointerup', () => this.angleRange.blur());
    flagBox.append(angleLab);

    const list = $('.dbg-params');
    for (const group of this.groups) {
      const details = el('details');
      details.open = true;
      const summary = el('summary', '', `${group.title}<span class="dbg-count"></span>`);
      details.append(summary);
      group.summaryCount = summary.querySelector('.dbg-count');
      group.details = details;
      for (const p of group.params) details.append(this.buildRow(p, group));
      list.append(details);
    }

    $('input[type="search"]').addEventListener('input', (e) => this.filter(e.target.value));
    const io = $('.dbg-io'), text = $('textarea'), msg = $('.dbg-io-msg');
    root.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      if (act === 'close') this.toggle(false);
      if (act === 'freecam') { e.target.blur(); this.onFreeCam?.(); }
      if (act === 'reset-all') for (const p of this.params) this.set(p, p.def);
      if (act === 'export') {
        io.hidden = !io.hidden;
        text.value = JSON.stringify(this.changedValues(), null, 2);
        msg.textContent = '';
      }
      if (act === 'copy') {
        text.value = JSON.stringify(this.changedValues(), null, 2);
        navigator.clipboard?.writeText(text.value).then(() => { msg.textContent = 'copiado'; }, () => { text.select(); msg.textContent = 'selecione e copie (Ctrl+C)'; });
      }
      if (act === 'import') {
        try {
          const count = this.apply(JSON.parse(text.value));
          this.refreshAll();
          this.save();
          msg.textContent = `${count} valor(es) aplicado(s)`;
        } catch {
          msg.textContent = 'JSON inválido';
        }
      }
      e.target.closest('button').blur();
    });

    this.makeDraggable(root.querySelector('header'));
    this.refreshAll();
  }

  buildRow(p, group) {
    const row = el('div', 'dbg-param');
    const dec = decimals(p.step);
    row.innerHTML = `<label></label><input type="range"><input type="number"><span class="dbg-unit"></span><button class="dbg-reset">↺</button>`;
    const [label, range, num, unit, reset] = row.children;
    label.textContent = p.label;
    label.title = `${p.t === 'sim' ? 'game' : p.t}.${p.k}${p.hint ? ` · ${p.hint}` : ''}\npadrão: ${p.def.toFixed(dec)}`;
    unit.textContent = p.unit;
    reset.title = `Voltar ao padrão (${p.def.toFixed(dec)})`;
    Object.assign(range, { min: p.min, max: p.max, step: p.step });
    num.step = p.step;
    range.addEventListener('input', () => this.set(p, Number(range.value), range));
    range.addEventListener('pointerup', () => range.blur()); // devolve o teclado para o carro
    num.addEventListener('input', () => { if (num.value !== '' && Number.isFinite(Number(num.value))) this.set(p, Number(num.value), num); });
    num.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') num.blur(); });
    num.addEventListener('blur', () => this.refresh(p));
    reset.addEventListener('click', () => this.set(p, p.def));
    p.row = row; p.range = range; p.num = num; p.dec = dec; p.group = group;
    return row;
  }

  set(p, value, source = null) {
    this.targets[p.t][p.k] = value;
    this.refresh(p, source);
    if (p.t !== 'sim') this.save();
  }

  refresh(p, source = null) {
    const v = this.targets[p.t][p.k];
    if (source !== p.range) p.range.value = v;
    if (source !== p.num) p.num.value = Number(v.toFixed(p.dec));
    p.row.classList.toggle('changed', !near(v, p.def));
    const changed = p.group.params.filter((q) => !near(this.targets[q.t][q.k], q.def)).length;
    p.group.summaryCount.textContent = changed ? `● ${changed}` : '';
  }

  refreshAll() {
    for (const p of this.params) this.refresh(p);
  }

  filter(query) {
    const q = query.trim().toLowerCase();
    for (const g of this.groups) {
      let visible = 0;
      for (const p of g.params) {
        const hit = !q || `${g.title} ${p.label} ${p.k} ${p.hint}`.toLowerCase().includes(q);
        p.row.hidden = !hit;
        visible += hit;
      }
      g.details.hidden = !visible;
      if (q && visible) g.details.open = true;
    }
  }

  makeDraggable(handle) {
    let start = null;
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = this.root.getBoundingClientRect();
      start = { x: e.clientX - r.left, y: e.clientY - r.top };
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!start) return;
      const x = Math.max(0, Math.min(innerWidth - 80, e.clientX - start.x));
      const y = Math.max(0, Math.min(innerHeight - 40, e.clientY - start.y));
      Object.assign(this.root.style, { left: `${x}px`, top: `${y}px`, right: 'auto' });
    });
    handle.addEventListener('pointerup', () => { start = null; });
  }

  toggle(force = !this.open) {
    this.open = force;
    this.root.hidden = !force;
    if (force) this.refreshAll(); // pode ter mudado pelo console
    if (!force && this.root.contains(document.activeElement)) document.activeElement.blur();
  }

  // --- Telemetria -------------------------------------------------------------------------------
  update(dt, { input, surfaces, fps, scorer }) {
    if (!this.open) return;
    const c = this.car, t = c.tel, G = CAR.gravity || 9.81;

    this.sampleTimer += dt;
    if (this.sampleTimer >= 1 / 30) {
      this.sampleTimer = 0;
      this.history.push({ beta: c.driftAngle * DEG, yaw: c.r * DEG, speed: c.speed * 3.6, steer: c.steer / CAR.maxLock });
      if (this.history.length > 180) this.history.shift(); // 6 s
      for (const [axle, fx, fy, grip] of [['F', t.FxF, t.FyF, t.gripF], ['R', t.FxR, t.FyR, t.gripR]]) {
        const trail = this.trails[axle];
        trail.push([fy / Math.max(1, grip), fx / Math.max(1, grip)]);
        if (trail.length > 24) trail.shift();
      }
    }
    this.drawCircle();
    this.drawChart();

    this.textTimer -= dt;
    if (this.textTimer > 0) return;
    this.textTimer = 0.1;

    const e = this.telEl;
    const set = (key, text, cls = '') => {
      if (e[key].textContent !== text) e[key].textContent = text;
      if (e[key].className !== cls) e[key].className = cls;
    };
    const useF = Math.hypot(t.FxF, t.FyF) / Math.max(1, t.gripF), useR = Math.hypot(t.FxR, t.FyR) / Math.max(1, t.gripR);
    const beta = c.driftAngle * DEG;
    set('speed', `${(c.speed * 3.6).toFixed(1)} km/h`);
    set('uv', `${c.u.toFixed(1)} / ${c.v.toFixed(1)} m/s`);
    set('beta', `${beta.toFixed(1)}°`, Math.abs(beta) > DRIFT.spinAngle ? 'bad' : Math.abs(beta) > DRIFT.minAngle ? 'warn' : '');
    set('yaw', `${(c.r * DEG).toFixed(0)}°/s`);
    set('steer', `${(c.steer * DEG).toFixed(1)}° (${(t.steerTarget * DEG).toFixed(1)}°)`);
    set('steerMax', `${(t.maxSteer * DEG).toFixed(1)}°`);
    set('alpha', `${(t.alphaF * DEG).toFixed(1)}° / ${(t.alphaR * DEG).toFixed(1)}°`);
    set('load', `${n0(t.Fzf)} / ${n0(t.Fzr)} N · ${pct(t.Fzf / Math.max(1, t.Fzf + t.Fzr))}`);
    set('use', `${pct(useF)} / ${pct(useR)}`, Math.max(useF, useR) > 0.97 ? 'warn' : '');
    set('grip', `${n0(t.gripF)} / ${n0(t.gripR)} N`);
    set('fy', `${n0(t.FyF)} / ${n0(t.FyR)} N`);
    set('fx', `${n0(t.FxF)} / ${n0(t.FxR)} N`);
    set('g', `${(c.ax / G).toFixed(2)} / ${(c.ay / G).toFixed(2)} g`);
    set('surface', surfaces ? `${SURFACE_NAMES[surfaces[0].name]} / ${SURFACE_NAMES[surfaces[1].name]}` : '-');
    set('engine', `${n0(c.rpm)} rpm / ${c.gear === -1 ? 'R' : c.gear === 0 ? 'N' : c.gear}${c.automatic ? ' auto' : ' man'}`, c.limiter ? 'bad' : '');
    set('torque', `${n0(t.torque)} N·m / ${n0(t.drive)} N`);
    set('aero', `${n0(t.drag)} / ${n0(t.down)} N`);
    set('assist', `${n0(t.assistMz)} N·m / ${n0(t.hold)} N`, Math.abs(t.assistMz) > 1 ? 'warn' : '');
    set('slip', `${pct(Math.min(9.99, c.wheelspin))} / ${pct(Math.min(9.99, c.lockup))}`, c.wheelspin > 0 || c.lockup > 0 ? 'warn' : '');
    set('flags', [c.driftMode && 'MODO DRIFT', c.tcsActive && 'TC', c.absActive && 'ABS', c.limiter && 'CORTE'].filter(Boolean).join(' ') || '-', c.driftMode ? 'warn' : '');
    set('inputs', input ? `${pct(input.throttle)} / ${pct(input.brake)} / ${input.handbrake ? 'sim' : 'não'}` : '-');
    set('inputSteer', input ? `${(input.steer * 100).toFixed(0)}%` : '-');
    set('combo', scorer ? `${n0(scorer.comboValue)} / ${scorer.mult.toFixed(1)}x` : '-');
    set('perf', `${Math.round(fps)} / ${(1000 / Math.max(1, fps)).toFixed(1)} ms${this.sim.timeScale !== 1 ? ` · tempo ${this.sim.timeScale}x` : ''}`, this.sim.timeScale !== 1 ? 'warn' : '');

    for (const { key, box } of this.flags) if (document.activeElement !== box) box.checked = !!c[key];
    if (document.activeElement !== this.angleRange) this.angleRange.value = c.angleControl;
    this.angleText.textContent = c.angleControl.toFixed(2);
  }

  drawCircle() {
    const ctx = this.circle, { width: w, height: h } = ctx.canvas;
    ctx.clearRect(0, 0, w, h);
    const rad = h * 0.4;
    [['F', w * 0.25, 'D'], ['R', w * 0.75, 'T']].forEach(([axle, cx, name]) => {
      const cy = h / 2;
      ctx.strokeStyle = 'rgba(61,255,196,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(61,255,196,0.12)';
      ctx.beginPath(); ctx.moveTo(cx - rad, cy); ctx.lineTo(cx + rad, cy); ctx.moveTo(cx, cy - rad); ctx.lineTo(cx, cy + rad); ctx.stroke();
      ctx.fillStyle = 'rgba(143,233,255,0.7)';
      ctx.font = '20px VT323, monospace';
      ctx.fillText(name, cx - rad, cy - rad + 12);
      const trail = this.trails[axle];
      trail.forEach(([x, y], i) => {
        const last = i === trail.length - 1;
        const over = Math.hypot(x, y) > 0.97;
        ctx.fillStyle = over ? `rgba(255,74,58,${last ? 1 : 0.15 + i / 60})` : `rgba(255,177,59,${last ? 1 : 0.1 + i / 60})`;
        const s = last ? 7 : 3;
        // lateral para os lados (esquerda = +), longitudinal para cima (acelerando)
        ctx.fillRect(cx - Math.max(-1.2, Math.min(1.2, x)) * rad - s / 2, cy - Math.max(-1.2, Math.min(1.2, y)) * rad - s / 2, s, s);
      });
    });
  }

  drawChart() {
    const ctx = this.chart, { width: w, height: h } = ctx.canvas;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(61,255,196,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    for (const a of [DRIFT.minAngle, -DRIFT.minAngle]) {                  // faixa que conta como drift
      const y = h / 2 - (a / 90) * (h / 2 - 4);
      ctx.strokeStyle = 'rgba(255,177,59,0.15)';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    const hist = this.history;
    if (hist.length < 2) return;
    const x = (i) => w - (hist.length - 1 - i) * (w / 179);
    const line = (color, value) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      hist.forEach((s, i) => {
        const y = h / 2 - Math.max(-1, Math.min(1, value(s))) * (h / 2 - 4);
        if (i) ctx.lineTo(x(i), y); else ctx.moveTo(x(i), y);
      });
      ctx.stroke();
    };
    line('rgba(61,255,196,0.8)', (s) => s.speed / 100 - 1);
    line('rgba(255,74,58,0.7)', (s) => s.steer);
    line('rgba(111,216,255,0.9)', (s) => s.yaw / 180);
    line('#ffb13b', (s) => s.beta / 90);
  }
}
