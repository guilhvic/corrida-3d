// Configurações gerais (tela CONFIGURAÇÕES): áudio, vídeo e jogo. Salvas no navegador.
// Módulo puro: a tela é montada pelo menu a partir de OPTIONS e o main.js aplica os valores (applyConfig).

const STORAGE_KEY = 'corrida3d.config';

const pct = (v) => `${Math.round(v * 100)}%`;
const volume = (key, label, def) => ({
  key, label, def, values: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1], bar: true,
  format: (v) => (v === 0 ? 'MUDO' : pct(v)),
});
const onOff = (key, label, def) => ({ key, label, def, values: [true, false], format: (v) => (v ? 'LIGADO' : 'DESLIGADO') });

export const CONFIG_GROUPS = [
  { title: 'ÁUDIO', options: [
    volume('master', 'GERAL', 0.8),
    volume('music', 'MÚSICA', 0.6),
    onOff('musicOn', 'TRILHA', true),
    volume('engine', 'MOTOR', 0.8),
    volume('rivals', 'RIVAIS', 0.7),
    volume('effects', 'EFEITOS', 0.8),
  ] },
  { title: 'VÍDEO', options: [
    { key: 'resolution', label: 'RESOLUÇÃO', def: 540, values: [360, 480, 540, 720, 0],
      format: (v) => (v === 0 ? 'NATIVA' : `${v} LINHAS`), hint: (v) => (v === 540 ? 'padrão PS2 tardio' : v === 0 ? 'mais nítido, mais pesado' : v < 540 ? 'mais leve e serrilhado' : 'mais nítido') },
    onOff('crt', 'EFEITO CRT', true),
    onOff('mist', 'NÉVOA', true),
    { key: 'trail', label: 'RASTRO', def: 1, values: [0, 0.5, 1, 1.5], format: (v) => ['DESLIGADO', 'SUAVE', 'NORMAL', 'FORTE'][[0, 0.5, 1, 1.5].indexOf(v)], hint: () => 'borrão de movimento dos quadros anteriores' },
    { key: 'fov', label: 'VISÃO', def: 0, values: [-8, -4, 0, 4, 8, 12], format: (v) => `${62 + v}°`, hint: () => 'campo de visão da câmera' },
    onOff('fps', 'FPS', true),
  ] },
  { title: 'JOGO', options: [
    { key: 'camera', label: 'CÂMERA', def: 0, values: [0, 1, 2], format: (v) => ['PERSEGUIÇÃO', 'DISTANTE', 'CAPÔ'][v], hint: () => 'câmera ao largar (C troca na corrida)' },
    { key: 'gearbox', label: 'CÂMBIO', def: 'auto', values: ['auto', 'manual'], format: (v) => (v === 'auto' ? 'AUTOMÁTICO' : 'MANUAL (Q/E)') },
    { key: 'units', label: 'UNIDADE', def: 'kmh', values: ['kmh', 'mph'], format: (v) => (v === 'kmh' ? 'KM/H' : 'MPH') },
    onOff('rumble', 'VIBRAÇÃO', true),
    onOff('ghost', 'FANTASMA', true),
    onOff('grades', 'NOTAS', true),
    onOff('driftTrail', 'RASTRO DRIFT', true),
    onOff('names', 'NOMES', true),
    onOff('minimap', 'MINIMAPA', true),
  ] },
];

export const CONFIG_OPTIONS = CONFIG_GROUPS.flatMap((g) => g.options);
export const DEFAULT_CONFIG = Object.fromEntries(CONFIG_OPTIONS.map((o) => [o.key, o.def]));

export function loadConfig() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { /* sem storage */ }
  // Chaves antigas das teclas N, V e M/K
  try {
    if (saved.mist === undefined && localStorage.getItem('corrida3d.nevoa') === '0') saved.mist = false;
    if (saved.crt === undefined && localStorage.getItem('corrida3d.crt') === '0') saved.crt = false;
    if (saved.musicOn === undefined && localStorage.getItem('corrida3d.musica') === '0') saved.musicOn = false;
  } catch { /* sem storage */ }
  const cfg = { ...DEFAULT_CONFIG };
  for (const o of CONFIG_OPTIONS) if (o.values.includes(saved[o.key])) cfg[o.key] = saved[o.key];
  return cfg;
}

export function saveConfig(cfg) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch { /* sem storage */ }
}
