// Rastro de luz das lanternas traseiras enquanto o combo de drift está valendo.
// Duas fitas voltadas para a câmera, aditivas e em HDR (pegam o bloom), com a cor do multiplicador:
// verde no x1, âmbar, vermelho e rosa no x5. Somar o combo dá um clarão dourado; perder, um vermelho.
import * as THREE from 'three';
import { DRIFT } from './drift.js';

const MAX_POINTS = 80;     // por fita
const LIFE = 0.8;          // s que um ponto leva para sumir
const SPACING = 0.3;       // m entre pontos gravados
const WIDTH = 0.2;         // meia largura na ponta mais nova
const PALETTE = [          // [multiplicador, cor]
  [1, new THREE.Color(0.24, 1, 0.77)],
  [2, new THREE.Color(1, 0.69, 0.23)],
  [3.5, new THREE.Color(1, 0.25, 0.12)],
  [5, new THREE.Color(1, 0.2, 0.75)],
];
const FLASH = { bank: new THREE.Color(1, 0.85, 0.4), lost: new THREE.Color(1, 0.08, 0.05) };

const vertexShader = /* glsl */ `
  attribute vec4 aColor;
  attribute float aEdge;
  varying vec4 vColor;
  varying float vEdge;
  void main() {
    vColor = aColor;
    vEdge = aEdge;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }`;

const fragmentShader = /* glsl */ `
  varying vec4 vColor;
  varying float vEdge;
  void main() {
    float e = 1.0 - abs(vEdge);
    float glow = e * e;
    float core = pow(e, 9.0);
    vec3 c = vColor.rgb * (glow * 1.2 + core * 0.9) + vec3(1.0, 0.95, 0.9) * core * 0.3;
    gl_FragColor = vec4(c * vColor.a, 1.0);
  }`;

function multColor(mult, out) {
  for (let i = 1; i < PALETTE.length; i++) {
    const [m0, c0] = PALETTE[i - 1], [m1, c1] = PALETTE[i];
    if (mult <= m1 || i === PALETTE.length - 1) return out.copy(c0).lerp(c1, THREE.MathUtils.clamp((mult - m0) / (m1 - m0), 0, 1));
  }
  return out;
}

export class DriftTrail {
  constructor(scene) {
    this.ribbons = [[], []]; // pontos { x, y, z, t, a, r, g, b }
    this.time = 0;
    this.strength = 0;
    this.color = new THREE.Color();
    this.flashColor = new THREE.Color();
    this.flashTime = 0;
    this.emitting = false;
    this.enabled = true;

    const verts = MAX_POINTS * 2 * 2;
    this.positions = new Float32Array(verts * 3);
    this.colors = new Float32Array(verts * 4);
    const edges = new Float32Array(verts);
    const index = [];
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < MAX_POINTS; i++) {
        const v = (r * MAX_POINTS + i) * 2;
        edges[v] = -1; edges[v + 1] = 1;
        if (i < MAX_POINTS - 1) index.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aEdge', new THREE.BufferAttribute(edges, 1));
    geo.setIndex(index);
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      vertexShader, fragmentShader, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    scene.add(this.mesh);
  }

  // null = cor do multiplicador; [r, g, b] = cor fixa; 'rainbow' = arco-íris girando
  setColor(color) {
    this.custom = color || null;
  }

  clear() {
    this.ribbons = [[], []];
    this.strength = 0;
    this.flashTime = 0;
    this.emitting = false;
  }

  // kind: 'bank' (combo somado) ou 'lost' (combo perdido)
  flash(kind) {
    this.flashColor.copy(FLASH[kind]);
    this.flashTime = kind === 'bank' ? 0.45 : 0.35;
  }

  // tailLights: posições [x, y, z] das lanternas no referencial do carro.
  update(dt, car, tailLights, scorer, camera) {
    this.mesh.visible = this.enabled;
    if (!this.enabled) return;
    this.time += dt;
    const now = this.time;

    // Intensidade: cresce com o ângulo, esmaece durante a folga antes de somar o combo.
    let target = 0;
    if (scorer.active) {
      const angle = THREE.MathUtils.clamp((scorer.angle - DRIFT.minAngle * 0.6) / 25, 0, 1);
      target = Math.max(0.35, angle) * (1 - THREE.MathUtils.clamp(scorer.idle / DRIFT.grace, 0, 1) * 0.8);
    }
    this.strength += (target - this.strength) * (1 - Math.exp(-dt * 10));
    if (this.custom === 'rainbow') this.color.setHSL((now * 0.35) % 1, 1, 0.55);
    else if (this.custom) this.color.setRGB(...this.custom);
    else multColor(scorer.mult, this.color);
    let flash = 0;
    if (this.flashTime > 0) {
      flash = this.flashTime / 0.45;
      this.flashTime = Math.max(0, this.flashTime - dt);
    }
    const alpha = Math.min(1.4, this.strength + flash);
    const color = this.color.clone().lerp(this.flashColor, Math.min(1, flash * 1.5));

    const sin = Math.sin(car.yaw), cos = Math.cos(car.yaw);
    const emit = alpha > 0.03 && car.speed > 2;
    tailLights.forEach(([lx, ly, lz], r) => {
      const pts = this.ribbons[r];
      const x = car.x + cos * lx + sin * lz, z = car.z - sin * lx + cos * lz, y = ly + 0.03;
      const last = pts[pts.length - 1];
      if (last && Math.hypot(last.x - x, last.z - z) > 6) pts.length = 0; // carro teleportado (R, grid)
      if (emit) {
        // Recomeço depois de uma pausa: ponto invisível para não ligar ao rastro antigo.
        if (!this.emitting && pts.length) pts.push({ x, y, z, t: now, a: 0, r: 0, g: 0, b: 0 });
        const head = { x, y, z, t: now, a: alpha, r: color.r, g: color.g, b: color.b };
        const prev = pts[pts.length - 2];
        if (last && prev && this.emitting && Math.hypot(prev.x - x, prev.z - z) < SPACING) pts[pts.length - 1] = head;
        else pts.push(head);
      } else if (this.emitting && last) {
        pts.push({ x, y, z, t: now, a: 0, r: 0, g: 0, b: 0 });
      }
      while (pts.length && now - pts[0].t > LIFE) pts.shift();
      while (pts.length > MAX_POINTS) pts.shift();
    });
    this.emitting = emit;
    this.build(camera);
  }

  build(camera) {
    const P = this.positions, C = this.colors, now = this.time;
    const cam = camera.position;
    for (let r = 0; r < 2; r++) {
      const pts = this.ribbons[r];
      const base = r * MAX_POINTS;
      for (let i = 0; i < MAX_POINTS; i++) {
        const v = (base + i) * 2;
        const p = pts[Math.min(i, pts.length - 1)];
        if (!p) {
          for (let k = 0; k < 6; k++) P[v * 3 + k] = 0;
          C[v * 4 + 3] = C[(v + 1) * 4 + 3] = 0;
          continue;
        }
        const a = pts[Math.max(0, Math.min(i, pts.length - 1) - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) < 1e-5) { dx = 1; dy = 0; dz = 0; }
        // Largura perpendicular ao rastro e à linha de visão
        const vx = cam.x - p.x, vy = cam.y - p.y, vz = cam.z - p.z;
        let sx = dy * vz - dz * vy, sy = dz * vx - dx * vz, sz = dx * vy - dy * vx;
        const sl = Math.hypot(sx, sy, sz) || 1;
        const age = Math.min(1, (now - p.t) / LIFE);
        const fade = i >= pts.length ? 0 : (1 - age) ** 1.6;
        const w = WIDTH * (0.3 + 0.7 * (1 - age)) * (0.7 + 0.3 * Math.min(1, p.a));
        sx = (sx / sl) * w; sy = (sy / sl) * w; sz = (sz / sl) * w;
        P[v * 3] = p.x - sx; P[v * 3 + 1] = p.y - sy; P[v * 3 + 2] = p.z - sz;
        P[v * 3 + 3] = p.x + sx; P[v * 3 + 4] = p.y + sy; P[v * 3 + 5] = p.z + sz;
        for (const k of [v, v + 1]) {
          C[k * 4] = p.r * 1.7; C[k * 4 + 1] = p.g * 1.7; C[k * 4 + 2] = p.b * 1.7; C[k * 4 + 3] = p.a * fade;
        }
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
  }
}
