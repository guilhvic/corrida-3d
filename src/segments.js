// Mostradores de painel eletrônico anos 80-90: dígitos de 7 segmentos em SVG (com os segmentos
// apagados visíveis, como num VFD) e barras segmentadas.

const NS = 'http://www.w3.org/2000/svg';
const T = 2.2;         // espessura do segmento
const CELL_W = 12, CELL_H = 22, ADVANCE = 15.5;

const horizontal = (x0, x1, y) =>
  `${x0},${y + T / 2} ${x0 + T / 2},${y} ${x1 - T / 2},${y} ${x1},${y + T / 2} ${x1 - T / 2},${y + T} ${x0 + T / 2},${y + T}`;
const vertical = (x, y0, y1) =>
  `${x + T / 2},${y0} ${x + T},${y0 + T / 2} ${x + T},${y1 - T / 2} ${x + T / 2},${y1} ${x},${y1 - T / 2} ${x},${y0 + T / 2}`;

const SEGMENTS = {
  a: horizontal(1.4, CELL_W - 1.4, 0),
  b: vertical(CELL_W - T, 1.3, 10.8),
  c: vertical(CELL_W - T, 11.2, CELL_H - 1.3),
  d: horizontal(1.4, CELL_W - 1.4, CELL_H - T),
  e: vertical(0, 11.2, CELL_H - 1.3),
  f: vertical(0, 1.3, 10.8),
  g: horizontal(1.4, CELL_W - 1.4, (CELL_H - T) / 2),
};

const GLYPHS = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
  '-': 'g', ' ': '', R: 'eg', r: 'eg', N: 'ceg', n: 'ceg', E: 'adefg', P: 'abefg', A: 'abcefg', o: 'cdeg',
  L: 'def', H: 'bcefg', b: 'cdefg', d: 'bcdeg', c: 'deg', t: 'defg', u: 'cde', '°': 'abfg',
};

export class SegDisplay {
  // count: número de dígitos; o texto é alinhado à direita. '.' acende o ponto do dígito anterior.
  constructor(parent, count, { className = '' } = {}) {
    this.count = count;
    this.text = null;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `-2 -1 ${count * ADVANCE + 2} ${CELL_H + 2}`);
    svg.setAttribute('class', `seg ${className}`);
    const group = document.createElementNS(NS, 'g');
    group.setAttribute('transform', 'skewX(-7) translate(2 0)');
    svg.appendChild(group);
    this.cells = [];
    for (let i = 0; i < count; i++) {
      const cell = document.createElementNS(NS, 'g');
      cell.setAttribute('transform', `translate(${i * ADVANCE} 0)`);
      const segs = {};
      for (const [name, points] of Object.entries(SEGMENTS)) {
        const p = document.createElementNS(NS, 'polygon');
        p.setAttribute('points', points);
        cell.appendChild(p);
        segs[name] = p;
      }
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', CELL_W + 1.2);
      dot.setAttribute('cy', CELL_H - 1.1);
      dot.setAttribute('r', 1.2);
      cell.appendChild(dot);
      group.appendChild(cell);
      this.cells.push({ segs, dot, lit: '', dp: false });
    }
    parent.appendChild(svg);
    this.el = svg;
  }

  set(value) {
    const text = String(value);
    if (text === this.text) return;
    this.text = text;
    const chars = [];
    for (const ch of text) {
      if (ch === '.' && chars.length) chars[chars.length - 1].dp = true;
      else chars.push({ ch, dp: false });
    }
    const visible = chars.slice(-this.count);
    const pad = this.count - visible.length;
    this.cells.forEach((cell, i) => {
      const item = i < pad ? { ch: ' ', dp: false } : visible[i - pad];
      const lit = GLYPHS[item.ch] ?? '';
      if (lit !== cell.lit) {
        for (const [name, el] of Object.entries(cell.segs)) el.classList.toggle('on', lit.includes(name));
        cell.lit = lit;
      }
      if (item.dp !== cell.dp) { cell.dot.classList.toggle('on', item.dp); cell.dp = item.dp; }
    });
  }
}

// Barra de segmentos: set(fração 0..1) acende da esquerda; centered: acende a partir do meio (-1..1).
export class SegBar {
  constructor(parent, count, { centered = false, zones = null } = {}) {
    this.count = count;
    this.centered = centered;
    this.state = '';
    this.items = [];
    for (let i = 0; i < count; i++) {
      const s = document.createElement('i');
      if (zones) s.dataset.zone = zones(i / (count - 1));
      parent.appendChild(s);
      this.items.push(s);
    }
  }

  set(value) {
    const n = this.count;
    let from, to;
    if (this.centered) {
      const mid = (n - 1) / 2, reach = Math.round(Math.max(-1, Math.min(1, value)) * mid);
      from = Math.round(mid + Math.min(0, reach)); to = Math.round(mid + Math.max(0, reach));
    } else {
      from = 0; to = Math.round(Math.max(0, Math.min(1, value)) * n) - 1;
    }
    const state = `${from}|${to}`;
    if (state === this.state) return;
    this.state = state;
    this.items.forEach((s, i) => s.classList.toggle('on', i >= from && i <= to));
  }
}
