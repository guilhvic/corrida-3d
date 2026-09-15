// Narrador em japonês com a voz do próprio sistema (Web Speech API). Sem arquivos de áudio: se o sistema não tiver
// voz japonesa, o narrador fica mudo e a tela de configurações avisa.
// Frases com prioridade: uma mais importante corta a que está falando; uma menos importante é descartada.

const LINES = {
  three: ['スリー'], two: ['ツー'], one: ['ワン'], go: ['ゴー！'],
  niceDrift: ['ナイスドリフト！', 'ナイス！', 'いいね！'],
  greatDrift: ['すごいドリフト！', 'グレイト！', 'ナイスドリフト！'],
  maxCombo: ['マックスコンボ！'],
  gradeSS: ['SS級！'], gradeS: ['S級！'],
  crash: ['あーっ！', 'クラッシュ！'], spin: ['スピン！'],
  bestLap: ['ベストラップ！'], finalLap: ['ファイナルラップ！'],
  finish: ['ゴール！'], win: ['優勝！'], record: ['新記録！'], medal: ['メダル獲得！'],
  welcome: ['{track}へようこそ！'],
};

// Vozes japonesas conhecidas, da mais natural para a mais robótica
const PREFERRED = [/natural/i, /online/i, /nanami/i, /google/i, /haruka/i, /ayumi/i, /kyoko/i, /otoya/i, /ichiro/i];

export class Announcer {
  constructor() {
    this.synth = globalThis.speechSynthesis ?? null;
    this.enabled = true;
    this.volume = 0.9;
    this.voice = null;
    this.speaking = null; // { priority, until }
    this.last = {};       // frase -> quando falou (evita repetir em sequência)
    this.onVoices = null;
    if (!this.synth) return;
    const pick = () => {
      const ja = this.synth.getVoices().filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('ja'));
      ja.sort((a, b) => rank(a) - rank(b));
      this.voice = ja[0] ?? null;
      this.onVoices?.(this.voice);
    };
    const rank = (v) => { const i = PREFERRED.findIndex((re) => re.test(v.name)); return i < 0 ? 99 : i; };
    pick();
    this.synth.addEventListener?.('voiceschanged', pick);
  }

  get available() { return !!this.voice; }

  // key: frase de LINES; priority: 0 enfeite, 1 normal, 2 importante; cooldown: s antes de repetir a mesma frase
  say(key, { priority = 1, cooldown = 2.5, params = null } = {}) {
    if (!this.enabled || !this.voice || this.volume <= 0) return;
    const now = performance.now() / 1000;
    if (now - (this.last[key] ?? -99) < cooldown) return;
    const busy = this.speaking && this.synth.speaking && now < this.speaking.until;
    if (busy && priority <= this.speaking.priority) return;
    if (busy || this.synth.pending) this.synth.cancel();
    const options = LINES[key];
    if (!options) return;
    let text = options[Math.floor(Math.random() * options.length)];
    if (params) text = text.replace(/\{(\w+)\}/g, (m, k) => params[k] ?? m);
    const u = new SpeechSynthesisUtterance(text);
    u.voice = this.voice;
    u.lang = this.voice.lang;
    u.volume = Math.min(1, this.volume);
    u.rate = key === 'three' || key === 'two' || key === 'one' ? 1.25 : 1.12;
    u.pitch = 1.08;
    this.synth.speak(u);
    this.last[key] = now;
    this.speaking = { priority, until: now + 0.25 + text.length * 0.13 };
  }

  stop() {
    this.synth?.cancel();
    this.speaking = null;
  }
}
