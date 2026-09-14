// Partículas em GPU: fumaça de pneu (THREE.Points) e faíscas de metal (riscos aditivos + cabeça brilhante).
// As faíscas saem em leque na batida e em jato contínuo ao raspar na mureta; quicam no chão e esfriam
// de branco-amarelo para laranja e vermelho.
import * as THREE from 'three';

const MAX = 2500;
const SPARK_MAX = 1200;
const STREAK = 0.03; // s de "rastro" de cada faísca (comprimento do risco = velocidade × STREAK)

const vertexShader = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  uniform float uNearFade;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
    // Fumaça some perto da câmera para não tapar a visão de quem vem atrás.
    vAlpha = aAlpha * mix(1.0, smoothstep(3.0, 12.0, -mv.z), uNearFade);
    vColor = aColor;
  }
`;

const fragmentShader = `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0;
    float a = smoothstep(1.0, 0.35, d) * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

const lineVertex = `
  attribute vec4 aColor;
  varying vec4 vColor;
  void main() {
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const lineFragment = `
  varying vec4 vColor;
  void main() {
    if (vColor.a < 0.003) discard;
    gl_FragColor = vec4(vColor.rgb * vColor.a, 1.0);
  }
`;

const HOT = new THREE.Color(3.2, 2.6, 1.5), WARM = new THREE.Color(2.6, 1.1, 0.25), COLD = new THREE.Color(0.9, 0.18, 0.04);

export class Particles {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.color = new Float32Array(MAX * 3);
    this.age = new Float32Array(MAX);
    this.life = new Float32Array(MAX).fill(-1);
    this.floor = new Float32Array(MAX);
    this.cursor = 0;

    const attr = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', attr(this.pos, 3));
    geo.setAttribute('aSize', attr(this.size, 1));
    geo.setAttribute('aAlpha', attr(this.alpha, 1));
    geo.setAttribute('aColor', attr(this.color, 3));
    this.geo = geo;
    this.material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, transparent: true, depthWrite: false,
      uniforms: { uScale: { value: 400 }, uNearFade: { value: 1 } },
    });
    const points = new THREE.Points(geo, this.material);
    points.frustumCulled = false;
    points.renderOrder = 3;
    scene.add(points);

    // Faíscas
    this.sPos = new Float32Array(SPARK_MAX * 3);
    this.sVel = new Float32Array(SPARK_MAX * 3);
    this.sAge = new Float32Array(SPARK_MAX);
    this.sLife = new Float32Array(SPARK_MAX).fill(-1);
    this.sFloor = new Float32Array(SPARK_MAX);
    this.sCursor = 0;
    this.sHeadPos = new Float32Array(SPARK_MAX * 3);
    this.sHeadSize = new Float32Array(SPARK_MAX);
    this.sHeadAlpha = new Float32Array(SPARK_MAX);
    this.sHeadColor = new Float32Array(SPARK_MAX * 3);
    const heads = new THREE.BufferGeometry();
    heads.setAttribute('position', attr(this.sHeadPos, 3));
    heads.setAttribute('aSize', attr(this.sHeadSize, 1));
    heads.setAttribute('aAlpha', attr(this.sHeadAlpha, 1));
    heads.setAttribute('aColor', attr(this.sHeadColor, 3));
    this.headGeo = heads;
    this.headMaterial = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uScale: this.material.uniforms.uScale, uNearFade: { value: 0 } },
    });
    const headPoints = new THREE.Points(heads, this.headMaterial);
    headPoints.frustumCulled = false;
    headPoints.renderOrder = 4;
    scene.add(headPoints);

    this.lineBuf = new Float32Array(SPARK_MAX * 2 * 3);
    this.lineCol = new Float32Array(SPARK_MAX * 2 * 4);
    const lines = new THREE.BufferGeometry();
    lines.setAttribute('position', attr(this.lineBuf, 3));
    lines.setAttribute('aColor', attr(this.lineCol, 4));
    this.lineGeo = lines;
    const streaks = new THREE.LineSegments(lines, new THREE.ShaderMaterial({
      vertexShader: lineVertex, fragmentShader: lineFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    streaks.frustumCulled = false;
    streaks.renderOrder = 4;
    scene.add(streaks);
    this.sparkLevel = 0; // quantas faíscas nasceram no último quadro (luz do raspão no main.js)
  }

  spawn(x, y, z, vx, vy, vz, life, size, r, g, b, floor = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.color.set([r, g, b], i * 3);
    this.age[i] = 0;
    this.life[i] = life;
    this.size[i] = size;
    this.floor[i] = floor;
  }

  // Fumaça: herda parte da velocidade do carro e sobe devagar. y: altura do chão.
  smoke(x, z, carVx, carVz, intensity, y = 0) {
    const shade = 0.45 + Math.random() * 0.1; // à noite a fumaça só aparece iluminada pelos postes
    this.spawn(
      x + (Math.random() - 0.5) * 0.4, y + 0.35, z + (Math.random() - 0.5) * 0.4,
      carVx * 0.25 + (Math.random() - 0.5) * 1.5, 0.5 + Math.random() * 0.8, carVz * 0.25 + (Math.random() - 0.5) * 1.5,
      1.0 + Math.random() * 0.8 * intensity, 0.8 + intensity * 0.45, shade, shade, shade, y);
  }

  spark(x, y, z, vx, vy, vz, life, floor) {
    const i = this.sCursor;
    this.sCursor = (this.sCursor + 1) % SPARK_MAX;
    this.sPos[i * 3] = x; this.sPos[i * 3 + 1] = y; this.sPos[i * 3 + 2] = z;
    this.sVel[i * 3] = vx; this.sVel[i * 3 + 1] = vy; this.sVel[i * 3 + 2] = vz;
    this.sAge[i] = 0;
    this.sLife[i] = life;
    this.sFloor[i] = floor;
    this.sparkLevel++;
  }

  // Leque de faíscas numa batida: sai pela normal da parede (nx, nz) com força proporcional ao impacto.
  // carVx/carVz: velocidade do carro (as faíscas herdam parte dela).
  sparks(x, z, nx, nz, strength, y = 0, carVx = 0, carVz = 0) {
    const n = Math.min(60, 10 + strength * 5);
    for (let k = 0; k < n; k++) {
      const s = 2.5 + Math.random() * (2 + strength * 1.2);
      this.spark(
        x, y + 0.3 + Math.random() * 0.4, z,
        carVx * 0.6 + nx * s + (Math.random() - 0.5) * s * 1.4, 0.8 + Math.random() * 3.5, carVz * 0.6 + nz * s + (Math.random() - 0.5) * s * 1.4,
        0.35 + Math.random() * 0.5, y);
    }
  }

  // Raspão contínuo na mureta: jato de faíscas para trás do contato, na direção em que o carro anda.
  grind(x, z, nx, nz, carVx, carVz, dt, y = 0) {
    const speed = Math.hypot(carVx, carVz);
    if (speed < 4) return;
    const count = dt * speed * 7;
    for (let k = Math.floor(count + Math.random()); k > 0; k--) {
      const keep = 0.55 + Math.random() * 0.35; // a faísca sai mais devagar que o carro, "fica para trás"
      this.spark(
        x + (Math.random() - 0.5) * 0.6, y + 0.25 + Math.random() * 0.35, z + (Math.random() - 0.5) * 0.6,
        carVx * keep + nx * (1 + Math.random() * 2.5) + (Math.random() - 0.5) * 2, 0.5 + Math.random() * 2.5, carVz * keep + nz * (1 + Math.random() * 2.5) + (Math.random() - 0.5) * 2,
        0.25 + Math.random() * 0.45, y);
    }
  }

  // viewportHeight: altura em pixels do alvo onde as partículas são desenhadas (a resolução interna).
  update(dt, camera, viewportHeight) {
    this.material.uniforms.uScale.value = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] < 0) continue;
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      if (t >= 1) { this.life[i] = -1; this.alpha[i] = 0; continue; }
      const o = i * 3;
      const drag = Math.exp(-dt * 1.6);
      this.vel[o] *= drag; this.vel[o + 2] *= drag; this.vel[o + 1] *= Math.exp(-dt * 0.8);
      this.size[i] += dt * 2.2;
      this.alpha[i] = 0.1 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.4);
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] = Math.max(this.floor[i] + 0.05, this.pos[o + 1] + this.vel[o + 1] * dt);
      this.pos[o + 2] += this.vel[o + 2] * dt;
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = a.aColor.needsUpdate = true;

    const c = new THREE.Color();
    const L = this.lineBuf, LC = this.lineCol;
    for (let i = 0; i < SPARK_MAX; i++) {
      const o = i * 3, lo = i * 6, co = i * 8;
      if (this.sLife[i] < 0) { this.sHeadAlpha[i] = 0; LC[co + 3] = LC[co + 7] = 0; continue; }
      this.sAge[i] += dt;
      const t = this.sAge[i] / this.sLife[i];
      if (t >= 1) { this.sLife[i] = -1; this.sHeadAlpha[i] = 0; LC[co + 3] = LC[co + 7] = 0; continue; }
      const v = this.sVel;
      v[o + 1] -= 9.81 * dt;
      const drag = Math.exp(-dt * 1.2);
      v[o] *= drag; v[o + 2] *= drag;
      const p = this.sPos;
      p[o] += v[o] * dt; p[o + 1] += v[o + 1] * dt; p[o + 2] += v[o + 2] * dt;
      if (p[o + 1] < this.sFloor[i] + 0.02 && v[o + 1] < 0) {
        // Quica no asfalto perdendo energia
        p[o + 1] = this.sFloor[i] + 0.02;
        v[o + 1] *= -0.35; v[o] *= 0.75; v[o + 2] *= 0.75;
      }
      if (t < 0.35) c.copy(HOT).lerp(WARM, t / 0.35); else c.copy(WARM).lerp(COLD, (t - 0.35) / 0.65);
      const fade = 1 - t * t;
      this.sHeadPos[o] = p[o]; this.sHeadPos[o + 1] = p[o + 1]; this.sHeadPos[o + 2] = p[o + 2];
      this.sHeadSize[i] = 0.05 + 0.05 * (1 - t);
      this.sHeadAlpha[i] = fade;
      this.sHeadColor[o] = c.r; this.sHeadColor[o + 1] = c.g; this.sHeadColor[o + 2] = c.b;
      L[lo] = p[o]; L[lo + 1] = p[o + 1]; L[lo + 2] = p[o + 2];
      L[lo + 3] = p[o] - v[o] * STREAK; L[lo + 4] = p[o + 1] - v[o + 1] * STREAK; L[lo + 5] = p[o + 2] - v[o + 2] * STREAK;
      LC[co] = c.r; LC[co + 1] = c.g; LC[co + 2] = c.b; LC[co + 3] = fade;
      LC[co + 4] = c.r * 0.6; LC[co + 5] = c.g * 0.4; LC[co + 6] = c.b * 0.3; LC[co + 7] = 0;
    }
    const h = this.headGeo.attributes;
    h.position.needsUpdate = h.aSize.needsUpdate = h.aAlpha.needsUpdate = h.aColor.needsUpdate = true;
    this.lineGeo.attributes.position.needsUpdate = this.lineGeo.attributes.aColor.needsUpdate = true;
  }
}
