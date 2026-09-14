// Níveis de dificuldade: combinações de assistências aplicadas ao carro.
// Bater na mureta zera o combo em todos eles.

export const DIFFICULTIES = {
  facil: {
    label: 'FÁCIL',
    description: 'Esterço todo + acelerador entra de lado; o jogo segura o ângulo e endireita quando você solta.',
    car: { angleControl: 1, driftAssist: true, abs: true, tcs: false },
  },
  normal: {
    label: 'NORMAL',
    description: 'Contra-esterço automático e anti-rodada; o ângulo depende de você dosar acelerador e esterço.',
    car: { angleControl: 0, driftAssist: true, abs: true, tcs: false },
  },
  simulacao: {
    label: 'SIMULAÇÃO',
    description: 'Sem assistências. Pede gatilho analógico e contra-esterço na mão.',
    car: { angleControl: 0, driftAssist: false, abs: false, tcs: false },
  },
};

export const DIFFICULTY_ORDER = ['facil', 'normal', 'simulacao'];
const STORAGE_KEY = 'corrida3d.dificuldade';

export function applyDifficulty(car, key) {
  Object.assign(car, DIFFICULTIES[key].car, { driftMode: false });
}

export function loadDifficulty() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved in DIFFICULTIES) return saved;
  } catch { /* sem storage */ }
  return 'facil';
}

export function saveDifficulty(key) {
  try { localStorage.setItem(STORAGE_KEY, key); } catch { /* ignora */ }
}
