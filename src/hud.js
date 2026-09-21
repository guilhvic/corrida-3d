// HUD de painel eletrônico anos 80-90 (VFD): 7 segmentos, conta-giros em barras, luzes de aviso,
// combo de drift, minimapa e avisos.
import { formatTime, formatPoints } from './laps.js';
import { CAR, paramsOf } from './physics.js';
import { DRIFT } from './drift.js';
import { SegDisplay, SegBar } from './segments.js';
import { t } from './i18n.js';

const $ = (id) => document.getElementById(id);
const TACH_MAX = 8000;

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

function setLamp(el, state) {
  if (el.dataset.state !== state) el.dataset.state = state;
}

export class Hud {
  constructor(track) {
    this.el = {
      lap: $('hud-lap'), lapTime: $('hud-lap-time'),
      combo: $('combo'), comboAngleText: $('combo-angle'), feed: $('combo-feed'), popup: $('popup'),
      mode: $('hud-mode'), shift: $('hud-shift'),
      fps: $('hud-fps'), pad: $('hud-pad'), toast: $('toast'),
      reverse: $('hud-reverse'),
    };
    this.lapPoints = new SegDisplay($('hud-lap-points'), 7, { className: 'green' });
    this.speed = new SegDisplay($('hud-speed'), 3, { className: 'green' });
    this.gear = new SegDisplay($('hud-gear'), 1, { className: 'amber' });
    this.comboValue = new SegDisplay($('combo-value'), 7, { className: 'amber' });
    this.comboMult = new SegDisplay($('combo-mult'), 2, { className: 'red' });
    this.comboAngle = new SegDisplay($('combo-angle-digits'), 2, { className: 'green' });

    // Conta-giros: barras em escada, verde até 5.500, âmbar até o corte, vermelho depois.
    const zones = (t) => (t * TACH_MAX >= CAR.redline - 400 ? 'red' : t * TACH_MAX >= 5500 ? 'amber' : 'green');
    const tach = $('hud-tach');
    this.tach = new SegBar(tach, 40, { zones });
    this.tach.items.forEach((bar, i) => bar.style.setProperty('--h', `${22 + (i / 39) ** 1.4 * 78}%`));

    this.angleBar = new SegBar($('combo-angle-bar'), 24, { zones: (t) => (t > 0.5 ? 'amber' : t > DRIFT.minAngle / 90 ? 'green' : 'dim') });
    this.multBar = new SegBar($('combo-mult-bar'), 12);

    this.track = track;
    this.options = { units: 'kmh', fps: true, minimap: true, grades: true };
    this.initMinimap();
    this.toastTimer = 0;
  }

  setOptions(o) {
    Object.assign(this.options, o);
    $('hud-unit').textContent = this.options.units === 'mph' ? 'mph' : 'km/h';
    this.el.fps.hidden = !this.options.fps;
    $('map-panel').hidden = !this.options.minimap;
  }

  setTrack(track) {
    this.track = track;
    this.initMinimap();
  }

  initMinimap() {
    const canvas = $('minimap');
    const dpr = Math.min(2, devicePixelRatio || 1);
    const size = canvas.clientWidth || 170;
    canvas.width = canvas.height = size * dpr;
    const ctx = (this.map = canvas.getContext('2d'));
    ctx.scale(dpr, dpr);

    const { N, x, z } = this.track;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let j = 0; j < N; j++) {
      minX = Math.min(minX, x[j]); maxX = Math.max(maxX, x[j]);
      minZ = Math.min(minZ, z[j]); maxZ = Math.max(maxZ, z[j]);
    }
    const pad = 14;
    const s = (size - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
    const ox = (size - (maxX - minX) * s) / 2, oz = (size - (maxZ - minZ) * s) / 2;
    // Rotação de 180° para a reta principal apontar para cima.
    this.project = (px, pz) => [ox + (maxX - px) * s, oz + (maxZ - pz) * s];

    const path = new Path2D();
    for (let j = 0; j <= N; j++) {
      const [sx, sy] = this.project(x[j % N], z[j % N]);
      if (j === 0) path.moveTo(sx, sy); else path.lineTo(sx, sy);
    }
    this.mapPath = path;
    this.mapSize = size;
  }

  drawMinimap(car, ghost, rivals = []) {
    const ctx = this.map, size = this.mapSize;
    ctx.clearRect(0, 0, size, size);
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#3dffc4';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = 'rgba(61,255,196,0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke(this.mapPath);
    ctx.shadowBlur = 0;

    const [lx, ly] = this.project(this.track.x[0], this.track.z[0]);
    ctx.fillStyle = '#ffb13b';
    ctx.fillRect(lx - 5, ly - 1, 10, 2);

    const dot = (px, pz, color, r) => {
      const [sx, sy] = this.project(px, pz);
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2); // ponto quadrado, como numa matriz
      ctx.shadowBlur = 0;
    };
    if (ghost) dot(ghost.x, ghost.z, '#6fd8ff', 2.5);
    for (const r of rivals) dot(r.car.x, r.car.z, r.css, 2.5);
    dot(car.x, car.z, '#ffb13b', 3.5);
  }

  update(car, timer, scorer, { fps, ghost, padName, totalLaps = 0, rivals = [] }) {
    const e = this.el;
    const lapText = totalLaps ? t('VOLTA {lap}/{laps}', { lap: Math.min(timer.lap, totalLaps), laps: totalLaps }) : t('VOLTA {lap}', { lap: String(timer.lap).padStart(2, '0') });
    setText(e.lap, timer.lap === 0 ? t('SAÍDA') : lapText);
    setText(e.lapTime, timer.lap === 0 ? '-:--.--' : formatTime(timer.time).slice(0, -1));
    this.lapPoints.set(Math.round(scorer.lapPoints));

    // Combo
    e.combo.classList.toggle('show', scorer.active);
    if (scorer.active) {
      this.comboValue.set(scorer.comboValue);
      this.comboMult.set(scorer.mult.toFixed(1));
      this.comboAngle.set(Math.min(99, Math.round(scorer.angle)));
      this.angleBar.set(scorer.angle / 90);
      this.multBar.set(scorer.mult >= DRIFT.maxMult ? 1 : scorer.multTimer / DRIFT.multStep);
      e.combo.classList.toggle('fading', scorer.idle > 0.15);
    }

    // Instrumentos
    this.speed.set(Math.min(999, Math.round(Math.abs(car.u) * (this.options.units === 'mph' ? 2.23694 : 3.6))));
    this.gear.set(car.gear === -1 ? 'r' : car.gear === 0 ? 'n' : car.gear);
    setText(e.mode, car.automatic ? 'AUTO' : 'MAN');
    this.tach.set(car.rpm / TACH_MAX);
    setLamp(e.shift, car.limiter ? 'blink' : car.rpm > paramsOf(car).upshiftRpm - 300 ? 'on' : 'off');
    setLamp(e.reverse, car.gear === -1 ? 'on' : 'off');

    setText(e.fps, `${Math.round(fps)} FPS`);
    e.pad.hidden = !padName;
    if (padName) setText(e.pad, t(padName).toUpperCase());
    this.drawMinimap(car, ghost, rivals);
  }

  // rows: classificação ordenada [{ name, color, points, player }]; vazio esconde o painel.
  standings(rows) {
    const panel = (this.standingsEl ||= document.getElementById('standings'));
    const posRow = document.getElementById('hud-pos-row');
    panel.hidden = rows.length < 2;
    posRow.hidden = rows.length < 2;
    if (rows.length < 2) return;
    const me = rows.findIndex((r) => r.player);
    setText(document.getElementById('hud-pos'), `${me + 1}/${rows.length}`);
    const html = rows.map((r, i) => `<li class="${r.player ? 'me' : ''}"><span>${i + 1}</span><i style="background:${r.css};color:${r.css}"></i><span>${r.name}</span><b>${formatPoints(r.points)}</b></li>`).join('');
    const list = document.getElementById('standings-list');
    if (list.innerHTML !== html) list.innerHTML = html;
  }

  bonus(label, points) {
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.textContent = `${label} +${formatPoints(points)}`;
    this.el.feed.prepend(item);
    while (this.el.feed.children.length > 4) this.el.feed.lastChild.remove();
    setTimeout(() => item.classList.add('out'), 1400);
    setTimeout(() => item.remove(), 1900);
  }

  // Nota de estilo no fim da curva: letra grande, barras de ângulo/linha/fumaça e o bônus.
  grade(ev) {
    if (!this.options.grades) return;
    const el = (this.gradeEl ||= {
      root: $('grade'), corner: $('grade-corner'), letter: $('grade-letter'), bonus: $('grade-bonus'),
      bars: { angle: new SegBar($('grade-angle'), 10), line: new SegBar($('grade-line'), 10), smoke: new SegBar($('grade-smoke'), 10) },
    });
    el.corner.textContent = t('CURVA {n}', { n: ev.corner });
    el.letter.textContent = ev.failed ? 'X' : ev.grade;
    el.root.dataset.grade = ev.failed ? 'fail' : ev.grade;
    el.bonus.textContent = ev.failed ? t('BATEU') : ev.bonus ? `+${formatPoints(ev.bonus)}` : '';
    for (const key of ['angle', 'line', 'smoke']) el.bars[key].set(ev[key]);
    el.root.hidden = false;
    el.root.classList.remove('show');
    void el.root.offsetWidth;
    el.root.classList.add('show');
    clearTimeout(this.gradeTimer);
    this.gradeTimer = setTimeout(() => { el.root.hidden = true; }, 2600);
  }

  popup(text, kind) {
    const p = this.el.popup;
    p.textContent = text;
    p.dataset.kind = kind;
    p.classList.remove('show');
    void p.offsetWidth; // reinicia a animação
    p.classList.add('show');
    this.el.feed.replaceChildren();
  }

  // Contagem regressiva no centro da tela ('' esconde).
  countdown(text) {
    const c = (this.countEl ||= document.getElementById('countdown'));
    if (c.textContent === text) return;
    c.textContent = text;
    c.dataset.go = String(text === t('JÁ!'));
    c.classList.remove('show');
    if (!text) return;
    void c.offsetWidth; // reinicia a animação a cada número
    c.classList.add('show');
  }

  toast(text, kind = 'info', ms = 2200) {
    const t = this.el.toast;
    t.textContent = text;
    t.dataset.kind = kind;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
}
