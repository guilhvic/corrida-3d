// Partículas em GPU (THREE.Points): fumaça de pneu e faíscas de batida.
import * as THREE from 'three';

const MAX = 2500;

const vertexShader = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
    // Some perto da câmera para a fumaça não tapar a visão de quem vem atrás.
    vAlpha = aAlpha * smoothstep(3.0, 12.0, -mv.z);
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

export class Particles {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.color = new Float32Array(MAX * 3);
    this.age = new Float32Array(MAX);
    this.life = new Float32Array(MAX).fill(-1);
    this.kind = new Uint8Array(MAX); // 0 fumaça, 1 faísca
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    const attr = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', attr(this.pos, 3));
    geo.setAttribute('aSize', attr(this.size, 1));
    geo.setAttribute('aAlpha', attr(this.alpha, 1));
    geo.setAttribute('aColor', attr(this.color, 3));
    this.geo = geo;

    this.material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, transparent: true, depthWrite: false,
      uniforms: { uScale: { value: 400 } },
    });
    const points = new THREE.Points(geo, this.material);
    points.frustumCulled = false;
    points.renderOrder = 3;
    scene.add(points);
  }

  spawn(kind, x, y, z, vx, vy, vz, life, size, r, g, b) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    this.kind[i] = kind;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.color.set([r, g, b], i * 3);
    this.age[i] = 0;
    this.life[i] = life;
    this.size[i] = size;
  }

  // Fumaça: herda parte da velocidade do carro e sobe devagar.
  smoke(x, z, carVx, carVz, intensity) {
    const shade = 0.45 + Math.random() * 0.1; // à noite a fumaça só aparece iluminada pelos postes
    this.spawn(0,
      x + (Math.random() - 0.5) * 0.4, 0.35, z + (Math.random() - 0.5) * 0.4,
      carVx * 0.25 + (Math.random() - 0.5) * 1.5, 0.5 + Math.random() * 0.8, carVz * 0.25 + (Math.random() - 0.5) * 1.5,
      1.0 + Math.random() * 0.8 * intensity, 0.8 + intensity * 0.45, shade, shade, shade);
  }

  sparks(x, z, nx, nz, strength) {
    const n = Math.min(40, 6 + strength * 3);
    for (let k = 0; k < n; k++) {
      const s = 3 + Math.random() * strength * 0.8;
      this.spawn(1,
        x, 0.4 + Math.random() * 0.4, z,
        nx * s + (Math.random() - 0.5) * s, 1 + Math.random() * 3, nz * s + (Math.random() - 0.5) * s,
        0.25 + Math.random() * 0.35, 0.12 + Math.random() * 0.1, 1, 0.65 + Math.random() * 0.25, 0.25);
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
      if (this.kind[i] === 0) {
        const drag = Math.exp(-dt * 1.6);
        this.vel[o] *= drag; this.vel[o + 2] *= drag; this.vel[o + 1] *= Math.exp(-dt * 0.8);
        this.size[i] += dt * 2.2;
        this.alpha[i] = 0.1 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.4);
      } else {
        this.vel[o + 1] -= 9.81 * dt;
        this.alpha[i] = 1 - t;
      }
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] = Math.max(0.05, this.pos[o + 1] + this.vel[o + 1] * dt);
      this.pos[o + 2] += this.vel[o + 2] * dt;
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = a.aColor.needsUpdate = true;
  }
}
