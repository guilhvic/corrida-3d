// Chuva na GPU, em volta da câmera:
// - pingos: riscos instanciados na direção da queda, expandidos em espaço de tela com borda suave (sem serrilhado);
//   os distantes ficam mais fracos em vez de mais grossos, como um pingo de verdade sub-pixel;
// - respingos: anéis que abrem e somem no chão, em posições fixas no mundo;
// - cortinas: cilindros ao longe com névoa de chuva e faixas caindo (dão profundidade e apagam os prédios distantes).
// Nada é atualizado na CPU além do relógio.
import * as THREE from 'three';

const DROP_VERTEX = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime, uRadius, uHeight, uSpeed, uStreak, uDropWidth, uMinPx, uFocal;
  uniform vec2 uWind, uResolution;
  uniform vec3 uCam;
  varying float vAcross, vAlong, vAlpha;
  void main() {
    float size = uRadius * 2.0;
    float speed = uSpeed * (0.8 + 0.4 * aSeed.w);
    vec3 vel = vec3(uWind.x, -speed, uWind.y);
    vec3 p = vec3(aSeed.x * size + uWind.x * uTime, 0.0, aSeed.z * size + uWind.y * uTime);
    p.x = mod(p.x - uCam.x + uRadius, size) - uRadius + uCam.x;
    p.z = mod(p.z - uCam.z + uRadius, size) - uRadius + uCam.z;
    p.y = uCam.y - uHeight * 0.4 + mod(aSeed.y * uHeight - speed * uTime, uHeight);
    vec3 tail = p - vel * uStreak;

    vec4 c0 = projectionMatrix * viewMatrix * vec4(p, 1.0);
    vec4 c1 = projectionMatrix * viewMatrix * vec4(tail, 1.0);
    if (c0.w < 0.3 || c1.w < 0.3 || p.y < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vAlpha = 0.0; return; }
    vec2 s0 = c0.xy / c0.w * uResolution, s1 = c1.xy / c1.w * uResolution;
    vec2 d = s1 - s0;
    float len = length(d);
    vec2 n = len > 1e-3 ? vec2(-d.y, d.x) / len : vec2(1.0, 0.0);

    // Largura física do pingo em pixels; abaixo do mínimo desenha com o mínimo e apaga proporcionalmente.
    float dist = length(p - uCam);
    float physPx = uDropWidth * uFocal / dist;
    float px = max(physPx, uMinPx);
    vec4 c = mix(c0, c1, position.y);
    c.xy += n * position.x * px / uResolution * c.w;
    gl_Position = c;

    vAcross = position.x;
    vAlong = position.y;
    float nearFade = smoothstep(0.8, 3.0, dist), farFade = 1.0 - smoothstep(uRadius * 0.55, uRadius, dist);
    vAlpha = clamp(physPx / px, 0.12, 1.0) * nearFade * farFade * (0.6 + 0.4 * aSeed.w);
  }`;

const DROP_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAcross, vAlong, vAlpha;
  void main() {
    float across = 1.0 - abs(vAcross);
    across *= across;
    float along = smoothstep(0.0, 0.12, vAlong) * (1.0 - smoothstep(0.35, 1.0, vAlong)); // mais forte perto da ponta
    float a = across * along * vAlpha * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
  }`;

const SPLASH_VERTEX = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime, uRadius, uRate;
  uniform vec3 uCam;
  varying vec2 vLocal;
  varying float vLife;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    float cycle = uTime * uRate * (0.7 + 0.6 * aSeed.w) + aSeed.y * 10.0;
    float id = floor(cycle);
    vLife = fract(cycle);
    float size = uRadius * 2.0;
    vec3 p = vec3(fract(aSeed.x + hash(id * 1.37 + aSeed.w * 91.0)) * size, 0.045, fract(aSeed.z + hash(id * 2.11 + aSeed.x * 57.0)) * size);
    p.x = mod(p.x - uCam.x + uRadius, size) - uRadius + uCam.x;
    p.z = mod(p.z - uCam.z + uRadius, size) - uRadius + uCam.z;
    float r = 0.02 + vLife * 0.13;
    vLocal = position.xz;
    gl_Position = projectionMatrix * viewMatrix * vec4(p + vec3(position.x * r, 0.0, position.z * r), 1.0);
  }`;

const SPLASH_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vLocal;
  varying float vLife;
  void main() {
    float d = length(vLocal);
    float ring = smoothstep(0.55, 0.85, d) * (1.0 - smoothstep(0.85, 1.0, d));
    float a = ring * (1.0 - vLife) * (1.0 - vLife) * 0.22;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
  }`;

const CURTAIN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const CURTAIN_FRAGMENT = /* glsl */ `
  uniform float uTime, uHaze, uStreaks, uColumns;
  uniform vec3 uColor;
  varying vec2 vUv;
  float h(float n) { return fract(sin(n) * 43758.5453); }
  float layer(float columns, float rows, float speed, float seed) {
    float x = vUv.x * columns, col = floor(x);
    float y = vUv.y * rows + uTime * speed * (0.7 + 0.6 * h(col + seed)) + h(col * 1.7 + seed) * 10.0;
    float seg = fract(y);
    float on = step(0.45, h(col * 3.1 + floor(y) * 7.3 + seed));
    float across = 1.0 - abs(fract(x) - 0.5) * 2.0;
    return on * across * across * smoothstep(0.0, 0.1, seg) * (1.0 - smoothstep(0.1, 0.7, seg));
  }
  void main() {
    float streaks = layer(uColumns, 18.0, 2.6, 0.0) * 0.6 + layer(uColumns * 2.3, 30.0, 3.4, 5.0) * 0.4;
    float haze = uHaze * (1.0 - smoothstep(0.45, 1.0, vUv.y));
    float a = clamp(haze + streaks * uStreaks * (1.0 - smoothstep(0.3, 1.0, vUv.y)), 0.0, 0.97);
    gl_FragColor = vec4(uColor + vec3(0.03, 0.035, 0.045) * streaks, a);
  }`;

export class Rain {
  // hazeColor: cor da névoa de chuva ao longe (deve combinar com a neblina da cena)
  constructor(parent, { count = 9000, radius = 26, height = 22, speed = 26, wind = [2.4, 1.0], color = 0xaebdd0, hazeColor = new THREE.Color(0.018, 0.022, 0.032), splashes = 900 } = {}) {
    this.time = 0;
    this.resolution = new THREE.Vector2(960, 540);
    const camPos = new THREE.Vector3();
    const shared = { uTime: { value: 0 }, uCam: { value: camPos }, uRadius: { value: radius } };
    this.shared = shared;

    // Pingos
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    quad.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds(count), 4));
    quad.instanceCount = count;
    this.dropUniforms = {
      ...shared, uHeight: { value: height }, uSpeed: { value: speed }, uStreak: { value: 0.05 }, uWind: { value: new THREE.Vector2(...wind) },
      uDropWidth: { value: 0.0045 }, uMinPx: { value: 1.6 }, uFocal: { value: 450 }, uResolution: { value: new THREE.Vector2(480, 270) },
      uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.6 },
    };
    this.drops = new THREE.Mesh(quad, new THREE.ShaderMaterial({
      vertexShader: DROP_VERTEX, fragmentShader: DROP_FRAGMENT, uniforms: this.dropUniforms, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, // a fita é montada em espaço de tela: o sentido dos triângulos varia
    }));
    this.drops.frustumCulled = false;
    this.drops.renderOrder = 5;
    this.drops.userData.dynamic = true;
    // A resolução e a distância focal vêm do alvo em que a cena está sendo desenhada (tela interna ou cubo do reflexo).
    this.drops.onBeforeRender = (renderer, _scene, camera) => {
      const target = renderer.getRenderTarget();
      if (target) this.dropUniforms.uResolution.value.set(target.width / 2, target.height / 2);
      else { renderer.getDrawingBufferSize(this.dropUniforms.uResolution.value); this.dropUniforms.uResolution.value.multiplyScalar(0.5); }
      this.dropUniforms.uFocal.value = this.dropUniforms.uResolution.value.y / Math.tan(THREE.MathUtils.degToRad((camera.fov ?? 90) / 2));
      camPos.setFromMatrixPosition(camera.matrixWorld);
    };
    parent.add(this.drops);

    // Respingos no chão (disco deitado: position.xz de -1 a 1)
    const disc = new THREE.InstancedBufferGeometry();
    disc.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], 3));
    disc.setIndex([0, 2, 1, 0, 3, 2]);
    disc.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds(splashes), 4));
    disc.instanceCount = splashes;
    this.splash = new THREE.Mesh(disc, new THREE.ShaderMaterial({
      vertexShader: SPLASH_VERTEX, fragmentShader: SPLASH_FRAGMENT, transparent: true, depthWrite: false,
      uniforms: { ...shared, uRadius: { value: 16 }, uRate: { value: 3.2 }, uColor: { value: new THREE.Color(color).multiplyScalar(1.2) } },
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
    }));
    this.splash.frustumCulled = false;
    this.splash.userData.dynamic = true;
    parent.add(this.splash);

    // Cortinas de chuva: perto (só faixas) e longe (névoa densa que apaga o horizonte de prédios)
    this.curtains = [[70, 0.08, 0.2, 700, 90], [210, 0.9, 0.3, 1100, 300]].map(([r, haze, streaks, columns, h]) => {
      const geo = new THREE.CylinderGeometry(r, r, h, 72, 1, true);
      geo.translate(0, h / 2 - 6, 0);
      const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        vertexShader: CURTAIN_VERTEX, fragmentShader: CURTAIN_FRAGMENT, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uTime: shared.uTime, uHaze: { value: haze }, uStreaks: { value: streaks }, uColumns: { value: columns }, uColor: { value: hazeColor } },
      }));
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      mesh.userData.dynamic = true;
      parent.add(mesh);
      return mesh;
    });
  }

  update(dt, camera) {
    this.time += dt;
    this.shared.uTime.value = this.time;
    if (!camera) return;
    this.shared.uCam.value.copy(camera.position);
    for (const c of this.curtains) c.position.set(camera.position.x, 0, camera.position.z);
  }
}

function seeds(n) {
  const a = new Float32Array(n * 4);
  for (let i = 0; i < a.length; i++) a[i] = Math.random();
  return a;
}
