// Materiais dos carros: pintura com verniz (clearcoat), vidro que reflete mais de lado (Fresnel),
// cromados, plásticos e borrachas; e o shader comum de danos (amassados e riscos) com os vãos de
// portas/capô/tampas desenhados na própria pintura (linhas em coordenadas do carro, antisserrilhadas).
import * as THREE from 'three';

export const MAX_LINES = { side: 48, top: 32, end: 24 };
export const MAX_HITS = 6; // amassados localizados: onde bateu, para que lado e quão fundo
export const MAX_TORN = 5; // painéis arrancados (capô, para-choques, portas): caixas no referencial do carro

// Tintas: sólida, metálica e perolizada
export function paintMaterial({ color, finish = 'solid', envMap = null, vertexColors = false }) {
  const metallic = finish === 'metallic';
  const pearl = finish === 'pearl';
  return new THREE.MeshPhysicalMaterial({
    color,
    vertexColors,
    metalness: metallic ? 0.55 : pearl ? 0.2 : 0.02,
    roughness: metallic ? 0.34 : pearl ? 0.3 : 0.4,
    clearcoat: 1,
    clearcoatRoughness: 0.045,
    sheen: pearl ? 0.6 : 0,
    sheenColor: new THREE.Color(0xd8e4ff),
    sheenRoughness: 0.5,
    envMap,
    envMapIntensity: 1,
  });
}

export function glassMaterial(envMap, { tint = 0x0a0d10, opacity = 0.42 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color: tint, metalness: 0, roughness: 0.04, envMap, envMapIntensity: 1.5,
    transparent: true, opacity, depthWrite: false, specularIntensity: 1,
  });
  m.userData.fresnelGlass = true;
  return m;
}

export const chromeMaterial = (envMap) => new THREE.MeshStandardMaterial({ color: 0xe2e5ea, metalness: 1, roughness: 0.1, envMap });
export const blackTrimMaterial = (envMap) => new THREE.MeshStandardMaterial({ color: 0x0d0d0f, metalness: 0, roughness: 0.5, envMap, envMapIntensity: 0.6 });
export const satinBlackMaterial = (envMap) => new THREE.MeshStandardMaterial({ color: 0x161618, metalness: 0.3, roughness: 0.38, envMap, envMapIntensity: 0.8 });
export const rubberMaterial = () => new THREE.MeshStandardMaterial({ color: 0x0a0a0b, metalness: 0, roughness: 0.92 });

export function rimMaterial(color, envMap) {
  const c = new THREE.Color(color);
  const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  // Muito escura (preto fosco) ou muito clara (branca): pintura; o resto é liga metálica
  const painted = l < 0.03 || (l > 0.7 && Math.abs(c.r - c.b) < 0.05 && c.r < 0.92);
  return new THREE.MeshStandardMaterial({
    color, envMap,
    metalness: painted ? 0.15 : 0.9,
    roughness: l < 0.03 ? 0.55 : painted ? 0.35 : 0.26,
  });
}

// Lâmpada acesa (cor HDR para o bloom do pós-processamento)
export const glowMaterial = (color) => new THREE.MeshBasicMaterial({ color });

// --- Shader: danos + vãos + Fresnel -------------------------------------------------------------------
const DAMAGE_VERTEX = /* glsl */ `
  vec3 dmgP = transformed;
  vObjN = normal;
  float dmgLow = 1.0 - smoothstep(0.55, 0.9, dmgP.y);
  float dmgFront = smoothstep(uCarZ.y - 0.6, uCarZ.y, dmgP.z) * dmgLow;
  float dmgRear = smoothstep(uCarZ.x + 0.6, uCarZ.x, dmgP.z) * dmgLow;
  float dmgN = 0.55 + 0.45 * sin(dmgP.x * 23.0 + dmgP.y * 17.0) * sin(dmgP.z * 11.0 + dmgP.x * 5.0);
  transformed.z -= uDent.x * dmgFront * 0.17 * dmgN;
  transformed.z += uDent.y * dmgRear * 0.15 * dmgN;
  transformed.y -= (uDent.x * dmgFront + uDent.y * dmgRear) * 0.035 * dmgN * smoothstep(0.0, 0.3, abs(dmgP.x));
  float dmgBand = smoothstep(0.25, 0.4, dmgP.y) * (1.0 - smoothstep(0.85, 1.0, dmgP.y));
  float dmgAlong = 0.6 + 0.4 * sin(dmgP.z * 3.1 + 1.0);
  transformed.x -= uDent.z * smoothstep(0.45, 0.8, dmgP.x) * dmgBand * 0.075 * dmgN * dmgAlong;
  transformed.x += uDent.w * smoothstep(-0.45, -0.8, dmgP.x) * dmgBand * 0.075 * dmgN * dmgAlong;
  // Amassados no ponto da batida: cada impacto afunda a lataria em volta de onde encostou, na direção
  // em que veio, com a borda enrugada (a chapa não afunda lisa). Só no carro do jogador (CAR_LOCAL_DAMAGE):
  // nos rivais esses laços ficam fora do shader.
  vDmgHit = 0.0;
  #ifdef CAR_LOCAL_DAMAGE
  float hitSum = 0.0;
  for (int h = 0; h < ${MAX_HITS}; h++) {
    float radius = uHitPos[h].w;
    if (radius <= 0.0) continue;
    vec3 rel = dmgP - uHitPos[h].xyz;
    float d = length(rel) / radius;
    if (d >= 1.0) continue;
    float fall = 1.0 - d * d;
    float wrinkle = 0.75 + 0.25 * sin(dmgP.x * 41.0 + dmgP.z * 29.0 + float(h));
    transformed += uHitDir[h].xyz * (uHitDir[h].w * fall * fall * wrinkle);
    hitSum += fall * uHitDir[h].w * 3.0;
  }
  vDmgHit = clamp(hitSum, 0.0, 1.0);
  // Painel arrancado: o que fica por baixo (estrutura, cofre do motor) afunda uns centímetros.
  for (int k = 0; k < ${MAX_TORN}; k++) {
    if (uTornMax[k].w <= 0.0) continue;
    if (all(greaterThanEqual(dmgP, uTornMin[k].xyz)) && all(lessThanEqual(dmgP, uTornMax[k].xyz))) {
      transformed -= normal * 0.045;
    }
  }
  #endif
  vDmgPos = dmgP;
`;

const SCRATCH_FRAGMENT = /* glsl */ `
  {
    float dmgSide = vDmgPos.x > 0.0 ? uScratch.x : uScratch.y;
    float dmgBandF = smoothstep(0.3, 0.42, vDmgPos.y) * (1.0 - smoothstep(0.82, 0.95, vDmgPos.y)) * smoothstep(0.5, 0.72, abs(vDmgPos.x));
    vec2 cell = vec2(vDmgPos.z * 2.2, vDmgPos.y * 38.0);
    float seed = fract(sin(dot(floor(cell), vec2(127.1, 311.7))) * 43758.5453);
    float thin = step(0.42, fract(cell.y)) * step(fract(cell.y), 0.6);
    float gaps = step(0.18, fract(cell.x + seed * 5.0)) * step(fract(vDmgPos.z * 31.0 + seed * 9.0), 0.85);
    float streak = step(1.0 - dmgSide * 0.38, seed) * thin * gaps;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.66, 0.64, 0.6), streak * dmgBandF * 0.9);
    float dmgLowF = 1.0 - smoothstep(0.55, 0.9, vDmgPos.y);
    float dmgEnds = uDent.x * smoothstep(uCarZ.y - 0.5, uCarZ.y, vDmgPos.z) + uDent.y * smoothstep(uCarZ.x + 0.5, uCarZ.x, vDmgPos.z);
    float crack = step(0.82, fract(sin(dot(floor(vDmgPos.xy * 40.0 + vDmgPos.z * 13.0), vec2(12.9898, 78.233))) * 43758.5453));
    diffuseColor.rgb *= 1.0 - clamp(dmgEnds * dmgLowF, 0.0, 1.0) * (0.25 + 0.35 * crack);
    #ifdef CAR_LOCAL_DAMAGE
    // Chapa afundada perde verniz: fica fosca, escura e com a pintura estalada.
    diffuseColor.rgb *= 1.0 - vDmgHit * (0.3 + 0.4 * crack);
    // Onde um painel foi arrancado. Modo (w): 1 = para-choque (sobra a estrutura, escura e crua),
    // 2 = capô (a pele de cima some e aparece o motor), 3 = porta (a pele lateral some e aparece o interior).
    for (int k = 0; k < ${MAX_TORN}; k++) {
      float tornMode = uTornMax[k].w;
      if (tornMode <= 0.0) continue;
      if (all(greaterThanEqual(vDmgPos, uTornMin[k].xyz)) && all(lessThanEqual(vDmgPos, uTornMax[k].xyz))) {
        vec3 tornN = normalize(vObjN);
        if (tornMode > 1.5 && tornMode < 2.5 && tornN.y > 0.45) discard;
        if (tornMode > 2.5 && abs(tornN.x) > 0.45) discard;
        diffuseColor.rgb = mix(vec3(0.035, 0.034, 0.033), vec3(0.16, 0.09, 0.05), crack * 0.5);
      }
    }
    #endif
  }
`;

// Vãos: segmentos 2D em três projeções (lateral z/y, topo |x|/z, frente-trás |x|/y) escolhidas pela normal.
const LINES_COMMON = /* glsl */ `
  uniform vec4 uLineSide[${MAX_LINES.side}];
  uniform vec4 uLineTop[${MAX_LINES.top}];
  uniform vec4 uLineEnd[${MAX_LINES.end}];
  uniform vec3 uLineCount;
  float carSeg(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
    return length(pa - ba * h);
  }
  float carGap(vec3 P, vec3 N) {
    vec3 an = abs(N);
    float aa = max(length(fwidth(P)), 0.0006);
    float gap = 1.0;
    const float W = 0.0024;
    if (an.x > 0.25) {
      vec2 q = vec2(P.z, P.y);
      float d = 1.0;
      for (int i = 0; i < ${MAX_LINES.side}; i++) { if (float(i) >= uLineCount.x) break; d = min(d, carSeg(q, uLineSide[i].xy, uLineSide[i].zw)); }
      gap = min(gap, mix(1.0, smoothstep(W, W + aa, d), smoothstep(0.25, 0.45, an.x)));
    }
    if (an.y > 0.25) {
      vec2 q = vec2(abs(P.x), P.z);
      float d = 1.0;
      for (int i = 0; i < ${MAX_LINES.top}; i++) { if (float(i) >= uLineCount.y) break; d = min(d, carSeg(q, uLineTop[i].xy, uLineTop[i].zw)); }
      gap = min(gap, mix(1.0, smoothstep(W, W + aa, d), smoothstep(0.25, 0.45, an.y)));
    }
    if (an.z > 0.25) {
      // x negativo codifica a traseira (z < 0)
      vec2 q = vec2(abs(P.x) * sign(P.z + 1e-4), P.y);
      float d = 1.0;
      for (int i = 0; i < ${MAX_LINES.end}; i++) { if (float(i) >= uLineCount.z) break; d = min(d, carSeg(q, uLineEnd[i].xy, uLineEnd[i].zw)); }
      gap = min(gap, mix(1.0, smoothstep(W, W + aa, d), smoothstep(0.25, 0.45, an.z)));
    }
    return gap;
  }
`;

// Uniformes dos vãos a partir de { side: [[z0,y0,z1,y1]...], top: [[x0,z0,x1,z1]...], end: [[x0,y0,x1,y1]...] }
// Polilinhas ([[a,b],[c,d],...]) viram segmentos. Na lista end, x negativo = traseira.
export function lineUniforms(lines = {}) {
  const pack = (list = [], max) => {
    const segs = [];
    for (const item of list) {
      if (Array.isArray(item[0])) for (let i = 0; i < item.length - 1; i++) segs.push([...item[i], ...item[i + 1]]);
      else segs.push(item);
    }
    if (segs.length > max) console.warn(`carro: ${segs.length} vãos (máx. ${max})`);
    const arr = Array.from({ length: max }, (_, i) => new THREE.Vector4(...(segs[i] || [0, 0, 0, 0])));
    return { arr, n: Math.min(max, segs.length) };
  };
  const side = pack(lines.side, MAX_LINES.side), top = pack(lines.top, MAX_LINES.top), end = pack(lines.end, MAX_LINES.end);
  return {
    uLineSide: { value: side.arr }, uLineTop: { value: top.arr }, uLineEnd: { value: end.arr },
    uLineCount: { value: new THREE.Vector3(side.n, top.n, end.n) },
  };
}

// Aplica danos (todos), vãos (pintura da carroceria) e Fresnel (vidros) no shader do material.
// local: amassados no ponto e painéis arrancados (só o carro do jogador compila esses trechos).
export function patchCarMaterial(material, uniforms, { scratches = false, gaps = false, local = false } = {}) {
  if (!material || material.isShaderMaterial || material.userData.carPatched) return;
  material.userData.carPatched = true;
  const glass = !!material.userData.fresnelGlass;
  if (local) material.defines = { ...material.defines, CAR_LOCAL_DAMAGE: '' };
  // O three reaproveita programas pelo texto do onBeforeCompile, que é o mesmo para todos: a chave precisa
  // dizer quais trechos entraram, senão dois materiais diferentes dividem o mesmo shader.
  material.customProgramCacheKey = () => `car-${scratches ? 1 : 0}${gaps ? 1 : 0}${glass ? 1 : 0}${local ? 1 : 0}`;
  material.onBeforeCompile = function (shader, renderer) {
    THREE.Material.prototype.onBeforeCompile.call(this, shader, renderer); // névoa do jogo
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform vec4 uDent;\nuniform vec2 uCarZ;\nuniform vec4 uHitPos[${MAX_HITS}];\nuniform vec4 uHitDir[${MAX_HITS}];\nuniform vec4 uTornMin[${MAX_TORN}];\nuniform vec4 uTornMax[${MAX_TORN}];\nvarying vec3 vDmgPos;\nvarying vec3 vObjN;\nvarying float vDmgHit;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${DAMAGE_VERTEX}`);
    let head = `#include <common>\nuniform vec4 uDent;\nuniform vec2 uCarZ;\nuniform vec2 uScratch;\nuniform vec4 uTornMin[${MAX_TORN}];\nuniform vec4 uTornMax[${MAX_TORN}];\nvarying vec3 vDmgPos;\nvarying vec3 vObjN;\nvarying float vDmgHit;`;
    if (gaps) head += LINES_COMMON;
    let frag = shader.fragmentShader.replace('#include <common>', head);
    if (scratches || gaps) {
      frag = frag.replace('#include <color_fragment>', `#include <color_fragment>\n${scratches ? SCRATCH_FRAGMENT : ''}\n${gaps ? 'float carGapM = carGap(vDmgPos, normalize(vObjN));' : ''}`);
    }
    if (gaps) frag = frag.replace('#include <opaque_fragment>', 'outgoingLight *= mix(0.12, 1.0, carGapM);\n#include <opaque_fragment>');
    if (glass) {
      frag = frag.replace('#include <opaque_fragment>', `
        float carFres = pow(1.0 - clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0), 3.0);
        diffuseColor.a = mix(diffuseColor.a, 0.96, carFres);
        #include <opaque_fragment>`);
    }
    shader.fragmentShader = frag;
  };
  material.customProgramCacheKey = () => `carro|${scratches ? 's' : ''}${gaps ? 'g' : ''}${glass ? 'v' : ''}`;
  material.needsUpdate = true;
}
