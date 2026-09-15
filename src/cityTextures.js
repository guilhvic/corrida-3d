// Texturas da cidade portuária geradas pixel a pixel (cor, relevo, brilho e luz própria coerentes):
// fachadas de vários tipos de prédio com janelas de verdade (caixilho, peitoril, cortina, persiana,
// luz interna em degradê, escorrido de chuva), vitrines do térreo, portas de aço, letreiros, toldos,
// mureta de concreto envelhecida, telhados, grelhas de ar-condicionado, folhagem e contêineres.
import * as THREE from 'three';
import { Surface, valueNoise, mulberry32 } from './textures.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const JP = '"Yu Gothic", "Meiryo", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Noto Sans JP", sans-serif';

// Superfície com luz própria (emissive) além de cor/relevo/brilho
class LitSurface extends Surface {
  constructor(w, h) {
    super(w, h);
    this.emit = new Float32Array(w * h * 3);
  }
  put(i, rgb, height, spec, emit = null) {
    this.col[i * 3] = rgb[0]; this.col[i * 3 + 1] = rgb[1]; this.col[i * 3 + 2] = rgb[2];
    if (height !== undefined) this.height[i] = height;
    if (spec !== undefined) this.spec[i] = spec;
    if (emit) { this.emit[i * 3] = emit[0]; this.emit[i * 3 + 1] = emit[1]; this.emit[i * 3 + 2] = emit[2]; }
  }
  all(opts) {
    const t = this.textures(opts);
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.w * this.h; i++) {
      img.data[i * 4] = clamp01(this.emit[i * 3]) * 255;
      img.data[i * 4 + 1] = clamp01(this.emit[i * 3 + 1]) * 255;
      img.data[i * 4 + 2] = clamp01(this.emit[i * 3 + 2]) * 255;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const emissiveMap = new THREE.CanvasTexture(c);
    emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
    emissiveMap.anisotropy = 8;
    return { ...t, emissiveMap };
  }
}

// --- Fachadas -------------------------------------------------------------------------------------------
// Ladrilho de 4 vãos (3,2 m) x 4 andares (3,4 m). Linha 0 do canvas = topo (andar mais alto).
export const FACADE_TILE = { bays: 4, floors: 4, bayW: 3.2, floorH: 3.4 };

export const FACADE_STYLES = {
  // Prédio de apartamentos: azulejo claro, portas de correr de vidro até o chão (varandas em 3D na frente)
  mansion: { wall: 'tile', color: [0.62, 0.58, 0.52], window: 'slider', lit: 0.42, balcony: true },
  // Escritório: faixas contínuas de janela com montantes de alumínio e peitoril escuro
  office: { wall: 'panel', color: [0.36, 0.38, 0.41], window: 'ribbon', lit: 0.5 },
  // Prédio velho de concreto (zakkyo): janelas médias, manchas e escorridos fortes
  zakkyo: { wall: 'concrete', color: [0.44, 0.42, 0.4], window: 'punched', lit: 0.36, grime: 1 },
  // Azulejo marrom anos 80
  brick: { wall: 'tile', color: [0.36, 0.25, 0.2], window: 'punched', lit: 0.32, tile: 10 },
  // Galpão do porto: metal ondulado, janelas altas em faixa, número pintado
  warehouse: { wall: 'metal', color: [0.46, 0.5, 0.52], window: 'clerestory', lit: 0.25, grime: 0.7 },
};

function wallPixel(style, s, x, y, n1, n2, rand) {
  const [r, g, b] = style.color;
  const W = s.w, H = s.h;
  let shade = 0.88 + (n1(x / W, y / H) - 0.5) * 0.22 + (rand() - 0.5) * 0.05;
  let height = 0.5, spec = 0.08;
  if (style.wall === 'tile') {
    const t = style.tile ?? 7;
    const gx = x % t === 0, gy = y % Math.round(t * 0.5 + 2) === 0;
    if (gx || gy) { shade *= 0.72; height = 0.35; } else { spec = 0.22; shade *= 0.95 + (((Math.floor(x / t) * 7 + Math.floor(y / 6) * 13) % 5) / 60); }
  } else if (style.wall === 'panel') {
    if (y % 26 === 0) { shade *= 0.65; height = 0.3; }
    spec = 0.12;
  } else if (style.wall === 'concrete') {
    if (x % 72 === 0 || y % 36 === 0) { shade *= 0.8; height = 0.4; }
    const tx = x % 36, ty = y % 18;
    if ((tx - 18) ** 2 + (ty - 9) ** 2 < 3) { shade *= 0.55; height = 0.2; } // furos das formas
    shade *= 0.92 + (n2(x / W, y / H) - 0.5) * 0.25;
  } else if (style.wall === 'metal') {
    const rib = Math.sin((x / 6) * Math.PI * 2);
    height = 0.5 + rib * 0.35;
    shade *= 0.9 + rib * 0.08;
    spec = 0.3 + Math.max(0, rib) * 0.2;
  }
  return { rgb: [r * shade, g * shade, b * shade], height, spec };
}

// Interior visto pela janela (acesa) ou vidro escuro (apagada)
function paintWindow(s, x0, y0, x1, y1, cell, rand, { frame = 3, mullions = [] } = {}) {
  const w = x1 - x0, h = y1 - y0;
  const { lit, color, curtain, blinds, furniture } = cell;
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const i = s.i(px, py);
      const fx = (px - x0) / w, fy = (py - y0) / h; // fy 0 = topo
      const edge = px - x0 < frame || x1 - px <= frame || py - y0 < frame || y1 - py <= frame;
      const mull = mullions.some((m) => Math.abs(px - (x0 + m * w)) < 1.5);
      if (edge || mull) { s.put(i, [0.5, 0.51, 0.53], 0.72, 0.55); continue; }
      let rgb, emit = null;
      if (lit) {
        // teto claro, piso escuro, vinheta nas bordas
        const k = (0.95 - fy * 0.45) * (1 - Math.abs(fx - 0.5) * 0.35);
        rgb = [color[0] * k, color[1] * k, color[2] * k];
        if (furniture && fy > 0.62) {
          const seg = Math.floor(fx * furniture.length);
          if (fy > 1 - furniture[seg]) rgb = rgb.map((v) => v * 0.28);
        }
        if (blinds && (py % 4 < 2)) rgb = rgb.map((v) => v * 0.55);
        if (curtain) {
          const covered = fx < curtain[0] || fx > 1 - curtain[1];
          if (covered) {
            const fold = 0.75 + Math.sin(px * 0.9) * 0.18;
            rgb = [curtain[2][0] * k * fold, curtain[2][1] * k * fold, curtain[2][2] * k * fold];
          }
        }
        emit = rgb;
      } else {
        // vidro escuro refletindo o céu (mais claro em cima) com um reflexo diagonal
        const refl = 0.05 + (1 - fy) * 0.07 + (Math.abs(((fx + fy * 0.6) % 0.5) - 0.25) < 0.04 ? 0.05 : 0);
        rgb = [refl * 0.8, refl * 0.9, refl * 1.15];
        if (curtain && (fx < curtain[0] * 0.7 || fx > 1 - curtain[1] * 0.7)) rgb = rgb.map((v, c) => v + curtain[2][c] * 0.06);
      }
      s.put(i, rgb, 0.05, lit ? 0.2 : 0.95, emit);
    }
  }
  // peitoril e escorrido de chuva embaixo
  for (let px = x0 - 2; px < x1 + 2; px++) {
    for (let k = 0; k < 3; k++) { const i = s.i(px, y1 + k); s.put(i, [0.6, 0.59, 0.56], 0.85, 0.25); }
    const run = 10 + rand() * 30;
    if (rand() < 0.35) {
      for (let k = 3; k < run; k++) {
        const i = s.i(px, y1 + k);
        const f = 1 - (k / run) * 0.9;
        for (let c = 0; c < 3; c++) s.col[i * 3 + c] *= 1 - 0.28 * f;
      }
    }
  }
}

function windowCell(style, rand) {
  const lit = rand() < style.lit;
  const warm = rand() < 0.7;
  const tv = rand() < 0.12;
  const base = tv ? [0.55, 0.7, 1] : warm ? [1, 0.8, 0.52] : [0.82, 0.92, 1];
  const bright = 0.55 + rand() * 0.45;
  const curtainColors = [[0.85, 0.8, 0.7], [0.6, 0.72, 0.8], [0.8, 0.55, 0.45], [0.9, 0.9, 0.85]];
  return {
    lit,
    color: base.map((v) => v * bright),
    curtain: rand() < 0.45 ? [rand() * 0.4, rand() * 0.4, curtainColors[Math.floor(rand() * curtainColors.length)]] : null,
    blinds: style.window === 'ribbon' ? rand() < 0.5 : rand() < 0.12,
    furniture: rand() < 0.6 ? Array.from({ length: 4 }, () => rand() * 0.35) : null,
  };
}

export function facadeTextures(styleId, seed = 1) {
  const style = FACADE_STYLES[styleId];
  const rand = mulberry32(seed * 7919 + styleId.length * 131);
  const W = 512, H = 512;
  const { bays, floors } = FACADE_TILE;
  const bayPx = W / bays, floorPx = H / floors;
  const s = new LitSurface(W, H);
  const n1 = valueNoise(rand, 6, 6), n2 = valueNoise(rand, 24, 24);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const { rgb, height, spec } = wallPixel(style, s, x, y, n1, n2, rand);
      s.put(s.i(x, y), rgb, height, spec);
    }
  }
  // Laje de cada andar (faixa de concreto)
  if (style.wall !== 'metal') {
    for (let f = 0; f < floors; f++) {
      const yb = H - f * floorPx - 1;
      for (let x = 0; x < W; x++) for (let k = 0; k < 6; k++) {
        const i = s.i(x, yb - k);
        const c = style.wall === 'panel' ? 0.2 : 0.5;
        s.put(i, [c * 1.02, c, c * 0.97], 0.7, 0.1);
      }
    }
  }
  for (let f = 0; f < floors; f++) {
    const top = H - (f + 1) * floorPx; // y do topo do andar no canvas
    if (style.window === 'ribbon') {
      const cell = windowCell(style, rand);
      paintWindow(s, 2, top + 30, W - 2, top + floorPx - 34, cell, rand, { frame: 3, mullions: [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875] });
      continue;
    }
    for (let b = 0; b < bays; b++) {
      const bx = b * bayPx;
      const cell = windowCell(style, rand);
      if (style.window === 'slider') {
        paintWindow(s, bx + 10, top + 14, bx + bayPx - 10, top + floorPx - 12, cell, rand, { frame: 4, mullions: [0.5] });
      } else if (style.window === 'punched') {
        paintWindow(s, bx + 26, top + 34, bx + bayPx - 26, top + floorPx - 38, cell, rand, { frame: 3, mullions: rand() < 0.6 ? [0.5] : [] });
      } else if (style.window === 'clerestory' && f === floors - 1) {
        paintWindow(s, bx + 8, top + 20, bx + bayPx - 8, top + 52, { ...cell, curtain: null, furniture: null }, rand, { frame: 3, mullions: [0.33, 0.66] });
      }
    }
  }
  // Galpão: número pintado grande
  if (style.window === 'clerestory') {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.font = `900 96px ${JP}`;
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${1 + Math.floor(rand() * 9)}号`, 128, 66);
    const d = ctx.getImageData(0, 0, 256, 128).data;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
      if (d[(y * 256 + x) * 4 + 3] < 128) continue;
      const i = s.i(x + 128, y + 200);
      s.col[i * 3] = 0.85; s.col[i * 3 + 1] = 0.83; s.col[i * 3 + 2] = 0.78;
    }
  }
  // Sujeira geral: escurece embaixo, manchas grandes
  const grime = style.grime ?? 0.5;
  const big = valueNoise(rand, 5, 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = s.i(x, y);
    const k = 1 - grime * (0.12 * (big(x / W, y / H) > 0.6 ? 1 : 0) + 0.05 * Math.sin(x * 0.07 + y * 0.01));
    for (let c = 0; c < 3; c++) s.col[i * 3 + c] *= k;
  }
  return { ...s.all({ normalStrength: 3 }), tileW: bays * FACADE_TILE.bayW, tileH: floors * FACADE_TILE.floorH };
}

// --- Térreo: vitrines, portas de aço, letreiros e toldos ---------------------------------------------------
// Atlas 2048x512 com 8 células de 256x512 (4 m x 3,8 m cada), mapa emissivo no mesmo layout.
export const SHOP_KINDS = ['konbini', 'izakaya', 'pharmacy', 'shutter', 'lobby', 'arcade', 'dark', 'garage'];

export function shopTextures(seed = 3) {
  const rand = mulberry32(seed);
  const CW = 256, CH = 512;
  const color = document.createElement('canvas'); color.width = CW * 8; color.height = CH;
  const emit = document.createElement('canvas'); emit.width = CW * 8; emit.height = CH;
  const c = color.getContext('2d'), e = emit.getContext('2d');
  e.fillStyle = '#000'; e.fillRect(0, 0, emit.width, CH);
  const both = (fn) => { fn(c, false); fn(e, true); };
  const products = ['#d8262c', '#1f6fd1', '#f2b51c', '#2aa34a', '#f5f5f5', '#7b3fc4', '#ff7a1a', '#18a0b0'];

  SHOP_KINDS.forEach((kind, k) => {
    const x0 = k * CW;
    c.save(); e.save();
    c.beginPath(); c.rect(x0, 0, CW, CH); c.clip();
    e.beginPath(); e.rect(x0, 0, CW, CH); e.clip();
    if (kind === 'konbini' || kind === 'pharmacy' || kind === 'arcade') {
      const ceiling = kind === 'arcade' ? '#ffd0f4' : '#f4fbff';
      both((ctx, isE) => {
        const g = ctx.createLinearGradient(0, 0, 0, CH);
        g.addColorStop(0, ceiling); g.addColorStop(0.45, kind === 'arcade' ? '#b04ab8' : '#dfe8ec'); g.addColorStop(1, kind === 'arcade' ? '#3a1640' : '#9aa3a6');
        ctx.fillStyle = g; ctx.fillRect(x0, 0, CW, CH);
        // luminárias
        ctx.fillStyle = '#ffffff';
        for (let lx = 20; lx < CW; lx += 58) ctx.fillRect(x0 + lx, 24, 36, 6);
        // gôndolas com produtos
        for (let row = 0; row < 5; row++) {
          const y = 150 + row * 56;
          ctx.fillStyle = isE ? 'rgba(40,40,40,1)' : '#c9cfd2';
          ctx.fillRect(x0, y + 40, CW, 6);
          for (let px = 4; px < CW - 6; px += 9) {
            ctx.fillStyle = kind === 'arcade' ? `hsl(${Math.floor(rand() * 360)},90%,60%)` : products[Math.floor(rand() * products.length)];
            if (isE) ctx.globalAlpha = 0.75;
            ctx.fillRect(x0 + px, y + 8 + rand() * 8, 7, 32 - rand() * 8);
            ctx.globalAlpha = 1;
          }
        }
        // cartazes na vitrine
        for (let p = 0; p < 3; p++) {
          ctx.fillStyle = ['#ffe14a', '#ff5a3a', '#3ab0ff'][p];
          ctx.fillRect(x0 + 16 + p * 80, 110, 50, 34);
        }
      });
      if (kind === 'pharmacy') { c.fillStyle = '#d0141c'; c.font = `900 40px ${JP}`; c.textAlign = 'center'; c.fillText('薬', x0 + CW / 2, 90); }
    } else if (kind === 'izakaya') {
      both((ctx, isE) => {
        const g = ctx.createLinearGradient(0, 0, 0, CH);
        g.addColorStop(0, '#ffcf8a'); g.addColorStop(0.5, '#b8742e'); g.addColorStop(1, '#3a1f0e');
        ctx.fillStyle = g; ctx.fillRect(x0, 0, CW, CH);
        // balcão de madeira e bancos
        ctx.fillStyle = isE ? '#3a2410' : '#6a3f1e'; ctx.fillRect(x0, 330, CW, 60);
        for (let bx = 20; bx < CW; bx += 50) { ctx.fillStyle = isE ? '#1a0e06' : '#2a1a0c'; ctx.fillRect(x0 + bx, 390, 16, 80); }
        // garrafas na prateleira
        for (let bx = 8; bx < CW; bx += 12) { ctx.fillStyle = ['#2a6a3a', '#6a3a1a', '#d8d0b0'][Math.floor(rand() * 3)]; ctx.fillRect(x0 + bx, 200, 7, 34); }
      });
      // noren (cortina curta com kanji) na parte de cima
      for (const [ctx, isE] of [[c, false], [e, true]]) {
        ctx.fillStyle = isE ? '#200808' : '#1d2a5a';
        for (let p = 0; p < 4; p++) ctx.fillRect(x0 + 6 + p * 62, 0, 58, 120);
        ctx.fillStyle = isE ? '#402020' : '#f2efe6';
        ctx.font = `900 42px ${JP}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ['や', 'き', 'と', 'り'].forEach((ch, p) => ctx.fillText(ch, x0 + 35 + p * 62, 66));
      }
    } else if (kind === 'lobby') {
      both((ctx, isE) => {
        ctx.fillStyle = isE ? '#1a1712' : '#3a3530'; ctx.fillRect(x0, 0, CW, CH);
        const g = ctx.createRadialGradient(x0 + CW / 2, 40, 10, x0 + CW / 2, 200, 260);
        g.addColorStop(0, isE ? '#bfa98a' : '#fff0d8'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(x0, 0, CW, CH);
        // caixas de correio
        ctx.fillStyle = isE ? '#221e18' : '#8a8a84';
        for (let r = 0; r < 4; r++) for (let q = 0; q < 5; q++) ctx.fillRect(x0 + 20 + q * 22, 220 + r * 26, 18, 20);
        // piso de mármore
        ctx.fillStyle = isE ? '#2a2620' : '#c8c0b4'; ctx.fillRect(x0, 440, CW, 72);
      });
      c.fillStyle = '#2a2a2a'; c.fillRect(x0 + CW / 2 - 2, 0, 4, CH); // porta dupla
    } else if (kind === 'shutter') {
      const ribs = document.createElement('canvas');
      c.fillStyle = '#7a7a76'; c.fillRect(x0, 0, CW, CH);
      for (let y = 0; y < CH; y += 10) {
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x0, y, CW, 2);
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x0, y + 3, CW, 2);
      }
      // ferrugem, adesivos e pichação
      for (let p = 0; p < 30; p++) { c.fillStyle = `rgba(90,50,20,${0.1 + rand() * 0.2})`; c.fillRect(x0 + rand() * CW, 400 + rand() * 110, 2 + rand() * 6, 10 + rand() * 30); }
      c.save(); c.translate(x0 + CW / 2, 300); c.rotate(-0.12);
      c.strokeStyle = ['#e23a8a', '#31c7ff', '#f2d21a'][Math.floor(rand() * 3)]; c.lineWidth = 7; c.lineJoin = 'round';
      c.font = '900 64px "Arial Black", Arial, sans-serif'; c.textAlign = 'center'; c.strokeText('DRFT', 0, 0);
      c.restore();
      c.fillStyle = '#f2f2ea'; c.fillRect(x0 + 30, 140, 60, 44); c.fillStyle = '#c0141c'; c.font = `900 18px ${JP}`; c.fillText('貸店舗', x0 + 60, 168);
      void ribs;
    } else if (kind === 'dark') {
      c.fillStyle = '#0c0e12'; c.fillRect(x0, 0, CW, CH);
      const g = c.createLinearGradient(x0, 0, x0 + CW, CH);
      g.addColorStop(0, 'rgba(120,140,170,0.18)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(120,140,170,0.1)');
      c.fillStyle = g; c.fillRect(x0, 0, CW, CH);
      c.fillStyle = '#f2f2ea'; c.fillRect(x0 + 150, 200, 64, 46); c.fillStyle = '#111'; c.font = `700 16px ${JP}`; c.textAlign = 'center'; c.fillText('テナント募集', x0 + 182, 228);
    } else if (kind === 'garage') {
      both((ctx, isE) => {
        const g = ctx.createLinearGradient(0, 0, 0, CH);
        g.addColorStop(0, '#e8f2ea'); g.addColorStop(0.6, '#8a948c'); g.addColorStop(1, '#2a2e2c');
        ctx.fillStyle = g; ctx.fillRect(x0, 0, CW, CH);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + 30, 20, 190, 6);
        // carro no elevador e ferramentas
        ctx.fillStyle = isE ? '#101010' : '#1a2a4a';
        ctx.beginPath(); ctx.moveTo(x0 + 20, 380); ctx.lineTo(x0 + 60, 330); ctx.lineTo(x0 + 180, 325); ctx.lineTo(x0 + 236, 370); ctx.lineTo(x0 + 236, 410); ctx.lineTo(x0 + 20, 410); ctx.fill();
        ctx.fillStyle = isE ? '#050505' : '#0a0a0a';
        for (const wx of [60, 190]) { ctx.beginPath(); ctx.arc(x0 + wx, 410, 22, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = isE ? '#301010' : '#b3121b'; ctx.fillRect(x0 + 200, 180, 40, 90);
      });
    }
    c.restore(); e.restore();
  });
  // Luz própria mais contida que a cor (senão o interior estoura em branco no bloom)
  e.globalCompositeOperation = 'multiply';
  e.fillStyle = 'rgb(128,122,112)';
  e.fillRect(0, 0, emit.width, CH);
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = 'rgb(210,205,198)';
  c.fillRect(0, 0, color.width, CH);
  const make = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: make(color), emissiveMap: make(emit), cells: SHOP_KINDS.length };
}

// Letreiros das lojas (caixa iluminada): atlas 1024x512 com 8 placas de 512x64
export const SIGN_TEXTS = [
  ['ローズマート', '#ffffff', '#1e9c4a', '#e8562a'], ['焼き鳥 まるや', '#f2e6c8', '#3a1a0e', null], ['くすり 薬局', '#ffffff', '#c8141c', null],
  ['パーラー 銀河', '#ffe14a', '#4a0a5a', '#ff3fb4'], ['ラーメン 龍', '#ffffff', '#c01818', null], ['湾岸モータース', '#ffffff', '#0f2f6b', '#ffd21a'],
  ['喫茶 港', '#3a2410', '#f0e2c0', null], ['ハッピー24', '#ffffff', '#1f6fd1', '#f2b51c'],
];
export function signTextures() {
  const W = 1024, H = 512, SH = 64;
  const draw = (isE) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    SIGN_TEXTS.forEach(([text, fg, bg, stripe], k) => {
      const y = k * SH;
      ctx.fillStyle = bg; ctx.fillRect(0, y, W / 2, SH);
      if (stripe) { ctx.fillStyle = stripe; ctx.fillRect(0, y + SH - 12, W / 2, 6); }
      const g = ctx.createLinearGradient(0, y, 0, y + SH);
      g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(0.5, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, y, W / 2, SH);
      ctx.fillStyle = fg; ctx.font = `900 40px ${JP}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, W / 4, y + SH / 2 - 2, W / 2 - 30);
      if (isE) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, y, W / 2, SH); }
    });
    // metade direita: toldos listrados (4 cores) e laterais escuras
    const awn = [['#b3121b', '#f2efe6'], ['#1e6a3a', '#f2efe6'], ['#1d3f7a', '#f2efe6'], ['#c77a12', '#3a2410']];
    awn.forEach(([a, b], k) => {
      const y = k * 128;
      for (let x = 0; x < W / 2; x += 32) { ctx.fillStyle = (x / 32) % 2 ? b : a; ctx.fillRect(W / 2 + x, y, 32, 128); }
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(W / 2, y + 100, W / 2, 28);
      if (isE) { ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(W / 2, y, W / 2, 128); }
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: draw(false), emissiveMap: draw(true), signH: SH / H };
}

// --- Mureta de concreto envelhecida (3 m x 0,9 m) ---------------------------------------------------------
export function barrierTextures(seed = 17) {
  const rand = mulberry32(seed);
  const W = 512, H = 160;
  const s = new Surface(W, H);
  const stain = valueNoise(rand, 8, 3), grain = valueNoise(rand, 64, 20);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = s.i(x, y);
      const fy = y / H; // 0 = topo
      let g = 0.55 + (stain(x / W, fy) - 0.5) * 0.18 + (grain(x / W, fy) - 0.5) * 0.08 + (rand() - 0.5) * 0.04;
      let height = 0.5 + (rand() - 0.5) * 0.15;
      // borda chanfrada em cima, sujeira de lama e musgo embaixo
      if (y < 6) { g += 0.08; height = 0.7 - y * 0.05; }
      const mud = Math.max(0, fy - 0.7) / 0.3;
      g -= mud * 0.22;
      let tint = [1, 0.99, 0.96];
      if (fy > 0.9 && stain(x / W * 3, 0.5) > 0.55) tint = [0.8, 0.95, 0.7];
      // juntas de dilatação a cada 3 m e furos de forma
      if (x % W < 3) { g *= 0.55; height = 0.2; }
      if ((x % 128 - 64) ** 2 + (y - 50) ** 2 < 5) { g *= 0.5; height = 0.15; }
      s.setGray(i, g, tint);
      s.height[i] = height;
      s.spec[i] = 0.1 + mud * 0.15;
    }
  }
  // escorridos de ferrugem e riscos de pneu
  for (let k = 0; k < 6; k++) {
    const x0 = Math.floor(rand() * W), len = 20 + rand() * 60;
    for (let y = 8; y < len; y++) for (let dx = 0; dx < 2; dx++) {
      const i = s.i(x0 + dx + Math.floor(y / 20), y);
      s.col[i * 3] *= 0.85; s.col[i * 3 + 1] *= 0.72; s.col[i * 3 + 2] *= 0.6;
    }
  }
  for (let k = 0; k < 5; k++) {
    const x0 = rand() * W, y0 = 70 + rand() * 60, len = 40 + rand() * 120;
    for (let t = 0; t < len; t++) {
      const i = s.i(Math.floor(x0 + t), Math.floor(y0 + Math.sin(t * 0.05) * 3));
      for (let c = 0; c < 3; c++) s.col[i * 3 + c] *= 0.35;
    }
  }
  return s.textures({ normalStrength: 2 });
}

// --- Telhado: manta asfáltica com emendas e poças ----------------------------------------------------------
export function roofTextures(seed = 23) {
  const rand = mulberry32(seed);
  const W = 256, H = 256;
  const s = new Surface(W, H);
  const n = valueNoise(rand, 8, 8);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = s.i(x, y);
    let g = 0.2 + (n(x / W, y / H) - 0.5) * 0.08 + (rand() - 0.5) * 0.05;
    let h = 0.5, sp = 0.1;
    if (y % 64 < 2) { g += 0.06; h = 0.8; }
    if (n(x / W * 2, y / H * 2) > 0.72) { g *= 0.7; h = 0.3; sp = 0.8; } // poça
    s.setGray(i, g, [1, 1, 1.02]);
    s.height[i] = h; s.spec[i] = sp;
  }
  return s.textures({ normalStrength: 1.5 });
}

// --- Grelha do ventilador do ar-condicionado (frente da caixa) ----------------------------------------------
export function acTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b9bbb6'; ctx.fillRect(0, 0, 128, 96);
  ctx.fillStyle = '#2a2b2c'; ctx.beginPath(); ctx.arc(46, 48, 36, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a8c88'; ctx.lineWidth = 2;
  for (let r = 8; r < 36; r += 6) { ctx.beginPath(); ctx.arc(46, 48, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(10, 48); ctx.lineTo(82, 48); ctx.moveTo(46, 12); ctx.lineTo(46, 84); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 10; y < 90; y += 5) ctx.fillRect(92, y, 28, 2);
  ctx.fillStyle = 'rgba(60,40,20,0.3)'; ctx.fillRect(0, 84, 128, 12);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// --- Folhagem (cachos de folhas com transparência) ------------------------------------------------------------
export function foliageTexture(seed = 29) {
  const rand = mulberry32(seed);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 110;
    const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r * 0.85;
    const shade = 0.35 + rand() * 0.45 - (y / 256) * 0.2;
    ctx.fillStyle = `rgb(${Math.floor(40 * shade)},${Math.floor(110 * shade)},${Math.floor(45 * shade)})`;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rand() * Math.PI);
    ctx.beginPath(); ctx.ellipse(0, 0, 5 + rand() * 4, 2.5 + rand() * 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// --- Contêiner: lateral ondulada com logo, portas nos fundos ---------------------------------------------------
// Atlas 512x256: metade esquerda = lateral (UV da caixa nas faces ±X e topo), direita = portas (±Z).
export function containerTextures(seed = 41) {
  const rand = mulberry32(seed);
  const W = 512, H = 256;
  const s = new Surface(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = s.i(x, y);
    const side = x < W / 2;
    let g = 0.85 + (rand() - 0.5) * 0.06;
    let h = 0.5;
    if (side) {
      const rib = Math.sin((x / 9) * Math.PI * 2);
      h = 0.5 + rib * 0.4; g *= 0.9 + rib * 0.08;
    } else {
      // portas com barras de trava verticais
      const lx = x - W / 2;
      if (Math.abs(lx - W / 4) < 2) g *= 0.4;
      for (const bx of [36, 70, 186, 220]) if (Math.abs(lx - bx) < 3) { g *= 0.7; h = 0.9; }
      const rib = Math.sin((y / 12) * Math.PI * 2); h += rib * 0.2;
    }
    if (y < 6 || y > H - 7 || x % (W / 2) < 5) { g *= 0.75; h = 0.9; } // longarinas
    // ferrugem nas bordas
    if ((y > H - 20 || y < 14) && rand() < 0.3) g *= 0.8;
    s.setGray(i, g, [1, 1, 1]);
    s.height[i] = h; s.spec[i] = 0.25;
  }
  const tex = s.textures({ normalStrength: 2.5 });
  // Logos fictícios pintados na lateral (em cima da cor multiplicada por instância)
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(tex.map.image, 0, 0);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#f4f4f0';
  ctx.font = '900 46px "Arial Black", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(['KAIYO', 'ZETA LINE', 'MINATO', 'OCEANEX'][Math.floor(rand() * 4)], W / 4, H / 2);
  ctx.font = '700 16px Arial, sans-serif';
  ctx.fillText('KYLU 418270 3', W * 0.75, 30);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  tex.map.dispose();
  return { ...tex, map };
}

// --- Base de pedra escura do térreo (pilares e faixas) --------------------------------------------------------
export function stoneTextures(seed = 61) {
  const rand = mulberry32(seed);
  const W = 256, H = 256;
  const s = new Surface(W, H);
  const n = valueNoise(rand, 16, 16);
  const tiles = new Map();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = s.i(x, y);
    const tx = Math.floor(x / 64), ty = Math.floor(y / 32);
    const key = tx * 100 + ty;
    if (!tiles.has(key)) tiles.set(key, 0.16 + rand() * 0.06);
    const joint = x % 64 < 2 || y % 32 < 2;
    const speck = rand() < 0.04 ? 0.08 : 0;
    const g = joint ? 0.07 : tiles.get(key) + (n(x / W, y / H) - 0.5) * 0.06 + speck;
    s.setGray(i, g, [1, 0.97, 0.95]);
    s.height[i] = joint ? 0.2 : 0.6;
    s.spec[i] = joint ? 0.1 : 0.55;
  }
  return s.textures({ normalStrength: 2 });
}

// --- Guarda-corpo da varanda: painel de vidro fosco com moldura e corrimão (alpha nos vãos) -------------------
export function railingTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 96);
  ctx.fillStyle = 'rgba(150,160,170,0.75)'; ctx.fillRect(0, 14, 256, 70);        // vidro fosco
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (let x = 0; x < 256; x += 20) ctx.fillRect(x, 14, 8, 70);
  ctx.fillStyle = '#6a6c70'; ctx.fillRect(0, 0, 256, 10); ctx.fillRect(0, 84, 256, 12); // corrimão e base
  for (let x = 0; x < 256; x += 64) ctx.fillRect(x, 0, 6, 96);                   // montantes
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// --- Poste de concreto: grão vertical, faixa zebrada amarela/preta e plaqueta ----------------------------------
export function poleTexture(seed = 71) {
  const rand = mulberry32(seed);
  const c = document.createElement('canvas');
  c.width = 64; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8d8c87'; ctx.fillRect(0, 0, 64, 512);
  for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(${rand() < 0.5 ? '0,0,0' : '255,255,255'},${rand() * 0.08})`; ctx.fillRect(rand() * 64, rand() * 512, 1, 4 + rand() * 20); }
  const g = ctx.createLinearGradient(0, 380, 0, 512);
  g.addColorStop(0, 'rgba(30,25,20,0)'); g.addColorStop(1, 'rgba(30,25,20,0.45)');
  ctx.fillStyle = g; ctx.fillRect(0, 380, 64, 132);
  // faixa zebrada (v 0..1 = 0..10 m; canvas de cima para baixo) entre 1,6 e 2,4 m
  for (let y = 512 - 124; y < 512 - 82; y += 8) { ctx.fillStyle = (y / 8) % 2 < 1 ? '#e8c21a' : '#151515'; ctx.fillRect(0, y, 64, 8); }
  ctx.fillStyle = '#e8e8e0'; ctx.fillRect(18, 512 - 150, 28, 16);
  ctx.fillStyle = '#1a3a8a'; ctx.font = '700 9px Arial'; ctx.fillText('湾岸12', 20, 512 - 139);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// --- Tampa de bueiro e grelha de sarjeta ----------------------------------------------------------------------
export function manholeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = '#2a2a2b'; ctx.beginPath(); ctx.arc(64, 64, 62, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4a4a4a'; ctx.lineWidth = 3;
  for (let r = 14; r < 60; r += 12) { ctx.beginPath(); ctx.arc(64, 64, r, 0, Math.PI * 2); ctx.stroke(); }
  for (let a = 0; a < 12; a++) { const an = (a / 12) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64 + Math.cos(an) * 60, 64 + Math.sin(an) * 60); ctx.stroke(); }
  ctx.fillStyle = '#5a5a58'; ctx.font = '900 18px "Yu Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('下水', 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function grateTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1c1c1d'; ctx.fillRect(0, 0, 64, 32);
  ctx.fillStyle = '#050505'; for (let x = 4; x < 62; x += 6) ctx.fillRect(x, 4, 3, 24);
  ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 62, 30);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
