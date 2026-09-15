// Texturas procedurais de superfície geradas pixel a pixel, com cor, relevo (normal map) e brilho coerentes.
import * as THREE from 'three';

export function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Ruído de valor com repetição (tileable) e interpolação suave.
export function valueNoise(rand, gw, gh) {
  const g = new Float32Array(gw * gh).map(() => rand());
  return (u, v) => {
    const x = (((u % 1) + 1) % 1) * gw, y = (((v % 1) + 1) % 1) * gh;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const at = (i, j) => g[((j % gh) + gh) % gh * gw + ((i % gw) + gw) % gw];
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

// Superfície em buffers: cor (0..1), altura e brilho; vira texturas no final.
export class Surface {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.col = new Float32Array(w * h * 3);
    this.height = new Float32Array(w * h);
    this.spec = new Float32Array(w * h);
  }
  i(x, y) {
    return (((y % this.h) + this.h) % this.h) * this.w + (((x % this.w) + this.w) % this.w);
  }
  // Aplica fn(i, px, py, t) nos pixels de uma elipse (t = distância normalizada ao centro).
  ellipse(cx, cy, rx, ry, fn) {
    for (let py = Math.floor(cy - ry); py <= cy + ry; py++) {
      for (let px = Math.floor(cx - rx); px <= cx + rx; px++) {
        const t = Math.hypot((px - cx) / rx, (py - cy) / ry);
        if (t <= 1) fn(this.i(px, py), px, py, t);
      }
    }
  }
  rect(x0, y0, x1, y1, fn) {
    for (let py = Math.floor(y0); py < y1; py++) for (let px = Math.floor(x0); px < x1; px++) fn(this.i(px, py), px, py);
  }
  setGray(i, v, tint = [1, 1, 1]) {
    this.col[i * 3] = v * tint[0]; this.col[i * 3 + 1] = v * tint[1]; this.col[i * 3 + 2] = v * tint[2];
  }

  textures({ normalStrength = 2.5, anisotropy = 8 } = {}) {
    const { w, h } = this;
    const make = (fill, srgb) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) fill(img.data, i);
      ctx.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = anisotropy;
      return t;
    };
    const map = make((d, i) => {
      d[i * 4] = clamp01(this.col[i * 3]) * 255; d[i * 4 + 1] = clamp01(this.col[i * 3 + 1]) * 255;
      d[i * 4 + 2] = clamp01(this.col[i * 3 + 2]) * 255; d[i * 4 + 3] = 255;
    }, true);
    const specularMap = make((d, i) => {
      const v = clamp01(this.spec[i]) * 255;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
    }, false);
    const normalMap = make((d, i) => {
      const x = i % w, y = (i - x) / w;
      const dx = (this.height[this.i(x - 1, y)] - this.height[this.i(x + 1, y)]) * normalStrength;
      const dy = (this.height[this.i(x, y + 1)] - this.height[this.i(x, y - 1)]) * normalStrength;
      const l = Math.hypot(dx, dy, 1);
      d[i * 4] = (dx / l * 0.5 + 0.5) * 255; d[i * 4 + 1] = (dy / l * 0.5 + 0.5) * 255;
      d[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; d[i * 4 + 3] = 255;
    }, false);
    return { map, normalMap, specularMap };
  }
}

// Rua de 14 m de largura x 16 m de comprimento (u = largura, v = comprimento).
export function roadTextures(seed = 31) {
  const rand = mulberry32(seed);
  const W = 256, H = 512, PX = W / 14, PY = H / 16; // pixels por metro
  const s = new Surface(W, H);
  const blotch = valueNoise(rand, 6, 12), mid = valueNoise(rand, 40, 80), wear = valueNoise(rand, 64, 128);
  const lanes = [0.2, 0.33, 0.67, 0.8];

  // Agregado, trilhas de pneu (mais escuras e lisas) e sarjeta molhada.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = s.i(x, y), u = x / W, v = y / H, grain = rand();
      const tyre = Math.max(...lanes.map((c) => Math.exp(-(((u - c) / 0.035) ** 2))));
      const gutter = clamp01(1 - (Math.min(u, 1 - u) * 14) / 0.45);
      let g = 0.15 + (blotch(u, v) - 0.5) * 0.06 + (mid(u, v) - 0.5) * 0.035 + (grain - 0.5) * (0.06 - tyre * 0.03);
      g -= tyre * 0.03 + gutter * 0.05;
      s.setGray(i, g, [0.98, 0.99, 1.04]);
      s.height[i] = (grain * 0.55 + mid(u, v) * 0.45) * (1 - tyre * 0.55) - gutter * 0.2;
      s.spec[i] = 0.18 + tyre * 0.18 + gutter * 0.6 + (grain > 0.985 ? 0.25 : 0);
    }
  }

  // Remendos de asfalto novo/velho
  for (let k = 0; k < 3; k++) {
    const x0 = rand() * W * 0.7, y0 = rand() * H, pw = (1.5 + rand() * 3) * PX, ph = (2 + rand() * 4) * PY;
    const shade = rand() < 0.5 ? 0.82 : 1.18;
    s.rect(x0, y0, x0 + pw, y0 + ph, (i, px, py) => {
      for (let c = 0; c < 3; c++) s.col[i * 3 + c] *= shade;
      s.height[i] = s.height[i] * 0.5 + 0.2;
      if (px < x0 + 1 || px >= x0 + pw - 1 || py < y0 + 1 || py >= y0 + ph - 1) { s.setGray(i, 0.06); s.spec[i] = 0.75; s.height[i] = 0.7; }
    });
  }

  // Rachaduras seladas com piche (brilhantes e levemente altas)
  for (let k = 0; k < 9; k++) {
    let px = rand() * W, py = rand() * H, dir = rand() * Math.PI * 2;
    const steps = 30 + rand() * 60;
    for (let n = 0; n < steps; n++) {
      dir += (rand() - 0.5) * 0.9;
      px += Math.cos(dir) * 1.5; py += Math.sin(dir) * 1.5;
      s.ellipse(px, py, 1.3, 1.3, (i) => { s.setGray(i, 0.045); s.spec[i] = 0.85; s.height[i] = 0.75; });
    }
  }

  // Poças: escuras, espelhadas e planas
  for (let k = 0; k < 4; k++) {
    const cx = (0.12 + rand() * 0.76) * W, cy = rand() * H, rx = (0.6 + rand() * 1.4) * PX, ry = (1 + rand() * 2.5) * PY;
    s.ellipse(cx, cy, rx, ry, (i, px, py, t) => {
      const edge = clamp01((1 - t) * 3);
      for (let c = 0; c < 3; c++) s.col[i * 3 + c] *= 1 - edge * 0.35;
      s.spec[i] = s.spec[i] * (1 - edge) + edge;
      s.height[i] = s.height[i] * (1 - edge) + 0.35 * edge;
    });
  }

  // Tampa de bueiro no meio de uma faixa
  {
    const cx = lanes[rand() < 0.5 ? 1 : 2] * W, cy = (0.2 + rand() * 0.6) * H, r = 0.34;
    s.ellipse(cx, cy, r * PX, r * PY, (i, px, py, t) => {
      const lattice = ((Math.floor((px - cx) / 2.2) + Math.floor((py - cy) / 2.2)) & 1) === 0;
      s.setGray(i, t > 0.86 ? 0.2 : lattice ? 0.14 : 0.09, [1, 0.97, 0.93]);
      s.spec[i] = 0.55;
      s.height[i] = t > 0.86 ? 0.8 : lattice ? 0.55 : 0.3;
    });
  }

  // Grelhas de escoamento junto às guias
  for (const side of [0, 1]) {
    const cx = side ? W - 0.28 * PX : 0.28 * PX, cy = rand() * H;
    const hw = 0.2 * PX, hh = 0.5 * PY;
    s.rect(cx - hw, cy - hh, cx + hw, cy + hh, (i, px, py) => {
      const slot = Math.floor(py - (cy - hh)) % 3 !== 0;
      s.setGray(i, slot ? 0.02 : 0.22, [1, 0.98, 0.95]);
      s.spec[i] = slot ? 0.1 : 0.6;
      s.height[i] = slot ? 0 : 0.6;
    });
  }

  // Faixas: bordas contínuas e central tracejada, com tinta gasta (mais nas trilhas de pneu).
  const paint = (x0, x1, y0, y1) => s.rect(x0, y0, x1, y1, (i, px, py) => {
    const u = px / W, v = py / H;
    const tyre = Math.max(...lanes.map((c) => Math.exp(-(((u - c) / 0.05) ** 2))));
    const amount = clamp01(0.95 - (wear(u, v) - 0.35) * 1.6 - tyre * 0.5 - rand() * 0.15);
    const g = s.col[i * 3];
    s.setGray(i, g + (0.8 - g) * amount, [1, 1, 0.97]);
    s.spec[i] = s.spec[i] * (1 - amount) + 0.12 * amount;
    s.height[i] += amount * 0.15;
  });
  const lw = 0.15 * PX;
  paint(0.35 * PX, 0.35 * PX + lw, 0, H);
  paint(W - 0.35 * PX - lw, W - 0.35 * PX, 0, H);
  for (const start of [0, 8]) paint(W / 2 - lw / 2, W / 2 + lw / 2, start * PY, (start + 5) * PY);

  return s.textures({ normalStrength: 1.8 });
}

// Estrada do interior, seca: asfalto mais claro e gasto, linha central amarela contínua e bordas brancas
// a 1,5 m do acostamento. Mesma escala da rua da cidade (14 x 16 m).
export function countryRoadTextures(seed = 47) {
  const rand = mulberry32(seed);
  const W = 256, H = 512, PX = W / 14, PY = H / 16;
  const s = new Surface(W, H);
  const blotch = valueNoise(rand, 5, 10), mid = valueNoise(rand, 40, 80), wear = valueNoise(rand, 64, 128);
  const tyres = [0.26, 0.37, 0.63, 0.74];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = s.i(x, y), u = x / W, v = y / H, grain = rand();
      const tyre = Math.max(...tyres.map((c) => Math.exp(-(((u - c) / 0.04) ** 2))));
      const edge = clamp01(1 - (Math.min(u, 1 - u) * 14) / 1.2); // poeira e cascalho junto ao acostamento
      let g = 0.25 + (blotch(u, v) - 0.5) * 0.07 + (mid(u, v) - 0.5) * 0.04 + (grain - 0.5) * 0.09;
      g -= tyre * 0.035;
      g += edge * (grain > 0.7 ? 0.08 : 0.02);
      s.setGray(i, g, [1.02, 1, 0.96]);
      s.height[i] = (grain * 0.6 + mid(u, v) * 0.4) * (1 - tyre * 0.4);
      s.spec[i] = 0.08 + tyre * 0.12;
    }
  }
  // Remendos e rachaduras seladas
  for (let k = 0; k < 4; k++) {
    const x0 = (0.1 + rand() * 0.6) * W, y0 = rand() * H, pw = (1.2 + rand() * 3) * PX, ph = (1.5 + rand() * 5) * PY;
    const shade = rand() < 0.6 ? 0.78 : 1.12;
    s.rect(x0, y0, x0 + pw, y0 + ph, (i) => { for (let c = 0; c < 3; c++) s.col[i * 3 + c] *= shade; s.height[i] = s.height[i] * 0.5 + 0.2; });
  }
  for (let k = 0; k < 12; k++) {
    let px = rand() * W, py = rand() * H, dir = rand() * Math.PI * 2;
    for (let n = 0, steps = 20 + rand() * 50; n < steps; n++) {
      dir += (rand() - 0.5) * 1.1;
      px += Math.cos(dir) * 1.5; py += Math.sin(dir) * 1.5;
      s.ellipse(px, py, 1.1, 1.1, (i) => { s.setGray(i, 0.07); s.spec[i] = 0.5; s.height[i] = 0.7; });
    }
  }
  const paint = (x0, x1, y0, y1, tint) => s.rect(x0, y0, x1, y1, (i, px, py) => {
    const u = px / W, v = py / H;
    const tyre = Math.max(...tyres.map((c) => Math.exp(-(((u - c) / 0.05) ** 2))));
    const amount = clamp01(0.92 - (wear(u, v) - 0.4) * 1.4 - tyre * 0.4 - rand() * 0.2);
    for (let c = 0; c < 3; c++) s.col[i * 3 + c] += (tint[c] - s.col[i * 3 + c]) * amount;
    s.spec[i] = s.spec[i] * (1 - amount) + 0.15 * amount;
    s.height[i] += amount * 0.15;
  });
  const lw = 0.15 * PX;
  paint(1.5 * PX, 1.5 * PX + lw, 0, H, [0.82, 0.82, 0.78]);
  paint(W - 1.5 * PX - lw, W - 1.5 * PX, 0, H, [0.82, 0.82, 0.78]);
  paint(W / 2 - lw / 2, W / 2 + lw / 2, 0, H, [0.86, 0.6, 0.12]);
  return s.textures({ normalStrength: 1.6 });
}

// Blocos intertravados de concreto (2 m x 2 m).
export function paverTextures(seed = 57) {
  const rand = mulberry32(seed);
  const W = 128, H = 128, bw = 16, bh = 8;
  const s = new Surface(W, H);
  const stain = valueNoise(rand, 4, 4);
  const shades = new Map();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const row = Math.floor(y / bh), offset = row % 2 ? bw / 2 : 0;
      const bx = Math.floor((x + offset) / bw);
      const key = `${row}|${bx}`;
      if (!shades.has(key)) shades.set(key, 0.33 + rand() * 0.08);
      const inX = (x + offset) % bw, inY = y % bh;
      const joint = inX === 0 || inY === 0;
      const i = s.i(x, y);
      const g = joint ? 0.12 : shades.get(key) + (rand() - 0.5) * 0.05 - (stain(x / W, y / H) - 0.5) * 0.1;
      s.setGray(i, g, [1, 0.98, 0.95]);
      s.height[i] = joint ? 0 : 0.6 + rand() * 0.1;
      s.spec[i] = joint ? 0.5 : 0.18;
    }
  }
  return s.textures({ normalStrength: 1.6 });
}

// Guia de concreto (textura ao longo, altura na vertical).
export function curbTextures(seed = 91) {
  const rand = mulberry32(seed);
  const W = 128, H = 16;
  const s = new Surface(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = s.i(x, y);
      const dirt = y / H; // v=0 embaixo (flipY): sujeira na base
      let g = 0.52 + (rand() - 0.5) * 0.08 - (1 - dirt) * 0.18;
      if (x % 32 === 0) g = 0.25;
      s.setGray(i, g, [1, 0.98, 0.94]);
      s.height[i] = rand() * 0.4 + (x % 32 === 0 ? -0.5 : 0);
      s.spec[i] = 0.15 + (1 - dirt) * 0.2;
    }
  }
  return s.textures({ normalStrength: 1.2 });
}

// Marcas de pneu de quem já derrapou: faixas escuras sinuosas, com transparência.
export function tireMarksTexture(seed = 13) {
  const rand = mulberry32(seed);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 512;
  const ctx = c.getContext('2d');
  for (let k = 0; k < 7; k++) {
    const x0 = 12 + rand() * 104, amp = 4 + rand() * 18, freq = (1 + Math.floor(rand() * 2)) * Math.PI * 2 / 512;
    const alpha = 0.15 + rand() * 0.3;
    for (const gap of [0, 9]) {
      ctx.strokeStyle = `rgba(8,8,8,${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let y = 0; y <= 512; y += 8) {
        const x = x0 + gap + Math.sin(y * freq + k) * amp;
        if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Marcação japonesa no asfalto: caracteres empilhados no sentido da rua, esticados, o primeiro mais perto
// de quem chega (no plano, o topo aponta para a frente, então o primeiro fica embaixo).
export function roadWordTexture(word, seed = 5) {
  const rand = mulberry32(seed);
  const chars = [...word];
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(228,227,216,0.92)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cell = c.height / chars.length;
  chars.forEach((ch, i) => {
    ctx.save();
    ctx.translate(64, c.height - cell * (i + 0.5));
    ctx.scale(1, 1.6); // alongado como a pintura de rua vista em perspectiva
    ctx.font = '900 64px "Yu Gothic", "Meiryo", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif';
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.3 + rand() * 0.7})`;
    ctx.fillRect(rand() * 128, rand() * 256, 1 + rand() * 3, 1 + rand() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Piso tátil de alerta (amarelo com relevo de bolinhas).
export function tactileTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9a21c';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 4; y < 64; y += 8) for (let x = 4; x < 64; x += 8) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(x + 0.8, y + 0.8, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c23a'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
