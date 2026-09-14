// Neblina noturna: névoa rasteira 3D (densidade cai com a altura, com manchas de ruído que andam)
// aplicada em todos os materiais com fog, e cones de luz volumétricos para postes e faróis.
import * as THREE from 'three';

// uMistColor: cor da névoa rasteira (cada mapa define a sua; a da cidade é mais clara e quente que o céu).
export const fogUniforms = {
  uFogTime: { value: 0 }, uMistAmount: { value: 1 }, uMistColor: { value: new THREE.Color(0.065, 0.047, 0.065) },
  uMistDensity: { value: 0.034 }, uMistFalloff: { value: 0.34 },
};

export const MIST = {
  density: 0.034,   // por metro, no nível do chão
  falloff: 0.34,    // quão rápido a névoa rarefaz com a altura (1/m)
  maxDistance: 170, // a névoa distante já é coberta pela neblina exponencial da cena
};

// Troca os trechos de neblina do three.js. Precisa rodar antes de qualquer material ser compilado.
export function installMist() {
  THREE.ShaderChunk.fog_pars_vertex = /* glsl */ `
    #ifdef USE_FOG
      varying float vFogDepth;
      varying vec3 vFogWorldPos;
    #endif`;

  // Posição no mundo a partir de mvPosition (existe em malhas, instâncias, sprites, pontos e linhas).
  THREE.ShaderChunk.fog_vertex = /* glsl */ `
    #ifdef USE_FOG
      vFogDepth = - mvPosition.z;
      vFogWorldPos = transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz);
    #endif`;

  THREE.ShaderChunk.fog_pars_fragment = /* glsl */ `
    #ifdef USE_FOG
      uniform vec3 fogColor;
      uniform float uFogTime;
      uniform float uMistAmount;
      uniform vec3 uMistColor;
      uniform float uMistDensity;
      uniform float uMistFalloff;
      varying float vFogDepth;
      varying vec3 vFogWorldPos;
      #ifdef FOG_EXP2
        uniform float fogDensity;
      #else
        uniform float fogNear;
        uniform float fogFar;
      #endif
      float mistHash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float mistNoise(vec3 x) {
        vec3 i = floor(x), f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(mistHash(i), mistHash(i + vec3(1, 0, 0)), f.x), mix(mistHash(i + vec3(0, 1, 0)), mistHash(i + vec3(1, 1, 0)), f.x), f.y),
          mix(mix(mistHash(i + vec3(0, 0, 1)), mistHash(i + vec3(1, 0, 1)), f.x), mix(mistHash(i + vec3(0, 1, 1)), mistHash(i + vec3(1, 1, 1)), f.x), f.y),
          f.z);
      }
    #endif`;

  THREE.ShaderChunk.fog_fragment = /* glsl */ `
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp(- fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      #endif

      // Densidade exp(-falloff * altura) integrada do olho até o fragmento (fórmula fechada).
      if (uMistAmount > 0.0) {
      vec3 mistRay = vFogWorldPos - cameraPosition;
      float mistDist = min(length(mistRay), ${MIST.maxDistance.toFixed(1)});
      float h0 = max(cameraPosition.y, 0.0), h1 = max(vFogWorldPos.y, 0.0), dh = h1 - h0;
      float FALLOFF = uMistFalloff;
      float heightTerm = abs(dh) > 0.01
        ? (exp(-FALLOFF * h0) - exp(-FALLOFF * h1)) / (FALLOFF * dh)
        : exp(-FALLOFF * h0);

      // Manchas: ruído 3D esticado na horizontal, derivando com o vento.
      vec3 np = vFogWorldPos * vec3(0.05, 0.16, 0.05) + vec3(uFogTime * 0.035, uFogTime * 0.01, uFogTime * 0.015);
      float patches = mistNoise(np) * 0.65 + mistNoise(np * 2.7 + 3.1) * 0.35;
      float mist = 1.0 - exp(-uMistDensity * mistDist * heightTerm * (0.25 + 1.5 * patches));

      gl_FragColor.rgb = mix(gl_FragColor.rgb, uMistColor, clamp(mist, 0.0, 0.9) * uMistAmount);
      }
      gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
    #endif`;

  // Todo material recebe o relógio da névoa (uniform ausente no shader é simplesmente ignorado).
  THREE.Material.prototype.onBeforeCompile = function (shader) {
    shader.uniforms.uFogTime = fogUniforms.uFogTime;
    shader.uniforms.uMistAmount = fogUniforms.uMistAmount;
    shader.uniforms.uMistColor = fogUniforms.uMistColor;
    shader.uniforms.uMistDensity = fogUniforms.uMistDensity;
    shader.uniforms.uMistFalloff = fogUniforms.uMistFalloff;
  };
}

// Cone aditivo que "acende" a névoa: forte perto da lâmpada, some nas bordas e na ponta larga.
// A geometria deve ter uv.y = 1 na ponta estreita (topo de um CylinderGeometry).
// coreWeight 1: o cone brilha mais visto de lado (postes); menor: aparece também visto de frente (faróis).
export function lightConeMaterial(color, strength, coreWeight = 1) {
  return new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) }, strength: { value: strength }, coreWeight: { value: coreWeight },
      uTime: fogUniforms.uFogTime, uMistAmount: fogUniforms.uMistAmount,
    },
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      void main() {
        vAlong = uv.y;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float strength;
      uniform float coreWeight;
      uniform float uTime;
      uniform float uMistAmount;
      varying float vAlong;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      void main() {
        // Cuidado com NaN: a interpolação pode deixar vAlong levemente negativo, e pow(negativo, 1.7) é NaN.
        vec3 toCamera = cameraPosition - vWorld;
        vec3 view = toCamera / max(length(toCamera), 1e-4);
        vec3 nrm = vNormalW / max(length(vNormalW), 1e-4);
        float facing = abs(dot(nrm, view));
        float core = mix(1.0, facing * facing, coreWeight);
        float fall = pow(clamp(vAlong, 0.0, 1.0), 1.7);
        float drift = 0.8 + 0.2 * sin(vWorld.x * 0.35 + vWorld.z * 0.22 + vWorld.y * 1.3 - uTime * 0.9);
        float nearFade = smoothstep(1.0, 5.0, distance(cameraPosition, vWorld)); // não estoura com a câmera dentro
        gl_FragColor = vec4(color * strength * core * fall * drift * nearFade * (0.15 + 0.85 * uMistAmount), 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
