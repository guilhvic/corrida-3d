// Pós-processamento "era PS2": cena em ~540 linhas, bloom, rastro de quadros anteriores (motion blur por
// feedback), desfoque de movimento (radial com a velocidade e na direção em que a câmera gira) e pontilhado de cor. A última passada roda na resolução da tela para o efeito CRT
// (scanlines leves, grade de fósforo, curvatura e aberração cromática) ficar nítido.
import * as THREE from 'three';

const INTERNAL_HEIGHT = 540; // PS2 tardio (jogos em 480p/entrelaçado com mais nitidez)

const quadVertex = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// Um único pixel NaN/Inf vira um quadrado preto no bloom e fica preso no rastro: descarta antes de usar.
const SAFE = 'vec3 safeColor(vec3 v){ if (any(isnan(v)) || any(isinf(v))) return vec3(0.0); return clamp(v, 0.0, 64.0); }';

const brightPass = `
  uniform sampler2D tInput; uniform float threshold; varying vec2 vUv;
  ${SAFE}
  void main(){
    vec3 c = safeColor(texture2D(tInput, vUv).rgb);
    float l = max(c.r, max(c.g, c.b));
    gl_FragColor = vec4(c * smoothstep(threshold, threshold + 0.6, l), 1.0);
  }`;

const blur = `
  uniform sampler2D tInput; uniform vec2 direction; varying vec2 vUv;
  void main(){
    vec3 sum = texture2D(tInput, vUv).rgb * 0.227;
    sum += texture2D(tInput, vUv + direction * 1.385).rgb * 0.316;
    sum += texture2D(tInput, vUv - direction * 1.385).rgb * 0.316;
    sum += texture2D(tInput, vUv + direction * 3.23).rgb * 0.07;
    sum += texture2D(tInput, vUv - direction * 3.23).rgb * 0.07;
    gl_FragColor = vec4(sum, 1.0);
  }`;

// radial: quanto a imagem "estica" a partir do centro (velocidade); shift: quanto a cena andou na tela durante a
// exposição (câmera girando ou tremendo). O centro da tela fica nítido; as bordas borram mais.
const composite = `
  uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tPrev;
  uniform float bloomStrength; uniform float trail; uniform float radial; uniform vec2 shift; uniform vec2 center;
  varying vec2 vUv;
  ${SAFE}
  void main(){
    vec2 d = vUv - center;
    vec2 v = d * radial * smoothstep(0.08, 0.55, length(d)) + shift;
    vec3 base;
    if (dot(v, v) > 1e-7) {
      base = vec3(0.0);
      for (int i = 0; i < 10; i++) base += safeColor(texture2D(tScene, vUv - v * (float(i) / 9.0 - 0.5)).rgb);
      base *= 0.1;
    } else base = safeColor(texture2D(tScene, vUv).rgb);
    vec3 c = base + safeColor(texture2D(tBloom, vUv).rgb) * bloomStrength;
    vec3 prev = safeColor(texture2D(tPrev, vUv).rgb);
    gl_FragColor = vec4(mix(c, prev, trail), 1.0);
  }`;

const output = `
  uniform sampler2D tInput; uniform vec2 resolution; uniform vec2 sourceSize; uniform float crt; varying vec2 vUv;
  vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  float bayer4(vec2 p){
    int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
    int i = x + y * 4;
    int m[16]; m[0]=0; m[1]=8; m[2]=2; m[3]=10; m[4]=12; m[5]=4; m[6]=14; m[7]=6;
    m[8]=3; m[9]=11; m[10]=1; m[11]=9; m[12]=15; m[13]=7; m[14]=13; m[15]=5;
    return float(m[i]) / 16.0;
  }
  void main(){
    vec2 uv = vUv;
    float edge = 1.0;
    if (crt > 0.5) {
      // Tela levemente abaulada (barril), com cantos arredondados escurecendo.
      vec2 cc = uv - 0.5;
      uv = 0.5 + cc * (1.0 + dot(cc, cc) * 0.12) / 1.03;
      vec2 corner = abs(uv - 0.5) * 2.0;
      float r = length(max(corner - vec2(0.94), 0.0)) / 0.06;
      edge = 1.0 - smoothstep(0.7, 1.0, r);
      if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    }

    vec3 src;
    if (crt > 0.5) {
      vec2 shift = (uv - 0.5) * 0.0022; // aberração cromática crescendo para as bordas
      src = vec3(texture2D(tInput, uv + shift).r, texture2D(tInput, uv).g, texture2D(tInput, uv - shift).b);
    } else src = texture2D(tInput, uv).rgb;

    vec3 c = aces(src * 1.1);
    c = pow(c, vec3(1.0 / 2.2));
    // Saturação levemente puxada, como as TVs de tubo.
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(l), c, 1.06);
    // Vinheta
    vec2 d = uv - 0.5;
    c *= 1.0 - dot(d, d) * 0.6;

    if (crt > 0.5) {
      // Scanlines leves: ~300 linhas; em cada período o primeiro terço dos pixels escurece.
      // (Discreto de propósito: uma senoide com período de 2 px amostra o mesmo valor em todas as linhas.)
      // Partes claras "vazam" sobre a linha escura, como no tubo.
      float period = max(3.0, floor(resolution.y / 300.0));
      float row = mod(floor(gl_FragCoord.y), period);
      float scan = row < max(1.0, floor(period / 3.0)) ? 1.0 : 0.0;
      c *= (1.0 - scan * (0.2 - 0.08 * l)) * 1.06;
      // Grade de abertura RGB bem sutil
      float m = mod(floor(gl_FragCoord.x), 3.0);
      c *= vec3(m < 0.5 ? 1.0 : 0.95, m > 0.5 && m < 1.5 ? 1.0 : 0.95, m > 1.5 ? 1.0 : 0.95) * 1.035;
      c *= edge;
    }

    // Profundidade de cor reduzida com pontilhado ordenado, no tamanho do pixel interno (framebuffer de 16 bits)
    float levels = 96.0;
    vec2 srcPixel = floor(gl_FragCoord.xy * sourceSize / resolution);
    c = floor(c * levels + bayer4(srcPixel)) / levels;
    gl_FragColor = vec4(c, 1.0);
  }`;

export class PS2Pipeline {
  constructor(renderer) {
    this.renderer = renderer;
    const opts = { type: THREE.HalfFloatType, depthBuffer: false };
    this.sceneTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.bloomA = new THREE.WebGLRenderTarget(1, 1, opts);
    this.bloomB = new THREE.WebGLRenderTarget(1, 1, opts);
    this.history = [new THREE.WebGLRenderTarget(1, 1, opts), new THREE.WebGLRenderTarget(1, 1, opts)];
    this.frame = 0;

    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    const make = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ vertexShader: quadVertex, fragmentShader, uniforms, depthTest: false, depthWrite: false });
    this.brightMat = make(brightPass, { tInput: { value: null }, threshold: { value: 1.1 } });
    this.blurMat = make(blur, { tInput: { value: null }, direction: { value: new THREE.Vector2() } });
    this.compositeMat = make(composite, {
      tScene: { value: null }, tBloom: { value: null }, tPrev: { value: null },
      bloomStrength: { value: 0.55 }, trail: { value: 0.2 },
      radial: { value: 0 }, shift: { value: new THREE.Vector2() }, center: { value: new THREE.Vector2(0.5, 0.52) },
    });
    this.outputMat = make(output, {
      tInput: { value: null }, resolution: { value: new THREE.Vector2() }, sourceSize: { value: new THREE.Vector2() }, crt: { value: 1 },
    });
    this.internalHeight = 1;
    this.targetHeight = INTERNAL_HEIGHT; // 0 = resolução nativa
  }

  set crt(on) { this.outputMat.uniforms.crt.value = on ? 1 : 0; }
  get crt() { return this.outputMat.uniforms.crt.value > 0.5; }

  // A cena roda em altura interna fixa; só a passada final (CRT) usa a resolução real do canvas.
  setSize(width, height) {
    const ih = this.targetHeight ? Math.min(this.targetHeight, height) : height;
    const iw = Math.round(ih * (width / height));
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.internalHeight = ih;
    this.sceneTarget.setSize(iw, ih);
    for (const t of this.history) t.setSize(iw, ih);
    const bw = Math.max(1, Math.round(iw / 3)), bh = Math.max(1, Math.round(ih / 3));
    this.bloomA.setSize(bw, bh);
    this.bloomB.setSize(bw, bh);
    this.renderer.getDrawingBufferSize(this.outputMat.uniforms.resolution.value);
    this.outputMat.uniforms.sourceSize.value.set(iw, ih);
    return { width: iw, height: ih };
  }

  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  // trail: 0..1 quanto do quadro anterior fica na imagem. radial e shift: desfoque de movimento (0 = desligado).
  render(scene, camera, { trail = 0.2, radial = 0, shift = null } = {}) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneTarget);
    r.render(scene, camera);

    this.brightMat.uniforms.tInput.value = this.sceneTarget.texture;
    this.pass(this.brightMat, this.bloomA);
    for (let i = 0; i < 2; i++) {
      this.blurMat.uniforms.tInput.value = this.bloomA.texture;
      this.blurMat.uniforms.direction.value.set(1 / this.bloomA.width, 0);
      this.pass(this.blurMat, this.bloomB);
      this.blurMat.uniforms.tInput.value = this.bloomB.texture;
      this.blurMat.uniforms.direction.value.set(0, 1 / this.bloomA.height);
      this.pass(this.blurMat, this.bloomA);
    }

    const prev = this.history[this.frame % 2], next = this.history[(this.frame + 1) % 2];
    const u = this.compositeMat.uniforms;
    u.tScene.value = this.sceneTarget.texture;
    u.tBloom.value = this.bloomA.texture;
    u.tPrev.value = prev.texture;
    u.trail.value = this.frame === 0 ? 0 : trail;
    u.radial.value = radial;
    if (shift) u.shift.value.copy(shift); else u.shift.value.set(0, 0);
    this.pass(this.compositeMat, next);

    this.outputMat.uniforms.tInput.value = next.texture;
    this.pass(this.outputMat, null);
    this.frame++;
  }
}
