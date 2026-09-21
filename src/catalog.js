// Pistas e carros disponíveis no menu.
import { CAR, engineTorque } from './physics.js';
import { buildTrack, FUJIMI_POINTS, HAKONE_POINTS } from './track.js';

// world: qual cenário o main.js monta para a pista (world.js = cidade, worldFujimi.js = interior, worldHakone.js = serra).
export const TRACKS = [
  {
    id: 'wangan',
    name: 'CIRCUITO DO PORTO',
    jp: '湾岸ループ',
    description: 'Quarteirões apertados da zona portuária, à noite. Muretas coladas na rua.',
    world: 'city',
    times: [
      { id: 'noite', name: 'NOITE', jp: '夜', description: 'Asfalto úmido, neon e névoa rasteira.' },
      { id: 'chuva', name: 'NOITE CHUVOSA', jp: '雨の夜', description: 'Chuva forte, asfalto espelhado e menos aderência.' },
    ],
    build: () => Object.assign(buildTrack(), { id: 'wangan' }),
  },
  {
    id: 'fujimi',
    name: 'ESTRADA DE FUJIMI',
    jp: '富士見街道',
    description: 'Interior do Japão no fim de tarde: arrozais, vila, grampo no morro e o Monte Fuji ao fundo.',
    world: 'fujimi',
    times: [
      { id: 'tarde', name: 'FIM DE TARDE', jp: '夕暮れ', description: 'Sol baixo, Fuji rosado e arrozais espelhando o céu.' },
      { id: 'noite', name: 'NOITE', jp: '夜', description: 'Lua sobre o Fuji, lanternas de festival acesas pela vila.' },
      { id: 'manha', name: 'MANHÃ COM NEBLINA', jp: '朝霧', description: 'Neblina densa no vale; o Fuji aparece acima dela.' },
    ],
    build: () => Object.assign(buildTrack(FUJIMI_POINTS), { id: 'fujimi' }),
  },
  {
    id: 'hakone',
    name: 'SERRA DE HAKONE',
    jp: '箱根峠',
    description: 'Descida de serra com sete grampos em sequência, muros de pedra e mata fechada; volta subindo pelo vale.',
    world: 'hakone',
    times: [
      { id: 'neblina', name: 'NEBLINA', jp: '霧', description: 'Céu fechado e neblina subindo do vale: lá embaixo quase não se enxerga.' },
      { id: 'outono', name: 'OUTONO', jp: '紅葉', description: 'Fim de tarde com os bordos vermelhos e o lago aparecendo no vale.' },
      { id: 'noite', name: 'NOITE', jp: '夜', description: 'Só os postes de sódio dos grampos e a névoa azulada.' },
    ],
    build: () => Object.assign(buildTrack(HAKONE_POINTS), { id: 'hakone' }),
  },
];

export const trackById = (id) => TRACKS.find((t) => t.id === id) || TRACKS[0];
export const timeOf = (track, id) => track.times.find((t) => t.id === id) || track.times[0];

// params: acerto próprio de cada carro (o resto vem de CAR). a/b precisam bater com o design do modelo.
export const CARS = [
  {
    id: 'kaze180',
    design: 'kaze180',
    name: 'KAZE 180 TURBO',
    jp: '風180',
    description: 'Coupé fastback anos 90 com faróis escamoteáveis, 2.0 turbo de 4 cilindros. Equilibrado e fácil de segurar de lado.',
    engine: 'i4t',
    params: { a: 1.3, b: 1.4 },
  },
  {
    id: 'seiran',
    design: 'seiran',
    name: 'SEIRAN S15 SPEC-R',
    jp: '晴嵐',
    description: 'Cupê três volumes do fim dos anos 90, faróis fixos repuxados, com swap de 6 em linha turbo. Entre-eixos curto: gira rápido.',
    engine: 'i6t',
    params: { a: 1.25, b: 1.28, mass: 1240, inertia: 1600, torqueScale: 1.1, redline: 8000, upshiftRpm: 7500, finalDrive: 4.25, rearGrip: 0.97 },
  },
  {
    id: 'kaminari86',
    design: 'kaminari86',
    name: 'KAMINARI 86',
    jp: '雷86',
    description: 'Hatch leve de 1983 com faróis escamoteáveis e pintura de dois tons. Motor 1.6 aspirado de alto giro: pouca força, mas gira rápido e entra de lado com pouco.',
    engine: 'i4na',
    params: {
      a: 1.2, b: 1.2, mass: 950, inertia: 1080, cgHeight: 0.44, torqueScale: 0.5, redline: 7800, upshiftRpm: 7400,
      finalDrive: 4.3, rearGrip: 0.95, dragK: 0.38, easyMaxTorque: 23000, stabilityK: 46000,
    },
  },
  {
    id: 'tsubame',
    design: 'tsubame',
    name: 'TSUBAME NA ROADSTER',
    jp: '燕',
    description: 'Roadster leve de cockpit aberto e faróis escamoteáveis, com swap de motor rotativo. Pouca potência, muito equilíbrio: exige manter o embalo.',
    engine: 'rotary',
    params: {
      a: 1.1, b: 1.165, mass: 1010, inertia: 1120, cgHeight: 0.42, torqueScale: 0.62, redline: 7600, upshiftRpm: 7100,
      finalDrive: 4.3, rearGrip: 0.96, dragK: 0.36, maxSteerLow: 0.78, easyMaxTorque: 24000, stabilityK: 48000,
    },
  },
];

export const carById = (id) => CARS.find((c) => c.id === id) || CARS[0];

// Voltas por corrida; 0 = treino livre, sem chegada.
export const LAP_OPTIONS = [1, 2, 3, 5, 10, 0];

// Números da ficha técnica, calculados do acerto atual do carro.
export function carSpecs(car = CARS[0]) {
  const P = Object.assign(Object.create(CAR), car.params);
  let peakTorque = 0, peakPower = 0;
  for (let rpm = 1000; rpm <= P.redline; rpm += 50) {
    const torque = engineTorque(rpm, P);
    peakTorque = Math.max(peakTorque, torque);
    peakPower = Math.max(peakPower, (torque * rpm) / 9549); // kW
  }
  const cv = peakPower * 1.36;
  return {
    power: Math.round(cv),
    torque: Math.round(peakTorque),
    mass: Math.round(P.mass),
    ratio: P.mass / cv,
    gears: P.gears.length,
    frontWeight: P.b / (P.a + P.b),
  };
}
